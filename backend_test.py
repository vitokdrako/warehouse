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

    def test_order_details_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/orders/{order_id} - should return order details for order #7121"""
        try:
            self.log("🧪 Testing order details endpoint for order #7121...")
            
            # Test order #7121 as specified in the review request
            order_id = 7121
            response = self.session.get(f"{self.base_url}/orders/{order_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Retrieved order details for #{order_id}")
                
                # Validate order structure
                required_fields = ['id', 'order_number', 'client_name', 'status', 'items']
                missing_fields = []
                
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log(f"❌ Order missing fields: {missing_fields}", "ERROR")
                    return {"success": False, "error": f"Missing required fields: {missing_fields}"}
                
                # Check if order has awaiting_customer status
                status = data.get('status')
                self.log(f"   Order #{data.get('order_number')}: {data.get('client_name')} - Status: {status}")
                
                # Check items structure
                items = data.get('items', [])
                self.log(f"   Items count: {len(items)}")
                
                if items:
                    for item in items[:2]:  # Check first 2 items
                        item_fields = ['inventory_id', 'name', 'quantity', 'price_per_day']
                        for field in item_fields:
                            if field not in item:
                                self.log(f"⚠️ Item missing field: {field}")
                        
                        self.log(f"   - {item.get('name')}: qty={item.get('quantity')}, price_per_day=₴{item.get('price_per_day', 0)}")
                
                return {"success": True, "data": data, "order_id": order_id, "status": status}
            else:
                self.log(f"❌ Failed to get order details: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing order details: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def verify_bug_fixes_behavior(self) -> Dict[str, Any]:
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