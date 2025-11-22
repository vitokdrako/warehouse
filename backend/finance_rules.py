"""
Financial calculation rules and policies
"""
from datetime import datetime, timedelta
from typing import List, Dict

# Policies
MIN_ORDER_AMOUNT = 2000  # UAH
RUSH_FEE_PERCENT = 0.30  # 30% for orders within 24 hours
OUT_OF_HOURS_FEE = 1500  # UAH for service outside business hours
DEPOSIT_RATE = 0.5  # 50% of replacement cost

# Business hours
BUSINESS_START_HOUR = 10
BUSINESS_END_HOUR = 17
BUSINESS_DAYS = [0, 1, 2, 3, 4]  # Monday to Friday

def is_business_hours(dt: datetime) -> bool:
    """Check if datetime is within business hours (Mon-Fri 10:00-17:00)"""
    return (
        dt.weekday() in BUSINESS_DAYS and
        BUSINESS_START_HOUR <= dt.hour < BUSINESS_END_HOUR
    )

def is_weekend(dt: datetime) -> bool:
    """Check if datetime is on weekend"""
    return dt.weekday() in [5, 6]  # Saturday, Sunday

def calculate_rental_days(issue_date: str, return_date: str, return_time: str = "17:00") -> int:
    """
    Calculate rental days based on policy:
    - Base: 24 hours = 1 day
    - If return after 17:00 → +1 day
    - Weekend returns count as separate days
    """
    issue_dt = datetime.fromisoformat(issue_date)
    return_dt = datetime.fromisoformat(return_date)
    
    # Check if return time is after 17:00
    return_hour = int(return_time.split(':')[0]) if return_time else 17
    
    # Calculate base days
    days_diff = (return_dt - issue_dt).days
    
    # If return after 17:00, add 1 day
    if return_hour >= 17:
        days_diff += 1
    
    # Minimum 1 day
    return max(1, days_diff)

def calculate_min_order_fee(rent_subtotal: float) -> float:
    """
    Calculate minimum order fee
    If rent_subtotal < 2000 UAH → charge difference
    """
    if rent_subtotal < MIN_ORDER_AMOUNT:
        return MIN_ORDER_AMOUNT - rent_subtotal
    return 0.0

def calculate_rush_fee(rent_subtotal: float, created_at: datetime, issue_date: str) -> float:
    """
    Calculate rush fee for orders placed within 24 hours
    Only applies during business hours Mon-Fri 10:00-18:00
    """
    issue_dt = datetime.fromisoformat(issue_date)
    hours_to_issue = (issue_dt - created_at).total_seconds() / 3600
    
    # Check if within business hours
    if not is_business_hours(created_at):
        return 0.0
    
    # If less than 24 hours to issue → +30%
    if hours_to_issue < 24:
        return rent_subtotal * RUSH_FEE_PERCENT
    
    return 0.0

def calculate_out_of_hours_fee(issue_dt: datetime = None, return_dt: datetime = None) -> float:
    """
    Calculate out-of-hours fee (1500 UAH)
    Applied when issue or return happens outside business hours or on weekend
    """
    fee = 0.0
    
    # Check issue time
    if issue_dt and (not is_business_hours(issue_dt) or is_weekend(issue_dt)):
        fee += OUT_OF_HOURS_FEE
    
    # Check return time
    if return_dt and (not is_business_hours(return_dt) or is_weekend(return_dt)):
        fee += OUT_OF_HOURS_FEE
    
    return fee

def calculate_late_fee(
    planned_return_date: str, 
    actual_return_date: str,
    daily_rate: float,
    return_time: str = "17:00"
) -> Dict[str, float]:
    """
    Calculate late return fee
    - After 17:00 or wrong day → charge additional days
    """
    planned_dt = datetime.fromisoformat(planned_return_date)
    actual_dt = datetime.fromisoformat(actual_return_date)
    
    # Parse return time
    return_hour = int(return_time.split(':')[0]) if return_time else 17
    
    # Set planned return deadline (17:00 on return date)
    planned_deadline = planned_dt.replace(hour=17, minute=0, second=0)
    
    late_days = 0
    
    # Check if returned late
    if actual_dt > planned_deadline:
        # Calculate extra days
        extra_seconds = (actual_dt - planned_deadline).total_seconds()
        late_days = int(extra_seconds / (24 * 3600)) + 1
    
    # If actual return is after 17:00 on the return date
    if actual_dt.date() == planned_dt.date() and actual_dt.hour >= 17:
        late_days = 1
    
    late_fee = late_days * daily_rate
    
    return {
        "late_days": late_days,
        "late_fee": late_fee,
        "daily_rate": daily_rate
    }

def calculate_deposit(items: List[Dict]) -> float:
    """
    Calculate deposit amount based on EAN field
    
    Formula: (Quantity × EAN) / 2
    
    Where:
    - EAN = збиток (damage/replacement cost) per item
    - Quantity = кількість товару
    - Final deposit = Sum of all items / 2
    """
    total_damage_cost = 0.0
    
    for item in items:
        # EAN містить збиток (вартість відшкодування) товару
        ean_value = item.get('ean', 0) or item.get('EAN', 0)
        quantity = item.get('quantity', 1)
        
        # Розраховуємо збиток для цього товару
        item_damage_cost = float(ean_value) * quantity
        total_damage_cost += item_damage_cost
    
    # Застава = половина загального збитку
    deposit = total_damage_cost / 2
    
    return deposit

def calculate_order_financials(order_data: Dict, created_at: datetime = None) -> Dict:
    """
    Calculate all financial aspects of an order
    Returns complete breakdown with all fees and charges
    """
    if not created_at:
        created_at = datetime.utcnow()
    
    items = order_data.get('items', [])
    issue_date = order_data.get('issue_date')
    return_date = order_data.get('return_date')
    rental_days = calculate_rental_days(issue_date, return_date)
    
    # Calculate base rental
    rent_subtotal = 0.0
    for item in items:
        item_rental = item.get('price_per_day', 0) * item.get('quantity', 1) * rental_days
        rent_subtotal += item_rental
    
    # Apply discount
    discount_percent = order_data.get('discount_percent', 0)
    discount = rent_subtotal * (discount_percent / 100)
    rent_total = rent_subtotal - discount
    
    # Calculate fees
    min_order_fee = calculate_min_order_fee(rent_subtotal)
    rush_fee = calculate_rush_fee(rent_subtotal, created_at, issue_date)
    
    # Services total
    services_total = order_data.get('delivery_fee', 0) + order_data.get('setup_fee', 0)
    
    # Deposit
    deposit_total = calculate_deposit(items)
    
    # Calculate total to pay at order creation
    subtotal = rent_total + min_order_fee + rush_fee + services_total
    prepaid = order_data.get('prepaid', 0)
    to_pay = subtotal + deposit_total - prepaid
    
    return {
        "rent_subtotal": rent_subtotal,
        "discount": discount,
        "discount_percent": discount_percent,
        "rent_total": rent_total,
        "rental_days": rental_days,
        
        # Fees
        "min_order_fee": min_order_fee,
        "rush_fee": rush_fee,
        "out_of_hours_fee": 0.0,  # Calculated at actual issue/return
        
        # Services
        "services_total": services_total,
        
        # Penalties (from damages)
        "late_fees": 0.0,
        "cleaning_fees": 0.0,
        "repair_fees": 0.0,
        "penalties_total": 0.0,
        
        # Deposit
        "deposit_hold": deposit_total,
        "deposit_withheld": 0.0,
        "deposit_released": 0.0,
        
        # Totals
        "subtotal": subtotal,
        "total_deposit": deposit_total,
        "prepaid": prepaid,
        "to_pay": to_pay,
        
        # Status
        "finance_status": "awaiting_prepayment" if to_pay > 0 else "paid_rent"
    }

def get_deposit_to_return(
    deposit_held: float,
    damages_total: float,
    late_fees: float,
    cleaning_fees: float,
    unpaid_balance: float
) -> Dict[str, float]:
    """
    Calculate deposit return after all deductions
    """
    total_withhold = damages_total + late_fees + cleaning_fees + min(unpaid_balance, deposit_held)
    
    # Can't withhold more than deposit
    total_withhold = min(total_withhold, deposit_held)
    
    to_return = deposit_held - total_withhold
    
    return {
        "deposit_held": deposit_held,
        "damages_total": damages_total,
        "late_fees": late_fees,
        "cleaning_fees": cleaning_fees,
        "unpaid_balance": unpaid_balance,
        "total_withheld": total_withhold,
        "to_return": to_return,
        "remaining_balance": max(0, damages_total + late_fees + cleaning_fees + unpaid_balance - deposit_held)
    }
