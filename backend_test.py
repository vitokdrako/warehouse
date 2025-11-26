#!/usr/bin/env python3
"""
Backend Testing Script for Return Workflow with Automatic Task Creation
Testing the complete return workflow as described in the Ukrainian review request.
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://decor-hub-system.preview.emergentagent.com/api"
TEST_ORDER_ID = 6996  # Default test order from review request

class BackendTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
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
    
    def find_active_order(self) -> Dict[str, Any]:
        """Find an active order with status 'issued' or 'on_rent'"""
        try:
            # Try to get the specific test order first
            response = self.session.get(f"{self.base_url}/decor-orders/{TEST_ORDER_ID}")
            if response.status_code == 200:
                order = response.json()
                if order.get('status') in ['issued', 'on_rent']:
                    self.log(f"✅ Found test order {TEST_ORDER_ID} with status '{order.get('status')}'")
                    return order
                else:
                    self.log(f"⚠️ Order {TEST_ORDER_ID} has status '{order.get('status')}', not 'issued' or 'on_rent'")
            
            # If specific order not suitable, search for any active order
            response = self.session.get(f"{self.base_url}/decor-orders?status=issued,on_rent&limit=10")
            if response.status_code == 200:
                data = response.json()
                orders = data.get('orders', [])
                if orders:
                    order = orders[0]
                    self.log(f"✅ Found active order {order.get('id')} with status '{order.get('status')}'")
                    return order
                else:
                    self.log("❌ No active orders found with status 'issued' or 'on_rent'", "ERROR")
                    return {}
            else:
                self.log(f"❌ Failed to fetch orders: {response.status_code}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Exception finding active order: {str(e)}", "ERROR")
            return {}
    
    def test_return_without_damage(self, order_id: int, items: List[Dict]) -> bool:
        """Test return workflow WITHOUT damage - should create 'wash' tasks"""
        try:
            self.log(f"🧪 Testing return WITHOUT damage for order {order_id}")
            
            # Prepare return data without damage
            return_data = {
                "items_returned": [],
                "late_fee": 0,
                "cleaning_fee": 0,
                "damage_fee": 0
            }
            
            # Add items without findings (no damage)
            for item in items[:2]:  # Test with first 2 items
                return_data["items_returned"].append({
                    "sku": item.get('sku', item.get('article', f"TEST-SKU-{item.get('inventory_id', '001')}")),
                    "returned_qty": 1,
                    "findings": []  # No damage
                })
            
            self.log(f"Return data: {json.dumps(return_data, indent=2)}")
            
            # Execute return
            response = self.session.post(
                f"{self.base_url}/decor-orders/{order_id}/complete-return",
                json=return_data
            )
            
            if response.status_code == 200:
                result = response.json()
                self.log(f"✅ Return completed successfully: {result.get('message', 'Success')}")
                return True
            else:
                self.log(f"❌ Return failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in return without damage test: {str(e)}", "ERROR")
            return False
    
    def test_return_with_damage(self, order_id: int, items: List[Dict]) -> bool:
        """Test return workflow WITH damage - should create 'repair' tasks and financial transactions"""
        try:
            self.log(f"🧪 Testing return WITH damage for order {order_id}")
            
            # Prepare return data with damage
            return_data = {
                "items_returned": [],
                "late_fee": 0,
                "cleaning_fee": 0,
                "damage_fee": 500  # Total damage fee
            }
            
            # Add items with findings (damage)
            if items:
                test_sku = items[0].get('sku', items[0].get('article', f"TEST-SKU-{items[0].get('inventory_id', '003')}"))
                return_data["items_returned"].append({
                    "sku": test_sku,
                    "returned_qty": 1,
                    "findings": [
                        {
                            "kind": "scratch",
                            "severity": "medium", 
                            "fee": 500,
                            "note": "Подряпина на поверхні"
                        }
                    ]
                })
            
            self.log(f"Return data with damage: {json.dumps(return_data, indent=2)}")
            
            # Execute return
            response = self.session.post(
                f"{self.base_url}/decor-orders/{order_id}/complete-return",
                json=return_data
            )
            
            if response.status_code == 200:
                result = response.json()
                self.log(f"✅ Return with damage completed: {result.get('message', 'Success')}")
                
                # Check if financial transaction was created
                if result.get('finance_transaction_created'):
                    self.log("✅ Financial transaction created for damage fee")
                
                return True
            else:
                self.log(f"❌ Return with damage failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Exception in return with damage test: {str(e)}", "ERROR")
            return False
    
    def create_test_order(self) -> Dict[str, Any]:
        """Create a test order for testing purposes"""
        try:
            self.log("🧪 Creating test order for damage testing...")
            
            # Create a simple test order
            order_data = {
                "customer_name": "Test Customer",
                "customer_phone": "+380501234567",
                "customer_email": "test@example.com",
                "rental_start_date": "2025-11-26",
                "rental_end_date": "2025-11-27",
                "total_amount": 100.0,
                "deposit_amount": 50.0,
                "notes": "Test order for return workflow testing",
                "items": [
                    {
                        "product_id": 672,  # VA228 - Ваза (8 см)
                        "name": "Ваза (8 см)",
                        "quantity": 1,
                        "price_per_day": 100.0,
                        "total_rental": 100.0
                    }
                ]
            }
            
            response = self.session.post(f"{self.base_url}/orders", json=order_data)
            
            if response.status_code == 200:
                result = response.json()
                order_id = result.get('order_id')
                self.log(f"✅ Test order created: {order_id}")
                
                # Move order to issued status for testing
                status_response = self.session.put(
                    f"{self.base_url}/orders/{order_id}/status",
                    json={"status": "issued"}
                )
                
                if status_response.status_code == 200:
                    self.log(f"✅ Test order {order_id} moved to 'issued' status")
                    
                    # Get the order details
                    order_response = self.session.get(f"{self.base_url}/orders/{order_id}")
                    if order_response.status_code == 200:
                        return order_response.json()
                    
                return {"id": order_id}
            else:
                self.log(f"❌ Failed to create test order: {response.status_code} - {response.text}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Exception creating test order: {str(e)}", "ERROR")
            return {}
    
    def test_cleaning_tasks_endpoint(self) -> Dict[str, Any]:
        """Test the /api/product-cleaning/all endpoint"""
        try:
            self.log("🧪 Testing product cleaning tasks endpoint")
            
            response = self.session.get(f"{self.base_url}/product-cleaning/all")
            
            if response.status_code == 200:
                tasks = response.json()
                self.log(f"✅ Retrieved {len(tasks)} cleaning tasks")
                
                # Analyze tasks
                wash_tasks = [t for t in tasks if t.get('status') == 'wash']
                repair_tasks = [t for t in tasks if t.get('status') == 'repair']
                dry_tasks = [t for t in tasks if t.get('status') == 'dry']
                
                self.log(f"📊 Task breakdown: {len(wash_tasks)} wash, {len(repair_tasks)} repair, {len(dry_tasks)} dry")
                
                # Check if repair tasks have priority (should be first)
                if tasks and repair_tasks:
                    first_task_is_repair = tasks[0].get('status') == 'repair'
                    if first_task_is_repair:
                        self.log("✅ Repair tasks have priority (appear first)")
                    else:
                        self.log("⚠️ Repair tasks don't appear first in the list")
                
                return {
                    'total': len(tasks),
                    'wash': len(wash_tasks),
                    'repair': len(repair_tasks),
                    'dry': len(dry_tasks),
                    'tasks': tasks
                }
            else:
                self.log(f"❌ Failed to get cleaning tasks: {response.status_code} - {response.text}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Exception testing cleaning tasks: {str(e)}", "ERROR")
            return {}
    
    def verify_task_creation(self, expected_skus: List[str], expected_statuses: List[str]) -> bool:
        """Verify that tasks were created for specific SKUs with expected statuses"""
        try:
            self.log("🔍 Verifying task creation...")
            
            tasks_data = self.test_cleaning_tasks_endpoint()
            if not tasks_data:
                return False
            
            tasks = tasks_data.get('tasks', [])
            
            # Check each expected SKU
            verification_results = []
            for i, sku in enumerate(expected_skus):
                expected_status = expected_statuses[i] if i < len(expected_statuses) else 'wash'
                
                # Find task for this SKU
                matching_tasks = [t for t in tasks if t.get('sku') == sku]
                
                if matching_tasks:
                    task = matching_tasks[0]
                    actual_status = task.get('status')
                    if actual_status == expected_status:
                        self.log(f"✅ SKU {sku}: Found task with correct status '{actual_status}'")
                        verification_results.append(True)
                    else:
                        self.log(f"❌ SKU {sku}: Expected status '{expected_status}', got '{actual_status}'", "ERROR")
                        verification_results.append(False)
                else:
                    self.log(f"❌ SKU {sku}: No task found", "ERROR")
                    verification_results.append(False)
            
            return all(verification_results)
            
        except Exception as e:
            self.log(f"❌ Exception verifying task creation: {str(e)}", "ERROR")
            return False
    
    def check_backend_logs(self):
        """Check backend logs for task creation messages"""
        try:
            self.log("📋 Checking backend logs for task creation messages...")
            
            # This would require access to supervisor logs
            # For now, we'll just note that logs should be checked manually
            self.log("ℹ️ Manual check required: Backend logs should show:")
            self.log("   - '🚿 Товар XXX → мийка' for items without damage")
            self.log("   - '🔧 Товар XXX → реставрація' for damaged items")
            
        except Exception as e:
            self.log(f"❌ Exception checking logs: {str(e)}", "ERROR")
    
    def run_comprehensive_test(self):
        """Run the complete test scenario as described in the review request"""
        self.log("🚀 Starting comprehensive return workflow test")
        self.log("=" * 60)
        
        # Step 1: Health check
        if not self.test_api_health():
            self.log("❌ API health check failed, aborting tests", "ERROR")
            return False
        
        # Step 2: Find or create active order
        self.log("\n📋 Step 1: Finding active order...")
        active_order = self.find_active_order()
        
        if not active_order:
            self.log("⚠️ No active orders found, creating test order...")
            active_order = self.create_test_order()
            if not active_order:
                self.log("❌ Could not create test order, aborting tests", "ERROR")
                return False
        
        order_id = active_order.get('id')
        items = active_order.get('items', [])
        
        self.log(f"Using order {order_id} with {len(items)} items")
        
        # Step 3: Test return without damage
        self.log("\n🧪 Step 2: Testing return WITHOUT damage...")
        if not self.test_return_without_damage(order_id, items):
            self.log("❌ Return without damage test failed", "ERROR")
            return False
        
        # Step 4: Check tasks after return without damage
        self.log("\n🔍 Step 3: Checking tasks after return...")
        initial_tasks = self.test_cleaning_tasks_endpoint()
        
        # Step 5: Create test order for damage testing
        self.log("\n📋 Step 4: Creating test order for damage testing...")
        test_order = self.create_test_order()
        
        if test_order and test_order.get('id'):
            damage_order_id = test_order.get('id')
            damage_items = test_order.get('items', [])
            
            self.log(f"Created test order {damage_order_id} for damage test")
            
            # Step 6: Test return with damage
            self.log("\n🧪 Step 5: Testing return WITH damage...")
            if not self.test_return_with_damage(damage_order_id, damage_items):
                self.log("❌ Return with damage test failed", "ERROR")
                return False
            
            # Step 7: Final verification
            self.log("\n🔍 Step 6: Final task verification...")
            final_tasks = self.test_cleaning_tasks_endpoint()
            
        else:
            self.log("⚠️ Could not create test order for damage test")
        
        # Step 8: Check logs
        self.log("\n📋 Step 7: Checking backend logs...")
        self.check_backend_logs()
        
        self.log("\n" + "=" * 60)
        self.log("🎉 Comprehensive test completed!")
        
        return True

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Return Workflow with Automatic Task Creation")
    print("=" * 70)
    
    tester = BackendTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_test()
        
        if success:
            print("\n✅ ALL TESTS COMPLETED")
            print("📊 Summary: Return workflow with automatic task creation tested")
            sys.exit(0)
        else:
            print("\n❌ SOME TESTS FAILED")
            print("📊 Summary: Issues found in return workflow")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()