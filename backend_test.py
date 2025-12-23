#!/usr/bin/env python3
"""
Backend Testing Script for Document Templates Admin Functionality
Testing the Document Templates Admin endpoints:
1. List all templates - GET /api/admin/templates (should return 18 templates)
2. Get specific template - GET /api/admin/templates/picking_list
3. Get base template - GET /api/admin/templates/base/content
4. Update template with backup - PUT /api/admin/templates/picking_list
5. List backups - GET /api/admin/templates/picking_list/backups
6. Restore from backup - POST /api/admin/templates/picking_list/restore/{backup_filename}
7. Preview template - POST /api/admin/templates/picking_list/preview

Each endpoint should work correctly with proper Ukrainian names and validation.
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

class TemplateAdminTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.test_backup_filename = None  # Store backup filename for restore test
        
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
    # TEMPLATE ADMIN TESTS
    # ============================================
    
    def test_list_templates(self) -> Dict[str, Any]:
        """Test GET /api/admin/templates - Should return 18 templates"""
        try:
            self.log("🧪 Testing list all templates endpoint...")
            
            response = self.session.get(f"{self.base_url}/admin/templates")
            
            if response.status_code == 200:
                data = response.json()
                templates = data.get('templates', [])
                total = data.get('total', 0)
                
                self.log(f"✅ Retrieved {total} templates")
                
                # Check if we have 18 templates as expected
                if total >= 18:
                    self.log(f"✅ Templates count meets requirement (18): {total}")
                else:
                    self.log(f"⚠️ Templates count below expected (18): {total}", "WARNING")
                
                # Check for Ukrainian names
                ukrainian_names_found = 0
                if templates:
                    self.log("📋 Available templates:")
                    for template in templates[:5]:  # Show first 5
                        doc_type = template.get('doc_type', 'unknown')
                        name = template.get('name', 'No name')
                        entity_type = template.get('entity_type', '')
                        versions = template.get('versions', [])
                        
                        # Check if name contains Ukrainian characters
                        if any(ord(char) > 127 for char in name):
                            ukrainian_names_found += 1
                        
                        self.log(f"   - {doc_type}: {name} ({entity_type}) - {len(versions)} versions")
                    
                    if len(templates) > 5:
                        self.log(f"   ... and {len(templates) - 5} more")
                
                self.log(f"📝 Templates with Ukrainian names: {ukrainian_names_found}")
                
                return {
                    "success": True, 
                    "data": data, 
                    "count": total,
                    "meets_requirement": total >= 18,
                    "ukrainian_names": ukrainian_names_found
                }
            else:
                self.log(f"❌ List templates failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing list templates: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_get_specific_template(self, doc_type: str = "picking_list") -> Dict[str, Any]:
        """Test GET /api/admin/templates/{doc_type}"""
        try:
            self.log(f"🧪 Testing get specific template: {doc_type}...")
            
            response = self.session.get(f"{self.base_url}/admin/templates/{doc_type}")
            
            if response.status_code == 200:
                data = response.json()
                
                name = data.get('name', '')
                content = data.get('content', '')
                versions = data.get('versions', [])
                variables = data.get('variables', {})
                
                self.log(f"✅ Template retrieved successfully")
                self.log(f"   📄 Name: {name}")
                self.log(f"   📝 Content Length: {len(content)} characters")
                self.log(f"   🔢 Versions: {len(versions)} ({', '.join(versions)})")
                self.log(f"   🔧 Variables: {len(variables)} available")
                
                # Check for Ukrainian name
                has_ukrainian = any(ord(char) > 127 for char in name)
                if has_ukrainian:
                    self.log(f"✅ Template has Ukrainian name")
                else:
                    self.log(f"⚠️ Template name not in Ukrainian", "WARNING")
                
                # Check for order/issue_card specific variables
                order_vars = [var for var in variables.keys() if 'order' in var.lower()]
                issue_vars = [var for var in variables.keys() if 'issue' in var.lower()]
                
                self.log(f"   📋 Order variables: {len(order_vars)}")
                self.log(f"   📋 Issue card variables: {len(issue_vars)}")
                
                return {
                    "success": True,
                    "data": data,
                    "name": name,
                    "content_length": len(content),
                    "versions_count": len(versions),
                    "variables_count": len(variables),
                    "has_ukrainian_name": has_ukrainian,
                    "order_vars": len(order_vars),
                    "issue_vars": len(issue_vars)
                }
            else:
                self.log(f"❌ Get template failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing get template: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_get_base_template(self) -> Dict[str, Any]:
        """Test GET /api/admin/templates/base/content"""
        try:
            self.log("🧪 Testing get base template...")
            
            response = self.session.get(f"{self.base_url}/admin/templates/base/content")
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('content', '')
                path = data.get('path', '')
                
                self.log(f"✅ Base template retrieved successfully")
                self.log(f"   📄 Path: {path}")
                self.log(f"   📝 Content Length: {len(content)} characters")
                
                # Check if it's HTML content
                is_html = '<html' in content.lower() or '<!doctype' in content.lower()
                if is_html:
                    self.log(f"✅ Base template contains HTML structure")
                else:
                    self.log(f"⚠️ Base template may not be valid HTML", "WARNING")
                
                return {
                    "success": True,
                    "data": data,
                    "content_length": len(content),
                    "is_html": is_html,
                    "path": path
                }
            else:
                self.log(f"❌ Get base template failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing get base template: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_update_template(self, doc_type: str = "picking_list") -> Dict[str, Any]:
        """Test PUT /api/admin/templates/{doc_type} with backup creation"""
        try:
            self.log(f"🧪 Testing update template with backup: {doc_type}...")
            
            # First get current template to modify it slightly
            get_response = self.session.get(f"{self.base_url}/admin/templates/{doc_type}")
            if get_response.status_code != 200:
                self.log(f"❌ Could not get current template for update test", "ERROR")
                return {"success": False, "error": "Could not get current template"}
            
            current_data = get_response.json()
            current_content = current_data.get('content', '')
            
            # Modify content slightly for test
            modified_content = current_content + "\n<!-- Test modification -->"
            
            request_data = {
                "content": modified_content,
                "create_backup": True
            }
            
            response = self.session.put(
                f"{self.base_url}/admin/templates/{doc_type}",
                json=request_data
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                message = data.get('message', '')
                backup_path = data.get('backup_path', '')
                
                self.log(f"✅ Template updated successfully")
                self.log(f"   📄 Message: {message}")
                self.log(f"   💾 Backup created: {backup_path is not None}")
                
                if backup_path:
                    self.log(f"   📁 Backup path: {backup_path}")
                    # Extract backup filename for restore test
                    import os
                    self.test_backup_filename = os.path.basename(backup_path)
                
                return {
                    "success": True,
                    "data": data,
                    "backup_created": backup_path is not None,
                    "backup_path": backup_path,
                    "message": message
                }
            else:
                self.log(f"❌ Update template failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing update template: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_list_backups(self, doc_type: str = "picking_list") -> Dict[str, Any]:
        """Test GET /api/admin/templates/{doc_type}/backups"""
        try:
            self.log(f"🧪 Testing list backups for: {doc_type}...")
            
            response = self.session.get(f"{self.base_url}/admin/templates/{doc_type}/backups")
            
            if response.status_code == 200:
                data = response.json()
                backups = data.get('backups', [])
                total = data.get('total', 0)
                
                self.log(f"✅ Backups list retrieved successfully")
                self.log(f"   📄 Total backups: {total}")
                
                if backups:
                    self.log("📋 Available backups:")
                    for backup in backups[:3]:  # Show first 3
                        filename = backup.get('filename', '')
                        created_at = backup.get('created_at', '')
                        size = backup.get('size', 0)
                        self.log(f"   - {filename} ({created_at}, {size} bytes)")
                    
                    if len(backups) > 3:
                        self.log(f"   ... and {len(backups) - 3} more")
                    
                    # Store first backup filename for restore test if we don't have one
                    if not self.test_backup_filename and backups:
                        self.test_backup_filename = backups[0].get('filename')
                
                return {
                    "success": True,
                    "data": data,
                    "backups_count": total,
                    "has_backups": total > 0
                }
            else:
                self.log(f"❌ List backups failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing list backups: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_restore_backup(self, doc_type: str = "picking_list") -> Dict[str, Any]:
        """Test POST /api/admin/templates/{doc_type}/restore/{backup_filename}"""
        try:
            if not self.test_backup_filename:
                self.log(f"⚠️ No backup filename available for restore test", "WARNING")
                return {"success": False, "error": "No backup filename available"}
            
            self.log(f"🧪 Testing restore backup: {self.test_backup_filename}...")
            
            response = self.session.post(
                f"{self.base_url}/admin/templates/{doc_type}/restore/{self.test_backup_filename}"
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                message = data.get('message', '')
                
                self.log(f"✅ Backup restored successfully")
                self.log(f"   📄 Message: {message}")
                
                return {
                    "success": True,
                    "data": data,
                    "message": message,
                    "restored_backup": self.test_backup_filename
                }
            else:
                self.log(f"❌ Restore backup failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing restore backup: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_preview_template(self, doc_type: str = "picking_list") -> Dict[str, Any]:
        """Test POST /api/admin/templates/{doc_type}/preview"""
        try:
            self.log(f"🧪 Testing preview template: {doc_type}...")
            
            # Get current template content for preview
            get_response = self.session.get(f"{self.base_url}/admin/templates/{doc_type}")
            if get_response.status_code != 200:
                self.log(f"❌ Could not get template for preview test", "ERROR")
                return {"success": False, "error": "Could not get template"}
            
            current_data = get_response.json()
            template_content = current_data.get('content', '')
            
            if not template_content:
                self.log(f"❌ Template content is empty", "ERROR")
                return {"success": False, "error": "Template content is empty"}
            
            request_data = {
                "content": template_content
            }
            
            response = self.session.post(
                f"{self.base_url}/admin/templates/{doc_type}/preview",
                json=request_data
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                html = data.get('html', '')
                data_used = data.get('data_used', {})
                error = data.get('error', '')
                
                if success:
                    self.log(f"✅ Template preview generated successfully")
                    self.log(f"   📄 HTML Length: {len(html)} characters")
                    self.log(f"   📊 Sample data keys: {len(data_used)} keys")
                    
                    # Check if HTML contains sample data
                    has_sample_data = any(key in html for key in ['Тестовий', 'SAMPLE', 'test'])
                    if has_sample_data:
                        self.log(f"✅ Preview contains sample data")
                    else:
                        self.log(f"⚠️ Preview may not contain sample data", "WARNING")
                    
                    return {
                        "success": True,
                        "data": data,
                        "html_length": len(html),
                        "sample_data_keys": len(data_used),
                        "has_sample_data": has_sample_data
                    }
                else:
                    self.log(f"❌ Preview generation failed: {error}", "ERROR")
                    return {"success": False, "error": error, "data": data}
            else:
                self.log(f"❌ Preview template failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing preview template: {str(e)}", "ERROR")
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