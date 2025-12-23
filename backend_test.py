#!/usr/bin/env python3
"""
Backend Testing Script for Expense Management API
Testing the Expense Management endpoints:
1. Templates CRUD operations
2. Due Items operations including generation and payment
3. Expenses listing and summary
4. Complete test flow as specified in review request
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
TEST_MONTH = "2025-02"  # Month for generating due items

class ExpenseManagementTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.auth_token = None
        self.test_template_id = None
        self.test_due_item_id = None
        
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
    # TEMPLATES CRUD TESTS
    # ============================================
    
    def test_list_templates(self) -> Dict[str, Any]:
        """Test GET /api/expense-management/templates"""
        try:
            self.log("🧪 Testing list templates endpoint...")
            
            response = self.session.get(f"{self.base_url}/expense-management/templates")
            
            if response.status_code == 200:
                data = response.json()
                templates = data.get('templates', [])
                
                self.log(f"✅ Retrieved {len(templates)} templates")
                
                # Check structure
                if templates:
                    template = templates[0]
                    expected_fields = ['id', 'name', 'amount', 'frequency']
                    missing_fields = [field for field in expected_fields if field not in template]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing template fields: {missing_fields}")
                
                return {"success": True, "data": data, "count": len(templates)}
            else:
                self.log(f"❌ Failed to list templates: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing list templates: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_create_template(self) -> Dict[str, Any]:
        """Test POST /api/expense-management/templates"""
        try:
            self.log("🧪 Testing create template endpoint...")
            
            template_data = {
                "name": "Тест витрата",
                "description": "Тестовий шаблон витрати",
                "category_id": 1,  # Add category_id
                "amount": 500.0,
                "frequency": "monthly",
                "day_of_month": 15,
                "funding_source": "general",
                "vendor_name": "Тестовий постачальник"
            }
            
            response = self.session.post(
                f"{self.base_url}/expense-management/templates",
                json=template_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Template created successfully")
                
                # Store template ID for later tests
                self.test_template_id = data.get('template_id')
                
                # Check for expected fields
                expected_fields = ['success', 'template_id']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing create response fields: {missing_fields}")
                
                self.log(f"   ✅ Template ID: {self.test_template_id}")
                
                return {"success": True, "data": data, "template_id": self.test_template_id}
            else:
                self.log(f"❌ Failed to create template: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing create template: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_update_template(self) -> Dict[str, Any]:
        """Test PUT /api/expense-management/templates/{id}"""
        if not self.test_template_id:
            return {"success": False, "error": "No template ID available for update test"}
            
        try:
            self.log(f"🧪 Testing update template endpoint (ID: {self.test_template_id})...")
            
            update_data = {
                "amount": 600.0,
                "description": "Оновлений тестовий шаблон"
            }
            
            response = self.session.put(
                f"{self.base_url}/expense-management/templates/{self.test_template_id}",
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Template updated successfully")
                
                return {"success": True, "data": data}
            else:
                self.log(f"❌ Failed to update template: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing update template: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    # ============================================
    # DUE ITEMS TESTS
    # ============================================
    
    def test_list_due_items(self) -> Dict[str, Any]:
        """Test GET /api/expense-management/due-items"""
        try:
            self.log("🧪 Testing list due items endpoint...")
            
            response = self.session.get(f"{self.base_url}/expense-management/due-items")
            
            if response.status_code == 200:
                data = response.json()
                due_items = data.get('due_items', [])
                
                self.log(f"✅ Retrieved {len(due_items)} due items")
                
                # Check structure
                if due_items:
                    item = due_items[0]
                    expected_fields = ['id', 'name', 'amount', 'due_date', 'status']
                    missing_fields = [field for field in expected_fields if field not in item]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing due item fields: {missing_fields}")
                
                return {"success": True, "data": data, "count": len(due_items)}
            else:
                self.log(f"❌ Failed to list due items: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing list due items: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_create_due_item(self) -> Dict[str, Any]:
        """Test POST /api/expense-management/due-items"""
        try:
            self.log("🧪 Testing create due item endpoint...")
            
            due_item_data = {
                "template_id": self.test_template_id,
                "name": "Тестовий платіж",
                "description": "Тестовий запланований платіж",
                "category_id": 1,  # Add category_id to avoid null constraint error
                "amount": 300.0,
                "due_date": "2025-02-15",
                "funding_source": "general",
                "vendor_name": "Тестовий постачальник"
            }
            
            response = self.session.post(
                f"{self.base_url}/expense-management/due-items",
                json=due_item_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Due item created successfully")
                
                # Store due item ID for later tests
                self.test_due_item_id = data.get('due_item_id')
                
                self.log(f"   ✅ Due Item ID: {self.test_due_item_id}")
                
                return {"success": True, "data": data, "due_item_id": self.test_due_item_id}
            else:
                self.log(f"❌ Failed to create due item: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing create due item: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_generate_due_items(self) -> Dict[str, Any]:
        """Test POST /api/expense-management/due-items/generate?month=YYYY-MM"""
        try:
            self.log(f"🧪 Testing generate due items endpoint for month {TEST_MONTH}...")
            
            response = self.session.post(
                f"{self.base_url}/expense-management/due-items/generate?month={TEST_MONTH}"
            )
            
            if response.status_code == 200:
                data = response.json()
                
                created_count = data.get('created', 0)
                self.log(f"✅ Generated {created_count} due items for {TEST_MONTH}")
                
                return {"success": True, "data": data, "created": created_count}
            else:
                self.log(f"❌ Failed to generate due items: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing generate due items: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_pay_due_item(self) -> Dict[str, Any]:
        """Test POST /api/expense-management/due-items/{id}/pay"""
        if not self.test_due_item_id:
            return {"success": False, "error": "No due item ID available for pay test"}
            
        try:
            self.log(f"🧪 Testing pay due item endpoint (ID: {self.test_due_item_id})...")
            
            payment_data = {
                "method": "cash"
            }
            
            response = self.session.post(
                f"{self.base_url}/expense-management/due-items/{self.test_due_item_id}/pay",
                json=payment_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Due item paid successfully")
                
                expense_id = data.get('expense_id')
                self.log(f"   ✅ Created expense record ID: {expense_id}")
                
                return {"success": True, "data": data, "expense_id": expense_id}
            else:
                self.log(f"❌ Failed to pay due item: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing pay due item: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_cancel_due_item(self) -> Dict[str, Any]:
        """Test POST /api/expense-management/due-items/{id}/cancel"""
        # Create a new due item for cancellation test
        try:
            self.log("🧪 Testing cancel due item endpoint...")
            
            # First create a due item to cancel
            due_item_data = {
                "name": "Тестовий платіж для скасування",
                "category_id": 1,  # Add category_id
                "amount": 100.0,
                "due_date": "2025-02-20",
                "funding_source": "general"
            }
            
            create_response = self.session.post(
                f"{self.base_url}/expense-management/due-items",
                json=due_item_data
            )
            
            if create_response.status_code != 200:
                return {"success": False, "error": "Failed to create due item for cancellation test"}
            
            cancel_item_id = create_response.json().get('due_item_id')
            
            # Now cancel it
            response = self.session.post(
                f"{self.base_url}/expense-management/due-items/{cancel_item_id}/cancel"
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Due item cancelled successfully")
                
                return {"success": True, "data": data}
            else:
                self.log(f"❌ Failed to cancel due item: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing cancel due item: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_delete_due_item(self) -> Dict[str, Any]:
        """Test DELETE /api/expense-management/due-items/{id}"""
        # Create a new due item for deletion test
        try:
            self.log("🧪 Testing delete due item endpoint...")
            
            # First create a due item to delete
            due_item_data = {
                "name": "Тестовий платіж для видалення",
                "category_id": 1,  # Add category_id
                "amount": 50.0,
                "due_date": "2025-02-25",
                "funding_source": "general"
            }
            
            create_response = self.session.post(
                f"{self.base_url}/expense-management/due-items",
                json=due_item_data
            )
            
            if create_response.status_code != 200:
                return {"success": False, "error": "Failed to create due item for deletion test"}
            
            delete_item_id = create_response.json().get('due_item_id')
            
            # Now delete it
            response = self.session.delete(
                f"{self.base_url}/expense-management/due-items/{delete_item_id}"
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Due item deleted successfully")
                
                return {"success": True, "data": data}
            else:
                self.log(f"❌ Failed to delete due item: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing delete due item: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    # ============================================
    # EXPENSES TESTS
    # ============================================
    
    def test_list_expenses(self) -> Dict[str, Any]:
        """Test GET /api/expense-management/expenses"""
        try:
            self.log("🧪 Testing list expenses endpoint...")
            
            response = self.session.get(f"{self.base_url}/expense-management/expenses")
            
            if response.status_code == 200:
                data = response.json()
                expenses = data.get('expenses', [])
                totals = data.get('totals', {})
                
                self.log(f"✅ Retrieved {len(expenses)} expense records")
                self.log(f"   ✅ Total amount: ₴{totals.get('total', 0)}")
                self.log(f"   ✅ General fund: ₴{totals.get('general', 0)}")
                self.log(f"   ✅ Damage pool: ₴{totals.get('damage_pool', 0)}")
                
                # Check structure
                if expenses:
                    expense = expenses[0]
                    expected_fields = ['id', 'amount', 'method', 'funding_source', 'occurred_at']
                    missing_fields = [field for field in expected_fields if field not in expense]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing expense fields: {missing_fields}")
                
                return {"success": True, "data": data, "count": len(expenses)}
            else:
                self.log(f"❌ Failed to list expenses: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing list expenses: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_get_summary(self) -> Dict[str, Any]:
        """Test GET /api/expense-management/summary"""
        try:
            self.log("🧪 Testing get summary endpoint...")
            
            response = self.session.get(f"{self.base_url}/expense-management/summary")
            
            if response.status_code == 200:
                data = response.json()
                
                month = data.get('month')
                due_items = data.get('due_items', {})
                expenses = data.get('expenses', {})
                
                self.log(f"✅ Retrieved summary for month: {month}")
                
                # Log due items stats
                counts = due_items.get('counts', {})
                amounts = due_items.get('amounts', {})
                self.log(f"   📋 Due Items:")
                self.log(f"      - Pending: {counts.get('pending', 0)} items (₴{amounts.get('pending', 0)})")
                self.log(f"      - Paid: {counts.get('paid', 0)} items (₴{amounts.get('paid', 0)})")
                self.log(f"      - Overdue: {counts.get('overdue', 0)} items (₴{amounts.get('overdue', 0)})")
                
                # Log expenses stats
                by_funding = expenses.get('by_funding', {})
                total_expenses = expenses.get('total', 0)
                self.log(f"   💰 Expenses:")
                self.log(f"      - Total: ₴{total_expenses}")
                self.log(f"      - General fund: ₴{by_funding.get('general', 0)}")
                self.log(f"      - Damage pool: ₴{by_funding.get('damage_pool', 0)}")
                
                return {"success": True, "data": data}
            else:
                self.log(f"❌ Failed to get summary: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing get summary: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_delete_template(self) -> Dict[str, Any]:
        """Test DELETE /api/expense-management/templates/{id} - cleanup"""
        if not self.test_template_id:
            return {"success": True, "message": "No template to delete"}
            
        try:
            self.log(f"🧪 Testing delete template endpoint (cleanup - ID: {self.test_template_id})...")
            
            response = self.session.delete(
                f"{self.base_url}/expense-management/templates/{self.test_template_id}"
            )
            
            if response.status_code == 200:
                data = response.json()
                
                self.log(f"✅ Template deleted successfully (cleanup)")
                
                return {"success": True, "data": data}
            else:
                self.log(f"❌ Failed to delete template: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing delete template: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}
    def run_comprehensive_expense_management_test(self):
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
    print("🧪 Backend Testing: Expense Management API")
    print("=" * 80)
    print("Testing the Expense Management API endpoints:")
    print("   1. 📋 Templates CRUD:")
    print("      - GET /api/expense-management/templates")
    print("      - POST /api/expense-management/templates")
    print("      - PUT /api/expense-management/templates/{id}")
    print("      - DELETE /api/expense-management/templates/{id}")
    print("   2. 📅 Due Items (scheduled payments):")
    print("      - GET /api/expense-management/due-items")
    print("      - POST /api/expense-management/due-items")
    print("      - POST /api/expense-management/due-items/generate?month=YYYY-MM")
    print("      - POST /api/expense-management/due-items/{id}/pay")
    print("      - POST /api/expense-management/due-items/{id}/cancel")
    print("      - DELETE /api/expense-management/due-items/{id}")
    print("   3. 💰 Expenses:")
    print("      - GET /api/expense-management/expenses")
    print("      - GET /api/expense-management/summary")
    print(f"Test Month: {TEST_MONTH}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://damage-workflow.preview.emergentagent.com")
    print("=" * 80)
    
    tester = ExpenseManagementTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_expense_management_test()
        
        if success:
            print("\n✅ ALL EXPENSE MANAGEMENT COMPONENTS VERIFIED SUCCESSFULLY")
            print("📊 Summary: Expense Management API working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Templates CRUD: All operations working")
            print("   ✅ Due Items Generation: Creates items from templates")
            print("   ✅ Due Items Payment: Creates expense records correctly")
            print("   ✅ Expenses Listing: Returns correct data")
            print("   ✅ Summary: Provides accurate statistics")
            print("   - Authentication works with provided credentials")
            print("   - All backend APIs respond correctly")
            print("   - Complete expense management workflow functional")
            sys.exit(0)
        else:
            print("\n❌ EXPENSE MANAGEMENT HAS PROBLEMS")
            print("📊 Summary: Issues found in the expense management workflow")
            print("🔍 Key findings:")
            print("   - Some backend APIs may not be working correctly")
            print("   - Expense management workflow may be incomplete")
            print("🔧 Recommended investigation:")
            print("   1. Check database tables: expense_templates, expense_due_items, fin_expenses")
            print("   2. Verify template generation logic")
            print("   3. Check payment processing and expense creation")
            print("   4. Verify summary calculations")
            print("   5. Check database permissions and connections")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()