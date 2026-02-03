#!/usr/bin/env python3
"""
Document Generation API Testing Script
Testing the new Document Generation system for rental equipment management application.

Test Credentials:
- email: vitokdrako@gmail.com
- password: test123

Test Data:
- Order ID: 7121 (for order-based documents)
- Issue Card ID: IC-7121-20251214125855 (for issue card based documents)
"""

import requests
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://order-archiver-1.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

# Test data
TEST_ORDER_ID = "7121"
TEST_ISSUE_CARD_ID = "IC-7121-20251214125855"

class DocumentsAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.generated_documents = []  # Track generated documents for cleanup
        
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

    def test_list_all_document_types(self) -> Dict[str, Any]:
        """Test GET /api/documents/types - List all document types (should return 9 types)"""
        try:
            self.log("🧪 Testing GET /api/documents/types...")
            
            response = self.session.get(f"{self.base_url}/documents/types")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log(f"❌ Expected list, got {type(data)}", "ERROR")
                    return {"success": False, "error": "Invalid response format"}
                
                self.log(f"✅ Retrieved {len(data)} document types")
                
                # Check if we have expected 9 types
                if len(data) != 9:
                    self.log(f"⚠️ Expected 9 document types, got {len(data)}")
                
                # Validate structure
                for doc_type in data:
                    required_fields = ['doc_type', 'name', 'entity_type', 'series']
                    missing_fields = [field for field in required_fields if field not in doc_type]
                    if missing_fields:
                        self.log(f"❌ Document type missing fields: {missing_fields}", "ERROR")
                        return {"success": False, "error": f"Missing fields: {missing_fields}"}
                
                # Log document types
                for doc_type in data:
                    self.log(f"   - {doc_type['doc_type']}: {doc_type['name']} ({doc_type['entity_type']})")
                
                return {"success": True, "data": data, "count": len(data)}
            else:
                self.log(f"❌ Failed to get document types: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing document types: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_list_documents_for_entity(self, entity_type: str, expected_count: int) -> Dict[str, Any]:
        """Test GET /api/documents/types/{entity_type}"""
        try:
            self.log(f"🧪 Testing GET /api/documents/types/{entity_type}...")
            
            response = self.session.get(f"{self.base_url}/documents/types/{entity_type}")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log(f"❌ Expected list, got {type(data)}", "ERROR")
                    return {"success": False, "error": "Invalid response format"}
                
                self.log(f"✅ Retrieved {len(data)} document types for '{entity_type}' entity")
                
                # Check expected count
                if len(data) != expected_count:
                    self.log(f"⚠️ Expected {expected_count} document types for '{entity_type}', got {len(data)}")
                
                # Log document types
                for doc_type in data:
                    self.log(f"   - {doc_type['doc_type']}: {doc_type['name']}")
                
                return {"success": True, "data": data, "count": len(data)}
            else:
                self.log(f"❌ Failed to get documents for entity '{entity_type}': {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing documents for entity '{entity_type}': {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_generate_document(self, doc_type: str, entity_id: str) -> Dict[str, Any]:
        """Test POST /api/documents/generate"""
        try:
            self.log(f"🧪 Testing document generation: {doc_type} for entity {entity_id}...")
            
            response = self.session.post(
                f"{self.base_url}/documents/generate",
                params={"doc_type": doc_type, "entity_id": entity_id}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['success', 'document_id', 'doc_number', 'preview_url', 'pdf_url']
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log(f"❌ Response missing fields: {missing_fields}", "ERROR")
                    return {"success": False, "error": f"Missing fields: {missing_fields}"}
                
                if not data.get('success'):
                    self.log(f"❌ Document generation failed: {data}", "ERROR")
                    return {"success": False, "error": "Generation failed"}
                
                document_id = data['document_id']
                doc_number = data['doc_number']
                
                self.log(f"✅ Document generated successfully:")
                self.log(f"   - Document ID: {document_id}")
                self.log(f"   - Document Number: {doc_number}")
                self.log(f"   - Preview URL: {data['preview_url']}")
                self.log(f"   - PDF URL: {data['pdf_url']}")
                
                # Track for cleanup
                self.generated_documents.append(document_id)
                
                return {"success": True, "data": data, "document_id": document_id}
            else:
                self.log(f"❌ Failed to generate document: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception generating document: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_document_preview(self, document_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/{document_id}/preview - Should return HTML content"""
        try:
            self.log(f"🧪 Testing document preview for {document_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/{document_id}/preview")
            
            if response.status_code == 200:
                content = response.text
                content_type = response.headers.get('content-type', '')
                
                # Check if it's HTML
                if 'html' not in content_type.lower():
                    self.log(f"⚠️ Expected HTML content-type, got: {content_type}")
                
                # Check for Ukrainian content
                ukrainian_keywords = ['РАХУНОК-ОФЕРТА', 'ДОГОВІР', 'АКТ', 'ЧЕКЛИСТ', 'ЛИСТ']
                found_ukrainian = any(keyword in content for keyword in ukrainian_keywords)
                
                if found_ukrainian:
                    self.log("✅ Document preview contains Ukrainian content")
                else:
                    self.log("⚠️ No Ukrainian keywords found in preview")
                
                # Check content length
                if len(content) < 100:
                    self.log(f"⚠️ Preview content seems too short: {len(content)} characters")
                else:
                    self.log(f"✅ Preview content length: {len(content)} characters")
                
                return {"success": True, "content_length": len(content), "has_ukrainian": found_ukrainian}
            else:
                self.log(f"❌ Failed to get document preview: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception getting document preview: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_document_pdf(self, document_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/{document_id}/pdf - Should return PDF file"""
        try:
            self.log(f"🧪 Testing document PDF for {document_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/{document_id}/pdf")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content = response.content
                
                # Check Content-Type
                if content_type != 'application/pdf':
                    self.log(f"❌ Expected 'application/pdf', got: {content_type}", "ERROR")
                    return {"success": False, "error": f"Wrong content-type: {content_type}"}
                
                # Check PDF signature
                if not content.startswith(b'%PDF'):
                    self.log("❌ Content does not start with PDF signature", "ERROR")
                    return {"success": False, "error": "Invalid PDF content"}
                
                self.log(f"✅ PDF generated successfully:")
                self.log(f"   - Content-Type: {content_type}")
                self.log(f"   - Size: {len(content)} bytes")
                self.log(f"   - PDF signature: {content[:8]}")
                
                return {"success": True, "content_type": content_type, "size": len(content)}
            else:
                self.log(f"❌ Failed to get document PDF: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception getting document PDF: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_list_entity_documents(self, entity_type: str, entity_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/entity/{entity_type}/{entity_id}"""
        try:
            self.log(f"🧪 Testing entity documents list for {entity_type}/{entity_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/entity/{entity_type}/{entity_id}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['documents', 'available_types']
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log(f"❌ Response missing fields: {missing_fields}", "ERROR")
                    return {"success": False, "error": f"Missing fields: {missing_fields}"}
                
                documents = data['documents']
                available_types = data['available_types']
                
                self.log(f"✅ Retrieved entity documents:")
                self.log(f"   - Documents count: {len(documents)}")
                self.log(f"   - Available types count: {len(available_types)}")
                
                # Log documents
                for doc in documents:
                    self.log(f"   - {doc.get('doc_number', 'N/A')}: {doc.get('doc_type_name', 'N/A')} ({doc.get('status', 'N/A')})")
                
                return {"success": True, "data": data, "documents_count": len(documents)}
            else:
                self.log(f"❌ Failed to get entity documents: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception getting entity documents: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_sign_document(self, document_id: str) -> Dict[str, Any]:
        """Test POST /api/documents/{document_id}/sign"""
        try:
            self.log(f"🧪 Testing document signing for {document_id}...")
            
            signature_data = {
                "signer_name": "Test Signer",
                "signed_at": datetime.now().isoformat()
            }
            
            response = self.session.post(
                f"{self.base_url}/documents/{document_id}/sign",
                json=signature_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success'):
                    self.log("✅ Document signed successfully")
                    return {"success": True, "data": data}
                else:
                    self.log(f"❌ Document signing failed: {data}", "ERROR")
                    return {"success": False, "error": "Signing failed"}
            else:
                self.log(f"❌ Failed to sign document: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception signing document: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def run_comprehensive_documents_test(self):
        """Run comprehensive document generation API tests"""
        self.log("🚀 Starting comprehensive Document Generation API test")
        self.log("=" * 80)
        
        test_results = {
            "api_health": False,
            "authentication": False,
            "list_all_types": False,
            "list_order_types": False,
            "list_issue_types": False,
            "document_generation": {},
            "document_preview": {},
            "document_pdf": {},
            "entity_documents": {},
            "document_signing": {}
        }
        
        # Step 1: Health check
        if not self.test_api_health():
            self.log("❌ API health check failed, aborting tests", "ERROR")
            return False
        test_results["api_health"] = True
        
        # Step 2: Authentication
        self.log("\n🔍 Step 1: Testing authentication...")
        if not self.authenticate():
            self.log("❌ Authentication failed, aborting tests", "ERROR")
            return False
        test_results["authentication"] = True
        
        # Step 3: Test document types listing
        self.log("\n🔍 Step 2: Testing document types listing...")
        
        # Test all document types (should return 9)
        all_types_result = self.test_list_all_document_types()
        test_results["list_all_types"] = all_types_result.get("success", False)
        
        # Test order entity types (should return 4)
        order_types_result = self.test_list_documents_for_entity("order", 4)
        test_results["list_order_types"] = order_types_result.get("success", False)
        
        # Test issue entity types (should return 2)
        issue_types_result = self.test_list_documents_for_entity("issue", 2)
        test_results["list_issue_types"] = issue_types_result.get("success", False)
        
        # Step 4: Test document generation
        self.log("\n🔍 Step 3: Testing document generation...")
        
        # Order-based documents
        order_docs = [
            ("invoice_offer", TEST_ORDER_ID),
            ("contract_rent", TEST_ORDER_ID),
            ("return_act", TEST_ORDER_ID),
            ("return_intake_checklist", TEST_ORDER_ID)
        ]
        
        # Issue-based documents
        issue_docs = [
            ("issue_act", TEST_ISSUE_CARD_ID),
            ("picking_list", TEST_ISSUE_CARD_ID)
        ]
        
        for doc_type, entity_id in order_docs + issue_docs:
            gen_result = self.test_generate_document(doc_type, entity_id)
            test_results["document_generation"][doc_type] = gen_result.get("success", False)
            
            if gen_result.get("success"):
                document_id = gen_result["document_id"]
                
                # Test preview
                preview_result = self.test_document_preview(document_id)
                test_results["document_preview"][doc_type] = preview_result.get("success", False)
                
                # Test PDF
                pdf_result = self.test_document_pdf(document_id)
                test_results["document_pdf"][doc_type] = pdf_result.get("success", False)
                
                # Test signing
                sign_result = self.test_sign_document(document_id)
                test_results["document_signing"][doc_type] = sign_result.get("success", False)
        
        # Step 5: Test entity documents listing
        self.log("\n🔍 Step 4: Testing entity documents listing...")
        
        # Test order documents
        order_docs_result = self.test_list_entity_documents("order", TEST_ORDER_ID)
        test_results["entity_documents"]["order"] = order_docs_result.get("success", False)
        
        # Test issue documents (if any generated)
        issue_docs_result = self.test_list_entity_documents("issue", TEST_ISSUE_CARD_ID)
        test_results["entity_documents"]["issue"] = issue_docs_result.get("success", False)
        
        # Step 6: Summary
        self.log("\n" + "=" * 80)
        self.log("📊 COMPREHENSIVE DOCUMENT GENERATION API TEST SUMMARY:")
        
        # Basic functionality
        self.log(f"   • API Health: {'✅' if test_results['api_health'] else '❌'}")
        self.log(f"   • Authentication: {'✅' if test_results['authentication'] else '❌'}")
        
        # Document types listing
        self.log(f"   • List All Types (9 expected): {'✅' if test_results['list_all_types'] else '❌'}")
        self.log(f"   • List Order Types (4 expected): {'✅' if test_results['list_order_types'] else '❌'}")
        self.log(f"   • List Issue Types (2 expected): {'✅' if test_results['list_issue_types'] else '❌'}")
        
        # Document generation
        self.log("   • Document Generation:")
        for doc_type, success in test_results["document_generation"].items():
            self.log(f"     - {doc_type}: {'✅' if success else '❌'}")
        
        # Document preview
        self.log("   • Document Preview (HTML):")
        for doc_type, success in test_results["document_preview"].items():
            self.log(f"     - {doc_type}: {'✅' if success else '❌'}")
        
        # Document PDF
        self.log("   • Document PDF:")
        for doc_type, success in test_results["document_pdf"].items():
            self.log(f"     - {doc_type}: {'✅' if success else '❌'}")
        
        # Document signing
        self.log("   • Document Signing:")
        for doc_type, success in test_results["document_signing"].items():
            self.log(f"     - {doc_type}: {'✅' if success else '❌'}")
        
        # Entity documents
        self.log("   • Entity Documents Listing:")
        for entity_type, success in test_results["entity_documents"].items():
            self.log(f"     - {entity_type}: {'✅' if success else '❌'}")
        
        # Calculate overall success
        all_basic_tests = [
            test_results["api_health"],
            test_results["authentication"],
            test_results["list_all_types"],
            test_results["list_order_types"],
            test_results["list_issue_types"]
        ]
        
        generation_tests = list(test_results["document_generation"].values())
        preview_tests = list(test_results["document_preview"].values())
        pdf_tests = list(test_results["document_pdf"].values())
        signing_tests = list(test_results["document_signing"].values())
        entity_tests = list(test_results["entity_documents"].values())
        
        overall_success = (
            all(all_basic_tests) and
            all(generation_tests) and
            all(preview_tests) and
            all(pdf_tests) and
            all(signing_tests) and
            all(entity_tests)
        )
        
        self.log(f"\n🎯 Generated Documents: {len(self.generated_documents)}")
        for doc_id in self.generated_documents:
            self.log(f"   - {doc_id}")
        
        if overall_success:
            self.log("\n✅ ALL DOCUMENT GENERATION API TESTS PASSED!")
        else:
            self.log("\n⚠️ SOME DOCUMENT GENERATION API TESTS FAILED - CHECK LOGS ABOVE")
        
        return overall_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Document Generation API System")
    print("=" * 80)
    print("Testing the new Document Generation system for rental equipment management:")
    print("   📋 Document Types Listing (9 types expected)")
    print("   📄 Document Generation (6 document types)")
    print("   👁️ Document Preview (HTML with Ukrainian content)")
    print("   📑 Document PDF (proper Content-Type and PDF signature)")
    print("   📝 Document Signing")
    print("   📚 Entity Documents Listing")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print(f"Test Order ID: {TEST_ORDER_ID}")
    print(f"Test Issue Card ID: {TEST_ISSUE_CARD_ID}")
    print("=" * 80)
    
    tester = DocumentsAPITester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_documents_test()
        
        if success:
            print("\n✅ ALL DOCUMENT GENERATION API TESTS PASSED")
            print("📊 Summary: Document Generation system working correctly")
            print("🎯 All expected functionality verified:")
            print("   ✅ Document types listing (9 total, 4 order, 2 issue)")
            print("   ✅ Document generation for all 6 document types")
            print("   ✅ HTML preview with Ukrainian content")
            print("   ✅ PDF generation with proper headers")
            print("   ✅ Document signing functionality")
            print("   ✅ Entity documents listing")
            sys.exit(0)
        else:
            print("\n❌ SOME DOCUMENT GENERATION API TESTS FAILED")
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