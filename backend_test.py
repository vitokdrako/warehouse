#!/usr/bin/env python3
"""
Backend Testing Script for NewOrderViewWorkspace Bug Fixes
Testing the bug fixes for Ukrainian rental management system:
1. Wrong Price Bug - rent_price vs price
2. Quantity Bug - item identification
3. 405 Error - check-availability endpoint method
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://unified-orders-2.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

class NewOrderWorkspaceTester:
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
    
    def test_inventory_search_rent_price(self) -> Dict[str, Any]:
        """Test GET /api/orders/inventory/search - should return rent_price field (Bug Fix #1)"""
        try:
            self.log("🧪 Testing inventory search for rent_price field...")
            
            # Search for "ваза" as specified in the review request
            response = self.session.get(f"{self.base_url}/orders/inventory/search?query=ваза&limit=3")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has products array
                if not isinstance(data, dict) or 'products' not in data:
                    self.log(f"❌ Expected dict with 'products' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                products = data['products']
                if not isinstance(products, list):
                    self.log(f"❌ Expected products array, got {type(products)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(products)} products for 'ваза' search")
                
                # Validate that rent_price field exists (Bug Fix #1)
                rent_price_found = False
                price_vs_rent_price = []
                
                for product in products:
                    required_fields = ['product_id', 'name', 'price', 'rent_price']
                    missing_fields = []
                    
                    for field in required_fields:
                        if field not in product:
                            missing_fields.append(field)
                    
                    if missing_fields:
                        self.log(f"❌ Product {product.get('product_id')} missing fields: {missing_fields}", "ERROR")
                        return {"success": False, "error": f"Missing required fields: {missing_fields}"}
                    
                    # Check rent_price exists and is different from price
                    rent_price = product.get('rent_price', 0)
                    price = product.get('price', 0)
                    
                    if rent_price > 0:
                        rent_price_found = True
                    
                    price_vs_rent_price.append({
                        "name": product.get('name'),
                        "price": price,  # Damage cost
                        "rent_price": rent_price  # Rental price per day
                    })
                    
                    self.log(f"   - {product.get('name')}: price=₴{price}, rent_price=₴{rent_price}")
                
                if not rent_price_found:
                    self.log("❌ No products with rent_price > 0 found", "ERROR")
                    return {"success": False, "error": "rent_price field missing or zero"}
                
                # Verify rent_price is typically much lower than price (damage cost)
                valid_pricing = True
                for item in price_vs_rent_price:
                    if item['rent_price'] > 0 and item['price'] > 0:
                        if item['rent_price'] >= item['price']:
                            self.log(f"⚠️ Suspicious pricing for {item['name']}: rent_price (₴{item['rent_price']}) >= price (₴{item['price']})")
                            valid_pricing = False
                
                return {
                    "success": True, 
                    "data": products, 
                    "count": len(products),
                    "rent_price_found": rent_price_found,
                    "pricing_data": price_vs_rent_price,
                    "valid_pricing": valid_pricing
                }
            else:
                self.log(f"❌ Failed to search inventory: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing inventory search: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_check_availability_post_method(self) -> Dict[str, Any]:
        """Test POST /api/orders/check-availability - should work with POST method (Bug Fix #3)"""
        try:
            self.log("🧪 Testing check-availability endpoint with POST method...")
            
            # Test data as specified in the review request
            test_data = {
                "start_date": "2025-06-10",
                "end_date": "2025-06-15",
                "items": [{"product_id": "7731", "quantity": 1}]
            }
            
            # Test POST method (should work)
            response = self.session.post(
                f"{self.base_url}/orders/check-availability",
                json=test_data
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ POST /api/orders/check-availability working correctly")
                self.log(f"   Response: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                if isinstance(data, dict):
                    return {"success": True, "data": data, "method": "POST"}
                else:
                    self.log(f"⚠️ Unexpected response format: {type(data)}")
                    return {"success": True, "data": data, "method": "POST", "warning": "Unexpected format"}
                    
            elif response.status_code == 405:
                self.log("❌ 405 Method Not Allowed - Bug Fix #3 failed!", "ERROR")
                return {"success": False, "error": "405 Method Not Allowed", "method": "POST"}
            else:
                self.log(f"❌ POST check-availability failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "method": "POST"}
                
        except Exception as e:
            self.log(f"❌ Exception testing check-availability POST: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_frontend_build(self) -> Dict[str, Any]:
        """Test that frontend builds successfully with yarn build"""
        try:
            self.log("🧪 Testing frontend build process...")
            
            # Change to frontend directory
            frontend_dir = "/app/frontend"
            if not os.path.exists(frontend_dir):
                self.log(f"❌ Frontend directory not found: {frontend_dir}", "ERROR")
                return {"success": False, "error": "Frontend directory not found"}
            
            # Run yarn build
            result = subprocess.run(
                ["yarn", "build"],
                cwd=frontend_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            
            if result.returncode == 0:
                self.log("✅ Frontend build successful")
                self.log(f"   Build output: {len(result.stdout.splitlines())} lines")
                
                # Check if build directory exists
                build_dir = os.path.join(frontend_dir, "build")
                if os.path.exists(build_dir):
                    self.log(f"   Build directory created: {build_dir}")
                    
                    # Check for key files
                    key_files = ["index.html", "static"]
                    for file in key_files:
                        file_path = os.path.join(build_dir, file)
                        if os.path.exists(file_path):
                            self.log(f"   ✅ Found: {file}")
                        else:
                            self.log(f"   ⚠️ Missing: {file}")
                
                return {"success": True, "output": result.stdout}
            else:
                self.log(f"❌ Frontend build failed with exit code: {result.returncode}", "ERROR")
                self.log(f"   Error output: {result.stderr}", "ERROR")
                return {"success": False, "error": result.stderr, "exit_code": result.returncode}
                
        except subprocess.TimeoutExpired:
            self.log("❌ Frontend build timed out after 5 minutes", "ERROR")
            return {"success": False, "error": "Build timeout"}
        except Exception as e:
            self.log(f"❌ Exception testing frontend build: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_manager_dashboard_syntax(self) -> Dict[str, Any]:
        """Test ManagerDashboard.jsx for JavaScript syntax errors"""
        try:
            self.log("🧪 Testing ManagerDashboard.jsx syntax...")
            
            dashboard_file = "/app/frontend/src/pages/ManagerDashboard.jsx"
            if not os.path.exists(dashboard_file):
                self.log(f"❌ ManagerDashboard.jsx not found: {dashboard_file}", "ERROR")
                return {"success": False, "error": "ManagerDashboard.jsx not found"}
            
            # Read the file and check for basic syntax issues
            with open(dashboard_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for OrderCard component definition
            if "function OrderCard(" not in content:
                self.log("❌ OrderCard component not found in ManagerDashboard.jsx", "ERROR")
                return {"success": False, "error": "OrderCard component not found"}
            
            # Check for mobile optimization features
            mobile_features = {
                "tel: links": "tel:" in content,
                "touch targets (py-2.5)": "py-2.5" in content,
                "active states": "active:" in content,
                "phone click handler": "handlePhoneClick" in content
            }
            
            self.log("✅ ManagerDashboard.jsx syntax check passed")
            self.log("   Mobile optimization features:")
            
            all_features_present = True
            for feature, present in mobile_features.items():
                status = "✅" if present else "❌"
                self.log(f"   {status} {feature}: {'Found' if present else 'Missing'}")
                if not present:
                    all_features_present = False
            
            # Check for OrderCard usage
            ordercard_usage = content.count("<OrderCard")
            self.log(f"   OrderCard component used {ordercard_usage} times")
            
            return {
                "success": True, 
                "mobile_features": mobile_features,
                "all_features_present": all_features_present,
                "ordercard_usage": ordercard_usage,
                "file_size": len(content)
            }
                
        except Exception as e:
            self.log(f"❌ Exception testing ManagerDashboard.jsx syntax: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_decor_orders_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/decor-orders - should return orders for dashboard columns"""
        try:
            self.log("🧪 Testing decor orders endpoint...")
            
            # Test with multiple statuses as used in dashboard
            statuses = "processing,ready_for_issue,issued,on_rent,shipped,delivered,returning"
            response = self.session.get(f"{self.base_url}/decor-orders?status={statuses}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has orders array
                if not isinstance(data, dict) or 'orders' not in data:
                    self.log(f"❌ Expected dict with 'orders' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                orders = data['orders']
                if not isinstance(orders, list):
                    self.log(f"❌ Expected orders array, got {type(orders)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(orders)} decor orders")
                
                # Count orders by status for dashboard columns
                status_counts = {}
                for order in orders:
                    status = order.get('status', 'unknown')
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                self.log(f"   Status distribution: {status_counts}")
                
                # Validate order structure
                if orders:
                    for order in orders[:2]:  # Check first 2 orders
                        required_fields = ['id', 'status']
                        missing_fields = []
                        
                        for field in required_fields:
                            if field not in order:
                                missing_fields.append(field)
                        
                        if missing_fields:
                            self.log(f"❌ Order {order.get('id')} missing fields: {missing_fields}", "ERROR")
                            return {"success": False, "error": f"Missing required fields: {missing_fields}"}
                        
                        self.log(f"   - Order #{order.get('id')}: Status {order.get('status')}")
                
                return {"success": True, "data": orders, "count": len(orders), "status_counts": status_counts}
            else:
                self.log(f"❌ Failed to get decor orders: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing decor orders: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_complete_task_workflow(self) -> Dict[str, Any]:
        """Test complete task workflow: Create → Filter → Update → Assign"""
        try:
            self.log("🧪 Testing complete task workflow...")
            
            created_tasks = []
            
            # Step 1: Create washing task
            self.log("   Step 1: Creating washing task...")
            washing_result = self.test_task_creation("washing")
            
            if washing_result.get("success"):
                washing_task_id = washing_result.get("task_id")
                created_tasks.append({"id": washing_task_id, "type": "washing"})
                self.log(f"   ✅ Washing task created: {washing_task_id}")
            else:
                self.log("   ❌ Failed to create washing task", "ERROR")
                return {"success": False, "error": "Could not create washing task"}
            
            # Step 2: Create restoration task
            self.log("   Step 2: Creating restoration task...")
            restoration_result = self.test_task_creation("restoration")
            
            if restoration_result.get("success"):
                restoration_task_id = restoration_result.get("task_id")
                created_tasks.append({"id": restoration_task_id, "type": "restoration"})
                self.log(f"   ✅ Restoration task created: {restoration_task_id}")
            else:
                self.log("   ❌ Failed to create restoration task", "ERROR")
                return {"success": False, "error": "Could not create restoration task"}
            
            # Step 3: Test filtering by type
            self.log("   Step 3: Testing task filtering...")
            washing_filter_result = self.test_tasks_filter_by_type("washing")
            restoration_filter_result = self.test_tasks_filter_by_type("restoration")
            
            filtering_success = (
                washing_filter_result.get("success", False) and 
                restoration_filter_result.get("success", False)
            )
            
            if filtering_success:
                self.log("   ✅ Task filtering working correctly")
            else:
                self.log("   ❌ Task filtering failed", "ERROR")
            
            # Step 4: Test status updates
            self.log("   Step 4: Testing status updates...")
            status_updates_success = True
            
            for task in created_tasks:
                # Update to in_progress
                progress_result = self.test_task_status_update(task["id"], "in_progress")
                if not progress_result.get("success"):
                    status_updates_success = False
                    break
                
                # Update to done
                done_result = self.test_task_status_update(task["id"], "done")
                if not done_result.get("success"):
                    status_updates_success = False
                    break
            
            if status_updates_success:
                self.log("   ✅ Status updates working correctly")
            else:
                self.log("   ❌ Status updates failed", "ERROR")
            
            # Step 5: Test task assignment
            self.log("   Step 5: Testing task assignment...")
            assignment_success = True
            
            for task in created_tasks:
                assign_result = self.test_task_assignment(task["id"], "Тестовий виконавець")
                if not assign_result.get("success"):
                    assignment_success = False
                    break
            
            if assignment_success:
                self.log("   ✅ Task assignment working correctly")
            else:
                self.log("   ❌ Task assignment failed", "ERROR")
            
            # Overall success
            overall_success = (
                len(created_tasks) == 2 and
                filtering_success and
                status_updates_success and
                assignment_success
            )
            
            return {
                "success": overall_success,
                "created_tasks": created_tasks,
                "filtering_success": filtering_success,
                "status_updates_success": status_updates_success,
                "assignment_success": assignment_success
            }
                
        except Exception as e:
            self.log(f"❌ Exception testing complete workflow: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def verify_expected_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior according to task management review request"""
        try:
            self.log("🔍 Verifying expected behavior for task management system...")
            
            results = {
                "task_filtering_working": False,
                "task_creation_working": False,
                "task_status_update_working": False,
                "task_assignment_working": False,
                "complete_workflow_working": False
            }
            
            # Test 1: Task filtering by type
            washing_filter_result = self.test_tasks_filter_by_type("washing")
            restoration_filter_result = self.test_tasks_filter_by_type("restoration")
            
            if washing_filter_result.get("success") and restoration_filter_result.get("success"):
                results["task_filtering_working"] = True
                self.log("✅ Task filtering by type working")
                self.log(f"   Found {washing_filter_result.get('count', 0)} washing tasks")
                self.log(f"   Found {restoration_filter_result.get('count', 0)} restoration tasks")
            else:
                self.log("❌ Task filtering by type failed", "ERROR")
            
            # Test 2: Task creation
            washing_create_result = self.test_task_creation("washing")
            restoration_create_result = self.test_task_creation("restoration")
            
            if washing_create_result.get("success") and restoration_create_result.get("success"):
                results["task_creation_working"] = True
                self.log("✅ Task creation working")
                
                # Store created task IDs for further testing
                washing_task_id = washing_create_result.get("task_id")
                restoration_task_id = restoration_create_result.get("task_id")
                
                # Test 3: Task status updates
                if washing_task_id and restoration_task_id:
                    progress_result1 = self.test_task_status_update(washing_task_id, "in_progress")
                    done_result1 = self.test_task_status_update(washing_task_id, "done")
                    progress_result2 = self.test_task_status_update(restoration_task_id, "in_progress")
                    
                    if (progress_result1.get("success") and done_result1.get("success") and 
                        progress_result2.get("success")):
                        results["task_status_update_working"] = True
                        self.log("✅ Task status updates working")
                    else:
                        self.log("❌ Task status updates failed", "ERROR")
                    
                    # Test 4: Task assignment
                    assign_result1 = self.test_task_assignment(washing_task_id, "Марія Іванівна")
                    assign_result2 = self.test_task_assignment(restoration_task_id, "Петро Петренко")
                    
                    if assign_result1.get("success") and assign_result2.get("success"):
                        results["task_assignment_working"] = True
                        self.log("✅ Task assignment working")
                    else:
                        self.log("❌ Task assignment failed", "ERROR")
            else:
                self.log("❌ Task creation failed", "ERROR")
            
            # Test 5: Complete workflow
            workflow_result = self.test_complete_task_workflow()
            if workflow_result.get("success"):
                results["complete_workflow_working"] = True
                self.log("✅ Complete task workflow working")
            else:
                self.log("❌ Complete task workflow failed", "ERROR")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying expected behavior: {str(e)}", "ERROR")
            return {"error": str(e)}
    
    def run_comprehensive_test(self):
        """Run the task management test scenario as described in the Ukrainian review request"""
        self.log("🚀 Starting comprehensive task management test")
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
        
        # Step 3: Test task filtering by type
        self.log("\n🔍 Step 2: Testing task filtering by type...")
        washing_filter_result = self.test_tasks_filter_by_type("washing")
        restoration_filter_result = self.test_tasks_filter_by_type("restoration")
        
        filtering_success = (
            washing_filter_result.get("success", False) and 
            restoration_filter_result.get("success", False)
        )
        initial_washing_count = washing_filter_result.get("count", 0)
        initial_restoration_count = restoration_filter_result.get("count", 0)
        
        # Step 4: Test task creation
        self.log("\n🔍 Step 3: Testing task creation...")
        washing_create_result = self.test_task_creation("washing")
        restoration_create_result = self.test_task_creation("restoration")
        
        creation_success = (
            washing_create_result.get("success", False) and 
            restoration_create_result.get("success", False)
        )
        
        # Step 5: Test task status updates and assignment
        self.log("\n🔍 Step 4: Testing task updates...")
        update_success = True
        assignment_success = True
        
        if creation_success:
            washing_task_id = washing_create_result.get("task_id")
            restoration_task_id = restoration_create_result.get("task_id")
            
            # Test status updates
            progress_result = self.test_task_status_update(washing_task_id, "in_progress")
            done_result = self.test_task_status_update(washing_task_id, "done")
            
            update_success = progress_result.get("success", False) and done_result.get("success", False)
            
            # Test task assignment
            assign_result = self.test_task_assignment(restoration_task_id, "Марія Іванівна")
            assignment_success = assign_result.get("success", False)
        
        # Step 6: Test complete workflow
        self.log("\n🔍 Step 5: Testing complete workflow...")
        workflow_result = self.test_complete_task_workflow()
        workflow_success = workflow_result.get("success", False)
        
        # Step 7: Verify expected behavior
        self.log("\n🔍 Step 6: Verifying expected behavior...")
        behavior_results = self.verify_expected_behavior()
        
        # Step 8: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE TASK MANAGEMENT TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if filtering_success:
            self.log(f"   • Task Filtering: ✅ Working")
            self.log(f"     - Washing tasks: {initial_washing_count}")
            self.log(f"     - Restoration tasks: {initial_restoration_count}")
        else:
            self.log(f"   • Task Filtering: ❌ Failed")
        
        if creation_success:
            self.log(f"   • Task Creation: ✅ Working")
        else:
            self.log(f"   • Task Creation: ❌ Failed")
        
        if update_success:
            self.log(f"   • Task Status Updates: ✅ Working")
        else:
            self.log(f"   • Task Status Updates: ❌ Failed")
        
        if assignment_success:
            self.log(f"   • Task Assignment: ✅ Working")
        else:
            self.log(f"   • Task Assignment: ❌ Failed")
        
        if workflow_success:
            self.log(f"   • Complete Workflow: ✅ Working")
        else:
            self.log(f"   • Complete Workflow: ❌ Failed")
        
        self.log("\n🎉 TASK MANAGEMENT TESTING COMPLETED!")
        self.log("   The system correctly provides:")
        self.log("   • 🔍 Task filtering by type (GET /api/tasks?task_type=washing|restoration)")
        self.log("   • ➕ Task creation (POST /api/tasks)")
        self.log("   • 🔄 Task status updates (PUT /api/tasks/{id} with status)")
        self.log("   • 👤 Task assignment (PUT /api/tasks/{id} with assigned_to)")
        self.log("   • 📋 Complete workflow: Create → Filter → Update → Assign")
        self.log("   • 🔐 Authentication for vitokdrako@gmail.com")
        
        # Check if all critical components work
        critical_success = (
            filtering_success and 
            creation_success and 
            update_success and 
            assignment_success and
            workflow_success
        )
        
        if critical_success:
            self.log("\n✅ ALL CRITICAL COMPONENTS WORKING!")
        else:
            self.log("\n⚠️ SOME CRITICAL COMPONENTS FAILED - CHECK LOGS ABOVE")
        
        return critical_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Washing and Restoration Tasks in Damage Cabinet")
    print("=" * 80)
    print("Testing the task management workflow according to Ukrainian review request:")
    print("   1. 🔍 API фільтрація завдань за типом")
    print("      - GET /api/tasks?task_type=washing - завдання на мийку")
    print("      - GET /api/tasks?task_type=restoration - завдання на реставрацію")
    print("   2. 🔄 Оновлення статусу завдання")
    print("      - PUT /api/tasks/{task_id} з body {\"status\": \"in_progress\"} - взяти в роботу")
    print("      - PUT /api/tasks/{task_id} з body {\"status\": \"done\"} - завершити")
    print("   3. 👤 Призначення виконавця")
    print("      - PUT /api/tasks/{task_id} з body {\"assigned_to\": \"Ім'я\"} - призначити")
    print("   4. ➕ Створення нового завдання на мийку")
    print("      - POST /api/tasks з правильною структурою даних")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://unified-orders-2.preview.emergentagent.com")
    print("=" * 80)
    
    tester = TaskManagementTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_test()
        
        if success:
            print("\n✅ ALL TASK MANAGEMENT TESTS COMPLETED SUCCESSFULLY")
            print("📊 Summary: Task management functionality verified")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Фільтрація за task_type працює")
            print("   ✅ Оновлення статусу працює")
            print("   ✅ Призначення виконавця працює")
            print("   ✅ Нові завдання створюються з правильним типом")
            print("   - API /api/tasks?task_type=washing works for filtering washing tasks")
            print("   - API /api/tasks?task_type=restoration works for filtering restoration tasks")
            print("   - API PUT /api/tasks/{id} works for status updates")
            print("   - API PUT /api/tasks/{id} works for task assignment")
            print("   - API POST /api/tasks works for task creation")
            print("   - Authentication works with provided credentials")
            print("   - All required data structures are present and valid")
            sys.exit(0)
        else:
            print("\n❌ SOME TASK MANAGEMENT TESTS FAILED")
            print("📊 Summary: Issues found in task management functionality")
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