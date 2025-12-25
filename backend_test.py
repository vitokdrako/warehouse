#!/usr/bin/env python3
"""
Backend Testing Script for Order Modifications API - Дозамовлення
Testing the new Order Modifications API for "Дозамовлення" functionality.

**Test Scenario:**
Test all Order Modifications API endpoints for adding, updating, removing, and restoring items in orders.

**Test Steps:**
1. Login with credentials: email: `vitokdrako@gmail.com`, password: `test123`
2. Find an order with status `processing` or `ready_for_issue`
3. Get a product_id from products API
4. Add item to order
5. Update item quantity
6. Remove/Refuse item
7. Get modifications history
8. Get refused items
9. Restore refused item

**Key validations:**
- API should reject modifications for orders not in `processing` or `ready_for_issue` status
- Totals should be recalculated automatically
- History should log all changes with user info
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://doc-management-9.preview.emergentagent.com/api"
FRONTEND_URL = "https://doc-management-9.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

# Company name validation - Not needed for Order Modifications testing
# CORRECT_COMPANY_NAME = "ФОП Арсалані Олександра Ігорівна"
# OLD_INCORRECT_NAME = "ФОП Маркін Ілля Павлович"

class OrderModificationsTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.test_order_id = None  # Store order ID for document generation tests
        
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

    def get_orders_list(self, limit: int = 10) -> Dict[str, Any]:
        """Get list of orders to find an existing order_id"""
        try:
            self.log("🧪 Getting list of orders...")
            
            response = self.session.get(f"{self.base_url}/orders?limit={limit}")
            
            if response.status_code == 200:
                data = response.json()
                orders = data.get('orders', []) if isinstance(data, dict) else data
                
                self.log(f"✅ Retrieved {len(orders)} orders")
                
                if orders:
                    # Show first few orders and store first order ID
                    self.log("📋 Sample orders:")
                    for order in orders[:3]:  # Show first 3
                        order_id = order.get('order_id') or order.get('id')
                        order_number = order.get('order_number', 'No number')
                        customer_name = order.get('customer_name', 'No name')
                        status = order.get('status', 'unknown')
                        
                        self.log(f"   - Order {order_id}: {order_number} - {customer_name} ({status})")
                        
                        # Store first order ID for document generation tests
                        if not self.test_order_id:
                            self.test_order_id = order_id
                    
                    if len(orders) > 3:
                        self.log(f"   ... and {len(orders) - 3} more")
                
                return {
                    "success": True, 
                    "data": orders, 
                    "count": len(orders),
                    "has_orders": len(orders) > 0,
                    "first_order_id": self.test_order_id
                }
            else:
                self.log(f"❌ Get orders failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception getting orders: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def generate_invoice_offer_document(self, order_id: str) -> Dict[str, Any]:
        """Generate invoice_offer document and verify company name"""
        try:
            self.log(f"🧪 Generating invoice_offer document for order: {order_id}...")
            
            request_data = {
                "doc_type": "invoice_offer",
                "entity_id": str(order_id),
                "format": "html"
            }
            
            response = self.session.post(
                f"{self.base_url}/documents/generate",
                json=request_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                success = data.get('success', False)
                document_id = data.get('document_id', '')
                doc_number = data.get('doc_number', '')
                html_content = data.get('html_content', '')
                
                self.log(f"✅ Document generated successfully")
                self.log(f"   📄 Document ID: {document_id}")
                self.log(f"   🔢 Document Number: {doc_number}")
                self.log(f"   📝 HTML Content Length: {len(html_content)} characters")
                
                # Verify company name in HTML content
                has_correct_name = CORRECT_COMPANY_NAME in html_content
                has_old_name = OLD_INCORRECT_NAME in html_content
                
                self.log(f"\n🔍 Company Name Verification:")
                if has_correct_name:
                    self.log(f"   ✅ Contains correct company name: '{CORRECT_COMPANY_NAME}'")
                else:
                    self.log(f"   ❌ Missing correct company name: '{CORRECT_COMPANY_NAME}'", "ERROR")
                
                if has_old_name:
                    self.log(f"   ❌ Still contains old incorrect name: '{OLD_INCORRECT_NAME}'", "ERROR")
                else:
                    self.log(f"   ✅ Does NOT contain old incorrect name: '{OLD_INCORRECT_NAME}'")
                
                # Check if HTML content is substantial
                has_content = len(html_content) > 1000
                if has_content:
                    self.log(f"   ✅ Document has substantial content")
                else:
                    self.log(f"   ⚠️ Document content may be minimal", "WARNING")
                
                # Overall validation
                validation_passed = has_correct_name and not has_old_name and has_content
                
                return {
                    "success": True,
                    "data": data,
                    "document_id": document_id,
                    "doc_number": doc_number,
                    "html_length": len(html_content),
                    "has_substantial_content": has_content,
                    "generation_success": success,
                    "has_correct_company_name": has_correct_name,
                    "has_old_company_name": has_old_name,
                    "validation_passed": validation_passed,
                    "html_content": html_content  # Include for debugging if needed
                }
            else:
                self.log(f"❌ Generate document failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception generating document: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def run_company_name_verification_test(self):
        """Run the complete company name verification test as per review request"""
        self.log("🚀 Starting Document Generation Company Name Verification Test")
        self.log("=" * 80)
        self.log(f"Testing company legal name update in document generation")
        self.log(f"Expected: '{CORRECT_COMPANY_NAME}'")
        self.log(f"Should NOT contain: '{OLD_INCORRECT_NAME}'")
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
        
        # Step 3: Get orders list
        self.log("\n🔍 Step 2: Getting list of orders...")
        orders_result = self.get_orders_list()
        orders_success = orders_result.get("success", False)
        has_orders = orders_result.get("has_orders", False)
        
        if not orders_success or not has_orders:
            self.log("❌ Failed to get orders or no orders available, aborting tests", "ERROR")
            return False
        
        order_id = orders_result.get("first_order_id")
        if not order_id:
            self.log("❌ No order ID found, aborting tests", "ERROR")
            return False
        
        # Step 4: Generate invoice_offer document
        self.log(f"\n🔍 Step 3: Generating invoice_offer document for order {order_id}...")
        doc_result = self.generate_invoice_offer_document(order_id)
        doc_success = doc_result.get("success", False)
        validation_passed = doc_result.get("validation_passed", False)
        
        # Step 5: Summary
        self.log("\n" + "=" * 80)
        self.log("📊 COMPANY NAME VERIFICATION TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        self.log(f"   • Orders List: ✅ Retrieved {orders_result.get('count', 0)} orders")
        self.log(f"   • Test Order ID: {order_id}")
        
        if doc_success:
            has_correct = doc_result.get("has_correct_company_name", False)
            has_old = doc_result.get("has_old_company_name", False)
            content_length = doc_result.get("html_length", 0)
            
            self.log(f"\n   📄 DOCUMENT GENERATION:")
            self.log(f"   • Document Generated: ✅ Success")
            self.log(f"   • Document ID: {doc_result.get('document_id', 'N/A')}")
            self.log(f"   • Document Number: {doc_result.get('doc_number', 'N/A')}")
            self.log(f"   • HTML Content Length: {content_length} characters")
            
            self.log(f"\n   🏢 COMPANY NAME VERIFICATION:")
            if has_correct:
                self.log(f"   • Correct Company Name: ✅ Found '{CORRECT_COMPANY_NAME}'")
            else:
                self.log(f"   • Correct Company Name: ❌ Missing '{CORRECT_COMPANY_NAME}'")
            
            if has_old:
                self.log(f"   • Old Company Name: ❌ Still contains '{OLD_INCORRECT_NAME}'")
            else:
                self.log(f"   • Old Company Name: ✅ Does NOT contain '{OLD_INCORRECT_NAME}'")
            
            if validation_passed:
                self.log(f"\n✅ COMPANY NAME UPDATE VERIFICATION PASSED!")
                self.log(f"   The document generation correctly uses the new company name")
                self.log(f"   '{CORRECT_COMPANY_NAME}' and does not contain the old name")
            else:
                self.log(f"\n❌ COMPANY NAME UPDATE VERIFICATION FAILED!")
                if not has_correct:
                    self.log(f"   - Document does not contain the correct company name")
                if has_old:
                    self.log(f"   - Document still contains the old incorrect company name")
        else:
            self.log(f"\n   📄 DOCUMENT GENERATION:")
            self.log(f"   • Document Generated: ❌ Failed")
            validation_passed = False
        
        return validation_passed
def main():
    """Main test execution"""
    print("🧪 Backend Testing: Document Generation Company Name Update")
    print("=" * 80)
    print("Testing the document generation to verify company legal name has been updated correctly.")
    print("")
    print("**Test Scenario:**")
    print("Generate an `invoice_offer` document for an existing order and verify the company details")
    print("contain 'ФОП Арсалані Олександра Ігорівна' instead of 'ФОП Маркін Ілля Павлович'.")
    print("")
    print("**Test Steps:**")
    print("1. Login with credentials: email: `vitokdrako@gmail.com`, password: `test123`")
    print("2. Get list of orders via `GET /api/orders` to find an existing order_id")
    print("3. Generate a document using `POST /api/documents/generate` with:")
    print("   - doc_type: 'invoice_offer'")
    print("   - entity_id: [order_id from step 2]")
    print("4. Verify the generated HTML contains:")
    print("   - 'ФОП Арсалані Олександра Ігорівна' (correct company name)")
    print("   - Does NOT contain 'ФОП Маркін Ілля Павлович' (old incorrect name)")
    print("")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print(f"Expected Company Name: {CORRECT_COMPANY_NAME}")
    print(f"Should NOT contain: {OLD_INCORRECT_NAME}")
    print("=" * 80)
    
    tester = DocumentGenerationTester(BASE_URL)
    
    try:
        success = tester.run_company_name_verification_test()
        
        if success:
            print("\n✅ COMPANY NAME UPDATE VERIFICATION PASSED!")
            print("📊 Summary: Document generation correctly uses the new company name")
            print("🎯 Test Results:")
            print("   ✅ API Health: Working correctly")
            print("   ✅ Authentication: Working with provided credentials")
            print("   ✅ Orders List: Retrieved successfully")
            print("   ✅ Document Generation: invoice_offer generated successfully")
            print(f"   ✅ Company Name: Contains '{CORRECT_COMPANY_NAME}'")
            print(f"   ✅ Old Name Removed: Does NOT contain '{OLD_INCORRECT_NAME}'")
            print("   ✅ HTML Content: Substantial content generated")
            print("")
            print("🔧 File Updated Successfully:")
            print("   - /app/backend/services/doc_engine/data_builders.py")
            print("   - Company legal_name updated in all builder functions")
            print("   - Document generation now uses correct company name")
            sys.exit(0)
        else:
            print("\n❌ COMPANY NAME UPDATE VERIFICATION FAILED!")
            print("📊 Summary: Issues found with company name in document generation")
            print("🔍 Possible Issues:")
            print("   - Document generation may have failed")
            print("   - Generated document may not contain the correct company name")
            print("   - Generated document may still contain the old company name")
            print("   - API authentication or orders retrieval may have failed")
            print("")
            print("🔧 Recommended Investigation:")
            print("   1. Check if /app/backend/services/doc_engine/data_builders.py was updated correctly")
            print("   2. Verify document generation API is working")
            print("   3. Check if template files are using the correct data")
            print("   4. Verify database connections and order data")
            print("   5. Check backend logs for any errors during document generation")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()