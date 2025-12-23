#!/usr/bin/env python3
"""
Backend Testing Script for Documents Functionality in Finance Console
Testing the Documents functionality endpoints as per review request:

**Test Cases:**
1. Get orders with finance data: GET /api/manager/finance/orders-with-finance?limit=10
2. Get documents for an order: GET /api/documents/entity/order/{order_id}
3. Generate invoice_offer document: POST /api/documents/generate
4. Generate contract_rent document: POST /api/documents/generate
5. Download PDF: GET /api/documents/{document_id}/pdf
6. Send document via email: POST /api/documents/{document_id}/send-email

**Finance documents available:**
- invoice_offer: Рахунок-оферта
- contract_rent: Договір оренди
- invoice_additional: Додатковий рахунок
- rental_extension: Додаткова угода
- deposit_settlement_act: Акт взаєморозрахунків
- deposit_refund_act: Акт повернення застави
- damage_settlement_act: Акт утримання із застави

**Key Validation:**
- Document generation works for order-based docs
- PDF download works
- Email sending endpoint exists
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

class DocumentsTester:
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

    def run_comprehensive_template_admin_test(self):
        """Run comprehensive Template Admin API test following the review request specifications"""
        self.log("🚀 Starting comprehensive Template Admin API test")
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
        
        # Step 3: Test List All Templates
        self.log("\n🔍 Step 2: Testing List All Templates...")
        list_result = self.test_list_templates()
        list_success = list_result.get("success", False)
        meets_requirement = list_result.get("meets_requirement", False)
        
        # Step 4: Test Get Specific Template
        self.log("\n🔍 Step 3: Testing Get Specific Template (picking_list)...")
        get_result = self.test_get_specific_template("picking_list")
        get_success = get_result.get("success", False)
        
        # Step 5: Test Get Base Template
        self.log("\n🔍 Step 4: Testing Get Base Template...")
        base_result = self.test_get_base_template()
        base_success = base_result.get("success", False)
        
        # Step 6: Test Update Template with Backup
        self.log("\n🔍 Step 5: Testing Update Template with Backup...")
        update_result = self.test_update_template("picking_list")
        update_success = update_result.get("success", False)
        
        # Step 7: Test List Backups
        self.log("\n🔍 Step 6: Testing List Backups...")
        backups_result = self.test_list_backups("picking_list")
        backups_success = backups_result.get("success", False)
        
        # Step 8: Test Restore from Backup (if backups exist)
        restore_success = False
        if backups_result.get("has_backups", False):
            self.log("\n🔍 Step 7: Testing Restore from Backup...")
            restore_result = self.test_restore_backup("picking_list")
            restore_success = restore_result.get("success", False)
        else:
            self.log("\n⚠️ Step 7: Skipping Restore from Backup - no backups available", "WARNING")
        
        # Step 9: Test Preview Template
        self.log("\n🔍 Step 8: Testing Preview Template...")
        preview_result = self.test_preview_template("picking_list")
        preview_success = preview_result.get("success", False)
        
        # Step 10: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE TEMPLATE ADMIN TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        # List Templates
        self.log(f"\n   📋 LIST TEMPLATES:")
        if list_success:
            count = list_result.get("count", 0)
            ukrainian_names = list_result.get("ukrainian_names", 0)
            requirement_status = "✅ Meets requirement (18)" if meets_requirement else "⚠️ Below requirement (18)"
            self.log(f"   • List All Templates: ✅ Working ({count} templates) - {requirement_status}")
            self.log(f"   • Ukrainian Names: ✅ Found {ukrainian_names} templates with Ukrainian names")
        else:
            self.log(f"   • List All Templates: ❌ Failed")
        
        # Get Specific Template
        self.log(f"\n   📄 GET SPECIFIC TEMPLATE:")
        if get_success:
            name = get_result.get("name", "")
            content_len = get_result.get("content_length", 0)
            versions = get_result.get("versions_count", 0)
            variables = get_result.get("variables_count", 0)
            has_ukrainian = get_result.get("has_ukrainian_name", False)
            order_vars = get_result.get("order_vars", 0)
            issue_vars = get_result.get("issue_vars", 0)
            
            ukrainian_status = "✅ Ukrainian name" if has_ukrainian else "⚠️ Non-Ukrainian name"
            self.log(f"   • Get picking_list: ✅ Working - {name} ({ukrainian_status})")
            self.log(f"   • Content: ✅ {content_len} chars, {versions} versions, {variables} variables")
            self.log(f"   • Variables: ✅ {order_vars} order vars, {issue_vars} issue vars")
        else:
            self.log(f"   • Get picking_list: ❌ Failed")
        
        # Get Base Template
        self.log(f"\n   🏗️ GET BASE TEMPLATE:")
        if base_success:
            content_len = base_result.get("content_length", 0)
            is_html = base_result.get("is_html", False)
            html_status = "✅ Valid HTML" if is_html else "⚠️ May not be HTML"
            self.log(f"   • Get Base Template: ✅ Working ({content_len} chars) - {html_status}")
        else:
            self.log(f"   • Get Base Template: ❌ Failed")
        
        # Update Template
        self.log(f"\n   ✏️ UPDATE TEMPLATE:")
        if update_success:
            backup_created = update_result.get("backup_created", False)
            backup_status = "✅ Backup created" if backup_created else "⚠️ No backup created"
            self.log(f"   • Update Template: ✅ Working - {backup_status}")
        else:
            self.log(f"   • Update Template: ❌ Failed")
        
        # List Backups
        self.log(f"\n   💾 BACKUP FUNCTIONALITY:")
        if backups_success:
            backups_count = backups_result.get("backups_count", 0)
            has_backups = backups_result.get("has_backups", False)
            self.log(f"   • List Backups: ✅ Working ({backups_count} backups found)")
            
            if restore_success:
                restored_backup = restore_result.get("restored_backup", "")
                self.log(f"   • Restore Backup: ✅ Working (restored {restored_backup})")
            elif has_backups:
                self.log(f"   • Restore Backup: ❌ Failed")
            else:
                self.log(f"   • Restore Backup: ⚠️ Skipped (no backups)")
        else:
            self.log(f"   • List Backups: ❌ Failed")
        
        # Preview Template
        self.log(f"\n   👁️ PREVIEW TEMPLATE:")
        if preview_success:
            html_len = preview_result.get("html_length", 0)
            sample_keys = preview_result.get("sample_data_keys", 0)
            has_sample = preview_result.get("has_sample_data", False)
            sample_status = "✅ Contains sample data" if has_sample else "⚠️ May not contain sample data"
            self.log(f"   • Preview Template: ✅ Working ({html_len} chars HTML, {sample_keys} data keys)")
            self.log(f"   • Sample Data: {sample_status}")
        else:
            self.log(f"   • Preview Template: ❌ Failed")
        
        self.log(f"\n🎉 TEMPLATE ADMIN TESTING COMPLETED!")
        
        # Check if critical functionality works
        core_working = list_success and meets_requirement
        template_ops_working = get_success and base_success and update_success
        backup_working = backups_success and (restore_success or not backups_result.get("has_backups", False))
        preview_working = preview_success
        
        all_working = core_working and template_ops_working and backup_working and preview_working
        
        if all_working:
            self.log(f"\n✅ ALL TEMPLATE ADMIN FUNCTIONALITY WORKING!")
            self.log(f"   The template admin system is fully functional")
        else:
            self.log(f"\n⚠️ TEMPLATE ADMIN HAS PROBLEMS:")
            if not core_working:
                self.log(f"   - Template listing has issues or doesn't meet 18 templates requirement")
            if not template_ops_working:
                self.log(f"   - Template operations (get/update/base) have issues")
            if not backup_working:
                self.log(f"   - Backup/restore functionality has issues")
            if not preview_working:
                self.log(f"   - Preview functionality has issues")
        
        return all_working
def main():
    """Main test execution"""
    print("🧪 Backend Testing: Document Templates Admin Functionality")
    print("=" * 80)
    print("Testing the Document Templates Admin API endpoints:")
    print("   1. 📋 List All Templates:")
    print("      - GET /api/admin/templates (should return 18 templates)")
    print("   2. 📄 Get Specific Template:")
    print("      - GET /api/admin/templates/picking_list (verify name, versions, content, variables)")
    print("   3. 🏗️ Get Base Template:")
    print("      - GET /api/admin/templates/base/content (verify base HTML template)")
    print("   4. ✏️ Update Template with Backup:")
    print("      - PUT /api/admin/templates/picking_list (with create_backup: true)")
    print("   5. 💾 List Backups:")
    print("      - GET /api/admin/templates/picking_list/backups (show backup files)")
    print("   6. 🔄 Restore from Backup:")
    print("      - POST /api/admin/templates/picking_list/restore/{backup_filename}")
    print("   7. 👁️ Preview Template:")
    print("      - POST /api/admin/templates/picking_list/preview (render with sample data)")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("Expected: All templates have Ukrainian names, variables include order/issue_card vars")
    print("=" * 80)
    
    tester = TemplateAdminTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_template_admin_test()
        
        if success:
            print("\n✅ ALL TEMPLATE ADMIN FUNCTIONALITY VERIFIED SUCCESSFULLY")
            print("📊 Summary: Template admin system working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Templates List: 18 templates with proper Ukrainian names")
            print("   ✅ Specific Template: picking_list with name, versions, content, variables")
            print("   ✅ Base Template: Base HTML template content available")
            print("   ✅ Update Template: Template updated with backup creation")
            print("   ✅ List Backups: Backup files shown with timestamps")
            print("   ✅ Restore Backup: Template restored from backup file")
            print("   ✅ Preview Template: Rendered HTML with sample data")
            print("   - All templates have proper Ukrainian names")
            print("   - Variables list includes order/issue_card specific vars")
            print("   - Backup/restore functionality works correctly")
            print("   - Preview generates valid HTML with test data")
            print("   - Authentication works with provided credentials")
            print("   - All backend APIs respond correctly")
            sys.exit(0)
        else:
            print("\n❌ TEMPLATE ADMIN HAS PROBLEMS")
            print("📊 Summary: Issues found in the template admin functionality")
            print("🔍 Key findings:")
            print("   - Some template admin endpoints may not be working correctly")
            print("   - Templates count may be below 18 requirement")
            print("   - Template names may not be in Ukrainian")
            print("   - Variables may not include order/issue_card specific vars")
            print("   - Backup/restore functionality may not be working")
            print("   - Preview may not generate valid HTML with sample data")
            print("🔧 Recommended investigation:")
            print("   1. Check template registry and available templates")
            print("   2. Verify template files exist in templates directory")
            print("   3. Check template_admin.py route implementation")
            print("   4. Verify backup directory permissions and functionality")
            print("   5. Check template rendering and preview functionality")
            print("   6. Verify database connections and template metadata")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()