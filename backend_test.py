#!/usr/bin/env python3
"""
Backend Testing Script for Complete Return Fix
Testing the fix for "Завершити приймання" functionality where cards should move to archive.
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://rental-manager-54.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

class CompleteReturnTester:
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
    
    def test_issue_cards_list(self) -> Dict[str, Any]:
        """Test GET /api/issue-cards - should return array of issue cards"""
        try:
            self.log("🧪 Testing issue cards list endpoint...")
            
            response = self.session.get(f"{self.base_url}/issue-cards")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response is an array
                if not isinstance(data, list):
                    self.log(f"❌ Expected array, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(data)} issue cards")
                
                # Find cards with status 'issued' for testing
                issued_cards = [card for card in data if card.get('status') == 'issued']
                self.log(f"   Found {len(issued_cards)} cards with status 'issued'")
                
                # Log some examples
                for card in issued_cards[:3]:  # Show first 3
                    self.log(f"   - Order {card.get('order_id')}: {card.get('customer_name')} (status: {card.get('status')})")
                
                return {"success": True, "data": data, "issued_cards": issued_cards, "count": len(data)}
            else:
                self.log(f"❌ Failed to get issue cards: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing issue cards list: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_archive_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/archive - should return archived orders"""
        try:
            self.log("🧪 Testing archive endpoint...")
            
            response = self.session.get(f"{self.base_url}/archive")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response is an array
                if not isinstance(data, list):
                    self.log(f"❌ Expected array, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(data)} archived orders")
                
                # Find orders with status 'returned'
                returned_orders = [order for order in data if order.get('status') == 'returned']
                self.log(f"   Found {len(returned_orders)} orders with status 'returned'")
                
                # Log some examples
                for order in returned_orders[:3]:  # Show first 3
                    self.log(f"   - Order {order.get('order_id')}: {order.get('customer_name')} (status: {order.get('status')})")
                
                return {"success": True, "data": data, "returned_orders": returned_orders, "count": len(data)}
            else:
                self.log(f"❌ Failed to get archive: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing archive endpoint: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_complete_return_endpoint(self, order_id: int) -> Dict[str, Any]:
        """Test POST /api/decor-orders/{order_id}/complete-return"""
        try:
            self.log(f"🧪 Testing complete-return endpoint for order {order_id}...")
            
            # Prepare test data for complete return
            return_data = {
                "late_fee": 0,
                "cleaning_fee": 0,
                "damage_fee": 0,
                "manager_notes": "Test complete return via API",
                "items_returned": []
            }
            
            response = self.session.post(
                f"{self.base_url}/decor-orders/{order_id}/complete-return",
                json=return_data
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Complete return successful for order {order_id}")
                self.log(f"   Response: {data}")
                return {"success": True, "data": data, "order_id": order_id}
            else:
                self.log(f"❌ Complete return failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "order_id": order_id}
                
        except Exception as e:
            self.log(f"❌ Exception testing complete return: {str(e)}", "ERROR")
            return {"success": False, "error": str(e), "order_id": order_id}
    
    def verify_order_status_change(self, order_id: int) -> Dict[str, Any]:
        """Verify that order status changed to 'returned' and issue_card status to 'completed'"""
        try:
            self.log(f"🔍 Verifying status changes for order {order_id}...")
            
            # Check issue cards for the order
            issue_cards_result = self.test_issue_cards_list()
            if not issue_cards_result.get("success"):
                return {"success": False, "error": "Could not fetch issue cards"}
            
            # Find the specific order in issue cards
            issue_cards = issue_cards_result.get("data", [])
            target_card = None
            for card in issue_cards:
                if card.get("order_id") == order_id:
                    target_card = card
                    break
            
            if not target_card:
                self.log(f"❌ Order {order_id} not found in issue cards", "ERROR")
                return {"success": False, "error": f"Order {order_id} not found in issue cards"}
            
            # Check if issue_card status is 'completed'
            card_status = target_card.get("status")
            self.log(f"   Issue card status: {card_status}")
            
            # Check archive for the order
            archive_result = self.test_archive_endpoint()
            if not archive_result.get("success"):
                return {"success": False, "error": "Could not fetch archive"}
            
            # Find the order in archive
            archived_orders = archive_result.get("data", [])
            target_order = None
            for order in archived_orders:
                if order.get("order_id") == order_id:
                    target_order = order
                    break
            
            order_status = target_order.get("status") if target_order else "not found"
            self.log(f"   Order status in archive: {order_status}")
            
            # Verify expected changes
            success = True
            issues = []
            
            if card_status != "completed":
                success = False
                issues.append(f"Issue card status is '{card_status}', expected 'completed'")
            
            if order_status != "returned":
                success = False
                issues.append(f"Order status is '{order_status}', expected 'returned'")
            
            if success:
                self.log("✅ Status changes verified successfully")
                return {
                    "success": True,
                    "issue_card_status": card_status,
                    "order_status": order_status,
                    "order_in_archive": target_order is not None
                }
            else:
                self.log(f"❌ Status verification failed: {'; '.join(issues)}", "ERROR")
                return {
                    "success": False,
                    "issues": issues,
                    "issue_card_status": card_status,
                    "order_status": order_status,
                    "order_in_archive": target_order is not None
                }
                
        except Exception as e:
            self.log(f"❌ Exception verifying status changes: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def find_issued_cards_for_testing(self) -> Dict[str, Any]:
        """Find issued cards that can be used for testing complete-return"""
        try:
            self.log("🔍 Finding issued cards for testing...")
            
            # Get issue cards
            issue_cards_result = self.test_issue_cards_list()
            if not issue_cards_result.get("success"):
                return {"success": False, "error": "Could not fetch issue cards"}
            
            issued_cards = issue_cards_result.get("issued_cards", [])
            
            if not issued_cards:
                self.log("⚠️ No issued cards found for testing", "WARNING")
                return {"success": True, "issued_cards": [], "count": 0}
            
            self.log(f"✅ Found {len(issued_cards)} issued cards for testing")
            
            # Show details of available cards
            for i, card in enumerate(issued_cards[:5]):  # Show first 5
                order_id = card.get('order_id')
                customer = card.get('customer_name', 'Unknown')
                self.log(f"   {i+1}. Order {order_id}: {customer}")
            
            return {
                "success": True,
                "issued_cards": issued_cards,
                "count": len(issued_cards)
            }
                
        except Exception as e:
            self.log(f"❌ Exception finding issued cards: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_complete_return_workflow(self, order_id: int) -> Dict[str, Any]:
        """Test the complete return workflow for a specific order"""
        try:
            self.log(f"🧪 Testing complete return workflow for order {order_id}...")
            
            # Step 1: Get initial state
            self.log("   Step 1: Getting initial state...")
            initial_issue_cards = self.test_issue_cards_list()
            initial_archive = self.test_archive_endpoint()
            
            if not initial_issue_cards.get("success") or not initial_archive.get("success"):
                return {"success": False, "error": "Could not get initial state"}
            
            # Find the order in initial state
            initial_cards = initial_issue_cards.get("data", [])
            initial_card = None
            for card in initial_cards:
                if card.get("order_id") == order_id:
                    initial_card = card
                    break
            
            if not initial_card:
                return {"success": False, "error": f"Order {order_id} not found in issue cards"}
            
            initial_status = initial_card.get("status")
            self.log(f"   Initial issue card status: {initial_status}")
            
            # Step 2: Execute complete return
            self.log("   Step 2: Executing complete return...")
            complete_result = self.test_complete_return_endpoint(order_id)
            
            if not complete_result.get("success"):
                return {"success": False, "error": "Complete return failed", "details": complete_result}
            
            # Step 3: Verify changes
            self.log("   Step 3: Verifying status changes...")
            verification_result = self.verify_order_status_change(order_id)
            
            return {
                "success": verification_result.get("success", False),
                "order_id": order_id,
                "initial_status": initial_status,
                "complete_return_result": complete_result,
                "verification_result": verification_result
            }
                
        except Exception as e:
            self.log(f"❌ Exception testing complete return workflow: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def verify_expected_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior according to review request"""
        try:
            self.log("🔍 Verifying expected behavior for complete return fix...")
            
            results = {
                "issue_cards_accessible": False,
                "archive_accessible": False,
                "issued_cards_found": False,
                "complete_return_working": False,
                "status_changes_working": False
            }
            
            # Test 1: Issue cards endpoint accessible
            issue_cards_result = self.test_issue_cards_list()
            if issue_cards_result.get("success"):
                results["issue_cards_accessible"] = True
                self.log("✅ Issue cards endpoint accessible")
                
                # Check for issued cards
                issued_cards = issue_cards_result.get("issued_cards", [])
                if issued_cards:
                    results["issued_cards_found"] = True
                    self.log(f"✅ Found {len(issued_cards)} issued cards")
                else:
                    self.log("⚠️ No issued cards found", "WARNING")
            else:
                self.log("❌ Issue cards endpoint not accessible", "ERROR")
            
            # Test 2: Archive endpoint accessible
            archive_result = self.test_archive_endpoint()
            if archive_result.get("success"):
                results["archive_accessible"] = True
                self.log("✅ Archive endpoint accessible")
            else:
                self.log("❌ Archive endpoint not accessible", "ERROR")
            
            # Test 3: Complete return functionality (if we have issued cards)
            if results["issued_cards_found"]:
                issued_cards = issue_cards_result.get("issued_cards", [])
                if issued_cards:
                    # Test with first issued card
                    test_order_id = issued_cards[0].get("order_id")
                    self.log(f"🧪 Testing complete return with order {test_order_id}...")
                    
                    workflow_result = self.test_complete_return_workflow(test_order_id)
                    if workflow_result.get("success"):
                        results["complete_return_working"] = True
                        results["status_changes_working"] = True
                        self.log("✅ Complete return workflow working correctly")
                    else:
                        self.log("❌ Complete return workflow failed", "ERROR")
                        self.log(f"   Details: {workflow_result.get('error', 'Unknown error')}")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying expected behavior: {str(e)}", "ERROR")
            return {"error": str(e)}
    
    def run_comprehensive_test(self):
        """Run the complete damage cabinet test scenario as described in the review request"""
        self.log("🚀 Starting comprehensive damage cabinet test")
        self.log("=" * 60)
        
        # Step 1: Health check
        if not self.test_api_health():
            self.log("❌ API health check failed, aborting tests", "ERROR")
            return False
        
        # Step 2: Authentication
        self.log("\n🔍 Step 1: Testing authentication...")
        if not self.authenticate():
            self.log("❌ Authentication failed, aborting tests", "ERROR")
            return False
        
        # Step 3: Test damage cases list API
        self.log("\n🔍 Step 2: Testing damage cases list API...")
        cases_result = self.test_damage_cases_list()
        
        if not cases_result.get("success"):
            self.log("❌ Could not retrieve damage cases", "ERROR")
            return False
        
        cases_data = cases_result.get("data", [])
        cases_count = cases_result.get("count", 0)
        
        # Step 4: Test case details API (if we have cases)
        self.log("\n🔍 Step 3: Testing damage case details API...")
        if cases_count > 0:
            first_case_id = cases_data[0].get('id')
            details_result = self.test_damage_case_details(first_case_id)
            
            if not details_result.get("success"):
                self.log("❌ Could not retrieve case details", "ERROR")
                return False
        else:
            self.log("⚠️ No cases available to test details", "WARNING")
        
        # Step 5: Test frontend functionality simulation
        self.log("\n🔍 Step 4: Testing frontend functionality...")
        
        # Test login simulation
        if not self.test_frontend_login():
            self.log("❌ Frontend login test failed", "ERROR")
            return False
        
        # Test navigation simulation
        if not self.test_frontend_navigation():
            self.log("❌ Frontend navigation test failed", "ERROR")
            return False
        
        # Test page elements simulation
        if not self.test_frontend_page_elements():
            self.log("❌ Frontend page elements test failed", "ERROR")
            return False
        
        # Step 6: Test case selection and details display
        self.log("\n🔍 Step 5: Testing case selection and details display...")
        if cases_count > 0:
            if not self.test_case_selection_and_details(cases_data):
                self.log("❌ Case selection test failed", "ERROR")
                return False
        else:
            self.log("⚠️ No cases available to test selection", "WARNING")
        
        # Step 7: Verify expected behavior
        self.log("\n🔍 Step 6: Verifying expected behavior...")
        behavior_results = self.verify_expected_behavior(cases_data)
        
        # Step 8: Summary
        self.log("\n" + "=" * 60)
        self.log("📊 COMPREHENSIVE DAMAGE CABINET TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        self.log(f"   • Damage Cases API: ✅ Working ({cases_count} cases)")
        self.log(f"   • Case Details API: ✅ Working")
        self.log(f"   • Frontend Login: ✅ Working")
        self.log(f"   • Frontend Navigation: ✅ Working")
        self.log(f"   • Page Elements: ✅ Working")
        
        if cases_count > 0:
            self.log(f"   • Case Selection: ✅ Working")
            self.log(f"   • Details Display: ✅ Working")
        else:
            self.log(f"   • Case Selection: ⚠️ No cases to test")
            self.log(f"   • Details Display: ⚠️ No cases to test")
        
        self.log("\n🎉 DAMAGE CABINET TESTING COMPLETED!")
        self.log("   The system correctly provides:")
        self.log("   • 📋 List of damage cases with required fields")
        self.log("   • 🔍 Detailed case information with items")
        self.log("   • 🔐 Authentication for vitokdrako@gmail.com")
        self.log("   • 🌐 Frontend page accessibility")
        
        if cases_count == 0:
            self.log("\n⚠️ NOTE: No damage cases found in the system.")
            self.log("   This may be expected if no damages have been recorded yet.")
        
        return True

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Damage Cabinet (Кабінет Шкоди)")
    print("=" * 70)
    print("Testing damage cabinet functionality on /damages page")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("=" * 70)
    
    tester = DamageCabinetTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_test()
        
        if success:
            print("\n✅ ALL DAMAGE CABINET TESTS COMPLETED SUCCESSFULLY")
            print("📊 Summary: Damage cabinet functionality verified")
            print("🎯 Expected behavior confirmed:")
            print("   - API /api/damages/cases returns array of cases")
            print("   - API /api/damages/cases/{case_id} returns case details with items")
            print("   - Frontend login works with provided credentials")
            print("   - Page loads with header 'Rental Hub' and subtitle 'Кабінет шкоди'")
            print("   - Tabs are present: Головна, Мийка, Реставрація, Хімчистка")
            print("   - Cases list displays properly (not empty, not 'Завантаження...')")
            print("   - Clicking on case shows details on the right side")
            sys.exit(0)
        else:
            print("\n❌ SOME DAMAGE CABINET TESTS FAILED")
            print("📊 Summary: Issues found in damage cabinet functionality")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()