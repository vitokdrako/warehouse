#!/usr/bin/env python3
"""
Backend Testing Script for Issue Card Workspace
Testing the specific issue reported:
1. GET /api/issue-cards/IC-7121-20251218133354 - Issue card data
2. GET /api/decor-orders/7121 - Order data
3. Frontend routing to /issue-workspace/IC-7121-20251218133354
4. Authentication and workspace loading workflow
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://docflow-134.preview.emergentagent.com/api"
FRONTEND_URL = "https://docflow-134.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}
TEST_ISSUE_CARD_ID = "IC-7121-20251218133354"  # Issue card from review request
TEST_ORDER_ID = "7121"  # Order ID from review request

class IssueCardWorkspaceTester:
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
    
    def test_issue_card_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/issue-cards/{id} - should return issue card data"""
        try:
            self.log(f"🧪 Testing issue card endpoint for {TEST_ISSUE_CARD_ID}...")
            
            response = self.session.get(f"{self.base_url}/issue-cards/{TEST_ISSUE_CARD_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Retrieved issue card data")
                
                # Check for expected fields
                expected_fields = ['id', 'order_id', 'order_number', 'status', 'items']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing issue card fields: {missing_fields}")
                
                # Log key information
                self.log(f"   ✅ Issue Card ID: {data.get('id')}")
                self.log(f"   ✅ Order ID: {data.get('order_id')}")
                self.log(f"   ✅ Order Number: {data.get('order_number')}")
                self.log(f"   ✅ Status: {data.get('status')}")
                self.log(f"   ✅ Items count: {len(data.get('items', []))}")
                
                return {
                    "success": True, 
                    "data": data,
                    "missing_fields": missing_fields
                }
            else:
                self.log(f"❌ Failed to get issue card: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing issue card: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_decor_order_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/decor-orders/{id} - should return order data"""
        try:
            self.log(f"🧪 Testing decor order endpoint for order {TEST_ORDER_ID}...")
            
            response = self.session.get(f"{self.base_url}/decor-orders/{TEST_ORDER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Retrieved order data")
                
                # Check for expected fields
                expected_fields = ['order_id', 'order_number', 'customer_name', 'status', 'items']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing order fields: {missing_fields}")
                
                # Log key information
                self.log(f"   ✅ Order ID: {data.get('order_id')}")
                self.log(f"   ✅ Order Number: {data.get('order_number')}")
                self.log(f"   ✅ Customer: {data.get('customer_name')}")
                self.log(f"   ✅ Status: {data.get('status')}")
                self.log(f"   ✅ Items count: {len(data.get('items', []))}")
                
                return {
                    "success": True, 
                    "data": data,
                    "missing_fields": missing_fields
                }
            else:
                self.log(f"❌ Failed to get order: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing order: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_frontend_routing(self) -> Dict[str, Any]:
        """Test frontend routing to issue workspace"""
        try:
            self.log(f"🧪 Testing frontend routing to issue workspace...")
            
            # Test the specific URL from the review request
            frontend_url = f"{FRONTEND_URL}/issue-workspace/{TEST_ISSUE_CARD_ID}"
            
            # Make a request to the frontend URL (without authentication headers)
            frontend_session = requests.Session()
            response = frontend_session.get(frontend_url, allow_redirects=False)
            
            self.log(f"   Frontend URL: {frontend_url}")
            self.log(f"   Response status: {response.status_code}")
            
            if response.status_code == 200:
                self.log(f"✅ Frontend page loads successfully")
                
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
                self.log(f"❌ Frontend redirects to: {redirect_location}")
                
                if '/manager' in redirect_location:
                    self.log(f"   ❌ CONFIRMED: Redirecting to /manager (this is the reported issue)")
                
                return {
                    "success": False, 
                    "status_code": response.status_code,
                    "redirect_location": redirect_location,
                    "issue_confirmed": '/manager' in redirect_location
                }
            else:
                self.log(f"❌ Frontend returns status: {response.status_code}")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing frontend routing: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_browser_console_simulation(self) -> Dict[str, Any]:
        """Simulate browser console errors that might occur"""
        try:
            self.log(f"🧪 Checking for potential JavaScript/console errors...")
            
            # Check if the issue card exists and has proper data structure
            issue_result = self.test_issue_card_endpoint()
            order_result = self.test_decor_order_endpoint()
            
            potential_issues = []
            
            if not issue_result.get("success"):
                potential_issues.append("Issue card API fails - would cause frontend error")
            
            if not order_result.get("success"):
                potential_issues.append("Order API fails - would cause frontend error")
            
            # Check for data consistency
            if issue_result.get("success") and order_result.get("success"):
                issue_data = issue_result.get("data", {})
                order_data = order_result.get("data", {})
                
                issue_order_id = issue_data.get("order_id")
                order_id = order_data.get("order_id")
                
                if str(issue_order_id) != str(order_id):
                    potential_issues.append(f"Order ID mismatch: issue_card.order_id={issue_order_id}, order.order_id={order_id}")
            
            if potential_issues:
                self.log(f"❌ Found potential console errors:")
                for issue in potential_issues:
                    self.log(f"   - {issue}")
                return {"success": False, "potential_issues": potential_issues}
            else:
                self.log(f"✅ No obvious console error sources detected")
                return {"success": True, "potential_issues": []}
                
        except Exception as e:
            self.log(f"❌ Exception checking console errors: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_document_preview(self, document_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/{document_id}/preview - should return HTML preview"""
        try:
            self.log(f"🧪 Testing document preview for document {document_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/{document_id}/preview")
            
            if response.status_code == 200:
                html_content = response.text
                
                self.log(f"✅ Retrieved document preview ({len(html_content)} chars)")
                
                # Check HTML structure
                if '<html' not in html_content.lower():
                    self.log(f"⚠️ Preview doesn't contain proper HTML structure")
                
                return {
                    "success": True, 
                    "html_content": html_content,
                    "html_length": len(html_content)
                }
            else:
                self.log(f"❌ Failed to get document preview: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing document preview: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    
    def test_document_pdf(self, document_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/{document_id}/pdf - should return PDF file"""
        try:
            self.log(f"🧪 Testing document PDF generation for document {document_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/{document_id}/pdf")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                self.log(f"✅ Retrieved PDF document ({content_length} bytes)")
                
                # Check PDF content type
                if 'application/pdf' not in content_type:
                    self.log(f"⚠️ Unexpected content type: {content_type}")
                
                # Check PDF magic bytes
                if not response.content.startswith(b'%PDF'):
                    self.log(f"⚠️ Content doesn't start with PDF magic bytes")
                
                return {
                    "success": True, 
                    "content_type": content_type,
                    "content_length": content_length
                }
            else:
                self.log(f"❌ Failed to get document PDF: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing document PDF: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def verify_issue_workspace_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior for Issue Card Workspace"""
        try:
            self.log("🔍 Verifying Issue Card Workspace behavior...")
            
            results = {
                "issue_card_api_working": False,
                "order_api_working": False,
                "frontend_routing_working": False,
                "console_errors_detected": False,
                "redirect_issue_confirmed": False
            }
            
            # Test 1: Issue Card API
            self.log("   Testing Issue Card API...")
            issue_result = self.test_issue_card_endpoint()
            
            if issue_result.get("success"):
                results["issue_card_api_working"] = True
                self.log(f"   ✅ Issue Card API: Working")
            else:
                self.log("   ❌ Issue Card API: Failed", "ERROR")
            
            # Test 2: Order API
            self.log("   Testing Order API...")
            order_result = self.test_decor_order_endpoint()
            
            if order_result.get("success"):
                results["order_api_working"] = True
                self.log(f"   ✅ Order API: Working")
            else:
                self.log("   ❌ Order API: Failed", "ERROR")
            
            # Test 3: Frontend Routing
            self.log("   Testing Frontend Routing...")
            routing_result = self.test_frontend_routing()
            
            if routing_result.get("success"):
                results["frontend_routing_working"] = True
                self.log(f"   ✅ Frontend Routing: Working")
            else:
                results["redirect_issue_confirmed"] = routing_result.get("issue_confirmed", False)
                self.log("   ❌ Frontend Routing: Failed", "ERROR")
            
            # Test 4: Console Error Detection
            self.log("   Checking for Console Errors...")
            console_result = self.test_browser_console_simulation()
            
            if not console_result.get("success"):
                results["console_errors_detected"] = True
                self.log("   ❌ Potential Console Errors: Detected", "ERROR")
            else:
                self.log(f"   ✅ Console Errors: None detected")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying Issue Workspace behavior: {str(e)}", "ERROR")
            return {"error": str(e)}

    def run_comprehensive_issue_workspace_test(self):
        """Run the comprehensive Issue Card Workspace test"""
        self.log("🚀 Starting comprehensive Issue Card Workspace test")
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
        
        # Step 3: Test Issue Card API
        self.log(f"\n🔍 Step 2: Testing Issue Card API ({TEST_ISSUE_CARD_ID})...")
        issue_result = self.test_issue_card_endpoint()
        issue_success = issue_result.get("success", False)
        
        # Step 4: Test Order API
        self.log(f"\n🔍 Step 3: Testing Order API ({TEST_ORDER_ID})...")
        order_result = self.test_decor_order_endpoint()
        order_success = order_result.get("success", False)
        
        # Step 5: Test Frontend Routing
        self.log(f"\n🔍 Step 4: Testing Frontend Routing...")
        routing_result = self.test_frontend_routing()
        routing_success = routing_result.get("success", False)
        
        # Step 6: Test Console Errors
        self.log(f"\n🔍 Step 5: Testing Console Error Detection...")
        console_result = self.test_browser_console_simulation()
        console_success = console_result.get("success", False)
        
        # Step 7: Comprehensive verification
        self.log("\n🔍 Step 6: Comprehensive verification...")
        behavior_results = self.verify_issue_workspace_behavior()
        
        # Step 8: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE ISSUE CARD WORKSPACE TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if issue_success:
            self.log(f"   • Issue Card API: ✅ Working")
            issue_data = issue_result.get("data", {})
            self.log(f"     - Issue Card ID: {issue_data.get('id')}")
            self.log(f"     - Order ID: {issue_data.get('order_id')}")
            self.log(f"     - Status: {issue_data.get('status')}")
        else:
            self.log(f"   • Issue Card API: ❌ Failed")
            self.log(f"     - Error: {issue_result.get('response_text', 'Unknown error')}")
        
        if order_success:
            self.log(f"   • Order API: ✅ Working")
            order_data = order_result.get("data", {})
            self.log(f"     - Customer: {order_data.get('customer_name')}")
            self.log(f"     - Order Number: {order_data.get('order_number')}")
        else:
            self.log(f"   • Order API: ❌ Failed")
            self.log(f"     - Error: {order_result.get('response_text', 'Unknown error')}")
        
        if routing_success:
            self.log(f"   • Frontend Routing: ✅ Working")
        else:
            self.log(f"   • Frontend Routing: ❌ Failed")
            if routing_result.get("issue_confirmed"):
                self.log(f"     - ❌ CONFIRMED: Page redirects to /manager (reported issue)")
            redirect_location = routing_result.get("redirect_location", "")
            if redirect_location:
                self.log(f"     - Redirect Location: {redirect_location}")
        
        if console_success:
            self.log(f"   • Console Errors: ✅ None detected")
        else:
            self.log(f"   • Console Errors: ❌ Potential issues detected")
            potential_issues = console_result.get("potential_issues", [])
            for issue in potential_issues:
                self.log(f"     - {issue}")
        
        self.log(f"\n🎉 ISSUE CARD WORKSPACE TESTING COMPLETED!")
        
        # Check if critical functionality works
        critical_apis = [issue_success, order_success]
        critical_success = all(critical_apis)
        
        if critical_success and routing_success:
            self.log(f"\n✅ ALL ISSUE CARD WORKSPACE COMPONENTS WORKING!")
            self.log(f"   The workspace should load correctly")
        else:
            self.log(f"\n⚠️ ISSUE CARD WORKSPACE HAS PROBLEMS:")
            if not critical_success:
                self.log(f"   - Backend APIs failing")
            if not routing_success:
                self.log(f"   - Frontend routing issues (redirects to /manager)")
                if routing_result.get("issue_confirmed"):
                    self.log(f"   - ❌ CONFIRMED: This matches the reported issue")
        
        return critical_success and routing_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Document Engine v2.0")
    print("=" * 80)
    print("Testing the document generation system that was just implemented:")
    print("   1. 📋 GET /api/documents/types")
    print("      - Should return 14+ document types")
    print("   2. 📄 POST /api/documents/generate")
    print("      - Should generate documents with real order data")
    print("   3. 🏷️ Document numbering and HTML content")
    print("      - Should have unique doc_number and real customer data")
    print("   4. 📝 Template rendering")
    print("      - Should contain customer_name: Галина Семчишин, order_number: OC-7136")
    print(f"Test Order ID: {TEST_ORDER_ID}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://docflow-134.preview.emergentagent.com")
    print("=" * 80)
    
    tester = DocumentEngineTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_document_test()
        
        if success:
            print("\n✅ ALL DOCUMENT ENGINE APIS VERIFIED SUCCESSFULLY")
            print("📊 Summary: Document Engine v2.0 working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Document Types: Returns 14+ document types")
            print("   ✅ Document Generation: Creates documents with real data")
            print("   ✅ Document Numbering: Unique numbers for each document")
            print("   ✅ Template Rendering: Contains expected customer data")
            print("   - HTML content includes customer_name: Галина Семчишин")
            print("   - HTML content includes order_number: OC-7136")
            print("   - Authentication works with provided credentials")
            print("   - All major document types generate successfully")
            sys.exit(0)
        else:
            print("\n❌ SOME DOCUMENT ENGINE APIS FAILED VERIFICATION")
            print("📊 Summary: Issues found in document generation system")
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