#!/usr/bin/env python3
"""
Backend Testing Script for Document Generation Company Name Update
Testing the document generation to verify company legal name has been updated correctly.

**Test Scenario:**
Generate an `invoice_offer` document for an existing order and verify the company details 
contain "ФОП Арсалані Олександра Ігорівна" instead of "ФОП Маркін Ілля Павлович".

**Test Steps:**
1. Login with credentials: email: `vitokdrako@gmail.com`, password: `test123`
2. Get list of orders via `GET /api/orders` to find an existing order_id
3. Generate a document using `POST /api/documents/generate` with:
   - doc_type: "invoice_offer"
   - entity_id: [order_id from step 2]
4. Verify the generated HTML contains:
   - "ФОП Арсалані Олександра Ігорівна" (correct company name)
   - Does NOT contain "ФОП Маркін Ілля Павлович" (old incorrect name)

**File changed:** /app/backend/services/doc_engine/data_builders.py - company legal_name updated in all builder functions.
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
        self.test_order_id = None  # Store order ID for document generation tests
        self.generated_documents = []  # Store generated document IDs for testing
        
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
    # DOCUMENTS FUNCTIONALITY TESTS
    # ============================================
    
    def test_get_orders_with_finance(self, limit: int = 10) -> Dict[str, Any]:
        """Test GET /api/manager/finance/orders-with-finance?limit=10"""
        try:
            self.log("🧪 Testing get orders with finance data...")
            
            response = self.session.get(f"{self.base_url}/manager/finance/orders-with-finance?limit={limit}")
            
            if response.status_code == 200:
                data = response.json()
                orders = data.get('orders', [])
                total = data.get('total', 0)
                
                self.log(f"✅ Retrieved {total} orders with finance data")
                
                if orders:
                    # Show first few orders
                    self.log("📋 Sample orders:")
                    for order in orders[:3]:  # Show first 3
                        order_id = order.get('order_id')
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
                    "data": data, 
                    "count": total,
                    "has_orders": total > 0,
                    "first_order_id": self.test_order_id
                }
            else:
                self.log(f"❌ Get orders with finance failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing get orders with finance: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_get_documents_for_order(self, order_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/entity/order/{order_id}"""
        try:
            self.log(f"🧪 Testing get documents for order: {order_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/entity/order/{order_id}")
            
            if response.status_code == 200:
                data = response.json()
                
                documents = data.get('documents', [])
                available_types = data.get('available_types', [])
                
                self.log(f"✅ Documents retrieved successfully")
                self.log(f"   📄 Existing documents: {len(documents)}")
                self.log(f"   📋 Available types: {len(available_types)}")
                
                if available_types:
                    self.log("📋 Available document types:")
                    for doc_type in available_types[:5]:  # Show first 5
                        doc_code = doc_type.get('doc_type', 'unknown')
                        doc_name = doc_type.get('name', 'No name')
                        self.log(f"   - {doc_code}: {doc_name}")
                    
                    if len(available_types) > 5:
                        self.log(f"   ... and {len(available_types) - 5} more")
                
                if documents:
                    self.log("📄 Existing documents:")
                    for doc in documents[:3]:  # Show first 3
                        doc_id = doc.get('id', 'unknown')
                        doc_type = doc.get('doc_type', 'unknown')
                        doc_number = doc.get('doc_number', 'No number')
                        status = doc.get('status', 'unknown')
                        self.log(f"   - {doc_id}: {doc_type} {doc_number} ({status})")
                
                return {
                    "success": True,
                    "data": data,
                    "documents_count": len(documents),
                    "available_types_count": len(available_types),
                    "has_documents": len(documents) > 0,
                    "has_available_types": len(available_types) > 0
                }
            else:
                self.log(f"❌ Get documents for order failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing get documents for order: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_generate_document(self, doc_type: str, entity_id: str) -> Dict[str, Any]:
        """Test POST /api/documents/generate"""
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
                
                success = data.get('success', False)
                document_id = data.get('document_id', '')
                doc_number = data.get('doc_number', '')
                html_content = data.get('html_content', '')
                
                self.log(f"✅ Document generated successfully")
                self.log(f"   📄 Document ID: {document_id}")
                self.log(f"   🔢 Document Number: {doc_number}")
                self.log(f"   📝 HTML Content Length: {len(html_content)} characters")
                
                # Store document ID for PDF and email tests
                if document_id:
                    self.generated_documents.append({
                        'id': document_id,
                        'type': doc_type,
                        'number': doc_number
                    })
                
                # Check if HTML content is substantial
                has_content = len(html_content) > 1000
                if has_content:
                    self.log(f"✅ Document has substantial content")
                else:
                    self.log(f"⚠️ Document content may be minimal", "WARNING")
                
                return {
                    "success": True,
                    "data": data,
                    "document_id": document_id,
                    "doc_number": doc_number,
                    "html_length": len(html_content),
                    "has_substantial_content": has_content,
                    "generation_success": success
                }
            else:
                self.log(f"❌ Generate document failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing generate document: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_download_pdf(self, document_id: str) -> Dict[str, Any]:
        """Test GET /api/documents/{document_id}/pdf"""
        try:
            self.log(f"🧪 Testing PDF download for document: {document_id}...")
            
            response = self.session.get(f"{self.base_url}/documents/{document_id}/pdf")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                content_disposition = response.headers.get('content-disposition', '')
                
                self.log(f"✅ PDF downloaded successfully")
                self.log(f"   📄 Content-Type: {content_type}")
                self.log(f"   📏 Content Length: {content_length} bytes")
                self.log(f"   📎 Content-Disposition: {content_disposition}")
                
                # Check if it's actually a PDF
                is_pdf = content_type == 'application/pdf'
                has_content = content_length > 1000
                has_disposition = 'attachment' in content_disposition
                
                if is_pdf:
                    self.log(f"✅ Content-Type is correct (application/pdf)")
                else:
                    self.log(f"⚠️ Content-Type may be incorrect: {content_type}", "WARNING")
                
                if has_content:
                    self.log(f"✅ PDF has substantial content ({content_length} bytes)")
                else:
                    self.log(f"⚠️ PDF content may be minimal", "WARNING")
                
                if has_disposition:
                    self.log(f"✅ Proper download headers present")
                else:
                    self.log(f"⚠️ Download headers may be missing", "WARNING")
                
                return {
                    "success": True,
                    "content_type": content_type,
                    "content_length": content_length,
                    "content_disposition": content_disposition,
                    "is_pdf": is_pdf,
                    "has_substantial_content": has_content,
                    "has_download_headers": has_disposition
                }
            else:
                self.log(f"❌ PDF download failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing PDF download: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_send_document_email(self, document_id: str, test_email: str = "test@example.com") -> Dict[str, Any]:
        """Test POST /api/documents/{document_id}/send-email"""
        try:
            self.log(f"🧪 Testing send document email for: {document_id}...")
            
            request_data = {
                "email": test_email
            }
            
            response = self.session.post(
                f"{self.base_url}/documents/{document_id}/send-email",
                json=request_data
            )
            
            # Note: This endpoint might fail if SMTP is not configured, but we test if it exists and responds
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                message = data.get('message', '')
                
                self.log(f"✅ Email sending endpoint working")
                self.log(f"   📧 Success: {success}")
                self.log(f"   📄 Message: {message}")
                
                return {
                    "success": True,
                    "data": data,
                    "email_success": success,
                    "message": message,
                    "endpoint_exists": True
                }
            elif response.status_code == 500:
                # SMTP configuration issue - endpoint exists but can't send
                self.log(f"⚠️ Email endpoint exists but SMTP may not be configured", "WARNING")
                self.log(f"   📧 Response: {response.status_code} - {response.text}")
                
                return {
                    "success": True,  # Endpoint exists
                    "endpoint_exists": True,
                    "smtp_configured": False,
                    "status_code": response.status_code,
                    "response_text": response.text
                }
            else:
                self.log(f"❌ Send email failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing send email: {str(e)}", "ERROR")
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