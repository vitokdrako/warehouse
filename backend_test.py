#!/usr/bin/env python3
"""
Backend Testing Script for Order Lifecycle API
Testing the enhanced order lifecycle API endpoint.

**Test Scenario:**
Test order lifecycle API endpoints for specific orders to verify complete history tracking.

**Test Steps:**
1. Login with credentials: email: `vitokdrako@gmail.com`, password: `test123`
2. Test GET /api/orders/7222/lifecycle - Verify response contains array of events
3. Test GET /api/orders/7219/lifecycle - Verify full lifecycle from creation to issue
4. Test GET /api/orders/7220/lifecycle - Should show created and preparation stages only
5. Verify lifecycle includes all key stages in chronological order

**Key validations:**
- Each event should have: stage, notes, created_at, created_by
- Events should be in chronological order (sorted by created_at)
- API should return COMPLETE history from the beginning of the order regardless of current stage
- Expected stages: created, preparation, ready_for_issue, issued, returned (if applicable)
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://order-ui-refresh.preview.emergentagent.com/api"
FRONTEND_URL = "https://order-ui-refresh.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

# Company name validation - Not needed for Order Modifications testing
# CORRECT_COMPANY_NAME = "ФОП Арсалані Олександра Ігорівна"
# OLD_INCORRECT_NAME = "ФОП Маркін Ілля Павлович"

class OrderLifecycleTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.test_order_ids = [7222, 7219, 7220]  # Specific order IDs to test
        self.expected_stages = ['created', 'preparation', 'ready_for_issue', 'issued', 'returned']
        
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

    def test_order_lifecycle(self, order_id: int) -> Dict[str, Any]:
        """Test order lifecycle API for specific order"""
        try:
            self.log(f"🧪 Testing lifecycle for order {order_id}...")
            
            response = self.session.get(f"{self.base_url}/orders/{order_id}/lifecycle")
            
            if response.status_code == 200:
                data = response.json()
                events = data if isinstance(data, list) else data.get('events', [])
                
                self.log(f"✅ Retrieved {len(events)} lifecycle events for order {order_id}")
                
                if events:
                    self.log(f"📋 Lifecycle events for order {order_id}:")
                    
                    # Verify events have required fields
                    valid_events = []
                    for i, event in enumerate(events):
                        stage = event.get('stage', 'unknown')
                        notes = event.get('notes', '')
                        created_at = event.get('created_at', 'unknown')
                        created_by = event.get('created_by', 'unknown')
                        
                        self.log(f"   {i+1}. Stage: {stage}")
                        self.log(f"      Notes: {notes}")
                        self.log(f"      Created: {created_at}")
                        self.log(f"      By: {created_by}")
                        
                        # Validate required fields
                        if all([stage, created_at, created_by]):
                            valid_events.append(event)
                        else:
                            self.log(f"      ⚠️ Missing required fields", "WARNING")
                    
                    # Check if events are in chronological order
                    is_chronological = True
                    if len(events) > 1:
                        for i in range(1, len(events)):
                            prev_time = events[i-1].get('created_at', '')
                            curr_time = events[i].get('created_at', '')
                            if prev_time > curr_time:
                                is_chronological = False
                                break
                    
                    # Check for expected stages
                    stages_found = [event.get('stage') for event in events]
                    has_created = 'created' in stages_found
                    
                    return {
                        "success": True,
                        "order_id": order_id,
                        "events_count": len(events),
                        "valid_events_count": len(valid_events),
                        "stages_found": stages_found,
                        "has_created_stage": has_created,
                        "is_chronological": is_chronological,
                        "events": events,
                        "first_stage": stages_found[0] if stages_found else None,
                        "last_stage": stages_found[-1] if stages_found else None
                    }
                else:
                    self.log(f"⚠️ No lifecycle events found for order {order_id}", "WARNING")
                    return {
                        "success": True,
                        "order_id": order_id,
                        "events_count": 0,
                        "valid_events_count": 0,
                        "stages_found": [],
                        "has_created_stage": False,
                        "is_chronological": True,
                        "events": [],
                        "first_stage": None,
                        "last_stage": None
                    }
            else:
                self.log(f"❌ Get lifecycle failed for order {order_id}: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "order_id": order_id, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception getting lifecycle for order {order_id}: {str(e)}", "ERROR")
            return {"success": False, "order_id": order_id, "error": str(e)}

    def validate_lifecycle_requirements(self, order_id: int, result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate specific requirements for each test order"""
        validations = {
            "order_id": order_id,
            "has_events": result.get("events_count", 0) > 0,
            "has_required_fields": result.get("valid_events_count", 0) == result.get("events_count", 0),
            "is_chronological": result.get("is_chronological", False),
            "has_created_stage": result.get("has_created_stage", False)
        }
        
        stages_found = result.get("stages_found", [])
        
        if order_id == 7222:
            # Order 7222 should have: created, preparation, ready_for_issue, issued
            expected_stages = ['created', 'preparation', 'ready_for_issue', 'issued']
            validations["expected_stages_present"] = all(stage in stages_found for stage in expected_stages)
            validations["expected_stages"] = expected_stages
            validations["missing_stages"] = [stage for stage in expected_stages if stage not in stages_found]
            
        elif order_id == 7219:
            # Order 7219 should have full lifecycle from creation to issue
            expected_stages = ['created', 'preparation', 'ready_for_issue', 'issued']
            validations["expected_stages_present"] = all(stage in stages_found for stage in expected_stages)
            validations["expected_stages"] = expected_stages
            validations["missing_stages"] = [stage for stage in expected_stages if stage not in stages_found]
            
        elif order_id == 7220:
            # Order 7220 should show created and preparation stages only (still in preparation)
            expected_stages = ['created', 'preparation']
            validations["expected_stages_present"] = all(stage in stages_found for stage in expected_stages)
            validations["expected_stages"] = expected_stages
            validations["missing_stages"] = [stage for stage in expected_stages if stage not in stages_found]
            # Should NOT have ready_for_issue or issued
            validations["no_advanced_stages"] = not any(stage in stages_found for stage in ['ready_for_issue', 'issued', 'returned'])
        
        return validations

    def run_order_lifecycle_test(self):
        """Run the complete Order Lifecycle API test as per review request"""
        self.log("🚀 Starting Order Lifecycle API Test")
        self.log("=" * 80)
        self.log(f"Testing Order Lifecycle API functionality")
        self.log("Test orders: 7222, 7219, 7220")
        self.log("Expected stages: created, preparation, ready_for_issue, issued, returned")
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
        
        # Step 3: Test each order lifecycle
        test_results = {}
        all_tests_passed = True
        
        for order_id in self.test_order_ids:
            self.log(f"\n🔍 Step {order_id}: Testing lifecycle for order {order_id}...")
            
            # Test lifecycle API
            lifecycle_result = self.test_order_lifecycle(order_id)
            lifecycle_success = lifecycle_result.get("success", False)
            
            if not lifecycle_success:
                self.log(f"❌ Failed to get lifecycle for order {order_id}", "ERROR")
                all_tests_passed = False
                test_results[order_id] = {"success": False, "result": lifecycle_result}
                continue
            
            # Validate requirements for this specific order
            validations = self.validate_lifecycle_requirements(order_id, lifecycle_result)
            test_results[order_id] = {
                "success": lifecycle_success,
                "result": lifecycle_result,
                "validations": validations
            }
            
            # Check if all validations passed
            validation_checks = [
                validations.get("has_events", False),
                validations.get("has_required_fields", False),
                validations.get("is_chronological", False),
                validations.get("has_created_stage", False),
                validations.get("expected_stages_present", False)
            ]
            
            # For order 7220, also check no advanced stages
            if order_id == 7220:
                validation_checks.append(validations.get("no_advanced_stages", False))
            
            order_passed = all(validation_checks)
            if not order_passed:
                all_tests_passed = False
            
            # Log validation results
            self.log(f"   📊 Validation Results for Order {order_id}:")
            self.log(f"      • Has Events: {'✅' if validations.get('has_events') else '❌'}")
            self.log(f"      • Required Fields: {'✅' if validations.get('has_required_fields') else '❌'}")
            self.log(f"      • Chronological Order: {'✅' if validations.get('is_chronological') else '❌'}")
            self.log(f"      • Has Created Stage: {'✅' if validations.get('has_created_stage') else '❌'}")
            self.log(f"      • Expected Stages Present: {'✅' if validations.get('expected_stages_present') else '❌'}")
            
            if order_id == 7220:
                self.log(f"      • No Advanced Stages: {'✅' if validations.get('no_advanced_stages') else '❌'}")
            
            if validations.get("missing_stages"):
                self.log(f"      • Missing Stages: {validations.get('missing_stages')}")
        
        # Summary
        self.log("\n" + "=" * 80)
        self.log("📊 ORDER LIFECYCLE API TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        self.log(f"\n   📋 ORDER LIFECYCLE TESTS:")
        for order_id in self.test_order_ids:
            result = test_results.get(order_id, {})
            success = result.get("success", False)
            lifecycle_data = result.get("result", {})
            validations = result.get("validations", {})
            
            events_count = lifecycle_data.get("events_count", 0)
            stages_found = lifecycle_data.get("stages_found", [])
            
            self.log(f"   • Order {order_id}: {'✅ PASS' if success and validations.get('expected_stages_present', False) else '❌ FAIL'}")
            self.log(f"     - Events: {events_count}")
            self.log(f"     - Stages: {', '.join(stages_found) if stages_found else 'None'}")
            
            if order_id == 7222:
                self.log(f"     - Expected: created, preparation, ready_for_issue, issued")
            elif order_id == 7219:
                self.log(f"     - Expected: Full lifecycle from creation to issue")
            elif order_id == 7220:
                self.log(f"     - Expected: created, preparation only (still in preparation)")
        
        self.log(f"\n   🔍 API ENDPOINT TESTED:")
        self.log(f"   • GET /api/orders/{{order_id}}/lifecycle: {'✅ Working' if any(r.get('success') for r in test_results.values()) else '❌ Failed'}")
        
        self.log(f"\n   🔍 KEY VALIDATIONS:")
        if all_tests_passed:
            self.log(f"   • All orders have lifecycle events: ✅")
            self.log(f"   • All events have required fields (stage, notes, created_at, created_by): ✅")
            self.log(f"   • Events are in chronological order: ✅")
            self.log(f"   • All orders start with 'created' stage: ✅")
            self.log(f"   • Order 7222 has expected stages: ✅")
            self.log(f"   • Order 7219 has full lifecycle: ✅")
            self.log(f"   • Order 7220 shows preparation stage only: ✅")
            
            self.log(f"\n✅ ORDER LIFECYCLE API TEST PASSED!")
            self.log(f"   All API endpoints working correctly with proper lifecycle tracking")
            self.log(f"   Complete history returned from beginning of order regardless of current stage")
        else:
            self.log(f"\n❌ ORDER LIFECYCLE API TEST FAILED!")
            self.log(f"   Some validations failed - check individual order results above")
        
        return all_tests_passed
def main():
    """Main test execution"""
    print("🧪 Backend Testing: Order Modifications API - Дозамовлення")
    print("=" * 80)
    print("Testing the new Order Modifications API for 'Дозамовлення' functionality.")
    print("")
    print("**Test Scenario:**")
    print("Test all Order Modifications API endpoints for adding, updating, removing, and restoring items in orders.")
    print("")
    print("**Test Steps:**")
    print("1. Login with credentials: email: `vitokdrako@gmail.com`, password: `test123`")
    print("2. Find an order with status `processing` or `ready_for_issue`")
    print("3. Get a product_id from products API")
    print("4. Add item to order")
    print("5. Update item quantity")
    print("6. Remove/Refuse item")
    print("7. Get modifications history")
    print("8. Get refused items")
    print("9. Restore refused item")
    print("")
    print("**Key validations:**")
    print("- API should reject modifications for orders not in `processing` or `ready_for_issue` status")
    print("- Totals should be recalculated automatically")
    print("- History should log all changes with user info")
    print("")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("=" * 80)
    
    tester = OrderModificationsTester(BASE_URL)
    
    try:
        success = tester.run_order_modifications_test()
        
        if success:
            print("\n✅ ORDER MODIFICATIONS API TEST PASSED!")
            print("📊 Summary: All Order Modifications API endpoints working correctly")
            print("🎯 Test Results:")
            print("   ✅ API Health: Working correctly")
            print("   ✅ Authentication: Working with provided credentials")
            print("   ✅ Orders for Modification: Found orders with correct status")
            print("   ✅ Add Item: Working with totals recalculation")
            print("   ✅ Update Quantity: Working with proper validation")
            print("   ✅ Remove Item: Working (marked as refused)")
            print("   ✅ Modifications History: Working with proper logging")
            print("   ✅ Refused Items: Working correctly")
            print("   ✅ Restore Item: Working (item restored to active)")
            print("")
            print("🔧 API Endpoints Verified:")
            print("   - GET /api/orders?status=processing")
            print("   - GET /api/products")
            print("   - POST /api/orders/{order_id}/items")
            print("   - PATCH /api/orders/{order_id}/items/{item_id}")
            print("   - DELETE /api/orders/{order_id}/items/{item_id}")
            print("   - GET /api/orders/{order_id}/modifications")
            print("   - GET /api/orders/{order_id}/items/refused")
            print("   - POST /api/orders/{order_id}/items/{item_id}/restore")
            print("")
            print("✅ All key validations passed:")
            print("   - Order status validation working")
            print("   - Totals recalculation working")
            print("   - History logging working")
            print("   - User tracking working")
            sys.exit(0)
        else:
            print("\n❌ ORDER MODIFICATIONS API TEST FAILED!")
            print("📊 Summary: Issues found with Order Modifications API")
            print("🔍 Possible Issues:")
            print("   - Some API endpoints may not be working correctly")
            print("   - Order status validation may be failing")
            print("   - Totals recalculation may not be working")
            print("   - History logging may not be working")
            print("   - Authentication or data retrieval may have failed")
            print("")
            print("🔧 Recommended Investigation:")
            print("   1. Check if order_modifications route is properly included in server.py")
            print("   2. Verify database tables are created correctly")
            print("   3. Check if orders with processing/ready_for_issue status exist")
            print("   4. Verify products are available for testing")
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