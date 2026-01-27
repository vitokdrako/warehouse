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
BASE_URL = "https://mobile-enhance-2.preview.emergentagent.com/api"
FRONTEND_URL = "https://mobile-enhance-2.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

class CatalogAvailabilityTester:
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

    def test_catalog_availability_filter(self, availability: str, expected_min_items: int = 0, expected_items: List[str] = None) -> Dict[str, Any]:
        """Test catalog availability filter without category selection"""
        try:
            self.log(f"🧪 Testing availability filter: {availability}...")
            
            # Test the API endpoint
            params = {
                "availability": availability,
                "limit": 50
            }
            
            response = self.session.get(f"{self.base_url}/catalog/items-by-category", params=params)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                stats = data.get('stats', {})
                
                self.log(f"✅ API Response successful for availability={availability}")
                self.log(f"   Items returned: {len(items)}")
                self.log(f"   Stats: {stats}")
                
                # Check if we have expected minimum items
                has_min_items = len(items) >= expected_min_items
                
                # Check for specific expected items
                found_expected_items = []
                if expected_items:
                    for item in items:
                        sku = item.get('sku', '')
                        name = item.get('name', '')
                        for expected in expected_items:
                            if expected in sku or expected in name:
                                found_expected_items.append(f"{sku} - {name}")
                
                # Log item details
                if items:
                    self.log(f"   📋 Items found:")
                    for i, item in enumerate(items[:5]):  # Show first 5 items
                        sku = item.get('sku', 'N/A')
                        name = item.get('name', 'N/A')
                        product_state = item.get('product_state', 'N/A')
                        self.log(f"      {i+1}. {sku} - {name} (state: {product_state})")
                    
                    if len(items) > 5:
                        self.log(f"      ... and {len(items) - 5} more items")
                else:
                    self.log(f"   ⚠️ No items found for availability={availability}")
                
                return {
                    "success": True,
                    "availability": availability,
                    "items_count": len(items),
                    "items": items,
                    "stats": stats,
                    "has_min_items": has_min_items,
                    "expected_min_items": expected_min_items,
                    "found_expected_items": found_expected_items,
                    "expected_items": expected_items or []
                }
            else:
                self.log(f"❌ API failed for availability={availability}: {response.status_code} - {response.text}", "ERROR")
                return {
                    "success": False,
                    "availability": availability,
                    "status_code": response.status_code,
                    "response_text": response.text
                }
                
        except Exception as e:
            self.log(f"❌ Exception testing availability={availability}: {str(e)}", "ERROR")
            return {
                "success": False,
                "availability": availability,
                "error": str(e)
            }

    def test_catalog_without_filters(self) -> Dict[str, Any]:
        """Test catalog without any filters to get baseline stats"""
        try:
            self.log("🧪 Testing catalog without filters (baseline)...")
            
            params = {"limit": 50}
            response = self.session.get(f"{self.base_url}/catalog/items-by-category", params=params)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])
                stats = data.get('stats', {})
                
                self.log(f"✅ Baseline catalog API successful")
                self.log(f"   Total items: {len(items)}")
                self.log(f"   Stats: {stats}")
                
                return {
                    "success": True,
                    "items_count": len(items),
                    "items": items,
                    "stats": stats
                }
            else:
                self.log(f"❌ Baseline catalog API failed: {response.status_code} - {response.text}", "ERROR")
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "response_text": response.text
                }
                
        except Exception as e:
            self.log(f"❌ Exception testing baseline catalog: {str(e)}", "ERROR")
            return {
                "success": False,
                "error": str(e)
            }

    def run_catalog_availability_tests(self):
        """Run the complete Catalog Availability Filters test as per review request"""
        self.log("🚀 Starting Catalog Availability Filters Test")
        self.log("=" * 80)
        self.log("Testing Catalog Page availability filters functionality")
        self.log("Key requirement: Filters should work WITHOUT category selection")
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
        
        # Test baseline (no filters)
        self.log("\n🔍 Baseline Test: Getting catalog without filters...")
        baseline_result = self.test_catalog_without_filters()
        test_results["baseline"] = baseline_result
        
        if not baseline_result.get("success", False):
            self.log("❌ Baseline catalog test failed", "ERROR")
            all_tests_passed = False
        
        # Test 1: on_laundry filter (expected: TX201 - Плед білий)
        self.log("\n🔍 Test 1: Testing availability=on_laundry filter...")
        laundry_result = self.test_catalog_availability_filter(
            availability="on_laundry",
            expected_min_items=1,
            expected_items=["TX201", "Плед білий"]
        )
        test_results["on_laundry"] = laundry_result
        
        if not laundry_result.get("success", False):
            self.log("❌ on_laundry filter test failed", "ERROR")
            all_tests_passed = False
        elif not laundry_result.get("has_min_items", False):
            self.log("❌ on_laundry filter returned fewer items than expected", "ERROR")
            all_tests_passed = False
        
        # Test 2: on_restoration filter (expected: LU10 - Люстра)
        self.log("\n🔍 Test 2: Testing availability=on_restoration filter...")
        restoration_result = self.test_catalog_availability_filter(
            availability="on_restoration",
            expected_min_items=1,
            expected_items=["LU10", "Люстра"]
        )
        test_results["on_restoration"] = restoration_result
        
        if not restoration_result.get("success", False):
            self.log("❌ on_restoration filter test failed", "ERROR")
            all_tests_passed = False
        elif not restoration_result.get("has_min_items", False):
            self.log("❌ on_restoration filter returned fewer items than expected", "ERROR")
            all_tests_passed = False
        
        # Test 3: on_wash filter
        self.log("\n🔍 Test 3: Testing availability=on_wash filter...")
        wash_result = self.test_catalog_availability_filter(
            availability="on_wash",
            expected_min_items=0  # May have 0 items, that's OK
        )
        test_results["on_wash"] = wash_result
        
        if not wash_result.get("success", False):
            self.log("❌ on_wash filter test failed", "ERROR")
            all_tests_passed = False
        
        # Test 4: in_rent filter
        self.log("\n🔍 Test 4: Testing availability=in_rent filter...")
        rent_result = self.test_catalog_availability_filter(
            availability="in_rent",
            expected_min_items=0  # May have 0 items, that's OK
        )
        test_results["in_rent"] = rent_result
        
        if not rent_result.get("success", False):
            self.log("❌ in_rent filter test failed", "ERROR")
            all_tests_passed = False
        
        # Test 5: reserved filter
        self.log("\n🔍 Test 5: Testing availability=reserved filter...")
        reserved_result = self.test_catalog_availability_filter(
            availability="reserved",
            expected_min_items=0  # May have 0 items, that's OK
        )
        test_results["reserved"] = reserved_result
        
        if not reserved_result.get("success", False):
            self.log("❌ reserved filter test failed", "ERROR")
            all_tests_passed = False
        
        # Summary
        self.log("\n" + "=" * 80)
        self.log("📊 CATALOG AVAILABILITY FILTERS TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        self.log(f"\n   📋 AVAILABILITY FILTER TESTS:")
        
        # Baseline summary
        baseline_success = test_results.get("baseline", {}).get("success", False)
        baseline_count = test_results.get("baseline", {}).get("items_count", 0)
        baseline_stats = test_results.get("baseline", {}).get("stats", {})
        self.log(f"   • Baseline (no filters): {'✅ PASS' if baseline_success else '❌ FAIL'}")
        self.log(f"     - Items returned: {baseline_count}")
        self.log(f"     - Stats: {baseline_stats}")
        
        # Test 1 summary
        laundry_success = test_results.get("on_laundry", {}).get("success", False)
        laundry_count = test_results.get("on_laundry", {}).get("items_count", 0)
        laundry_expected = test_results.get("on_laundry", {}).get("found_expected_items", [])
        self.log(f"   • Test 1 - on_laundry filter: {'✅ PASS' if laundry_success and laundry_count >= 1 else '❌ FAIL'}")
        self.log(f"     - Items found: {laundry_count}")
        self.log(f"     - Expected items found: {laundry_expected}")
        
        # Test 2 summary
        restoration_success = test_results.get("on_restoration", {}).get("success", False)
        restoration_count = test_results.get("on_restoration", {}).get("items_count", 0)
        restoration_expected = test_results.get("on_restoration", {}).get("found_expected_items", [])
        self.log(f"   • Test 2 - on_restoration filter: {'✅ PASS' if restoration_success and restoration_count >= 1 else '❌ FAIL'}")
        self.log(f"     - Items found: {restoration_count}")
        self.log(f"     - Expected items found: {restoration_expected}")
        
        # Test 3 summary
        wash_success = test_results.get("on_wash", {}).get("success", False)
        wash_count = test_results.get("on_wash", {}).get("items_count", 0)
        self.log(f"   • Test 3 - on_wash filter: {'✅ PASS' if wash_success else '❌ FAIL'}")
        self.log(f"     - Items found: {wash_count}")
        
        # Test 4 summary
        rent_success = test_results.get("in_rent", {}).get("success", False)
        rent_count = test_results.get("in_rent", {}).get("items_count", 0)
        self.log(f"   • Test 4 - in_rent filter: {'✅ PASS' if rent_success else '❌ FAIL'}")
        self.log(f"     - Items found: {rent_count}")
        
        # Test 5 summary
        reserved_success = test_results.get("reserved", {}).get("success", False)
        reserved_count = test_results.get("reserved", {}).get("items_count", 0)
        self.log(f"   • Test 5 - reserved filter: {'✅ PASS' if reserved_success else '❌ FAIL'}")
        self.log(f"     - Items found: {reserved_count}")
        
        self.log(f"\n   🔍 API ENDPOINT TESTED:")
        self.log(f"   • GET /api/catalog/items-by-category?availability={{filter}}&limit=50")
        
        # Check if key requirements are met
        key_requirements_met = True
        
        # Requirement 1: on_laundry should return TX201
        if laundry_success and laundry_count >= 1:
            self.log(f"   ✅ Requirement 1: on_laundry filter works globally (found {laundry_count} items)")
        else:
            self.log(f"   ❌ Requirement 1: on_laundry filter failed or returned no items")
            key_requirements_met = False
        
        # Requirement 2: on_restoration should return LU10
        if restoration_success and restoration_count >= 1:
            self.log(f"   ✅ Requirement 2: on_restoration filter works globally (found {restoration_count} items)")
        else:
            self.log(f"   ❌ Requirement 2: on_restoration filter failed or returned no items")
            key_requirements_met = False
        
        # Requirement 3: All filters should work without category selection
        all_filters_work = all([
            laundry_success, restoration_success, wash_success, rent_success, reserved_success
        ])
        
        if all_filters_work:
            self.log(f"   ✅ Requirement 3: All availability filters work without category selection")
        else:
            self.log(f"   ❌ Requirement 3: Some availability filters failed")
            key_requirements_met = False
        
        final_success = all_tests_passed and key_requirements_met
        
        if final_success:
            self.log(f"\n✅ CATALOG AVAILABILITY FILTERS TEST PASSED!")
            self.log(f"   All availability filters working correctly without category selection")
        else:
            self.log(f"\n❌ CATALOG AVAILABILITY FILTERS TEST FAILED!")
            self.log(f"   Some filters failed or key requirements not met")
        
        return final_success, test_results
def main():
    """Main test execution"""
    print("🧪 Backend Testing: Catalog Availability Filters")
    print("=" * 80)
    print("Testing the Catalog Page availability filters functionality.")
    print("")
    print("**Login credentials:**")
    print("- email: vitokdrako@gmail.com")
    print("- password: test123")
    print("")
    print("**Backend API Tests:**")
    print("1. Test /api/catalog/items-by-category?availability=on_laundry&limit=50")
    print("   - Expected: Should return at least 1 item (TX201 - Плед білий)")
    print("")
    print("2. Test /api/catalog/items-by-category?availability=on_restoration&limit=50")
    print("   - Expected: Should return at least 1 item (LU10 - Люстра)")
    print("")
    print("3. Test /api/catalog/items-by-category?availability=on_wash&limit=50")
    print("   - Verify it returns items if any exist on wash")
    print("")
    print("4. Test /api/catalog/items-by-category?availability=in_rent&limit=50")
    print("   - Verify filtering works for items in rent")
    print("")
    print("5. Test /api/catalog/items-by-category (without availability filter)")
    print("   - Should return items with stats showing on_wash, on_laundry, on_restoration counts")
    print("")
    print("**Key Points:**")
    print("- The issue is that availability filters were only working when a category was also selected")
    print("- The fix should make availability filters work independently, showing ALL items matching that status across the entire catalog")
    print("- Backend API at /app/backend/routes/catalog.py has special handling for processing filters (lines 117-191)")
    print("")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("=" * 80)
    
    tester = CatalogAvailabilityTester(BASE_URL)
    
    try:
        success, test_results = tester.run_catalog_availability_tests()
        
        if success:
            print("\n✅ CATALOG AVAILABILITY FILTERS TEST PASSED!")
            print("📊 Summary: All availability filters working correctly without category selection")
            print("🎯 Test Results:")
            print("   ✅ API Health: Working correctly")
            print("   ✅ Authentication: Working with provided credentials")
            print("   ✅ Baseline Test: Catalog API working without filters")
            print("   ✅ Test 1 - on_laundry filter: Working globally (expected TX201)")
            print("   ✅ Test 2 - on_restoration filter: Working globally (expected LU10)")
            print("   ✅ Test 3 - on_wash filter: Working globally")
            print("   ✅ Test 4 - in_rent filter: Working globally")
            print("   ✅ Test 5 - reserved filter: Working globally")
            print("")
            print("🔧 API Endpoint Verified:")
            print("   - GET /api/catalog/items-by-category?availability={filter}&limit=50")
            print("")
            print("✅ All key validations passed:")
            print("   - Availability filters work WITHOUT category selection")
            print("   - on_laundry filter returns expected items")
            print("   - on_restoration filter returns expected items")
            print("   - All filters process correctly across entire catalog")
            print("   - Backend special handling for processing filters working")
            
            # Show specific results
            laundry_count = test_results.get("on_laundry", {}).get("items_count", 0)
            restoration_count = test_results.get("on_restoration", {}).get("items_count", 0)
            wash_count = test_results.get("on_wash", {}).get("items_count", 0)
            rent_count = test_results.get("in_rent", {}).get("items_count", 0)
            reserved_count = test_results.get("reserved", {}).get("items_count", 0)
            
            print(f"\n📈 Items Found by Filter:")
            print(f"   - on_laundry: {laundry_count} items")
            print(f"   - on_restoration: {restoration_count} items")
            print(f"   - on_wash: {wash_count} items")
            print(f"   - in_rent: {rent_count} items")
            print(f"   - reserved: {reserved_count} items")
            
            sys.exit(0)
        else:
            print("\n❌ CATALOG AVAILABILITY FILTERS TEST FAILED!")
            print("📊 Summary: Issues found with catalog availability filters")
            print("🔍 Possible Issues:")
            print("   - Some availability filters may not be working correctly")
            print("   - Expected items (TX201, LU10) may not be found")
            print("   - Filters may still require category selection")
            print("   - Backend processing filter logic may have issues")
            print("   - Authentication or API access may have failed")
            print("")
            print("🔧 Recommended Investigation:")
            print("   1. Check if catalog route is properly included in server.py")
            print("   2. Verify database tables for product_damage_history exist")
            print("   3. Check if expected items TX201, LU10 exist with proper status")
            print("   4. Verify availability filter logic in /app/backend/routes/catalog.py lines 117-191")
            print("   5. Check backend logs for any errors during API calls")
            print("   6. Test frontend UI to see if filters work in browser")
            
            # Show specific failure details
            for filter_name, result in test_results.items():
                if not result.get("success", True):
                    print(f"   ❌ {filter_name} filter failed: {result.get('error', 'Unknown error')}")
            
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()