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
BASE_URL = "https://doc-management-9.preview.emergentagent.com/api"
FRONTEND_URL = "https://doc-management-9.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

# Company name validation
CORRECT_COMPANY_NAME = "ФОП Арсалані Олександра Ігорівна"
OLD_INCORRECT_NAME = "ФОП Маркін Ілля Павлович"

class DocumentGenerationTester:
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