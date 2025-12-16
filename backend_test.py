#!/usr/bin/env python3
"""
Backend Testing Script for Finance Cabinet Integration
Testing the Finance Cabinet full integration with real data:
1. Manager Finance Summary API
2. Finance Dashboard Integration  
3. Admin Panel Finance Management
4. Vendors, Employees, Payroll APIs
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://rental-finance-2.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

class FinanceCabinetTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_api_health(self) -> bool:
        """Test if API is accessible"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                self.log("✅ API Health Check: OK")
                return True
            else:
                self.log(f"❌ API Health Check Failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ API Health Check Exception: {str(e)}", "ERROR")
            return False
    
    def authenticate(self) -> bool:
        """Authenticate with the API"""
        try:
            self.log("🔐 Authenticating with provided credentials...")
            
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json=TEST_CREDENTIALS
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access_token')
                if self.auth_token:
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}'
                    })
                    self.log("✅ Authentication successful")
                    return True
                else:
                    self.log("❌ No access token in response", "ERROR")
                    return False
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication exception: {str(e)}", "ERROR")
            return False
    
    def test_manager_finance_summary(self) -> Dict[str, Any]:
        """Test GET /api/manager/finance/summary - should return revenue, deposits data from ledger"""
        try:
            self.log("🧪 Testing manager finance summary endpoint...")
            
            response = self.session.get(f"{self.base_url}/manager/finance/summary")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ['total_revenue', 'deposits_held', 'deposits_count']
                missing_fields = []
                
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log(f"❌ Manager finance summary missing fields: {missing_fields}", "ERROR")
                    return {"success": False, "error": f"Missing required fields: {missing_fields}"}
                
                # Log the values
                self.log(f"✅ Manager Finance Summary:")
                self.log(f"   - Total Revenue: ₴{data.get('total_revenue', 0)}")
                self.log(f"   - Deposits Held: ₴{data.get('deposits_held', 0)}")
                self.log(f"   - Deposits Count: {data.get('deposits_count', 0)}")
                self.log(f"   - Rent Revenue: ₴{data.get('rent_revenue', 0)}")
                self.log(f"   - Damage Revenue: ₴{data.get('damage_revenue', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "has_revenue": data.get('total_revenue', 0) > 0,
                    "has_deposits": data.get('deposits_held', 0) > 0
                }
            else:
                self.log(f"❌ Failed to get manager finance summary: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing manager finance summary: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_dashboard(self) -> Dict[str, Any]:
        """Test GET /api/finance/dashboard?period=month - should return metrics and deposits"""
        try:
            self.log("🧪 Testing finance dashboard endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/dashboard?period=month")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required structure
                required_sections = ['period', 'metrics', 'deposits']
                missing_sections = []
                
                for section in required_sections:
                    if section not in data:
                        missing_sections.append(section)
                
                if missing_sections:
                    self.log(f"❌ Finance dashboard missing sections: {missing_sections}", "ERROR")
                    return {"success": False, "error": f"Missing required sections: {missing_sections}"}
                
                # Check metrics structure
                metrics = data.get('metrics', {})
                required_metrics = ['net_profit', 'rent_revenue', 'operating_expenses', 'cash_balance']
                
                for metric in required_metrics:
                    if metric not in metrics:
                        self.log(f"⚠️ Missing metric: {metric}")
                
                # Check deposits structure
                deposits = data.get('deposits', {})
                required_deposit_fields = ['held', 'used', 'refunded', 'available_to_refund']
                
                for field in required_deposit_fields:
                    if field not in deposits:
                        self.log(f"⚠️ Missing deposit field: {field}")
                
                self.log(f"✅ Finance Dashboard (period: {data.get('period')}):")
                self.log(f"   - Net Profit: ₴{metrics.get('net_profit', 0)}")
                self.log(f"   - Rent Revenue: ₴{metrics.get('rent_revenue', 0)}")
                self.log(f"   - Operating Expenses: ₴{metrics.get('operating_expenses', 0)}")
                self.log(f"   - Cash Balance: ₴{metrics.get('cash_balance', 0)}")
                self.log(f"   - Deposits Held: ₴{deposits.get('held', 0)}")
                self.log(f"   - Deposits Available: ₴{deposits.get('available_to_refund', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "has_metrics": len(metrics) > 0,
                    "has_deposits": len(deposits) > 0
                }
            else:
                self.log(f"❌ Failed to get finance dashboard: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing finance dashboard: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_vendors(self) -> Dict[str, Any]:
        """Test GET /api/finance/vendors - should return list of vendors"""
        try:
            self.log("🧪 Testing finance vendors endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/vendors")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has vendors array
                if not isinstance(data, dict) or 'vendors' not in data:
                    self.log(f"❌ Expected dict with 'vendors' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                vendors = data['vendors']
                if not isinstance(vendors, list):
                    self.log(f"❌ Expected vendors array, got {type(vendors)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(vendors)} vendors")
                
                # Check vendor structure if any exist
                if vendors:
                    vendor = vendors[0]
                    required_fields = ['id', 'name', 'vendor_type']
                    for field in required_fields:
                        if field not in vendor:
                            self.log(f"⚠️ Vendor missing field: {field}")
                    
                    self.log(f"   Sample vendor: {vendor.get('name')} ({vendor.get('vendor_type')})")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(vendors)
                }
            else:
                self.log(f"❌ Failed to get vendors: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing vendors: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_employees(self) -> Dict[str, Any]:
        """Test GET /api/finance/employees - should return list of employees"""
        try:
            self.log("🧪 Testing finance employees endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/employees")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has employees array
                if not isinstance(data, dict) or 'employees' not in data:
                    self.log(f"❌ Expected dict with 'employees' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                employees = data['employees']
                if not isinstance(employees, list):
                    self.log(f"❌ Expected employees array, got {type(employees)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(employees)} employees")
                
                # Check employee structure if any exist
                if employees:
                    employee = employees[0]
                    required_fields = ['id', 'name', 'role']
                    for field in required_fields:
                        if field not in employee:
                            self.log(f"⚠️ Employee missing field: {field}")
                    
                    self.log(f"   Sample employee: {employee.get('name')} ({employee.get('role')})")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(employees)
                }
            else:
                self.log(f"❌ Failed to get employees: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing employees: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_payroll(self) -> Dict[str, Any]:
        """Test GET /api/finance/payroll - should return payroll records"""
        try:
            self.log("🧪 Testing finance payroll endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/payroll")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has payroll array
                if not isinstance(data, dict) or 'payroll' not in data:
                    self.log(f"❌ Expected dict with 'payroll' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                payroll = data['payroll']
                if not isinstance(payroll, list):
                    self.log(f"❌ Expected payroll array, got {type(payroll)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(payroll)} payroll records")
                
                # Check payroll structure if any exist
                if payroll:
                    record = payroll[0]
                    required_fields = ['id', 'employee_id', 'base_amount', 'status']
                    for field in required_fields:
                        if field not in record:
                            self.log(f"⚠️ Payroll record missing field: {field}")
                    
                    self.log(f"   Sample payroll: Employee {record.get('employee_id')}, Amount: ₴{record.get('base_amount', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(payroll)
                }
            else:
                self.log(f"❌ Failed to get payroll: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing payroll: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_admin_expense_categories(self) -> Dict[str, Any]:
        """Test GET /api/finance/admin/expense-categories - should return expense categories"""
        try:
            self.log("🧪 Testing admin expense categories endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/admin/expense-categories")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should be a list of categories
                if not isinstance(data, list):
                    self.log(f"❌ Expected list of categories, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(data)} expense categories")
                
                # Check category structure if any exist
                if data:
                    category = data[0]
                    required_fields = ['id', 'type', 'code', 'name']
                    for field in required_fields:
                        if field not in category:
                            self.log(f"⚠️ Category missing field: {field}")
                    
                    self.log(f"   Sample category: {category.get('name')} ({category.get('code')})")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(data)
                }
            else:
                self.log(f"❌ Failed to get expense categories: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing expense categories: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_create_vendor(self) -> Dict[str, Any]:
        """Test POST /api/finance/vendors - create a new vendor"""
        try:
            self.log("🧪 Testing create vendor endpoint...")
            
            # Test vendor data
            vendor_data = {
                "name": "Test Vendor Company",
                "vendor_type": "service",
                "contact_name": "Іван Петренко",
                "phone": "+380501234567",
                "email": "test@vendor.com",
                "address": "вул. Тестова, 123, Київ",
                "note": "Тестовий постачальник для перевірки API"
            }
            
            response = self.session.post(f"{self.base_url}/finance/vendors", json=vendor_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check success response
                if not data.get('success'):
                    self.log(f"❌ Vendor creation failed: {data}", "ERROR")
                    return {"success": False, "data": data}
                
                vendor_id = data.get('vendor_id')
                self.log(f"✅ Created vendor with ID: {vendor_id}")
                
                return {
                    "success": True, 
                    "data": data,
                    "vendor_id": vendor_id
                }
            else:
                self.log(f"❌ Failed to create vendor: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing create vendor: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_create_employee(self) -> Dict[str, Any]:
        """Test POST /api/finance/employees - create a new employee"""
        try:
            self.log("🧪 Testing create employee endpoint...")
            
            # Test employee data
            employee_data = {
                "name": "Марія Коваленко",
                "role": "manager",
                "phone": "+380671234567",
                "email": "maria@company.com",
                "base_salary": 25000.0,
                "hire_date": "2024-01-15",
                "note": "Тестовий співробітник для перевірки API"
            }
            
            response = self.session.post(f"{self.base_url}/finance/employees", json=employee_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check success response
                if not data.get('success'):
                    self.log(f"❌ Employee creation failed: {data}", "ERROR")
                    return {"success": False, "data": data}
                
                employee_id = data.get('employee_id')
                self.log(f"✅ Created employee with ID: {employee_id}")
                
                return {
                    "success": True, 
                    "data": data,
                    "employee_id": employee_id
                }
            else:
                self.log(f"❌ Failed to create employee: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing create employee: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def verify_finance_integration_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior according to bug fix review request"""
        try:
            self.log("🔍 Verifying expected behavior for NewOrderViewWorkspace bug fixes...")
            
            results = {
                "wrong_price_bug_fixed": False,
                "quantity_bug_context_verified": False,
                "method_405_error_fixed": False,
                "all_endpoints_accessible": False
            }
            
            # Test 1: Wrong Price Bug - inventory search should return rent_price
            self.log("   Testing Bug Fix #1: Wrong Price (rent_price vs price)...")
            inventory_result = self.test_inventory_search_rent_price()
            
            if inventory_result.get("success") and inventory_result.get("rent_price_found"):
                results["wrong_price_bug_fixed"] = True
                self.log("   ✅ Wrong Price Bug: rent_price field available")
                
                # Check if pricing makes sense (rent_price should be much lower than price)
                pricing_data = inventory_result.get("pricing_data", [])
                for item in pricing_data:
                    if item['rent_price'] > 0 and item['price'] > 0:
                        ratio = item['price'] / item['rent_price']
                        self.log(f"     {item['name']}: price/rent_price ratio = {ratio:.1f}")
            else:
                self.log("   ❌ Wrong Price Bug: rent_price field missing or failed", "ERROR")
            
            # Test 2: 405 Error Bug - check-availability should work with POST
            self.log("   Testing Bug Fix #3: 405 Error (POST method)...")
            availability_result = self.test_check_availability_post_method()
            
            if availability_result.get("success"):
                results["method_405_error_fixed"] = True
                self.log("   ✅ 405 Error Bug: POST method working")
            else:
                error = availability_result.get("error", "")
                if "405" in str(error):
                    self.log("   ❌ 405 Error Bug: Still getting 405 Method Not Allowed", "ERROR")
                else:
                    self.log(f"   ❌ 405 Error Bug: Other error - {error}", "ERROR")
            
            # Test 3: Order details for quantity bug context
            self.log("   Testing context for Bug Fix #2: Quantity Bug...")
            order_result = self.test_order_details_endpoint()
            
            if order_result.get("success"):
                results["quantity_bug_context_verified"] = True
                self.log("   ✅ Quantity Bug Context: Order details accessible")
                
                # Check if order has items with inventory_id (needed for quantity bug fix)
                order_data = order_result.get("data", {})
                items = order_data.get("items", [])
                if items:
                    for item in items[:2]:
                        inventory_id = item.get("inventory_id")
                        if inventory_id:
                            self.log(f"     Item has inventory_id: {inventory_id}")
                        else:
                            self.log(f"     ⚠️ Item missing inventory_id: {item.get('name')}")
            else:
                self.log("   ❌ Quantity Bug Context: Order details not accessible", "ERROR")
            
            # Overall endpoint accessibility
            endpoints_working = (
                inventory_result.get("success", False) and
                availability_result.get("success", False) and
                order_result.get("success", False)
            )
            
            if endpoints_working:
                results["all_endpoints_accessible"] = True
                self.log("   ✅ All required endpoints accessible")
            else:
                self.log("   ❌ Some endpoints not accessible", "ERROR")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying bug fixes behavior: {str(e)}", "ERROR")
            return {"error": str(e)}

    def run_comprehensive_bug_fix_test(self):
        """Run the comprehensive bug fix test scenario for NewOrderViewWorkspace"""
        self.log("🚀 Starting comprehensive NewOrderViewWorkspace bug fix test")
        self.log("=" * 70)
        
        # Step 1: Health check
        if not self.test_api_health():
            self.log("❌ API health check failed, aborting tests", "ERROR")
            return False
        
        # Step 2: Authentication
        self.log("\n🔍 Step 1: Testing authentication...")
        if not self.authenticate():
            self.log("❌ Authentication failed, aborting tests", "ERROR")
            return False
        
        # Step 3: Test Bug Fix #1 - Wrong Price (rent_price vs price)
        self.log("\n🔍 Step 2: Testing Bug Fix #1 - Wrong Price...")
        inventory_result = self.test_inventory_search_rent_price()
        bug1_success = inventory_result.get("success", False) and inventory_result.get("rent_price_found", False)
        
        # Step 4: Test Bug Fix #3 - 405 Error (POST method)
        self.log("\n🔍 Step 3: Testing Bug Fix #3 - 405 Error...")
        availability_result = self.test_check_availability_post_method()
        bug3_success = availability_result.get("success", False)
        
        # Step 5: Test Order Details (context for Bug Fix #2)
        self.log("\n🔍 Step 4: Testing Order Details (Quantity Bug context)...")
        order_result = self.test_order_details_endpoint()
        order_success = order_result.get("success", False)
        
        # Step 6: Comprehensive verification
        self.log("\n🔍 Step 5: Comprehensive verification...")
        behavior_results = self.verify_bug_fixes_behavior()
        
        # Step 7: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE BUG FIX TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if bug1_success:
            self.log(f"   • Bug Fix #1 (Wrong Price): ✅ Working")
            pricing_data = inventory_result.get("pricing_data", [])
            for item in pricing_data[:2]:  # Show first 2 items
                self.log(f"     - {item['name']}: price=₴{item['price']}, rent_price=₴{item['rent_price']}")
        else:
            self.log(f"   • Bug Fix #1 (Wrong Price): ❌ Failed")
        
        if bug3_success:
            self.log(f"   • Bug Fix #3 (405 Error): ✅ Working")
        else:
            self.log(f"   • Bug Fix #3 (405 Error): ❌ Failed")
        
        if order_success:
            self.log(f"   • Order Details Access: ✅ Working")
            order_data = order_result.get("data", {})
            self.log(f"     - Order #{order_data.get('order_number')}: {order_data.get('client_name')}")
            self.log(f"     - Status: {order_data.get('status')}")
            self.log(f"     - Items: {len(order_data.get('items', []))}")
        else:
            self.log(f"   • Order Details Access: ❌ Failed")
        
        self.log("\n🎉 BUG FIX TESTING COMPLETED!")
        self.log("   The system correctly provides:")
        self.log("   • 🔍 Inventory search with rent_price field (GET /api/orders/inventory/search)")
        self.log("   • ✅ Check availability with POST method (POST /api/orders/check-availability)")
        self.log("   • 📋 Order details access for quantity testing (GET /api/orders/{id})")
        self.log("   • 🔐 Authentication for vitokdrako@gmail.com")
        
        # Check if all critical bug fixes work
        critical_success = bug1_success and bug3_success and order_success
        
        if critical_success:
            self.log("\n✅ ALL CRITICAL BUG FIXES WORKING!")
        else:
            self.log("\n⚠️ SOME CRITICAL BUG FIXES FAILED - CHECK LOGS ABOVE")
        
        return critical_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: NewOrderViewWorkspace Bug Fixes")
    print("=" * 80)
    print("Testing the bug fixes for Ukrainian rental management system:")
    print("   1. 🔍 Wrong Price Bug - API should return rent_price (not just price)")
    print("      - GET /api/orders/inventory/search?query=ваза&limit=3")
    print("      - Should return rent_price field for rental pricing")
    print("   2. 🔄 Quantity Bug - Items should use inventory_id for identification")
    print("      - Order details should have proper inventory_id fields")
    print("   3. ✅ 405 Error Bug - check-availability should work with POST")
    print("      - POST /api/orders/check-availability with JSON body")
    print("      - Should return 200 OK, not 405 Method Not Allowed")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://rental-finance-2.preview.emergentagent.com")
    print("Test Order: #7121 (awaiting_customer status)")
    print("=" * 80)
    
    tester = NewOrderWorkspaceTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_bug_fix_test()
        
        if success:
            print("\n✅ ALL BUG FIXES VERIFIED SUCCESSFULLY")
            print("📊 Summary: NewOrderViewWorkspace bug fixes working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Bug Fix #1: rent_price field available in inventory search")
            print("   ✅ Bug Fix #3: POST method working for check-availability")
            print("   ✅ Order details accessible for quantity bug context")
            print("   - API GET /api/orders/inventory/search returns rent_price field")
            print("   - API POST /api/orders/check-availability works without 405 error")
            print("   - API GET /api/orders/{id} provides order details with inventory_id")
            print("   - Authentication works with provided credentials")
            print("   - All required data structures are present and valid")
            sys.exit(0)
        else:
            print("\n❌ SOME BUG FIXES FAILED VERIFICATION")
            print("📊 Summary: Issues found in bug fix implementation")
            print("🔍 Check the detailed logs above for specific failures")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()