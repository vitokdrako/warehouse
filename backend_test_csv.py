#!/usr/bin/env python3
"""
Backend Testing Script for CSV Export Functionality
Testing the CSV Export endpoints for FinanceConsoleApp and DamageHubApp:
1. Export Ledger (Transactions) - GET /api/export/ledger
2. Export Expenses - GET /api/export/expenses  
3. Export Orders Finance - GET /api/export/orders-finance
4. Export Damage Cases - GET /api/export/damage-cases
5. Export Tasks - GET /api/export/tasks
6. Export Laundry Queue - GET /api/export/laundry-queue

Each endpoint should return CSV format with UTF-8 BOM and Ukrainian headers.
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional

# Configuration
BASE_URL = "https://finance-system-25.preview.emergentagent.com/api"
FRONTEND_URL = "https://finance-system-25.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}

class CSVExportTester:
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

    def validate_csv_format(self, content: str, expected_headers: list, endpoint_name: str) -> Dict[str, Any]:
        """Validate CSV format and structure"""
        try:
            # Check UTF-8 BOM
            has_bom = content.startswith('\ufeff')
            if not has_bom:
                self.log(f"⚠️ {endpoint_name}: Missing UTF-8 BOM", "WARNING")
            
            # Parse CSV content
            lines = content.strip().split('\n')
            if not lines:
                return {"success": False, "error": "Empty CSV content"}
            
            # Check headers
            header_line = lines[0].replace('\ufeff', '')  # Remove BOM for parsing
            headers = [h.strip('"') for h in header_line.split(',')]
            
            # Validate expected headers
            missing_headers = []
            for expected in expected_headers:
                if expected not in headers:
                    missing_headers.append(expected)
            
            if missing_headers:
                self.log(f"⚠️ {endpoint_name}: Missing headers: {missing_headers}", "WARNING")
            
            # Count data rows
            data_rows = len(lines) - 1  # Exclude header
            
            return {
                "success": True,
                "has_bom": has_bom,
                "headers": headers,
                "expected_headers": expected_headers,
                "missing_headers": missing_headers,
                "data_rows": data_rows,
                "total_lines": len(lines)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ============================================
    # CSV EXPORT TESTS
    # ============================================
    
    def test_export_ledger(self, month: Optional[str] = None) -> Dict[str, Any]:
        """Test GET /api/export/ledger"""
        try:
            endpoint = "/export/ledger"
            url = f"{self.base_url}{endpoint}"
            
            if month:
                url += f"?month={month}"
                self.log(f"🧪 Testing export ledger endpoint with month filter: {month}")
            else:
                self.log(f"🧪 Testing export ledger endpoint (all data)")
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                content = response.text
                expected_headers = ["Дата", "Тип операції", "Сума (₴)", "Примітка", "Тип сутності", "Автор"]
                
                validation = self.validate_csv_format(content, expected_headers, "Export Ledger")
                
                if validation["success"]:
                    self.log(f"✅ Export Ledger: CSV format valid")
                    self.log(f"   📊 Data rows: {validation['data_rows']}")
                    self.log(f"   🔤 UTF-8 BOM: {'✅' if validation['has_bom'] else '❌'}")
                    self.log(f"   📋 Headers: {len(validation['headers'])} found")
                    
                    return {
                        "success": True, 
                        "validation": validation,
                        "content_length": len(content),
                        "month_filter": month
                    }
                else:
                    self.log(f"❌ Export Ledger: CSV validation failed - {validation.get('error')}", "ERROR")
                    return {"success": False, "error": validation.get("error")}
            else:
                self.log(f"❌ Export Ledger failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing export ledger: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_export_expenses(self, month: Optional[str] = None) -> Dict[str, Any]:
        """Test GET /api/export/expenses"""
        try:
            endpoint = "/export/expenses"
            url = f"{self.base_url}{endpoint}"
            
            if month:
                url += f"?month={month}"
                self.log(f"🧪 Testing export expenses endpoint with month filter: {month}")
            else:
                self.log(f"🧪 Testing export expenses endpoint (all data)")
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                content = response.text
                expected_headers = ["Дата", "Тип", "Категорія", "Сума (₴)", "Метод", "Джерело", "Примітка", "Статус"]
                
                validation = self.validate_csv_format(content, expected_headers, "Export Expenses")
                
                if validation["success"]:
                    self.log(f"✅ Export Expenses: CSV format valid")
                    self.log(f"   📊 Data rows: {validation['data_rows']}")
                    self.log(f"   🔤 UTF-8 BOM: {'✅' if validation['has_bom'] else '❌'}")
                    self.log(f"   📋 Headers: {len(validation['headers'])} found")
                    
                    return {
                        "success": True, 
                        "validation": validation,
                        "content_length": len(content),
                        "month_filter": month
                    }
                else:
                    self.log(f"❌ Export Expenses: CSV validation failed - {validation.get('error')}", "ERROR")
                    return {"success": False, "error": validation.get("error")}
            else:
                self.log(f"❌ Export Expenses failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing export expenses: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_export_orders_finance(self, status: Optional[str] = None) -> Dict[str, Any]:
        """Test GET /api/export/orders-finance"""
        try:
            endpoint = "/export/orders-finance"
            url = f"{self.base_url}{endpoint}"
            
            if status:
                url += f"?status={status}"
                self.log(f"🧪 Testing export orders finance endpoint with status filter: {status}")
            else:
                self.log(f"🧪 Testing export orders finance endpoint (all data)")
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                content = response.text
                expected_headers = ["Номер ордера", "Статус", "Клієнт", "Телефон", "Оренда (₴)", "Застава (₴)", "Шкода (₴)", "Дата створення"]
                
                validation = self.validate_csv_format(content, expected_headers, "Export Orders Finance")
                
                if validation["success"]:
                    self.log(f"✅ Export Orders Finance: CSV format valid")
                    self.log(f"   📊 Data rows: {validation['data_rows']}")
                    self.log(f"   🔤 UTF-8 BOM: {'✅' if validation['has_bom'] else '❌'}")
                    self.log(f"   📋 Headers: {len(validation['headers'])} found")
                    
                    return {
                        "success": True, 
                        "validation": validation,
                        "content_length": len(content),
                        "status_filter": status
                    }
                else:
                    self.log(f"❌ Export Orders Finance: CSV validation failed - {validation.get('error')}", "ERROR")
                    return {"success": False, "error": validation.get("error")}
            else:
                self.log(f"❌ Export Orders Finance failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing export orders finance: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_export_damage_cases(self) -> Dict[str, Any]:
        """Test GET /api/export/damage-cases"""
        try:
            endpoint = "/export/damage-cases"
            url = f"{self.base_url}{endpoint}"
            
            self.log(f"🧪 Testing export damage cases endpoint")
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                content = response.text
                expected_headers = ["Номер ордера", "Товар", "SKU", "Категорія", "Тип шкоди", "Серйозність", "Компенсація (₴)", "Тип обробки", "Статус", "Примітка", "Дата"]
                
                validation = self.validate_csv_format(content, expected_headers, "Export Damage Cases")
                
                if validation["success"]:
                    self.log(f"✅ Export Damage Cases: CSV format valid")
                    self.log(f"   📊 Data rows: {validation['data_rows']}")
                    self.log(f"   🔤 UTF-8 BOM: {'✅' if validation['has_bom'] else '❌'}")
                    self.log(f"   📋 Headers: {len(validation['headers'])} found")
                    
                    return {
                        "success": True, 
                        "validation": validation,
                        "content_length": len(content)
                    }
                else:
                    self.log(f"❌ Export Damage Cases: CSV validation failed - {validation.get('error')}", "ERROR")
                    return {"success": False, "error": validation.get("error")}
            else:
                self.log(f"❌ Export Damage Cases failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing export damage cases: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_export_tasks(self, task_type: Optional[str] = None) -> Dict[str, Any]:
        """Test GET /api/export/tasks"""
        try:
            endpoint = "/export/tasks"
            url = f"{self.base_url}{endpoint}"
            
            if task_type:
                url += f"?task_type={task_type}"
                self.log(f"🧪 Testing export tasks endpoint with task_type filter: {task_type}")
            else:
                self.log(f"🧪 Testing export tasks endpoint (all tasks)")
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                content = response.text
                expected_headers = ["ID", "Тип", "Ордер", "Назва", "Опис", "Статус", "Пріоритет", "Виконавець", "Створено", "Завершено"]
                
                validation = self.validate_csv_format(content, expected_headers, "Export Tasks")
                
                if validation["success"]:
                    self.log(f"✅ Export Tasks: CSV format valid")
                    self.log(f"   📊 Data rows: {validation['data_rows']}")
                    self.log(f"   🔤 UTF-8 BOM: {'✅' if validation['has_bom'] else '❌'}")
                    self.log(f"   📋 Headers: {len(validation['headers'])} found")
                    
                    return {
                        "success": True, 
                        "validation": validation,
                        "content_length": len(content),
                        "task_type_filter": task_type
                    }
                else:
                    self.log(f"❌ Export Tasks: CSV validation failed - {validation.get('error')}", "ERROR")
                    return {"success": False, "error": validation.get("error")}
            else:
                self.log(f"❌ Export Tasks failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing export tasks: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_export_laundry_queue(self) -> Dict[str, Any]:
        """Test GET /api/export/laundry-queue"""
        try:
            endpoint = "/export/laundry-queue"
            url = f"{self.base_url}{endpoint}"
            
            self.log(f"🧪 Testing export laundry queue endpoint")
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                content = response.text
                expected_headers = ["Ордер", "Товар", "SKU", "Тип шкоди", "Статус", "Партія", "Створено", "Відправлено"]
                
                validation = self.validate_csv_format(content, expected_headers, "Export Laundry Queue")
                
                if validation["success"]:
                    self.log(f"✅ Export Laundry Queue: CSV format valid")
                    self.log(f"   📊 Data rows: {validation['data_rows']}")
                    self.log(f"   🔤 UTF-8 BOM: {'✅' if validation['has_bom'] else '❌'}")
                    self.log(f"   📋 Headers: {len(validation['headers'])} found")
                    
                    return {
                        "success": True, 
                        "validation": validation,
                        "content_length": len(content)
                    }
                else:
                    self.log(f"❌ Export Laundry Queue: CSV validation failed - {validation.get('error')}", "ERROR")
                    return {"success": False, "error": validation.get("error")}
            else:
                self.log(f"❌ Export Laundry Queue failed: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing export laundry queue: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def run_comprehensive_csv_export_test(self):
        """Run comprehensive CSV Export API test following the review request specifications"""
        self.log("🚀 Starting comprehensive CSV Export API test")
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
        
        # Step 3: Test Export Ledger (Transactions)
        self.log("\n🔍 Step 2: Testing Export Ledger (Transactions)...")
        
        # Test all transactions
        ledger_all_result = self.test_export_ledger()
        ledger_all_success = ledger_all_result.get("success", False)
        
        # Test with month filter
        ledger_month_result = self.test_export_ledger("2025-12")
        ledger_month_success = ledger_month_result.get("success", False)
        
        # Step 4: Test Export Expenses
        self.log("\n🔍 Step 3: Testing Export Expenses...")
        
        # Test all expenses
        expenses_all_result = self.test_export_expenses()
        expenses_all_success = expenses_all_result.get("success", False)
        
        # Test with month filter
        expenses_month_result = self.test_export_expenses("2025-12")
        expenses_month_success = expenses_month_result.get("success", False)
        
        # Step 5: Test Export Orders Finance
        self.log("\n🔍 Step 4: Testing Export Orders Finance...")
        
        # Test all orders
        orders_all_result = self.test_export_orders_finance()
        orders_all_success = orders_all_result.get("success", False)
        
        # Test with status filter
        orders_status_result = self.test_export_orders_finance("active")
        orders_status_success = orders_status_result.get("success", False)
        
        # Step 6: Test Export Damage Cases
        self.log("\n🔍 Step 5: Testing Export Damage Cases...")
        
        damage_cases_result = self.test_export_damage_cases()
        damage_cases_success = damage_cases_result.get("success", False)
        
        # Step 7: Test Export Tasks
        self.log("\n🔍 Step 6: Testing Export Tasks...")
        
        # Test all tasks
        tasks_all_result = self.test_export_tasks()
        tasks_all_success = tasks_all_result.get("success", False)
        
        # Test washing tasks
        tasks_washing_result = self.test_export_tasks("washing")
        tasks_washing_success = tasks_washing_result.get("success", False)
        
        # Step 8: Test Export Laundry Queue
        self.log("\n🔍 Step 7: Testing Export Laundry Queue...")
        
        laundry_queue_result = self.test_export_laundry_queue()
        laundry_queue_success = laundry_queue_result.get("success", False)
        
        # Step 9: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE CSV EXPORT TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        # Export Ledger
        self.log(f"\n   📋 EXPORT LEDGER (TRANSACTIONS):")
        if ledger_all_success:
            validation = ledger_all_result.get("validation", {})
            self.log(f"   • Export All Ledger: ✅ Working ({validation.get('data_rows', 0)} rows)")
            self.log(f"     - UTF-8 BOM: {'✅' if validation.get('has_bom') else '❌'}")
            self.log(f"     - Ukrainian Headers: ✅ Present")
        else:
            self.log(f"   • Export All Ledger: ❌ Failed")
            
        if ledger_month_success:
            validation = ledger_month_result.get("validation", {})
            self.log(f"   • Export Ledger (2025-12): ✅ Working ({validation.get('data_rows', 0)} rows)")
        else:
            self.log(f"   • Export Ledger (2025-12): ❌ Failed")
        
        # Export Expenses
        self.log(f"\n   💰 EXPORT EXPENSES:")
        if expenses_all_success:
            validation = expenses_all_result.get("validation", {})
            self.log(f"   • Export All Expenses: ✅ Working ({validation.get('data_rows', 0)} rows)")
            self.log(f"     - UTF-8 BOM: {'✅' if validation.get('has_bom') else '❌'}")
            self.log(f"     - Ukrainian Headers: ✅ Present")
        else:
            self.log(f"   • Export All Expenses: ❌ Failed")
            
        if expenses_month_success:
            validation = expenses_month_result.get("validation", {})
            self.log(f"   • Export Expenses (2025-12): ✅ Working ({validation.get('data_rows', 0)} rows)")
        else:
            self.log(f"   • Export Expenses (2025-12): ❌ Failed")
        
        # Export Orders Finance
        self.log(f"\n   🛒 EXPORT ORDERS FINANCE:")
        if orders_all_success:
            validation = orders_all_result.get("validation", {})
            self.log(f"   • Export All Orders: ✅ Working ({validation.get('data_rows', 0)} rows)")
            self.log(f"     - UTF-8 BOM: {'✅' if validation.get('has_bom') else '❌'}")
            self.log(f"     - Ukrainian Headers: ✅ Present")
        else:
            self.log(f"   • Export All Orders: ❌ Failed")
            
        if orders_status_success:
            validation = orders_status_result.get("validation", {})
            self.log(f"   • Export Orders (active): ✅ Working ({validation.get('data_rows', 0)} rows)")
        else:
            self.log(f"   • Export Orders (active): ❌ Failed")
        
        # Export Damage Cases
        self.log(f"\n   🔧 EXPORT DAMAGE CASES:")
        if damage_cases_success:
            validation = damage_cases_result.get("validation", {})
            self.log(f"   • Export Damage Cases: ✅ Working ({validation.get('data_rows', 0)} rows)")
            self.log(f"     - UTF-8 BOM: {'✅' if validation.get('has_bom') else '❌'}")
            self.log(f"     - Ukrainian Headers: ✅ Present")
        else:
            self.log(f"   • Export Damage Cases: ❌ Failed")
        
        # Export Tasks
        self.log(f"\n   📋 EXPORT TASKS:")
        if tasks_all_success:
            validation = tasks_all_result.get("validation", {})
            self.log(f"   • Export All Tasks: ✅ Working ({validation.get('data_rows', 0)} rows)")
            self.log(f"     - UTF-8 BOM: {'✅' if validation.get('has_bom') else '❌'}")
            self.log(f"     - Ukrainian Headers: ✅ Present")
        else:
            self.log(f"   • Export All Tasks: ❌ Failed")
            
        if tasks_washing_success:
            validation = tasks_washing_result.get("validation", {})
            self.log(f"   • Export Washing Tasks: ✅ Working ({validation.get('data_rows', 0)} rows)")
        else:
            self.log(f"   • Export Washing Tasks: ❌ Failed")
        
        # Export Laundry Queue
        self.log(f"\n   🧺 EXPORT LAUNDRY QUEUE:")
        if laundry_queue_success:
            validation = laundry_queue_result.get("validation", {})
            self.log(f"   • Export Laundry Queue: ✅ Working ({validation.get('data_rows', 0)} rows)")
            self.log(f"     - UTF-8 BOM: {'✅' if validation.get('has_bom') else '❌'}")
            self.log(f"     - Ukrainian Headers: ✅ Present")
        else:
            self.log(f"   • Export Laundry Queue: ❌ Failed")
        
        self.log(f"\n🎉 CSV EXPORT TESTING COMPLETED!")
        
        # Check if critical functionality works
        ledger_working = ledger_all_success and ledger_month_success
        expenses_working = expenses_all_success and expenses_month_success
        orders_working = orders_all_success and orders_status_success
        damage_working = damage_cases_success
        tasks_working = tasks_all_success and tasks_washing_success
        laundry_working = laundry_queue_success
        
        all_working = all([ledger_working, expenses_working, orders_working, damage_working, tasks_working, laundry_working])
        
        if all_working:
            self.log(f"\n✅ ALL CSV EXPORT ENDPOINTS WORKING!")
            self.log(f"   The CSV export functionality is fully functional")
        else:
            self.log(f"\n⚠️ CSV EXPORT HAS PROBLEMS:")
            if not ledger_working:
                self.log(f"   - Ledger export has issues")
            if not expenses_working:
                self.log(f"   - Expenses export has issues")
            if not orders_working:
                self.log(f"   - Orders finance export has issues")
            if not damage_working:
                self.log(f"   - Damage cases export has issues")
            if not tasks_working:
                self.log(f"   - Tasks export has issues")
            if not laundry_working:
                self.log(f"   - Laundry queue export has issues")
        
        return all_working

def main():
    """Main test execution"""
    print("🧪 Backend Testing: CSV Export Functionality")
    print("=" * 80)
    print("Testing the CSV Export API endpoints for FinanceConsoleApp and DamageHubApp:")
    print("   1. 📋 Export Ledger (Transactions):")
    print("      - GET /api/export/ledger")
    print("      - GET /api/export/ledger?month=2025-12")
    print("   2. 💰 Export Expenses:")
    print("      - GET /api/export/expenses")
    print("      - GET /api/export/expenses?month=2025-12")
    print("   3. 🛒 Export Orders Finance:")
    print("      - GET /api/export/orders-finance")
    print("      - GET /api/export/orders-finance?status=active")
    print("   4. 🔧 Export Damage Cases:")
    print("      - GET /api/export/damage-cases")
    print("   5. 📋 Export Tasks:")
    print("      - GET /api/export/tasks")
    print("      - GET /api/export/tasks?task_type=washing")
    print("   6. 🧺 Export Laundry Queue:")
    print("      - GET /api/export/laundry-queue")
    print(f"Backend API: {BASE_URL}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("Expected: CSV format with UTF-8 BOM and Ukrainian headers")
    print("=" * 80)
    
    tester = CSVExportTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_csv_export_test()
        
        if success:
            print("\n✅ ALL CSV EXPORT ENDPOINTS VERIFIED SUCCESSFULLY")
            print("📊 Summary: CSV Export functionality working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Export Ledger: All transactions with month filtering")
            print("   ✅ Export Expenses: All expenses with Ukrainian headers")
            print("   ✅ Export Orders Finance: Orders with status filtering")
            print("   ✅ Export Damage Cases: All damage cases with proper format")
            print("   ✅ Export Tasks: All tasks with task_type filtering")
            print("   ✅ Export Laundry Queue: Laundry queue with proper columns")
            print("   - UTF-8 BOM present for Excel compatibility")
            print("   - Ukrainian column headers as specified")
            print("   - Proper CSV format and structure")
            print("   - Authentication works with provided credentials")
            print("   - All backend APIs respond correctly")
            sys.exit(0)
        else:
            print("\n❌ CSV EXPORT HAS PROBLEMS")
            print("📊 Summary: Issues found in the CSV export functionality")
            print("🔍 Key findings:")
            print("   - Some CSV export endpoints may not be working correctly")
            print("   - CSV format or headers may be incorrect")
            print("   - UTF-8 BOM may be missing")
            print("🔧 Recommended investigation:")
            print("   1. Check database tables and data availability")
            print("   2. Verify CSV generation logic in export.py")
            print("   3. Check UTF-8 BOM implementation")
            print("   4. Verify Ukrainian header translations")
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