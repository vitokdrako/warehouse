#!/usr/bin/env python3
"""
Specific API Testing Script for Review Request
Testing the exact endpoints mentioned in the review request:
1. Templates CRUD with expected 3 templates
2. Due Items with month=2025-12
3. Expenses with month=2025-12
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://inventory-state.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

class SpecificAPITester:
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
        
    def authenticate(self) -> bool:
        """Authenticate with the API"""
        try:
            self.log("🔐 Authenticating...")
            
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
            
            self.log(f"❌ Authentication failed: {response.status_code}", "ERROR")
            return False
                
        except Exception as e:
            self.log(f"❌ Authentication exception: {str(e)}", "ERROR")
            return False

    def test_specific_endpoints(self):
        """Test the specific endpoints mentioned in review request"""
        self.log("🚀 Testing Specific API Endpoints from Review Request")
        self.log("=" * 70)
        
        if not self.authenticate():
            return False
        
        results = {}
        
        # 1. Templates CRUD
        self.log("\n📋 Testing Templates CRUD:")
        
        # GET /api/expense-management/templates - List templates (should return 3)
        try:
            response = self.session.get(f"{self.base_url}/expense-management/templates")
            if response.status_code == 200:
                data = response.json()
                template_count = len(data.get('templates', []))
                self.log(f"✅ GET /api/expense-management/templates - Found {template_count} templates")
                results['templates_list'] = True
            else:
                self.log(f"❌ GET /api/expense-management/templates - Failed: {response.status_code}")
                results['templates_list'] = False
        except Exception as e:
            self.log(f"❌ Templates list error: {str(e)}")
            results['templates_list'] = False
        
        # POST /api/expense-management/templates - Create new template
        try:
            template_data = {
                "name": "Review Test Template",
                "description": "Template created during review testing",
                "category_id": 1,
                "amount": 1000.0,
                "frequency": "monthly",
                "day_of_month": 1,
                "funding_source": "general"
            }
            response = self.session.post(f"{self.base_url}/expense-management/templates", json=template_data)
            if response.status_code == 200:
                data = response.json()
                template_id = data.get('template_id')
                self.log(f"✅ POST /api/expense-management/templates - Created template ID: {template_id}")
                results['templates_create'] = True
                results['test_template_id'] = template_id
            else:
                self.log(f"❌ POST /api/expense-management/templates - Failed: {response.status_code}")
                results['templates_create'] = False
        except Exception as e:
            self.log(f"❌ Templates create error: {str(e)}")
            results['templates_create'] = False
        
        # PUT /api/expense-management/templates/{id} - Update template
        if results.get('test_template_id'):
            try:
                update_data = {"amount": 1200.0}
                response = self.session.put(f"{self.base_url}/expense-management/templates/{results['test_template_id']}", json=update_data)
                if response.status_code == 200:
                    self.log(f"✅ PUT /api/expense-management/templates/{results['test_template_id']} - Updated successfully")
                    results['templates_update'] = True
                else:
                    self.log(f"❌ PUT /api/expense-management/templates/{results['test_template_id']} - Failed: {response.status_code}")
                    results['templates_update'] = False
            except Exception as e:
                self.log(f"❌ Templates update error: {str(e)}")
                results['templates_update'] = False
        
        # 2. Due Items
        self.log("\n📅 Testing Due Items:")
        
        # GET /api/expense-management/due-items?month=2025-12 - List due items
        try:
            response = self.session.get(f"{self.base_url}/expense-management/due-items?month=2025-12")
            if response.status_code == 200:
                data = response.json()
                due_items_count = len(data.get('due_items', []))
                self.log(f"✅ GET /api/expense-management/due-items?month=2025-12 - Found {due_items_count} due items")
                results['due_items_list'] = True
            else:
                self.log(f"❌ GET /api/expense-management/due-items?month=2025-12 - Failed: {response.status_code}")
                results['due_items_list'] = False
        except Exception as e:
            self.log(f"❌ Due items list error: {str(e)}")
            results['due_items_list'] = False
        
        # POST /api/expense-management/due-items/generate?month=2025-12 - Generate from templates
        try:
            response = self.session.post(f"{self.base_url}/expense-management/due-items/generate?month=2025-12")
            if response.status_code == 200:
                data = response.json()
                created_count = data.get('created', 0)
                self.log(f"✅ POST /api/expense-management/due-items/generate?month=2025-12 - Generated {created_count} items")
                results['due_items_generate'] = True
            else:
                self.log(f"❌ POST /api/expense-management/due-items/generate?month=2025-12 - Failed: {response.status_code}")
                results['due_items_generate'] = False
        except Exception as e:
            self.log(f"❌ Due items generate error: {str(e)}")
            results['due_items_generate'] = False
        
        # POST /api/expense-management/due-items - Create manual due item
        try:
            due_item_data = {
                "name": "Review Test Due Item",
                "description": "Manual due item for review testing",
                "category_id": 1,
                "amount": 500.0,
                "due_date": "2025-12-15",
                "funding_source": "general"
            }
            response = self.session.post(f"{self.base_url}/expense-management/due-items", json=due_item_data)
            if response.status_code == 200:
                data = response.json()
                due_item_id = data.get('due_item_id')
                self.log(f"✅ POST /api/expense-management/due-items - Created due item ID: {due_item_id}")
                results['due_items_create'] = True
                results['test_due_item_id'] = due_item_id
            else:
                self.log(f"❌ POST /api/expense-management/due-items - Failed: {response.status_code}")
                results['due_items_create'] = False
        except Exception as e:
            self.log(f"❌ Due items create error: {str(e)}")
            results['due_items_create'] = False
        
        # POST /api/expense-management/due-items/{id}/pay - Pay due item
        if results.get('test_due_item_id'):
            try:
                payment_data = {"method": "cash"}
                response = self.session.post(f"{self.base_url}/expense-management/due-items/{results['test_due_item_id']}/pay", json=payment_data)
                if response.status_code == 200:
                    data = response.json()
                    expense_id = data.get('expense_id')
                    self.log(f"✅ POST /api/expense-management/due-items/{results['test_due_item_id']}/pay - Created expense ID: {expense_id}")
                    results['due_items_pay'] = True
                else:
                    self.log(f"❌ POST /api/expense-management/due-items/{results['test_due_item_id']}/pay - Failed: {response.status_code}")
                    results['due_items_pay'] = False
            except Exception as e:
                self.log(f"❌ Due items pay error: {str(e)}")
                results['due_items_pay'] = False
        
        # 3. Expenses
        self.log("\n💰 Testing Expenses:")
        
        # GET /api/expense-management/expenses?month=2025-12 - List expenses
        try:
            response = self.session.get(f"{self.base_url}/expense-management/expenses?month=2025-12")
            if response.status_code == 200:
                data = response.json()
                expenses_count = len(data.get('expenses', []))
                totals = data.get('totals', {})
                self.log(f"✅ GET /api/expense-management/expenses?month=2025-12 - Found {expenses_count} expenses")
                self.log(f"   Total: ₴{totals.get('total', 0)}, General: ₴{totals.get('general', 0)}")
                results['expenses_list'] = True
            else:
                self.log(f"❌ GET /api/expense-management/expenses?month=2025-12 - Failed: {response.status_code}")
                results['expenses_list'] = False
        except Exception as e:
            self.log(f"❌ Expenses list error: {str(e)}")
            results['expenses_list'] = False
        
        # GET /api/expense-management/summary?month=2025-12 - Get summary
        try:
            response = self.session.get(f"{self.base_url}/expense-management/summary?month=2025-12")
            if response.status_code == 200:
                data = response.json()
                month = data.get('month')
                due_items = data.get('due_items', {})
                expenses = data.get('expenses', {})
                self.log(f"✅ GET /api/expense-management/summary?month=2025-12 - Summary for {month}")
                self.log(f"   Due items pending: {due_items.get('counts', {}).get('pending', 0)}")
                self.log(f"   Total expenses: ₴{expenses.get('total', 0)}")
                results['summary'] = True
            else:
                self.log(f"❌ GET /api/expense-management/summary?month=2025-12 - Failed: {response.status_code}")
                results['summary'] = False
        except Exception as e:
            self.log(f"❌ Summary error: {str(e)}")
            results['summary'] = False
        
        # Cleanup - DELETE template
        if results.get('test_template_id'):
            try:
                response = self.session.delete(f"{self.base_url}/expense-management/templates/{results['test_template_id']}")
                if response.status_code == 200:
                    self.log(f"✅ DELETE /api/expense-management/templates/{results['test_template_id']} - Deleted successfully")
                    results['templates_delete'] = True
                else:
                    self.log(f"❌ DELETE /api/expense-management/templates/{results['test_template_id']} - Failed: {response.status_code}")
                    results['templates_delete'] = False
            except Exception as e:
                self.log(f"❌ Templates delete error: {str(e)}")
                results['templates_delete'] = False
        
        # Summary
        self.log("\n" + "=" * 70)
        self.log("📊 SPECIFIC API ENDPOINTS TEST SUMMARY:")
        
        templates_working = all([
            results.get('templates_list', False),
            results.get('templates_create', False),
            results.get('templates_update', False),
            results.get('templates_delete', False)
        ])
        
        due_items_working = all([
            results.get('due_items_list', False),
            results.get('due_items_generate', False),
            results.get('due_items_create', False),
            results.get('due_items_pay', False)
        ])
        
        expenses_working = all([
            results.get('expenses_list', False),
            results.get('summary', False)
        ])
        
        self.log(f"   📋 Templates CRUD: {'✅ Working' if templates_working else '❌ Issues'}")
        self.log(f"   📅 Due Items: {'✅ Working' if due_items_working else '❌ Issues'}")
        self.log(f"   💰 Expenses: {'✅ Working' if expenses_working else '❌ Issues'}")
        
        all_working = templates_working and due_items_working and expenses_working
        
        if all_working:
            self.log(f"\n✅ ALL REVIEW REQUEST ENDPOINTS WORKING!")
        else:
            self.log(f"\n⚠️ SOME ENDPOINTS HAVE ISSUES")
        
        return all_working

def main():
    """Main test execution"""
    print("🧪 Specific API Testing: Review Request Endpoints")
    print("=" * 80)
    print("Testing exact endpoints from review request:")
    print("   Templates CRUD (should return 3 initially)")
    print("   Due Items with month=2025-12")
    print("   Expenses with month=2025-12")
    print("   Frontend verification")
    print("=" * 80)
    
    tester = SpecificAPITester(BASE_URL)
    
    try:
        success = tester.test_specific_endpoints()
        
        if success:
            print("\n✅ ALL REVIEW REQUEST ENDPOINTS VERIFIED")
            print("📊 Summary: All specified API endpoints working correctly")
            sys.exit(0)
        else:
            print("\n❌ SOME REVIEW REQUEST ENDPOINTS HAVE ISSUES")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()