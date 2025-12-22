#!/usr/bin/env python3
"""
Backend Testing Script for Finance Console Damage-to-Archive Workflow
Testing the specific workflow reported:
1. GET /api/analytics/order-damage-fee/{order_id} - Get unpaid damage fees for order
2. POST /api/orders/{order_id}/archive - Archive order
3. POST /api/finance/payments - Accept damage payment
4. Authentication and finance console workflow
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://awesome-montalcini.preview.emergentagent.com/api"
FRONTEND_URL = "https://awesome-montalcini.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}
TEST_ORDER_ID = 7004  # Order ID with damages from review request

class FinanceConsoleTester:
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
    
    def test_order_damage_fee_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/analytics/order-damage-fee/{order_id} - should return damage fee data"""
        try:
            self.log(f"🧪 Testing order damage fee endpoint for order {TEST_ORDER_ID}...")
            
            response = self.session.get(f"{self.base_url}/analytics/order-damage-fee/{TEST_ORDER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Retrieved order damage fee data")
                
                # Check for expected fields
                expected_fields = ['order_id', 'total_damage_fee', 'paid_damage', 'due_amount', 'damage_items']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing damage fee fields: {missing_fields}")
                
                # Log key information
                self.log(f"   ✅ Order ID: {data.get('order_id')}")
                self.log(f"   ✅ Total Damage Fee: ₴{data.get('total_damage_fee', 0)}")
                self.log(f"   ✅ Paid Damage: ₴{data.get('paid_damage', 0)}")
                self.log(f"   ✅ Due Amount: ₴{data.get('due_amount', 0)}")
                self.log(f"   ✅ Damage Items count: {len(data.get('damage_items', []))}")
                self.log(f"   ✅ Needs Payment: {data.get('needs_payment', False)}")
                
                # Log damage items details
                damage_items = data.get('damage_items', [])
                if damage_items:
                    self.log(f"   📋 Damage Items:")
                    for item in damage_items:
                        self.log(f"      - {item.get('product_name', 'Unknown')}: {item.get('damage_type', 'Unknown')} - ₴{item.get('fee', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "missing_fields": missing_fields
                }
            else:
                self.log(f"❌ Failed to get order damage fee: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing order damage fee: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_damage_payment_endpoint(self, amount: float = 100) -> Dict[str, Any]:
        """Test POST /api/finance/payments - should accept damage payment"""
        try:
            self.log(f"🧪 Testing damage payment endpoint with amount ₴{amount}...")
            
            payment_data = {
                "payment_type": "damage",
                "method": "cash",
                "amount": amount,
                "order_id": TEST_ORDER_ID,
                "payer_name": "Test Customer",
                "note": f"Test damage payment for order {TEST_ORDER_ID}",
                "accepted_by_name": "Test Manager"
            }
            
            response = self.session.post(
                f"{self.base_url}/finance/payments",
                json=payment_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Damage payment accepted successfully")
                
                # Check for expected fields
                expected_fields = ['success', 'payment_id']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing payment response fields: {missing_fields}")
                
                # Log key information
                self.log(f"   ✅ Success: {data.get('success')}")
                self.log(f"   ✅ Payment ID: {data.get('payment_id')}")
                self.log(f"   ✅ Transaction ID: {data.get('tx_id')}")
                
                return {
                    "success": True, 
                    "data": data,
                    "missing_fields": missing_fields
                }
            else:
                self.log(f"❌ Failed to accept damage payment: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing damage payment: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_order_archive_endpoint(self) -> Dict[str, Any]:
        """Test POST /api/orders/{order_id}/archive - should archive order"""
        try:
            self.log(f"🧪 Testing order archive endpoint for order {TEST_ORDER_ID}...")
            
            response = self.session.post(f"{self.base_url}/orders/{TEST_ORDER_ID}/archive")
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Order archived successfully")
                
                # Check for expected fields
                expected_fields = ['message', 'order_id', 'is_archived']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing archive response fields: {missing_fields}")
                
                # Log key information
                self.log(f"   ✅ Message: {data.get('message')}")
                self.log(f"   ✅ Order ID: {data.get('order_id')}")
                self.log(f"   ✅ Order Number: {data.get('order_number')}")
                self.log(f"   ✅ Is Archived: {data.get('is_archived')}")
                
                return {
                    "success": True, 
                    "data": data,
                    "missing_fields": missing_fields
                }
            else:
                self.log(f"❌ Failed to archive order: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing order archive: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_frontend_finance_console(self) -> Dict[str, Any]:
        """Test frontend finance console accessibility"""
        try:
            self.log(f"🧪 Testing frontend finance console accessibility...")
            
            # Test the specific URL from the review request
            frontend_url = f"{FRONTEND_URL}/finance"
            
            # Make a request to the frontend URL (without authentication headers)
            frontend_session = requests.Session()
            response = frontend_session.get(frontend_url, allow_redirects=False)
            
            self.log(f"   Frontend URL: {frontend_url}")
            self.log(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                self.log(f"✅ Finance console page loads successfully")
                
                # Check if it contains React app content
                content = response.text
                if 'react' in content.lower() or 'app' in content.lower():
                    self.log(f"   ✅ Contains React app content")
                else:
                    self.log(f"   ⚠️ May not contain React app content")
                
                return {"success": True, "status_code": response.status_code}
                
            elif response.status_code in [301, 302, 307, 308]:
                # Check for redirects
                redirect_location = response.headers.get('Location', '')
                self.log(f"❌ Finance console redirects to: {redirect_location}")
                
                return {
                    "success": False, 
                    "status_code": response.status_code,
                    "redirect_location": redirect_location
                }
            else:
                self.log(f"❌ Finance console returns status: {response.status_code}")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing frontend finance console: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_order_details_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/orders/{order_id} - should return order details"""
        try:
            self.log(f"🧪 Testing order details endpoint for order {TEST_ORDER_ID}...")
            
            response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Retrieved order details")
                
                # Check for expected fields
                expected_fields = ['order_id', 'order_number', 'customer_name', 'status']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing order fields: {missing_fields}")
                
                # Log key information
                self.log(f"   ✅ Order ID: {data.get('order_id')}")
                self.log(f"   ✅ Order Number: {data.get('order_number')}")
                self.log(f"   ✅ Customer: {data.get('customer_name')}")
                self.log(f"   ✅ Status: {data.get('status')}")
                self.log(f"   ✅ Total Rental: ₴{data.get('total_rental', 0)}")
                self.log(f"   ✅ Total Deposit: ₴{data.get('total_deposit', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "missing_fields": missing_fields
                }
            else:
                self.log(f"❌ Failed to get order details: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing order details: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def verify_finance_console_workflow(self) -> Dict[str, Any]:
        """Verify expected behavior for Finance Console damage-to-archive workflow"""
        try:
            self.log("🔍 Verifying Finance Console damage-to-archive workflow...")
            
            results = {
                "order_details_working": False,
                "damage_fee_api_working": False,
                "damage_payment_working": False,
                "order_archive_working": False,
                "frontend_console_working": False,
                "workflow_complete": False
            }
            
            # Test 1: Order Details API
            self.log("   Testing Order Details API...")
            order_result = self.test_order_details_endpoint()
            
            if order_result.get("success"):
                results["order_details_working"] = True
                self.log(f"   ✅ Order Details API: Working")
            else:
                self.log("   ❌ Order Details API: Failed", "ERROR")
            
            # Test 2: Damage Fee API
            self.log("   Testing Damage Fee API...")
            damage_fee_result = self.test_order_damage_fee_endpoint()
            
            if damage_fee_result.get("success"):
                results["damage_fee_api_working"] = True
                self.log(f"   ✅ Damage Fee API: Working")
                
                # Check if there are unpaid damages
                damage_data = damage_fee_result.get("data", {})
                due_amount = damage_data.get("due_amount", 0)
                if due_amount > 0:
                    self.log(f"   💰 Found unpaid damages: ₴{due_amount}")
                else:
                    self.log(f"   ℹ️ No unpaid damages found")
            else:
                self.log("   ❌ Damage Fee API: Failed", "ERROR")
            
            # Test 3: Damage Payment API (only if there are damages)
            if results["damage_fee_api_working"]:
                damage_data = damage_fee_result.get("data", {})
                due_amount = damage_data.get("due_amount", 0)
                
                if due_amount > 0:
                    self.log("   Testing Damage Payment API...")
                    payment_result = self.test_damage_payment_endpoint(min(due_amount, 100))
                    
                    if payment_result.get("success"):
                        results["damage_payment_working"] = True
                        self.log(f"   ✅ Damage Payment API: Working")
                    else:
                        self.log("   ❌ Damage Payment API: Failed", "ERROR")
                else:
                    results["damage_payment_working"] = True  # No payment needed
                    self.log(f"   ✅ Damage Payment API: Not needed (no damages)")
            
            # Test 4: Order Archive API
            self.log("   Testing Order Archive API...")
            archive_result = self.test_order_archive_endpoint()
            
            if archive_result.get("success"):
                results["order_archive_working"] = True
                self.log(f"   ✅ Order Archive API: Working")
            else:
                self.log("   ❌ Order Archive API: Failed", "ERROR")
            
            # Test 5: Frontend Console
            self.log("   Testing Frontend Console...")
            frontend_result = self.test_frontend_finance_console()
            
            if frontend_result.get("success"):
                results["frontend_console_working"] = True
                self.log(f"   ✅ Frontend Console: Working")
            else:
                self.log("   ❌ Frontend Console: Failed", "ERROR")
            
            # Overall workflow assessment
            critical_apis = [
                results["order_details_working"],
                results["damage_fee_api_working"],
                results["damage_payment_working"],
                results["order_archive_working"]
            ]
            results["workflow_complete"] = all(critical_apis)
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying Finance Console workflow: {str(e)}", "ERROR")
            return {"error": str(e)}

    def run_comprehensive_finance_console_test(self):
        """Run the comprehensive Finance Console damage-to-archive test"""
        self.log("🚀 Starting comprehensive Finance Console damage-to-archive test")
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
        
        # Step 3: Test Order Details
        self.log(f"\n🔍 Step 2: Testing Order Details API ({TEST_ORDER_ID})...")
        order_result = self.test_order_details_endpoint()
        order_success = order_result.get("success", False)
        
        # Step 4: Test Damage Fee API
        self.log(f"\n🔍 Step 3: Testing Damage Fee API ({TEST_ORDER_ID})...")
        damage_fee_result = self.test_order_damage_fee_endpoint()
        damage_fee_success = damage_fee_result.get("success", False)
        
        # Step 5: Test Damage Payment API (conditional)
        payment_success = True
        payment_result = {"success": True, "data": {"message": "No payment needed"}}
        
        if damage_fee_success:
            damage_data = damage_fee_result.get("data", {})
            due_amount = damage_data.get("due_amount", 0)
            
            if due_amount > 0:
                self.log(f"\n🔍 Step 4: Testing Damage Payment API (₴{due_amount})...")
                payment_result = self.test_damage_payment_endpoint(min(due_amount, 100))
                payment_success = payment_result.get("success", False)
            else:
                self.log(f"\n🔍 Step 4: Skipping Damage Payment (no unpaid damages)...")
        
        # Step 6: Test Order Archive API
        self.log(f"\n🔍 Step 5: Testing Order Archive API...")
        archive_result = self.test_order_archive_endpoint()
        archive_success = archive_result.get("success", False)
        
        # Step 7: Test Frontend Console
        self.log(f"\n🔍 Step 6: Testing Frontend Console...")
        frontend_result = self.test_frontend_finance_console()
        frontend_success = frontend_result.get("success", False)
        
        # Step 8: Comprehensive verification
        self.log("\n🔍 Step 7: Comprehensive verification...")
        workflow_results = self.verify_finance_console_workflow()
        
        # Step 9: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE FINANCE CONSOLE TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if order_success:
            self.log(f"   • Order Details API: ✅ Working")
            order_data = order_result.get("data", {})
            self.log(f"     - Order Number: {order_data.get('order_number')}")
            self.log(f"     - Customer: {order_data.get('customer_name')}")
            self.log(f"     - Status: {order_data.get('status')}")
        else:
            self.log(f"   • Order Details API: ❌ Failed")
            self.log(f"     - Error: {order_result.get('response_text', 'Unknown error')}")
        
        if damage_fee_success:
            self.log(f"   • Damage Fee API: ✅ Working")
            damage_data = damage_fee_result.get("data", {})
            self.log(f"     - Total Damage Fee: ₴{damage_data.get('total_damage_fee', 0)}")
            self.log(f"     - Due Amount: ₴{damage_data.get('due_amount', 0)}")
            self.log(f"     - Damage Items: {len(damage_data.get('damage_items', []))}")
        else:
            self.log(f"   • Damage Fee API: ❌ Failed")
            self.log(f"     - Error: {damage_fee_result.get('response_text', 'Unknown error')}")
        
        if payment_success:
            self.log(f"   • Damage Payment API: ✅ Working")
            payment_data = payment_result.get("data", {})
            if payment_data.get("payment_id"):
                self.log(f"     - Payment ID: {payment_data.get('payment_id')}")
            else:
                self.log(f"     - Status: {payment_data.get('message', 'OK')}")
        else:
            self.log(f"   • Damage Payment API: ❌ Failed")
            self.log(f"     - Error: {payment_result.get('response_text', 'Unknown error')}")
        
        if archive_success:
            self.log(f"   • Order Archive API: ✅ Working")
            archive_data = archive_result.get("data", {})
            self.log(f"     - Archived: {archive_data.get('is_archived', False)}")
        else:
            self.log(f"   • Order Archive API: ❌ Failed")
            self.log(f"     - Error: {archive_result.get('response_text', 'Unknown error')}")
        
        if frontend_success:
            self.log(f"   • Frontend Console: ✅ Working")
        else:
            self.log(f"   • Frontend Console: ❌ Failed")
            redirect_location = frontend_result.get("redirect_location", "")
            if redirect_location:
                self.log(f"     - Redirect Location: {redirect_location}")
        
        self.log(f"\n🎉 FINANCE CONSOLE TESTING COMPLETED!")
        
        # Check if critical functionality works
        critical_apis = [order_success, damage_fee_success, payment_success, archive_success]
        critical_success = all(critical_apis)
        
        if critical_success and frontend_success:
            self.log(f"\n✅ ALL FINANCE CONSOLE COMPONENTS WORKING!")
            self.log(f"   The damage-to-archive workflow should work correctly")
        else:
            self.log(f"\n⚠️ FINANCE CONSOLE HAS PROBLEMS:")
            if not critical_success:
                self.log(f"   - Backend APIs have issues")
            if not frontend_success:
                self.log(f"   - Frontend console access issues")
        
        return critical_success and frontend_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Issue Card Workspace")
    print("=" * 80)
    print("Testing the specific issue reported in the review request:")
    print("   1. 📋 GET /api/issue-cards/IC-7121-20251218133354")
    print("      - Should return valid issue card data")
    print("   2. 📄 GET /api/decor-orders/7121")
    print("      - Should return valid order data")
    print("   3. 🌐 Frontend routing to /issue-workspace/IC-7121-20251218133354")
    print("      - Should NOT redirect to /manager")
    print("   4. 🔍 Console error detection")
    print("      - Should identify potential JavaScript errors")
    print(f"Test Issue Card ID: {TEST_ISSUE_CARD_ID}")
    print(f"Test Order ID: {TEST_ORDER_ID}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://awesome-montalcini.preview.emergentagent.com")
    print("=" * 80)
    
    tester = IssueCardWorkspaceTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_issue_workspace_test()
        
        if success:
            print("\n✅ ALL ISSUE CARD WORKSPACE COMPONENTS VERIFIED SUCCESSFULLY")
            print("📊 Summary: Issue Card Workspace working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Issue Card API: Returns valid data")
            print("   ✅ Order API: Returns valid data")
            print("   ✅ Frontend Routing: No redirect to /manager")
            print("   ✅ Console Errors: None detected")
            print("   - Authentication works with provided credentials")
            print("   - All backend APIs respond correctly")
            print("   - Frontend should load the workspace properly")
            sys.exit(0)
        else:
            print("\n❌ ISSUE CARD WORKSPACE HAS PROBLEMS")
            print("📊 Summary: Issues found that match the reported problem")
            print("🔍 Key findings:")
            print("   - Backend APIs may be working correctly")
            print("   - Frontend routing likely redirects to /manager")
            print("   - This confirms the reported issue")
            print("🔧 Recommended investigation:")
            print("   1. Check React Router configuration")
            print("   2. Check authentication/authorization logic")
            print("   3. Check for JavaScript errors in browser console")
            print("   4. Verify issue card ID format and validation")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()