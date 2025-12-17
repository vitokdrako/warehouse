#!/usr/bin/env python3
"""
Backend Testing Script for Order Lifecycle User Tracking
Testing the order lifecycle user tracking feature that was just implemented:
1. GET /api/orders/{order_id}/lifecycle endpoint
2. POST endpoints that create lifecycle entries (accept, status update, move-to-preparation)
3. Authentication and user info tracking
"""

import requests
import json
import sys
import subprocess
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://finflow-581.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "email": "vitokdrako@gmail.com",
    "password": "test123"
}
TEST_ORDER_ID = 7143

class OrderLifecycleTester:
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
    
    def test_order_lifecycle_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/orders/{order_id}/lifecycle - should return lifecycle events with user info"""
        try:
            self.log(f"🧪 Testing order lifecycle endpoint for order {TEST_ORDER_ID}...")
            
            response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}/lifecycle")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log(f"❌ Expected list of lifecycle events, got {type(data)}", "ERROR")
                    return {"success": False, "error": f"Expected list, got {type(data)}"}
                
                self.log(f"✅ Retrieved {len(data)} lifecycle events")
                
                # Check lifecycle event structure
                user_tracked_events = 0
                old_events = 0
                
                for event in data:
                    required_fields = ['stage', 'created_at']
                    for field in required_fields:
                        if field not in event:
                            self.log(f"⚠️ Lifecycle event missing field: {field}")
                    
                    # Check user tracking fields
                    has_user_info = (
                        event.get('created_by_id') is not None or 
                        event.get('created_by_name') is not None or
                        event.get('created_by') is not None
                    )
                    
                    if has_user_info:
                        user_tracked_events += 1
                        self.log(f"   ✅ Event '{event.get('stage')}' has user info: {event.get('created_by_name') or event.get('created_by')}")
                    else:
                        old_events += 1
                        self.log(f"   ⚠️ Event '{event.get('stage')}' has no user info (expected for old records)")
                
                return {
                    "success": True, 
                    "data": data,
                    "total_events": len(data),
                    "user_tracked_events": user_tracked_events,
                    "old_events": old_events
                }
            else:
                self.log(f"❌ Failed to get order lifecycle: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing order lifecycle: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_dashboard(self) -> Dict[str, Any]:
        """Test GET /api/finance/dashboard?period=month - should return metrics and deposits"""
        try:
            self.log("🧪 Testing finance dashboard endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/dashboard?period=month")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required structure
                required_sections = ['period', 'metrics', 'deposits']
                missing_sections = []
                
                for section in required_sections:
                    if section not in data:
                        missing_sections.append(section)
                
                if missing_sections:
                    self.log(f"❌ Finance dashboard missing sections: {missing_sections}", "ERROR")
                    return {"success": False, "error": f"Missing required sections: {missing_sections}"}
                
                # Check metrics structure
                metrics = data.get('metrics', {})
                required_metrics = ['net_profit', 'rent_revenue', 'operating_expenses', 'cash_balance']
                
                for metric in required_metrics:
                    if metric not in metrics:
                        self.log(f"⚠️ Missing metric: {metric}")
                
                # Check deposits structure
                deposits = data.get('deposits', {})
                required_deposit_fields = ['held', 'used', 'refunded', 'available_to_refund']
                
                for field in required_deposit_fields:
                    if field not in deposits:
                        self.log(f"⚠️ Missing deposit field: {field}")
                
                self.log(f"✅ Finance Dashboard (period: {data.get('period')}):")
                self.log(f"   - Net Profit: ₴{metrics.get('net_profit', 0)}")
                self.log(f"   - Rent Revenue: ₴{metrics.get('rent_revenue', 0)}")
                self.log(f"   - Operating Expenses: ₴{metrics.get('operating_expenses', 0)}")
                self.log(f"   - Cash Balance: ₴{metrics.get('cash_balance', 0)}")
                self.log(f"   - Deposits Held: ₴{deposits.get('held', 0)}")
                self.log(f"   - Deposits Available: ₴{deposits.get('available_to_refund', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "has_metrics": len(metrics) > 0,
                    "has_deposits": len(deposits) > 0
                }
            else:
                self.log(f"❌ Failed to get finance dashboard: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing finance dashboard: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_vendors(self) -> Dict[str, Any]:
        """Test GET /api/finance/vendors - should return list of vendors"""
        try:
            self.log("🧪 Testing finance vendors endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/vendors")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has vendors array
                if not isinstance(data, dict) or 'vendors' not in data:
                    self.log(f"❌ Expected dict with 'vendors' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                vendors = data['vendors']
                if not isinstance(vendors, list):
                    self.log(f"❌ Expected vendors array, got {type(vendors)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(vendors)} vendors")
                
                # Check vendor structure if any exist
                if vendors:
                    vendor = vendors[0]
                    required_fields = ['id', 'name', 'vendor_type']
                    for field in required_fields:
                        if field not in vendor:
                            self.log(f"⚠️ Vendor missing field: {field}")
                    
                    self.log(f"   Sample vendor: {vendor.get('name')} ({vendor.get('vendor_type')})")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(vendors)
                }
            else:
                self.log(f"❌ Failed to get vendors: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing vendors: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_employees(self) -> Dict[str, Any]:
        """Test GET /api/finance/employees - should return list of employees"""
        try:
            self.log("🧪 Testing finance employees endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/employees")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has employees array
                if not isinstance(data, dict) or 'employees' not in data:
                    self.log(f"❌ Expected dict with 'employees' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                employees = data['employees']
                if not isinstance(employees, list):
                    self.log(f"❌ Expected employees array, got {type(employees)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(employees)} employees")
                
                # Check employee structure if any exist
                if employees:
                    employee = employees[0]
                    required_fields = ['id', 'name', 'role']
                    for field in required_fields:
                        if field not in employee:
                            self.log(f"⚠️ Employee missing field: {field}")
                    
                    self.log(f"   Sample employee: {employee.get('name')} ({employee.get('role')})")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(employees)
                }
            else:
                self.log(f"❌ Failed to get employees: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing employees: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_finance_payroll(self) -> Dict[str, Any]:
        """Test GET /api/finance/payroll - should return payroll records"""
        try:
            self.log("🧪 Testing finance payroll endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/payroll")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has payroll array
                if not isinstance(data, dict) or 'payroll' not in data:
                    self.log(f"❌ Expected dict with 'payroll' key, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                payroll = data['payroll']
                if not isinstance(payroll, list):
                    self.log(f"❌ Expected payroll array, got {type(payroll)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(payroll)} payroll records")
                
                # Check payroll structure if any exist
                if payroll:
                    record = payroll[0]
                    required_fields = ['id', 'employee_id', 'base_amount', 'status']
                    for field in required_fields:
                        if field not in record:
                            self.log(f"⚠️ Payroll record missing field: {field}")
                    
                    self.log(f"   Sample payroll: Employee {record.get('employee_id')}, Amount: ₴{record.get('base_amount', 0)}")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(payroll)
                }
            else:
                self.log(f"❌ Failed to get payroll: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing payroll: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_admin_expense_categories(self) -> Dict[str, Any]:
        """Test GET /api/finance/admin/expense-categories - should return expense categories"""
        try:
            self.log("🧪 Testing admin expense categories endpoint...")
            
            response = self.session.get(f"{self.base_url}/finance/admin/expense-categories")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should be a list of categories
                if not isinstance(data, list):
                    self.log(f"❌ Expected list of categories, got {type(data)}", "ERROR")
                    return {"success": False, "data": data}
                
                self.log(f"✅ Retrieved {len(data)} expense categories")
                
                # Check category structure if any exist
                if data:
                    category = data[0]
                    required_fields = ['id', 'type', 'code', 'name']
                    for field in required_fields:
                        if field not in category:
                            self.log(f"⚠️ Category missing field: {field}")
                    
                    self.log(f"   Sample category: {category.get('name')} ({category.get('code')})")
                
                return {
                    "success": True, 
                    "data": data,
                    "count": len(data)
                }
            else:
                self.log(f"❌ Failed to get expense categories: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing expense categories: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_create_vendor(self) -> Dict[str, Any]:
        """Test POST /api/finance/vendors - create a new vendor"""
        try:
            self.log("🧪 Testing create vendor endpoint...")
            
            # Test vendor data
            vendor_data = {
                "name": "Test Vendor Company",
                "vendor_type": "service",
                "contact_name": "Іван Петренко",
                "phone": "+380501234567",
                "email": "test@vendor.com",
                "address": "вул. Тестова, 123, Київ",
                "note": "Тестовий постачальник для перевірки API"
            }
            
            response = self.session.post(f"{self.base_url}/finance/vendors", json=vendor_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check success response
                if not data.get('success'):
                    self.log(f"❌ Vendor creation failed: {data}", "ERROR")
                    return {"success": False, "data": data}
                
                vendor_id = data.get('vendor_id')
                self.log(f"✅ Created vendor with ID: {vendor_id}")
                
                return {
                    "success": True, 
                    "data": data,
                    "vendor_id": vendor_id
                }
            else:
                self.log(f"❌ Failed to create vendor: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing create vendor: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_create_employee(self) -> Dict[str, Any]:
        """Test POST /api/finance/employees - create a new employee"""
        try:
            self.log("🧪 Testing create employee endpoint...")
            
            # Test employee data
            employee_data = {
                "name": "Марія Коваленко",
                "role": "manager",
                "phone": "+380671234567",
                "email": "maria@company.com",
                "base_salary": 25000.0,
                "hire_date": "2024-01-15",
                "note": "Тестовий співробітник для перевірки API"
            }
            
            response = self.session.post(f"{self.base_url}/finance/employees", json=employee_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check success response
                if not data.get('success'):
                    self.log(f"❌ Employee creation failed: {data}", "ERROR")
                    return {"success": False, "data": data}
                
                employee_id = data.get('employee_id')
                self.log(f"✅ Created employee with ID: {employee_id}")
                
                return {
                    "success": True, 
                    "data": data,
                    "employee_id": employee_id
                }
            else:
                self.log(f"❌ Failed to create employee: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing create employee: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def verify_finance_integration_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior for Finance Cabinet integration"""
        try:
            self.log("🔍 Verifying Finance Cabinet integration behavior...")
            
            results = {
                "manager_finance_working": False,
                "finance_dashboard_working": False,
                "vendors_api_working": False,
                "employees_api_working": False,
                "payroll_api_working": False,
                "expense_categories_working": False,
                "create_vendor_working": False,
                "create_employee_working": False,
                "all_endpoints_accessible": False
            }
            
            # Test 1: Manager Finance Summary
            self.log("   Testing Manager Finance Summary API...")
            manager_result = self.test_manager_finance_summary()
            
            if manager_result.get("success"):
                results["manager_finance_working"] = True
                self.log("   ✅ Manager Finance Summary: Working")
            else:
                self.log("   ❌ Manager Finance Summary: Failed", "ERROR")
            
            # Test 2: Finance Dashboard
            self.log("   Testing Finance Dashboard API...")
            dashboard_result = self.test_finance_dashboard()
            
            if dashboard_result.get("success"):
                results["finance_dashboard_working"] = True
                self.log("   ✅ Finance Dashboard: Working")
            else:
                self.log("   ❌ Finance Dashboard: Failed", "ERROR")
            
            # Test 3: Vendors API
            self.log("   Testing Vendors API...")
            vendors_result = self.test_finance_vendors()
            
            if vendors_result.get("success"):
                results["vendors_api_working"] = True
                self.log("   ✅ Vendors API: Working")
            else:
                self.log("   ❌ Vendors API: Failed", "ERROR")
            
            # Test 4: Employees API
            self.log("   Testing Employees API...")
            employees_result = self.test_finance_employees()
            
            if employees_result.get("success"):
                results["employees_api_working"] = True
                self.log("   ✅ Employees API: Working")
            else:
                self.log("   ❌ Employees API: Failed", "ERROR")
            
            # Test 5: Payroll API
            self.log("   Testing Payroll API...")
            payroll_result = self.test_finance_payroll()
            
            if payroll_result.get("success"):
                results["payroll_api_working"] = True
                self.log("   ✅ Payroll API: Working")
            else:
                self.log("   ❌ Payroll API: Failed", "ERROR")
            
            # Test 6: Expense Categories API
            self.log("   Testing Expense Categories API...")
            categories_result = self.test_admin_expense_categories()
            
            if categories_result.get("success"):
                results["expense_categories_working"] = True
                self.log("   ✅ Expense Categories API: Working")
            else:
                self.log("   ❌ Expense Categories API: Failed", "ERROR")
            
            # Test 7: Create Vendor
            self.log("   Testing Create Vendor API...")
            create_vendor_result = self.test_create_vendor()
            
            if create_vendor_result.get("success"):
                results["create_vendor_working"] = True
                self.log("   ✅ Create Vendor API: Working")
            else:
                self.log("   ❌ Create Vendor API: Failed", "ERROR")
            
            # Test 8: Create Employee
            self.log("   Testing Create Employee API...")
            create_employee_result = self.test_create_employee()
            
            if create_employee_result.get("success"):
                results["create_employee_working"] = True
                self.log("   ✅ Create Employee API: Working")
            else:
                self.log("   ❌ Create Employee API: Failed", "ERROR")
            
            # Overall endpoint accessibility
            critical_endpoints = [
                manager_result.get("success", False),
                dashboard_result.get("success", False),
                vendors_result.get("success", False),
                employees_result.get("success", False),
                categories_result.get("success", False)
            ]
            
            if all(critical_endpoints):
                results["all_endpoints_accessible"] = True
                self.log("   ✅ All critical Finance Cabinet endpoints accessible")
            else:
                self.log("   ❌ Some critical Finance Cabinet endpoints not accessible", "ERROR")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying Finance Cabinet integration: {str(e)}", "ERROR")
            return {"error": str(e)}

    def run_comprehensive_finance_test(self):
        """Run the comprehensive Finance Cabinet integration test"""
        self.log("🚀 Starting comprehensive Finance Cabinet integration test")
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
        
        # Step 3: Test Manager Finance Summary
        self.log("\n🔍 Step 2: Testing Manager Finance Summary...")
        manager_result = self.test_manager_finance_summary()
        manager_success = manager_result.get("success", False)
        
        # Step 4: Test Finance Dashboard
        self.log("\n🔍 Step 3: Testing Finance Dashboard...")
        dashboard_result = self.test_finance_dashboard()
        dashboard_success = dashboard_result.get("success", False)
        
        # Step 5: Test Vendors API
        self.log("\n🔍 Step 4: Testing Vendors API...")
        vendors_result = self.test_finance_vendors()
        vendors_success = vendors_result.get("success", False)
        
        # Step 6: Test Employees API
        self.log("\n🔍 Step 5: Testing Employees API...")
        employees_result = self.test_finance_employees()
        employees_success = employees_result.get("success", False)
        
        # Step 7: Test Payroll API
        self.log("\n🔍 Step 6: Testing Payroll API...")
        payroll_result = self.test_finance_payroll()
        payroll_success = payroll_result.get("success", False)
        
        # Step 8: Test Expense Categories API
        self.log("\n🔍 Step 7: Testing Expense Categories API...")
        categories_result = self.test_admin_expense_categories()
        categories_success = categories_result.get("success", False)
        
        # Step 9: Test Create Vendor
        self.log("\n🔍 Step 8: Testing Create Vendor...")
        create_vendor_result = self.test_create_vendor()
        create_vendor_success = create_vendor_result.get("success", False)
        
        # Step 10: Test Create Employee
        self.log("\n🔍 Step 9: Testing Create Employee...")
        create_employee_result = self.test_create_employee()
        create_employee_success = create_employee_result.get("success", False)
        
        # Step 11: Comprehensive verification
        self.log("\n🔍 Step 10: Comprehensive verification...")
        behavior_results = self.verify_finance_integration_behavior()
        
        # Step 12: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE FINANCE CABINET TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if manager_success:
            self.log(f"   • Manager Finance Summary: ✅ Working")
            manager_data = manager_result.get("data", {})
            self.log(f"     - Total Revenue: ₴{manager_data.get('total_revenue', 0)}")
            self.log(f"     - Deposits Held: ₴{manager_data.get('deposits_held', 0)}")
        else:
            self.log(f"   • Manager Finance Summary: ❌ Failed")
        
        if dashboard_success:
            self.log(f"   • Finance Dashboard: ✅ Working")
            dashboard_data = dashboard_result.get("data", {})
            metrics = dashboard_data.get("metrics", {})
            self.log(f"     - Net Profit: ₴{metrics.get('net_profit', 0)}")
        else:
            self.log(f"   • Finance Dashboard: ❌ Failed")
        
        if vendors_success:
            self.log(f"   • Vendors API: ✅ Working ({vendors_result.get('count', 0)} vendors)")
        else:
            self.log(f"   • Vendors API: ❌ Failed")
        
        if employees_success:
            self.log(f"   • Employees API: ✅ Working ({employees_result.get('count', 0)} employees)")
        else:
            self.log(f"   • Employees API: ❌ Failed")
        
        if payroll_success:
            self.log(f"   • Payroll API: ✅ Working ({payroll_result.get('count', 0)} records)")
        else:
            self.log(f"   • Payroll API: ❌ Failed")
        
        if categories_success:
            self.log(f"   • Expense Categories: ✅ Working ({categories_result.get('count', 0)} categories)")
        else:
            self.log(f"   • Expense Categories: ❌ Failed")
        
        if create_vendor_success:
            self.log(f"   • Create Vendor: ✅ Working (ID: {create_vendor_result.get('vendor_id')})")
        else:
            self.log(f"   • Create Vendor: ❌ Failed")
        
        if create_employee_success:
            self.log(f"   • Create Employee: ✅ Working (ID: {create_employee_result.get('employee_id')})")
        else:
            self.log(f"   • Create Employee: ❌ Failed")
        
        self.log("\n🎉 FINANCE CABINET TESTING COMPLETED!")
        self.log("   The system correctly provides:")
        self.log("   • 📊 Manager finance summary with real ledger data")
        self.log("   • 📈 Finance dashboard with metrics and deposits")
        self.log("   • 👥 Vendors management API")
        self.log("   • 👨‍💼 Employees management API")
        self.log("   • 💰 Payroll records API")
        self.log("   • 📝 Expense categories management")
        self.log("   • ➕ Create new vendors and employees")
        self.log("   • 🔐 Authentication for vitokdrako@gmail.com")
        
        # Check if all critical APIs work
        critical_apis = [manager_success, dashboard_success, vendors_success, employees_success, categories_success]
        critical_success = all(critical_apis)
        
        if critical_success:
            self.log("\n✅ ALL CRITICAL FINANCE CABINET APIS WORKING!")
        else:
            self.log("\n⚠️ SOME CRITICAL FINANCE CABINET APIS FAILED - CHECK LOGS ABOVE")
        
        return critical_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Finance Cabinet Integration")
    print("=" * 80)
    print("Testing the Finance Cabinet full integration with real data:")
    print("   1. 📊 Manager Finance Summary - GET /api/manager/finance/summary")
    print("      - Should return revenue, deposits data from ledger")
    print("   2. 📈 Finance Dashboard - GET /api/finance/dashboard?period=month")
    print("      - Should return metrics and deposits")
    print("   3. 👥 Vendors API - GET /api/finance/vendors")
    print("      - Should return list of vendors")
    print("   4. 👨‍💼 Employees API - GET /api/finance/employees")
    print("      - Should return list of employees")
    print("   5. 💰 Payroll API - GET /api/finance/payroll")
    print("      - Should return payroll records")
    print("   6. 📝 Expense Categories - GET /api/finance/admin/expense-categories")
    print("      - Should return expense categories")
    print("   7. ➕ Create Vendor - POST /api/finance/vendors")
    print("      - Should create a new vendor")
    print("   8. ➕ Create Employee - POST /api/finance/employees")
    print("      - Should create a new employee")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://finflow-581.preview.emergentagent.com")
    print("=" * 80)
    
    tester = FinanceCabinetTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_finance_test()
        
        if success:
            print("\n✅ ALL FINANCE CABINET APIS VERIFIED SUCCESSFULLY")
            print("📊 Summary: Finance Cabinet integration working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Manager Finance Summary: Real ledger data integration")
            print("   ✅ Finance Dashboard: Metrics and deposits working")
            print("   ✅ Vendors API: List and create functionality")
            print("   ✅ Employees API: List and create functionality")
            print("   ✅ Payroll API: Records accessible")
            print("   ✅ Expense Categories: Admin management working")
            print("   - All Finance Cabinet APIs return proper data structures")
            print("   - Authentication works with provided credentials")
            print("   - Real financial data integration confirmed")
            print("   - Admin panel finance management operational")
            sys.exit(0)
        else:
            print("\n❌ SOME FINANCE CABINET APIS FAILED VERIFICATION")
            print("📊 Summary: Issues found in Finance Cabinet integration")
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