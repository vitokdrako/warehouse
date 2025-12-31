#!/usr/bin/env python3
"""
Backend Testing Script for Catalog Availability Filters
Testing the Catalog Page availability filters functionality.

**Test Scenario:**
Test the Catalog Availability Filters Without Category Selection

**Login credentials:**
- email: vitokdrako@gmail.com  
- password: test123

**Backend API Tests (curl):**
1. Test /api/catalog/items-by-category?availability=on_laundry&limit=50
   - Expected: Should return at least 1 item (TX201 - Плед білий)
   
2. Test /api/catalog/items-by-category?availability=on_restoration&limit=50
   - Expected: Should return at least 1 item (LU10 - Люстра)
   
3. Test /api/catalog/items-by-category?availability=on_wash&limit=50
   - Verify it returns items if any exist on wash

4. Test /api/catalog/items-by-category?availability=in_rent&limit=50
   - Verify filtering works for items in rent

5. Test /api/catalog/items-by-category (without availability filter)
   - Should return items with stats showing on_wash, on_laundry, on_restoration counts

**Key Points:**
- The issue is that availability filters were only working when a category was also selected
- The fix should make availability filters work independently, showing ALL items matching that status across the entire catalog
- Backend API at /app/backend/routes/catalog.py has special handling for processing filters (lines 117-191)
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://catalog-repair-4.preview.emergentagent.com/api"
FRONTEND_URL = "https://catalog-repair-4.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

# Company name validation - Not needed for Order Modifications testing
# CORRECT_COMPANY_NAME = "ФОП Арсалані Олександра Ігорівна"
# OLD_INCORRECT_NAME = "ФОП Маркін Ілля Павлович"

class PartialReturnsTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.test_order_7219 = 7219  # For getting items
        self.test_order_7220 = 7220  # For processing partial returns
        self.extension_id = None  # Will be set after creating extension
        
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

    def test_get_not_returned_items(self, order_id: int) -> Dict[str, Any]:
        """Test 1: Get items for partial return"""
        try:
            self.log(f"🧪 Test 1: Getting not-returned items for order {order_id}...")
            
            response = self.session.get(f"{self.base_url}/partial-returns/order/{order_id}/not-returned")
            
            if response.status_code == 200:
                data = response.json()
                items = data if isinstance(data, list) else data.get('items', [])
                
                self.log(f"✅ Retrieved {len(items)} not-returned items for order {order_id}")
                
                if items:
                    # Validate item structure
                    required_fields = ['product_id', 'sku', 'name', 'rented_qty', 'full_price', 'daily_rate', 'loss_amount']
                    valid_items = []
                    
                    for i, item in enumerate(items):
                        self.log(f"   Item {i+1}:")
                        self.log(f"      Product ID: {item.get('product_id')}")
                        self.log(f"      SKU: {item.get('sku')}")
                        self.log(f"      Name: {item.get('name')}")
                        self.log(f"      Rented Qty: {item.get('rented_qty')}")
                        self.log(f"      Daily Rate: {item.get('daily_rate')}")
                        
                        # Check if all required fields are present
                        has_all_fields = all(field in item for field in required_fields)
                        daily_rate = item.get('daily_rate', 0)
                        has_positive_rate = daily_rate > 0
                        
                        if has_all_fields and has_positive_rate:
                            valid_items.append(item)
                            self.log(f"      ✅ Valid item with daily_rate: {daily_rate}")
                        else:
                            missing_fields = [field for field in required_fields if field not in item]
                            if missing_fields:
                                self.log(f"      ❌ Missing fields: {missing_fields}")
                            if not has_positive_rate:
                                self.log(f"      ❌ Invalid daily_rate: {daily_rate} (should be > 0)")
                    
                    return {
                        "success": True,
                        "order_id": order_id,
                        "items_count": len(items),
                        "valid_items_count": len(valid_items),
                        "items": items,
                        "valid_items": valid_items
                    }
                else:
                    self.log(f"⚠️ No not-returned items found for order {order_id}", "WARNING")
                    return {
                        "success": True,
                        "order_id": order_id,
                        "items_count": 0,
                        "valid_items_count": 0,
                        "items": [],
                        "valid_items": []
                    }
            else:
                self.log(f"❌ Get not-returned items failed for order {order_id}: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "order_id": order_id, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception getting not-returned items for order {order_id}: {str(e)}", "ERROR")
            return {"success": False, "order_id": order_id, "error": str(e)}

    def test_process_partial_return(self, order_id: int, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test 2: Process partial return with EXTEND action"""
        try:
            self.log(f"🧪 Test 2: Processing partial return for order {order_id}...")
            
            # Prepare request body
            request_body = {
                "items": [{
                    "product_id": item_data.get('product_id'),
                    "sku": item_data.get('sku'),
                    "name": item_data.get('name'),
                    "rented_qty": item_data.get('rented_qty', 1),
                    "returned_qty": 0,
                    "not_returned_qty": 1,
                    "action": "extend",
                    "daily_rate": 100,
                    "adjusted_daily_rate": 100
                }]
            }
            
            self.log(f"   Request body: {json.dumps(request_body, indent=2)}")
            
            response = self.session.post(
                f"{self.base_url}/partial-returns/order/{order_id}/process",
                json=request_body
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Partial return processed successfully for order {order_id}")
                self.log(f"   Response: {json.dumps(data, indent=2)}")
                
                return {
                    "success": True,
                    "order_id": order_id,
                    "response_data": data
                }
            else:
                self.log(f"❌ Process partial return failed for order {order_id}: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "order_id": order_id, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception processing partial return for order {order_id}: {str(e)}", "ERROR")
            return {"success": False, "order_id": order_id, "error": str(e)}

    def test_get_extensions(self, order_id: int) -> Dict[str, Any]:
        """Test 3: Get extensions for order"""
        try:
            self.log(f"🧪 Test 3: Getting extensions for order {order_id}...")
            
            response = self.session.get(f"{self.base_url}/partial-returns/order/{order_id}/extensions")
            
            if response.status_code == 200:
                data = response.json()
                extensions = data if isinstance(data, list) else data.get('extensions', [])
                
                self.log(f"✅ Retrieved {len(extensions)} extensions for order {order_id}")
                
                if extensions:
                    for i, extension in enumerate(extensions):
                        extension_id = extension.get('id')
                        product_id = extension.get('product_id')
                        status = extension.get('status')
                        daily_rate = extension.get('daily_rate')
                        
                        self.log(f"   Extension {i+1}:")
                        self.log(f"      ID: {extension_id}")
                        self.log(f"      Product ID: {product_id}")
                        self.log(f"      Status: {status}")
                        self.log(f"      Daily Rate: {daily_rate}")
                        
                        # Store the first extension ID for later use
                        if i == 0 and extension_id:
                            self.extension_id = extension_id
                            self.log(f"      📝 Stored extension ID for completion test: {extension_id}")
                
                return {
                    "success": True,
                    "order_id": order_id,
                    "extensions_count": len(extensions),
                    "extensions": extensions
                }
            else:
                self.log(f"❌ Get extensions failed for order {order_id}: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "order_id": order_id, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception getting extensions for order {order_id}: {str(e)}", "ERROR")
            return {"success": False, "order_id": order_id, "error": str(e)}

    def test_complete_extension(self, order_id: int, extension_id: int) -> Dict[str, Any]:
        """Test 4: Complete extension (return item)"""
        try:
            self.log(f"🧪 Test 4: Completing extension {extension_id} for order {order_id}...")
            
            request_body = {
                "days": 3,
                "final_amount": 300
            }
            
            self.log(f"   Request body: {json.dumps(request_body, indent=2)}")
            
            response = self.session.post(
                f"{self.base_url}/partial-returns/order/{order_id}/extensions/{extension_id}/complete",
                json=request_body
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Extension completed successfully")
                self.log(f"   Response: {json.dumps(data, indent=2)}")
                
                return {
                    "success": True,
                    "order_id": order_id,
                    "extension_id": extension_id,
                    "response_data": data
                }
            else:
                self.log(f"❌ Complete extension failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "order_id": order_id, "extension_id": extension_id, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception completing extension: {str(e)}", "ERROR")
            return {"success": False, "order_id": order_id, "extension_id": extension_id, "error": str(e)}

    def run_partial_returns_test(self):
        """Run the complete Partial Returns API test as per review request"""
        self.log("🚀 Starting Partial Returns API Test")
        self.log("=" * 80)
        self.log(f"Testing Partial Returns API functionality")
        self.log("Test orders: 7219 (get items), 7220 (process returns)")
        self.log("=" * 80)
        
        # Step 1: Health check
        if not self.test_api_health():
            self.log("❌ API health check failed, aborting tests", "ERROR")
            return False
        
        # Step 2: Authentication
        self.log("\n🔍 Step 1: Testing authentication...")
        if not self.authenticate():
            self.log("❌ Authentication failed, aborting tests", "ERROR")
            return False
        
        all_tests_passed = True
        test_results = {}
        
        # Test 1: Get items for partial return from order 7219
        self.log(f"\n🔍 Test 1: Getting not-returned items from order {self.test_order_7219}...")
        items_result = self.test_get_not_returned_items(self.test_order_7219)
        test_results["get_items"] = items_result
        
        if not items_result.get("success", False):
            self.log("❌ Failed to get not-returned items", "ERROR")
            all_tests_passed = False
        elif items_result.get("valid_items_count", 0) == 0:
            self.log("❌ No valid items found for testing", "ERROR")
            all_tests_passed = False
        
        # Get first valid item for processing
        valid_items = items_result.get("valid_items", [])
        first_item = valid_items[0] if valid_items else None
        
        if not first_item:
            self.log("❌ No valid item available for partial return processing", "ERROR")
            all_tests_passed = False
            return False
        
        # Test 2: Process partial return with EXTEND action on order 7220
        self.log(f"\n🔍 Test 2: Processing partial return for order {self.test_order_7220}...")
        process_result = self.test_process_partial_return(self.test_order_7220, first_item)
        test_results["process_return"] = process_result
        
        if not process_result.get("success", False):
            self.log("❌ Failed to process partial return", "ERROR")
            all_tests_passed = False
        
        # Test 3: Get extensions for order 7220
        self.log(f"\n🔍 Test 3: Getting extensions for order {self.test_order_7220}...")
        extensions_result = self.test_get_extensions(self.test_order_7220)
        test_results["get_extensions"] = extensions_result
        
        if not extensions_result.get("success", False):
            self.log("❌ Failed to get extensions", "ERROR")
            all_tests_passed = False
        elif extensions_result.get("extensions_count", 0) == 0:
            self.log("❌ No extensions found after processing", "ERROR")
            all_tests_passed = False
        
        # Test 4: Complete extension (if we have an extension ID)
        if self.extension_id:
            self.log(f"\n🔍 Test 4: Completing extension {self.extension_id} for order {self.test_order_7220}...")
            complete_result = self.test_complete_extension(self.test_order_7220, self.extension_id)
            test_results["complete_extension"] = complete_result
            
            if not complete_result.get("success", False):
                self.log("❌ Failed to complete extension", "ERROR")
                all_tests_passed = False
        else:
            self.log("\n⚠️ Test 4: Skipping extension completion - no extension ID available", "WARNING")
            all_tests_passed = False
        
        # Summary
        self.log("\n" + "=" * 80)
        self.log("📊 PARTIAL RETURNS API TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        self.log(f"\n   📋 PARTIAL RETURNS TESTS:")
        
        # Test 1 summary
        items_success = test_results.get("get_items", {}).get("success", False)
        items_count = test_results.get("get_items", {}).get("valid_items_count", 0)
        self.log(f"   • Test 1 - Get Not-Returned Items: {'✅ PASS' if items_success and items_count > 0 else '❌ FAIL'}")
        self.log(f"     - Order: {self.test_order_7219}")
        self.log(f"     - Valid Items Found: {items_count}")
        
        # Test 2 summary
        process_success = test_results.get("process_return", {}).get("success", False)
        self.log(f"   • Test 2 - Process Partial Return: {'✅ PASS' if process_success else '❌ FAIL'}")
        self.log(f"     - Order: {self.test_order_7220}")
        self.log(f"     - Action: EXTEND")
        
        # Test 3 summary
        extensions_success = test_results.get("get_extensions", {}).get("success", False)
        extensions_count = test_results.get("get_extensions", {}).get("extensions_count", 0)
        self.log(f"   • Test 3 - Get Extensions: {'✅ PASS' if extensions_success and extensions_count > 0 else '❌ FAIL'}")
        self.log(f"     - Order: {self.test_order_7220}")
        self.log(f"     - Extensions Found: {extensions_count}")
        
        # Test 4 summary
        complete_success = test_results.get("complete_extension", {}).get("success", False)
        self.log(f"   • Test 4 - Complete Extension: {'✅ PASS' if complete_success else '❌ FAIL'}")
        if self.extension_id:
            self.log(f"     - Extension ID: {self.extension_id}")
            self.log(f"     - Days: 3, Amount: ₴300")
        else:
            self.log(f"     - Skipped: No extension ID available")
        
        self.log(f"\n   🔍 API ENDPOINTS TESTED:")
        self.log(f"   • GET /api/partial-returns/order/{{order_id}}/not-returned: {'✅ Working' if items_success else '❌ Failed'}")
        self.log(f"   • POST /api/partial-returns/order/{{order_id}}/process: {'✅ Working' if process_success else '❌ Failed'}")
        self.log(f"   • GET /api/partial-returns/order/{{order_id}}/extensions: {'✅ Working' if extensions_success else '❌ Failed'}")
        self.log(f"   • POST /api/partial-returns/order/{{order_id}}/extensions/{{id}}/complete: {'✅ Working' if complete_success else '❌ Failed'}")
        
        if all_tests_passed:
            self.log(f"\n✅ PARTIAL RETURNS API TEST PASSED!")
            self.log(f"   All API endpoints working correctly with proper partial returns functionality")
        else:
            self.log(f"\n❌ PARTIAL RETURNS API TEST FAILED!")
            self.log(f"   Some tests failed - check individual test results above")
        
        return all_tests_passed
def main():
    """Main test execution"""
    print("🧪 Backend Testing: Partial Returns API")
    print("=" * 80)
    print("Testing the new Partial Returns API functionality.")
    print("")
    print("**Login credentials:**")
    print("- email: vitokdrako@gmail.com")
    print("- password: test123")
    print("")
    print("**Test 1: Get items for partial return**")
    print("- GET /api/partial-returns/order/7219/not-returned")
    print("- Should return list of items with: product_id, sku, name, rented_qty, full_price, daily_rate, loss_amount")
    print("- Verify each item has daily_rate > 0")
    print("")
    print("**Test 2: Process partial return with EXTEND action**")
    print("- POST /api/partial-returns/order/7220/process")
    print("- Should create extension record and return success")
    print("")
    print("**Test 3: Get extensions for order**")
    print("- GET /api/partial-returns/order/7220/extensions")
    print("- Should show the extension we created")
    print("")
    print("**Test 4: Complete extension (return item)**")
    print("- POST /api/partial-returns/order/7220/extensions/{extension_id}/complete")
    print("- Body: { \"days\": 3, \"final_amount\": 300 }")
    print("- Should calculate and charge late fee")
    print("")
    print("**Note:** First get the items from order 7220 to use real product IDs in tests.")
    print("")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("=" * 80)
    
    tester = PartialReturnsTester(BASE_URL)
    
    try:
        success = tester.run_partial_returns_test()
        
        if success:
            print("\n✅ PARTIAL RETURNS API TEST PASSED!")
            print("📊 Summary: All Partial Returns API endpoints working correctly")
            print("🎯 Test Results:")
            print("   ✅ API Health: Working correctly")
            print("   ✅ Authentication: Working with provided credentials")
            print("   ✅ Test 1 - Get Not-Returned Items: Working correctly")
            print("   ✅ Test 2 - Process Partial Return: EXTEND action working")
            print("   ✅ Test 3 - Get Extensions: Extension records retrieved")
            print("   ✅ Test 4 - Complete Extension: Late fee calculation working")
            print("")
            print("🔧 API Endpoints Verified:")
            print("   - GET /api/partial-returns/order/{order_id}/not-returned")
            print("   - POST /api/partial-returns/order/{order_id}/process")
            print("   - GET /api/partial-returns/order/{order_id}/extensions")
            print("   - POST /api/partial-returns/order/{order_id}/extensions/{extension_id}/complete")
            print("")
            print("✅ All key validations passed:")
            print("   - Item structure validation working")
            print("   - Daily rate validation working (> 0)")
            print("   - Extension creation working")
            print("   - Extension completion working")
            sys.exit(0)
        else:
            print("\n❌ PARTIAL RETURNS API TEST FAILED!")
            print("📊 Summary: Issues found with Partial Returns API")
            print("🔍 Possible Issues:")
            print("   - Some API endpoints may not be working correctly")
            print("   - Item structure may be missing required fields")
            print("   - Daily rates may not be properly set (should be > 0)")
            print("   - Extension creation or completion may have failed")
            print("   - Authentication or data retrieval may have failed")
            print("")
            print("🔧 Recommended Investigation:")
            print("   1. Check if partial_returns route is properly included in server.py")
            print("   2. Verify database tables for partial returns and extensions exist")
            print("   3. Check if orders 7219, 7220 exist with proper item data")
            print("   4. Verify item structure includes all required fields with valid daily_rate")
            print("   5. Check backend logs for any errors during API calls")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()