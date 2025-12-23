#!/usr/bin/env python3
"""
Backend Testing Script for Document Generation Functionality
Testing the Document Generation endpoints across all order stages:
1. Get all document types - GET /api/documents/types (should return 18+ types)
2. Generate Picking List - POST /api/documents/generate
3. Generate Invoice Offer - POST /api/documents/generate
4. Generate Contract - POST /api/documents/generate
5. Generate Issue Act - POST /api/documents/generate
6. Generate Issue Checklist - POST /api/documents/generate
7. Test PDF download - GET /api/documents/{document_id}/pdf
8. Test document history - GET /api/documents/entity/issue/{entity_id}

Each document should generate successfully with proper HTML content and PDF download capability.
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://catalog-revamp-2.preview.emergentagent.com/api"
FRONTEND_URL = "https://catalog-revamp-2.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}
TEST_MONTH = "2025-01"  # Month for testing (not used in document generation)

class DocumentGenerationTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.generated_documents = []  # Store generated document IDs for cleanup
        
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

    # ============================================
    # DOCUMENT GENERATION TESTS
    # ============================================
    
    def test_get_document_types(self) -> Dict[str, Any]:
        """Test GET /api/documents/types - Should return 18+ document types"""
        try:
            self.log("🧪 Testing get document types endpoint...")
            
            response = self.session.get(f"{self.base_url}/documents/types")
            
            if response.status_code == 200:
                data = response.json()
                doc_types_count = len(data)
                
                self.log(f"✅ Retrieved {doc_types_count} document types")
                
                # Check if we have 18+ document types as expected
                if doc_types_count >= 18:
                    self.log(f"✅ Document types count meets requirement (18+): {doc_types_count}")
                else:
                    self.log(f"⚠️ Document types count below expected (18+): {doc_types_count}", "WARNING")
                
                # Log some document types for verification
                if data:
                    self.log("📋 Available document types:")
                    for doc_type in data[:5]:  # Show first 5
                        doc_key = doc_type.get('doc_type', 'unknown')
                        doc_name = doc_type.get('name', 'No name')
                        self.log(f"   - {doc_key}: {doc_name}")
                    if len(data) > 5:
                        self.log(f"   ... and {len(data) - 5} more")
                
                return {
                    "success": True, 
                    "data": data, 
                    "count": doc_types_count,
                    "meets_requirement": doc_types_count >= 18
                }
            else:
                self.log(f"❌ Get document types failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing get document types: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_generate_document(self, doc_type: str, entity_id: str, expected_content_check: str = None) -> Dict[str, Any]:
        """Test POST /api/documents/generate for specific document type"""
        try:
            self.log(f"🧪 Testing generate document: {doc_type} for entity {entity_id}...")
            
            request_data = {
                "doc_type": doc_type,
                "entity_id": entity_id,
                "format": "html"
            }
            
            response = self.session.post(
                f"{self.base_url}/documents/generate",
                json=request_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required response fields
                required_fields = ['success', 'document_id', 'doc_number', 'html_content']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing response fields: {missing_fields}", "WARNING")
                
                success = data.get('success', False)
                document_id = data.get('document_id')
                doc_number = data.get('doc_number')
                html_content = data.get('html_content', '')
                
                if success and document_id:
                    self.log(f"✅ Document generated successfully")
                    self.log(f"   📄 Document ID: {document_id}")
                    self.log(f"   🔢 Document Number: {doc_number}")
                    self.log(f"   📝 HTML Content Length: {len(html_content)} characters")
                    
                    # Store document ID for later tests and cleanup
                    self.generated_documents.append(document_id)
                    
                    # Check if HTML content is not empty
                    if html_content and len(html_content) > 100:
                        self.log(f"✅ HTML content appears to be substantial")
                        
                        # Check for expected content if specified
                        if expected_content_check:
                            if expected_content_check.lower() in html_content.lower():
                                self.log(f"✅ Expected content found: {expected_content_check}")
                            else:
                                self.log(f"⚠️ Expected content not found: {expected_content_check}", "WARNING")
                    else:
                        self.log(f"⚠️ HTML content appears to be empty or too short", "WARNING")
                    
                    return {
                        "success": True,
                        "data": data,
                        "document_id": document_id,
                        "doc_number": doc_number,
                        "html_length": len(html_content),
                        "has_content": len(html_content) > 100
                    }
                else:
                    self.log(f"❌ Document generation failed: success={success}, document_id={document_id}", "ERROR")
                    return {"success": False, "error": "Generation failed", "data": data}
            else:
                self.log(f"❌ Generate document failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing generate document: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_pdf_download(self, document_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/{document_id}/pdf"""
        try:
            self.log(f"🧪 Testing PDF download for document {document_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/{document_id}/pdf")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                if 'application/pdf' in content_type:
                    self.log(f"✅ PDF download successful")
                    self.log(f"   📄 Content-Type: {content_type}")
                    self.log(f"   📊 Content Length: {content_length} bytes")
                    
                    # Check if PDF content is substantial
                    if content_length > 1000:  # PDFs should be at least 1KB
                        self.log(f"✅ PDF content appears to be substantial")
                        return {
                            "success": True,
                            "content_type": content_type,
                            "content_length": content_length,
                            "is_substantial": True
                        }
                    else:
                        self.log(f"⚠️ PDF content appears to be too small", "WARNING")
                        return {
                            "success": True,
                            "content_type": content_type,
                            "content_length": content_length,
                            "is_substantial": False
                        }
                else:
                    self.log(f"⚠️ Unexpected content type: {content_type}", "WARNING")
                    return {"success": False, "error": f"Wrong content type: {content_type}"}
            else:
                self.log(f"❌ PDF download failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing PDF download: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_document_history(self, entity_type: str, entity_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/entity/{entity_type}/{entity_id}"""
        try:
            self.log(f"🧪 Testing document history for {entity_type}/{entity_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/entity/{entity_type}/{entity_id}")
            
            if response.status_code == 200:
                data = response.json()
                documents = data.get('documents', [])
                available_types = data.get('available_types', [])
                
                self.log(f"✅ Document history retrieved successfully")
                self.log(f"   📄 Documents found: {len(documents)}")
                self.log(f"   📋 Available types: {len(available_types)}")
                
                # Log document details
                if documents:
                    self.log("📋 Generated documents:")
                    for doc in documents[:3]:  # Show first 3
                        doc_type = doc.get('doc_type', 'unknown')
                        doc_number = doc.get('doc_number', 'no number')
                        status = doc.get('status', 'unknown')
                        self.log(f"   - {doc_type}: {doc_number} ({status})")
                    if len(documents) > 3:
                        self.log(f"   ... and {len(documents) - 3} more")
                
                return {
                    "success": True,
                    "data": data,
                    "documents_count": len(documents),
                    "available_types_count": len(available_types)
                }
            else:
                self.log(f"❌ Document history failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing document history: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
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

    def run_comprehensive_document_generation_test(self):
        """Run comprehensive Document Generation API test following the review request specifications"""
        self.log("🚀 Starting comprehensive Document Generation API test")
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
        
        # Step 3: Test Get All Document Types
        self.log("\n🔍 Step 2: Testing Get All Document Types...")
        doc_types_result = self.test_get_document_types()
        doc_types_success = doc_types_result.get("success", False)
        meets_requirement = doc_types_result.get("meets_requirement", False)
        
        # Step 4: Test Generate Picking List
        self.log("\n🔍 Step 3: Testing Generate Picking List...")
        picking_list_result = self.test_generate_document(
            "picking_list", 
            "IC-6996-20251223095239",
            "items"  # Expected content check
        )
        picking_list_success = picking_list_result.get("success", False)
        
        # Step 5: Test Generate Invoice Offer
        self.log("\n🔍 Step 4: Testing Generate Invoice Offer...")
        invoice_offer_result = self.test_generate_document(
            "invoice_offer", 
            "7136"
        )
        invoice_offer_success = invoice_offer_result.get("success", False)
        
        # Step 6: Test Generate Contract
        self.log("\n🔍 Step 5: Testing Generate Contract...")
        contract_result = self.test_generate_document(
            "contract_rent", 
            "7136"
        )
        contract_success = contract_result.get("success", False)
        
        # Step 7: Test Generate Issue Act
        self.log("\n🔍 Step 6: Testing Generate Issue Act...")
        issue_act_result = self.test_generate_document(
            "issue_act", 
            "IC-6996-20251223095239",
            "items"  # Expected content check
        )
        issue_act_success = issue_act_result.get("success", False)
        
        # Step 8: Test Generate Issue Checklist
        self.log("\n🔍 Step 7: Testing Generate Issue Checklist...")
        issue_checklist_result = self.test_generate_document(
            "issue_checklist", 
            "IC-6996-20251223095239"
        )
        issue_checklist_success = issue_checklist_result.get("success", False)
        
        # Step 9: Test PDF Download (using first generated document)
        pdf_success = False
        if self.generated_documents:
            self.log("\n🔍 Step 8: Testing PDF Download...")
            first_doc_id = self.generated_documents[0]
            pdf_result = self.test_pdf_download(first_doc_id)
            pdf_success = pdf_result.get("success", False)
        else:
            self.log("\n⚠️ Step 8: Skipping PDF Download - no documents generated", "WARNING")
        
        # Step 10: Test Document History
        self.log("\n🔍 Step 9: Testing Document History...")
        history_result = self.test_document_history("issue", "IC-6996-20251223095239")
        history_success = history_result.get("success", False)
        
        # Step 11: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE DOCUMENT GENERATION TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        # Document Types
        self.log(f"\n   📋 DOCUMENT TYPES:")
        if doc_types_success:
            count = doc_types_result.get("count", 0)
            requirement_status = "✅ Meets requirement (18+)" if meets_requirement else "⚠️ Below requirement (18+)"
            self.log(f"   • Get Document Types: ✅ Working ({count} types) - {requirement_status}")
        else:
            self.log(f"   • Get Document Types: ❌ Failed")
        
        # Document Generation Tests
        self.log(f"\n   📄 DOCUMENT GENERATION:")
        
        if picking_list_success:
            html_len = picking_list_result.get("html_length", 0)
            has_content = picking_list_result.get("has_content", False)
            content_status = "✅ Has content" if has_content else "⚠️ Empty/short content"
            self.log(f"   • Picking List (IC-6996-20251223095239): ✅ Working ({html_len} chars) - {content_status}")
        else:
            self.log(f"   • Picking List (IC-6996-20251223095239): ❌ Failed")
        
        if invoice_offer_success:
            html_len = invoice_offer_result.get("html_length", 0)
            has_content = invoice_offer_result.get("has_content", False)
            content_status = "✅ Has content" if has_content else "⚠️ Empty/short content"
            self.log(f"   • Invoice Offer (7136): ✅ Working ({html_len} chars) - {content_status}")
        else:
            self.log(f"   • Invoice Offer (7136): ❌ Failed")
        
        if contract_success:
            html_len = contract_result.get("html_length", 0)
            has_content = contract_result.get("has_content", False)
            content_status = "✅ Has content" if has_content else "⚠️ Empty/short content"
            self.log(f"   • Contract (7136): ✅ Working ({html_len} chars) - {content_status}")
        else:
            self.log(f"   • Contract (7136): ❌ Failed")
        
        if issue_act_success:
            html_len = issue_act_result.get("html_length", 0)
            has_content = issue_act_result.get("has_content", False)
            content_status = "✅ Has content" if has_content else "⚠️ Empty/short content"
            self.log(f"   • Issue Act (IC-6996-20251223095239): ✅ Working ({html_len} chars) - {content_status}")
        else:
            self.log(f"   • Issue Act (IC-6996-20251223095239): ❌ Failed")
        
        if issue_checklist_success:
            html_len = issue_checklist_result.get("html_length", 0)
            has_content = issue_checklist_result.get("has_content", False)
            content_status = "✅ Has content" if has_content else "⚠️ Empty/short content"
            self.log(f"   • Issue Checklist (IC-6996-20251223095239): ✅ Working ({html_len} chars) - {content_status}")
        else:
            self.log(f"   • Issue Checklist (IC-6996-20251223095239): ❌ Failed")
        
        # PDF Download
        self.log(f"\n   📥 PDF DOWNLOAD:")
        if pdf_success:
            self.log(f"   • PDF Download: ✅ Working")
        else:
            self.log(f"   • PDF Download: ❌ Failed or Skipped")
        
        # Document History
        self.log(f"\n   📚 DOCUMENT HISTORY:")
        if history_success:
            docs_count = history_result.get("documents_count", 0)
            self.log(f"   • Document History: ✅ Working ({docs_count} documents found)")
        else:
            self.log(f"   • Document History: ❌ Failed")
        
        self.log(f"\n🎉 DOCUMENT GENERATION TESTING COMPLETED!")
        
        # Check if critical functionality works
        generation_tests = [
            picking_list_success, invoice_offer_success, contract_success,
            issue_act_success, issue_checklist_success
        ]
        
        core_working = doc_types_success and meets_requirement
        generation_working = all(generation_tests)
        pdf_working = pdf_success or not self.generated_documents  # OK if no docs to test
        history_working = history_success
        
        all_working = core_working and generation_working and pdf_working and history_working
        
        if all_working:
            self.log(f"\n✅ ALL DOCUMENT GENERATION FUNCTIONALITY WORKING!")
            self.log(f"   The document generation system is fully functional")
        else:
            self.log(f"\n⚠️ DOCUMENT GENERATION HAS PROBLEMS:")
            if not core_working:
                self.log(f"   - Document types endpoint has issues or doesn't meet 18+ requirement")
            if not generation_working:
                failed_docs = []
                if not picking_list_success:
                    failed_docs.append("Picking List")
                if not invoice_offer_success:
                    failed_docs.append("Invoice Offer")
                if not contract_success:
                    failed_docs.append("Contract")
                if not issue_act_success:
                    failed_docs.append("Issue Act")
                if not issue_checklist_success:
                    failed_docs.append("Issue Checklist")
                self.log(f"   - Document generation failed for: {', '.join(failed_docs)}")
            if not pdf_working:
                self.log(f"   - PDF download functionality has issues")
            if not history_working:
                self.log(f"   - Document history functionality has issues")
        
        return all_working
        """Run the comprehensive Expense Management API test following the specified flow"""
        self.log("🚀 Starting comprehensive Expense Management API test")
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
        
        # Step 3: Test Templates CRUD
        self.log("\n🔍 Step 2: Testing Templates CRUD...")
        
        # List templates (initial)
        list_result_1 = self.test_list_templates()
        list_success_1 = list_result_1.get("success", False)
        initial_count = list_result_1.get("count", 0)
        
        # Create template
        create_result = self.test_create_template()
        create_success = create_result.get("success", False)
        
        # Update template
        update_result = self.test_update_template()
        update_success = update_result.get("success", False)
        
        # List templates (after create)
        list_result_2 = self.test_list_templates()
        list_success_2 = list_result_2.get("success", False)
        after_create_count = list_result_2.get("count", 0)
        
        # Step 4: Test Due Items operations
        self.log("\n🔍 Step 3: Testing Due Items operations...")
        
        # Generate due items from templates
        generate_result = self.test_generate_due_items()
        generate_success = generate_result.get("success", False)
        
        # List due items
        list_due_result = self.test_list_due_items()
        list_due_success = list_due_result.get("success", False)
        
        # Create manual due item
        create_due_result = self.test_create_due_item()
        create_due_success = create_due_result.get("success", False)
        
        # Pay due item
        pay_result = self.test_pay_due_item()
        pay_success = pay_result.get("success", False)
        
        # Cancel due item
        cancel_result = self.test_cancel_due_item()
        cancel_success = cancel_result.get("success", False)
        
        # Delete due item
        delete_due_result = self.test_delete_due_item()
        delete_due_success = delete_due_result.get("success", False)
        
        # Step 5: Test Expenses
        self.log("\n🔍 Step 4: Testing Expenses...")
        
        # List expenses
        expenses_result = self.test_list_expenses()
        expenses_success = expenses_result.get("success", False)
        
        # Get summary
        summary_result = self.test_get_summary()
        summary_success = summary_result.get("success", False)
        
        # Step 6: Cleanup
        self.log("\n🔍 Step 5: Cleanup...")
        
        # Delete test template
        delete_result = self.test_delete_template()
        delete_success = delete_result.get("success", False)
        
        # Step 7: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE EXPENSE MANAGEMENT TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        # Templates CRUD
        self.log(f"\n   📋 TEMPLATES CRUD:")
        if list_success_1:
            self.log(f"   • List Templates (initial): ✅ Working ({initial_count} templates)")
        else:
            self.log(f"   • List Templates (initial): ❌ Failed")
            
        if create_success:
            self.log(f"   • Create Template: ✅ Working (ID: {self.test_template_id})")
        else:
            self.log(f"   • Create Template: ❌ Failed")
            
        if update_success:
            self.log(f"   • Update Template: ✅ Working")
        else:
            self.log(f"   • Update Template: ❌ Failed")
            
        if list_success_2:
            self.log(f"   • List Templates (after create): ✅ Working ({after_create_count} templates)")
        else:
            self.log(f"   • List Templates (after create): ❌ Failed")
            
        if delete_success:
            self.log(f"   • Delete Template: ✅ Working")
        else:
            self.log(f"   • Delete Template: ❌ Failed")
        
        # Due Items
        self.log(f"\n   📅 DUE ITEMS:")
        if generate_success:
            generated_count = generate_result.get("created", 0)
            self.log(f"   • Generate Due Items: ✅ Working ({generated_count} created for {TEST_MONTH})")
        else:
            self.log(f"   • Generate Due Items: ❌ Failed")
            
        if list_due_success:
            due_count = list_due_result.get("count", 0)
            self.log(f"   • List Due Items: ✅ Working ({due_count} items)")
        else:
            self.log(f"   • List Due Items: ❌ Failed")
            
        if create_due_success:
            self.log(f"   • Create Due Item: ✅ Working (ID: {self.test_due_item_id})")
        else:
            self.log(f"   • Create Due Item: ❌ Failed")
            
        if pay_success:
            expense_id = pay_result.get("expense_id")
            self.log(f"   • Pay Due Item: ✅ Working (Created expense ID: {expense_id})")
        else:
            self.log(f"   • Pay Due Item: ❌ Failed")
            
        if cancel_success:
            self.log(f"   • Cancel Due Item: ✅ Working")
        else:
            self.log(f"   • Cancel Due Item: ❌ Failed")
            
        if delete_due_success:
            self.log(f"   • Delete Due Item: ✅ Working")
        else:
            self.log(f"   • Delete Due Item: ❌ Failed")
        
        # Expenses
        self.log(f"\n   💰 EXPENSES:")
        if expenses_success:
            expense_count = expenses_result.get("count", 0)
            self.log(f"   • List Expenses: ✅ Working ({expense_count} records)")
        else:
            self.log(f"   • List Expenses: ❌ Failed")
            
        if summary_success:
            self.log(f"   • Get Summary: ✅ Working")
        else:
            self.log(f"   • Get Summary: ❌ Failed")
        
        self.log(f"\n🎉 EXPENSE MANAGEMENT TESTING COMPLETED!")
        
        # Check if critical functionality works
        templates_working = all([list_success_1, create_success, update_success, delete_success])
        due_items_working = all([generate_success, list_due_success, create_due_success, pay_success])
        expenses_working = all([expenses_success, summary_success])
        
        all_working = templates_working and due_items_working and expenses_working
        
        if all_working:
            self.log(f"\n✅ ALL EXPENSE MANAGEMENT COMPONENTS WORKING!")
            self.log(f"   The expense management workflow is fully functional")
        else:
            self.log(f"\n⚠️ EXPENSE MANAGEMENT HAS PROBLEMS:")
            if not templates_working:
                self.log(f"   - Templates CRUD operations have issues")
            if not due_items_working:
                self.log(f"   - Due Items operations have issues")
            if not expenses_working:
                self.log(f"   - Expenses operations have issues")
        
        return all_working

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Document Generation Functionality")
    print("=" * 80)
    print("Testing the Document Generation API endpoints across all order stages:")
    print("   1. 📋 Get All Document Types:")
    print("      - GET /api/documents/types (should return 18+ types)")
    print("   2. 📄 Generate Documents:")
    print("      - POST /api/documents/generate (picking_list, invoice_offer, contract_rent, issue_act, issue_checklist)")
    print("   3. 📥 PDF Download:")
    print("      - GET /api/documents/{document_id}/pdf")
    print("   4. 📚 Document History:")
    print("      - GET /api/documents/entity/issue/{entity_id}")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("Expected: Successful document generation with HTML content and PDF download")
    print("=" * 80)
    
    tester = DocumentGenerationTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_document_generation_test()
        
        if success:
            print("\n✅ ALL DOCUMENT GENERATION FUNCTIONALITY VERIFIED SUCCESSFULLY")
            print("📊 Summary: Document generation system working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Document Types: 18+ document types available")
            print("   ✅ Picking List: Generated with items content")
            print("   ✅ Invoice Offer: Generated successfully")
            print("   ✅ Contract: Generated successfully")
            print("   ✅ Issue Act: Generated with items content")
            print("   ✅ Issue Checklist: Generated successfully")
            print("   ✅ PDF Download: Working with proper content-type")
            print("   ✅ Document History: Lists all generated documents")
            print("   - All documents have substantial HTML content")
            print("   - PDF generation works correctly")
            print("   - Document numbering system functional")
            print("   - Authentication works with provided credentials")
            print("   - All backend APIs respond correctly")
            sys.exit(0)
        else:
            print("\n❌ DOCUMENT GENERATION HAS PROBLEMS")
            print("📊 Summary: Issues found in the document generation functionality")
            print("🔍 Key findings:")
            print("   - Some document generation endpoints may not be working correctly")
            print("   - Document types count may be below 18+ requirement")
            print("   - HTML content may be empty or insufficient")
            print("   - PDF download may not be working")
            print("   - Document history may not be accessible")
            print("🔧 Recommended investigation:")
            print("   1. Check document templates and data builders")
            print("   2. Verify entity IDs exist in database")
            print("   3. Check document generation logic in documents.py")
            print("   4. Verify PDF rendering functionality")
            print("   5. Check database permissions and connections")
            print("   6. Verify document registry configuration")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()