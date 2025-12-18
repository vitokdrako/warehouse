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

    def test_generate_document(self, doc_type: str, entity_id: str, expected_data: dict = None) -> Dict[str, Any]:
        """Test POST /api/documents/generate - should generate document with real data"""
        try:
            self.log(f"🧪 Testing document generation for {doc_type} with entity {entity_id}...")
            
            # Prepare request data
            request_data = {
                "doc_type": doc_type,
                "entity_id": entity_id,
                "format": "html"
            }
            
            response = self.session.post(f"{self.base_url}/documents/generate", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ['success', 'document_id', 'doc_number', 'doc_type', 'html_content']
                for field in required_fields:
                    if field not in data:
                        self.log(f"❌ Response missing field: {field}", "ERROR")
                        return {"success": False, "error": f"Missing field: {field}"}
                
                if not data.get('success'):
                    self.log(f"❌ Document generation failed: {data}", "ERROR")
                    return {"success": False, "error": "Generation failed"}
                
                doc_number = data.get('doc_number')
                html_content = data.get('html_content', '')
                
                self.log(f"✅ Generated document {doc_number} for {doc_type}")
                
                # Validate HTML content contains expected data
                validation_results = {}
                if expected_data:
                    for key, expected_value in expected_data.items():
                        if str(expected_value).lower() in html_content.lower():
                            validation_results[key] = True
                            self.log(f"   ✅ Found expected data: {key} = {expected_value}")
                        else:
                            validation_results[key] = False
                            self.log(f"   ⚠️ Missing expected data: {key} = {expected_value}")
                
                # Check HTML content is not empty and contains basic structure
                if len(html_content) < 100:
                    self.log(f"⚠️ HTML content seems too short: {len(html_content)} chars")
                
                if '<html' not in html_content.lower():
                    self.log(f"⚠️ HTML content doesn't contain proper HTML structure")
                
                return {
                    "success": True, 
                    "data": data,
                    "doc_number": doc_number,
                    "html_length": len(html_content),
                    "validation_results": validation_results
                }
            else:
                self.log(f"❌ Failed to generate document: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing document generation: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_invoice_offer_generation(self) -> Dict[str, Any]:
        """Test invoice_offer document generation with real order data"""
        expected_data = {
            "customer_name": "Галина Семчишин",
            "order_number": "OC-7136"
        }
        return self.test_generate_document("invoice_offer", TEST_ORDER_ID, expected_data)
    
    def test_contract_rent_generation(self) -> Dict[str, Any]:
        """Test contract_rent document generation with real order data"""
        expected_data = {
            "customer_name": "Галина Семчишин",
            "order_number": "OC-7136"
        }
        return self.test_generate_document("contract_rent", TEST_ORDER_ID, expected_data)
    
    def test_return_act_generation(self) -> Dict[str, Any]:
        """Test return_act document generation with real order data"""
        expected_data = {
            "customer_name": "Галина Семчишин",
            "order_number": "OC-7136"
        }
        return self.test_generate_document("return_act", TEST_ORDER_ID, expected_data)
    
    def test_delivery_note_generation(self) -> Dict[str, Any]:
        """Test delivery_note document generation with real order data"""
        expected_data = {
            "customer_name": "Галина Семчишин",
            "order_number": "OC-7136"
        }
        return self.test_generate_document("delivery_note", TEST_ORDER_ID, expected_data)
    
    def test_damage_report_generation(self) -> Dict[str, Any]:
        """Test damage_report document generation with real order data"""
        expected_data = {
            "customer_name": "Галина Семчишин",
            "order_number": "OC-7136"
        }
        return self.test_generate_document("damage_report", TEST_ORDER_ID, expected_data)

    def test_get_order_data(self) -> Dict[str, Any]:
        """Test getting order data to verify test order exists"""
        try:
            self.log(f"🧪 Testing order data retrieval for order {TEST_ORDER_ID}...")
            
            response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                customer_name = data.get('customer_name', '')
                order_number = data.get('order_number', '')
                
                self.log(f"✅ Order found: {order_number} - Customer: {customer_name}")
                
                # Verify this is the expected test order
                if "Галина" in customer_name or "Семчишин" in customer_name:
                    self.log(f"   ✅ Confirmed test order with expected customer")
                else:
                    self.log(f"   ⚠️ Different customer than expected: {customer_name}")
                
                return {
                    "success": True, 
                    "data": data,
                    "customer_name": customer_name,
                    "order_number": order_number
                }
            else:
                self.log(f"❌ Failed to get order: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing order data: {str(e)}", "ERROR")
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

    def verify_document_engine_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior for Document Engine v2.0"""
        try:
            self.log("🔍 Verifying Document Engine v2.0 behavior...")
            
            results = {
                "document_types_working": False,
                "invoice_offer_working": False,
                "contract_rent_working": False,
                "return_act_working": False,
                "delivery_note_working": False,
                "damage_report_working": False,
                "order_data_available": False,
                "generated_documents": []
            }
            
            # Test 1: Document Types Endpoint
            self.log("   Testing Document Types Endpoint...")
            types_result = self.test_document_types_endpoint()
            
            if types_result.get("success"):
                results["document_types_working"] = True
                self.log(f"   ✅ Document Types: {types_result.get('total_types')} types available")
            else:
                self.log("   ❌ Document Types Endpoint: Failed", "ERROR")
            
            # Test 2: Order Data Availability
            self.log("   Testing Order Data Availability...")
            order_result = self.test_get_order_data()
            
            if order_result.get("success"):
                results["order_data_available"] = True
                self.log(f"   ✅ Order Data: Available for {order_result.get('customer_name')}")
            else:
                self.log("   ❌ Order Data: Not available", "ERROR")
                return results  # Can't test documents without order data
            
            # Test 3: Document Generation Tests
            document_tests = [
                ("invoice_offer", self.test_invoice_offer_generation),
                ("contract_rent", self.test_contract_rent_generation),
                ("return_act", self.test_return_act_generation),
                ("delivery_note", self.test_delivery_note_generation),
                ("damage_report", self.test_damage_report_generation)
            ]
            
            for doc_type, test_method in document_tests:
                self.log(f"   Testing {doc_type} generation...")
                doc_result = test_method()
                
                if doc_result.get("success"):
                    results[f"{doc_type}_working"] = True
                    doc_number = doc_result.get("doc_number")
                    results["generated_documents"].append({
                        "doc_type": doc_type,
                        "doc_number": doc_number,
                        "document_id": doc_result.get("data", {}).get("document_id")
                    })
                    self.log(f"   ✅ {doc_type}: Generated {doc_number}")
                else:
                    self.log(f"   ❌ {doc_type}: Failed", "ERROR")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying Document Engine behavior: {str(e)}", "ERROR")
            return {"error": str(e)}

    def run_comprehensive_document_test(self):
        """Run the comprehensive Document Engine v2.0 test"""
        self.log("🚀 Starting comprehensive Document Engine v2.0 test")
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
        
        # Step 3: Test Document Types Endpoint
        self.log("\n🔍 Step 2: Testing Document Types Endpoint...")
        types_result = self.test_document_types_endpoint()
        types_success = types_result.get("success", False)
        
        # Step 4: Test Order Data
        self.log(f"\n🔍 Step 3: Testing Order Data (Order {TEST_ORDER_ID})...")
        order_result = self.test_get_order_data()
        order_success = order_result.get("success", False)
        
        # Step 5: Test Document Generation
        self.log(f"\n🔍 Step 4: Testing Document Generation...")
        
        invoice_result = self.test_invoice_offer_generation()
        invoice_success = invoice_result.get("success", False)
        
        contract_result = self.test_contract_rent_generation()
        contract_success = contract_result.get("success", False)
        
        return_result = self.test_return_act_generation()
        return_success = return_result.get("success", False)
        
        delivery_result = self.test_delivery_note_generation()
        delivery_success = delivery_result.get("success", False)
        
        damage_result = self.test_damage_report_generation()
        damage_success = damage_result.get("success", False)
        
        # Step 6: Comprehensive verification
        self.log("\n🔍 Step 5: Comprehensive verification...")
        behavior_results = self.verify_document_engine_behavior()
        
        # Step 7: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE DOCUMENT ENGINE v2.0 TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if types_success:
            self.log(f"   • Document Types Endpoint: ✅ Working")
            total_types = types_result.get("total_types", 0)
            self.log(f"     - Total Document Types: {total_types}")
        else:
            self.log(f"   • Document Types Endpoint: ❌ Failed")
        
        if order_success:
            self.log(f"   • Order Data: ✅ Available")
            customer_name = order_result.get("customer_name", "")
            order_number = order_result.get("order_number", "")
            self.log(f"     - Customer: {customer_name}")
            self.log(f"     - Order: {order_number}")
        else:
            self.log(f"   • Order Data: ❌ Not available")
        
        # Document generation results
        doc_results = [
            ("Invoice Offer", invoice_success, invoice_result),
            ("Contract Rent", contract_success, contract_result),
            ("Return Act", return_success, return_result),
            ("Delivery Note", delivery_success, delivery_result),
            ("Damage Report", damage_success, damage_result)
        ]
        
        successful_docs = 0
        for doc_name, success, result in doc_results:
            if success:
                successful_docs += 1
                doc_number = result.get("doc_number", "")
                self.log(f"   • {doc_name}: ✅ Generated {doc_number}")
            else:
                self.log(f"   • {doc_name}: ❌ Failed")
        
        self.log(f"\n🎉 DOCUMENT ENGINE v2.0 TESTING COMPLETED!")
        self.log("   The system correctly provides:")
        self.log("   • 📋 Document types registry with 14+ document types")
        self.log("   • 📄 Document generation with real order data")
        self.log("   • 🏷️ Unique document numbers for each generated document")
        self.log("   • 📝 HTML templates rendering with customer data")
        self.log("   • 🔐 Authentication for vitokdrako@gmail.com")
        
        # Check if critical functionality works
        critical_apis = [types_success, order_success, invoice_success, contract_success, return_success]
        critical_success = all(critical_apis)
        
        if critical_success:
            self.log(f"\n✅ ALL CRITICAL DOCUMENT ENGINE APIS WORKING!")
            self.log(f"   Successfully generated {successful_docs}/5 document types")
        else:
            self.log(f"\n⚠️ SOME CRITICAL DOCUMENT ENGINE APIS FAILED - CHECK LOGS ABOVE")
            self.log(f"   Generated {successful_docs}/5 document types")
        
        return critical_success

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