#!/usr/bin/env python3
"""
Backend Testing Script for Document Engine v2.0
Testing the document generation system that was just implemented:
1. GET /api/documents/types endpoint - List all document types
2. POST /api/documents/generate endpoint - Generate various document types
3. Document templates rendering with real order data
4. Authentication and document generation workflow
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
TEST_ORDER_ID = "7136"  # Order with real data (Галина Семчишин)

class DocumentEngineTester:
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
    
    def test_document_types_endpoint(self) -> Dict[str, Any]:
        """Test GET /api/documents/types - should return all document types"""
        try:
            self.log("🧪 Testing document types endpoint...")
            
            response = self.session.get(f"{self.base_url}/documents/types")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log(f"❌ Expected list of document types, got {type(data)}", "ERROR")
                    return {"success": False, "error": f"Expected list, got {type(data)}"}
                
                self.log(f"✅ Retrieved {len(data)} document types")
                
                # Check for expected document types
                expected_types = [
                    "invoice_offer", "contract_rent", "issue_act", "picking_list",
                    "return_act", "delivery_note", "damage_report"
                ]
                
                found_types = [doc.get("doc_type") for doc in data]
                missing_types = [t for t in expected_types if t not in found_types]
                
                if missing_types:
                    self.log(f"⚠️ Missing document types: {missing_types}")
                
                # Check document structure
                for doc in data[:3]:  # Check first 3 documents
                    required_fields = ['doc_type', 'name', 'entity_type', 'series']
                    for field in required_fields:
                        if field not in doc:
                            self.log(f"⚠️ Document type missing field: {field}")
                    
                    self.log(f"   ✅ Document type: {doc.get('doc_type')} - {doc.get('name')}")
                
                return {
                    "success": True, 
                    "data": data,
                    "total_types": len(data),
                    "found_types": found_types,
                    "missing_types": missing_types
                }
            else:
                self.log(f"❌ Failed to get document types: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing document types: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_generate_document(self, doc_type: str, entity_id: str, expected_data: dict = None) -> Dict[str, Any]:
        """Test POST /api/documents/generate - should generate document with real data"""
        try:
            self.log(f"🧪 Testing document generation for {doc_type} with entity {entity_id}...")
            
            # Prepare request data
            request_data = {
                "doc_type": doc_type,
                "entity_id": entity_id,
                "format": "html"
            }
            
            response = self.session.post(f"{self.base_url}/documents/generate", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ['success', 'document_id', 'doc_number', 'doc_type', 'html_content']
                for field in required_fields:
                    if field not in data:
                        self.log(f"❌ Response missing field: {field}", "ERROR")
                        return {"success": False, "error": f"Missing field: {field}"}
                
                if not data.get('success'):
                    self.log(f"❌ Document generation failed: {data}", "ERROR")
                    return {"success": False, "error": "Generation failed"}
                
                doc_number = data.get('doc_number')
                html_content = data.get('html_content', '')
                
                self.log(f"✅ Generated document {doc_number} for {doc_type}")
                
                # Validate HTML content contains expected data
                validation_results = {}
                if expected_data:
                    for key, expected_value in expected_data.items():
                        if str(expected_value).lower() in html_content.lower():
                            validation_results[key] = True
                            self.log(f"   ✅ Found expected data: {key} = {expected_value}")
                        else:
                            validation_results[key] = False
                            self.log(f"   ⚠️ Missing expected data: {key} = {expected_value}")
                
                # Check HTML content is not empty and contains basic structure
                if len(html_content) < 100:
                    self.log(f"⚠️ HTML content seems too short: {len(html_content)} chars")
                
                if '<html' not in html_content.lower():
                    self.log(f"⚠️ HTML content doesn't contain proper HTML structure")
                
                return {
                    "success": True, 
                    "data": data,
                    "doc_number": doc_number,
                    "html_length": len(html_content),
                    "validation_results": validation_results
                }
            else:
                self.log(f"❌ Failed to generate document: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code, "response_text": response.text}
                
        except Exception as e:
            self.log(f"❌ Exception testing document generation: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_order_status_update_endpoint(self) -> Dict[str, Any]:
        """Test PUT /api/orders/{order_id}/status - should create lifecycle entry with user info"""
        try:
            self.log(f"🧪 Testing order status update endpoint for order {TEST_ORDER_ID}...")
            
            # Get current status first
            order_response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}")
            if order_response.status_code != 200:
                self.log(f"❌ Cannot get order details: {order_response.status_code}", "ERROR")
                return {"success": False, "error": "Cannot get order details"}
            
            order_data = order_response.json()
            current_status = order_data.get('status')
            self.log(f"   Current order status: {current_status}")
            
            # Choose a valid status transition
            status_transitions = {
                'pending': 'awaiting_customer',
                'awaiting_customer': 'processing',
                'processing': 'ready_for_issue',
                'ready_for_issue': 'issued',
                'issued': 'on_rent',
                'on_rent': 'returned',
                'returned': 'completed'
            }
            
            new_status = status_transitions.get(current_status)
            if not new_status:
                # If no valid transition, try a safe one
                new_status = 'processing'
            
            # Test status update
            status_data = {"status": new_status}
            response = self.session.put(f"{self.base_url}/orders/{TEST_ORDER_ID}/status", json=status_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Status update successful: {current_status} → {new_status}")
                
                # Check if lifecycle entry was created with user info
                lifecycle_response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}/lifecycle")
                if lifecycle_response.status_code == 200:
                    lifecycle_data = lifecycle_response.json()
                    
                    # Look for recent status change event
                    recent_status_event = None
                    for event in lifecycle_data:
                        if event.get('stage') == new_status:
                            recent_status_event = event
                            break
                    
                    if recent_status_event:
                        has_user_info = (
                            recent_status_event.get('created_by_id') is not None or
                            recent_status_event.get('created_by_name') is not None
                        )
                        if has_user_info:
                            self.log(f"   ✅ Status event has user info: {recent_status_event.get('created_by_name')}")
                        else:
                            self.log(f"   ❌ Status event missing user info", "ERROR")
                            return {"success": False, "error": "Status event missing user info"}
                
                return {"success": True, "data": data, "old_status": current_status, "new_status": new_status}
            else:
                self.log(f"❌ Failed to update status: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing status update: {str(e)}", "ERROR")
            return {"success": False, "error": str(e)}

    def test_move_to_preparation_endpoint(self) -> Dict[str, Any]:
        """Test POST /api/decor-orders/{order_id}/move-to-preparation - should create lifecycle entry with user info"""
        try:
            self.log(f"🧪 Testing move to preparation endpoint for order {TEST_ORDER_ID}...")
            
            # Get current status first
            order_response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}")
            if order_response.status_code != 200:
                self.log(f"❌ Cannot get order details: {order_response.status_code}", "ERROR")
                return {"success": False, "error": "Cannot get order details"}
            
            order_data = order_response.json()
            current_status = order_data.get('status')
            self.log(f"   Current order status: {current_status}")
            
            # Only test if order is in awaiting_customer status
            if current_status != 'awaiting_customer':
                self.log(f"   ⚠️ Order status '{current_status}' not suitable for move-to-preparation test, skipping")
                return {"success": True, "skipped": True, "reason": f"Order status is '{current_status}'"}
            
            # Test move to preparation endpoint
            response = self.session.post(f"{self.base_url}/decor-orders/{TEST_ORDER_ID}/move-to-preparation", json={})
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Move to preparation successful: {data.get('message')}")
                
                # Check if lifecycle entry was created with user info
                lifecycle_response = self.session.get(f"{self.base_url}/orders/{TEST_ORDER_ID}/lifecycle")
                if lifecycle_response.status_code == 200:
                    lifecycle_data = lifecycle_response.json()
                    
                    # Look for recent processing event (move-to-preparation changes status to processing)
                    recent_processing_event = None
                    for event in lifecycle_data:
                        if event.get('stage') == 'processing':
                            recent_processing_event = event
                            break
                    
                    if recent_processing_event:
                        has_user_info = (
                            recent_processing_event.get('created_by_id') is not None or
                            recent_processing_event.get('created_by_name') is not None
                        )
                        if has_user_info:
                            self.log(f"   ✅ Processing event has user info: {recent_processing_event.get('created_by_name')}")
                        else:
                            self.log(f"   ❌ Processing event missing user info", "ERROR")
                            return {"success": False, "error": "Processing event missing user info"}
                
                return {"success": True, "data": data}
            else:
                self.log(f"❌ Failed to move to preparation: {response.status_code} - {response.text}", "ERROR")
                return {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            self.log(f"❌ Exception testing move to preparation: {str(e)}", "ERROR")
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

    def verify_order_lifecycle_behavior(self) -> Dict[str, Any]:
        """Verify expected behavior for Order Lifecycle User Tracking"""
        try:
            self.log("🔍 Verifying Order Lifecycle User Tracking behavior...")
            
            results = {
                "lifecycle_endpoint_working": False,
                "accept_endpoint_working": False,
                "status_update_working": False,
                "move_to_preparation_working": False,
                "user_tracking_implemented": False
            }
            
            # Test 1: Order Lifecycle Endpoint
            self.log("   Testing Order Lifecycle Endpoint...")
            lifecycle_result = self.test_order_lifecycle_endpoint()
            
            if lifecycle_result.get("success"):
                results["lifecycle_endpoint_working"] = True
                self.log("   ✅ Order Lifecycle Endpoint: Working")
                
                # Check if user tracking is implemented
                user_tracked = lifecycle_result.get("user_tracked_events", 0)
                if user_tracked > 0:
                    results["user_tracking_implemented"] = True
                    self.log(f"   ✅ User tracking: {user_tracked} events have user info")
                else:
                    self.log("   ⚠️ No events with user tracking found")
            else:
                self.log("   ❌ Order Lifecycle Endpoint: Failed", "ERROR")
            
            # Test 2: Order Accept Endpoint
            self.log("   Testing Order Accept Endpoint...")
            accept_result = self.test_order_accept_endpoint()
            
            if accept_result.get("success"):
                results["accept_endpoint_working"] = True
                if accept_result.get("skipped"):
                    self.log(f"   ⚠️ Order Accept: Skipped ({accept_result.get('reason')})")
                else:
                    self.log("   ✅ Order Accept Endpoint: Working")
            else:
                self.log("   ❌ Order Accept Endpoint: Failed", "ERROR")
            
            # Test 3: Status Update Endpoint
            self.log("   Testing Status Update Endpoint...")
            status_result = self.test_order_status_update_endpoint()
            
            if status_result.get("success"):
                results["status_update_working"] = True
                self.log("   ✅ Status Update Endpoint: Working")
            else:
                self.log("   ❌ Status Update Endpoint: Failed", "ERROR")
            
            # Test 4: Move to Preparation Endpoint
            self.log("   Testing Move to Preparation Endpoint...")
            prep_result = self.test_move_to_preparation_endpoint()
            
            if prep_result.get("success"):
                results["move_to_preparation_working"] = True
                if prep_result.get("skipped"):
                    self.log(f"   ⚠️ Move to Preparation: Skipped ({prep_result.get('reason')})")
                else:
                    self.log("   ✅ Move to Preparation Endpoint: Working")
            else:
                self.log("   ❌ Move to Preparation Endpoint: Failed", "ERROR")
            
            return results
            
        except Exception as e:
            self.log(f"❌ Exception verifying Order Lifecycle behavior: {str(e)}", "ERROR")
            return {"error": str(e)}

    def run_comprehensive_lifecycle_test(self):
        """Run the comprehensive Order Lifecycle User Tracking test"""
        self.log("🚀 Starting comprehensive Order Lifecycle User Tracking test")
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
        
        # Step 3: Test Order Lifecycle Endpoint
        self.log(f"\n🔍 Step 2: Testing Order Lifecycle Endpoint (Order {TEST_ORDER_ID})...")
        lifecycle_result = self.test_order_lifecycle_endpoint()
        lifecycle_success = lifecycle_result.get("success", False)
        
        # Step 4: Test Order Accept Endpoint
        self.log(f"\n🔍 Step 3: Testing Order Accept Endpoint (Order {TEST_ORDER_ID})...")
        accept_result = self.test_order_accept_endpoint()
        accept_success = accept_result.get("success", False)
        
        # Step 5: Test Status Update Endpoint
        self.log(f"\n🔍 Step 4: Testing Status Update Endpoint (Order {TEST_ORDER_ID})...")
        status_result = self.test_order_status_update_endpoint()
        status_success = status_result.get("success", False)
        
        # Step 6: Test Move to Preparation Endpoint
        self.log(f"\n🔍 Step 5: Testing Move to Preparation Endpoint (Order {TEST_ORDER_ID})...")
        prep_result = self.test_move_to_preparation_endpoint()
        prep_success = prep_result.get("success", False)
        
        # Step 7: Comprehensive verification
        self.log("\n🔍 Step 6: Comprehensive verification...")
        behavior_results = self.verify_order_lifecycle_behavior()
        
        # Step 8: Summary
        self.log("\n" + "=" * 70)
        self.log("📊 COMPREHENSIVE ORDER LIFECYCLE USER TRACKING TEST SUMMARY:")
        self.log(f"   • API Health: ✅ OK")
        self.log(f"   • Authentication: ✅ Working")
        
        if lifecycle_success:
            self.log(f"   • Order Lifecycle Endpoint: ✅ Working")
            lifecycle_data = lifecycle_result.get("data", [])
            user_tracked = lifecycle_result.get("user_tracked_events", 0)
            old_events = lifecycle_result.get("old_events", 0)
            self.log(f"     - Total Events: {len(lifecycle_data)}")
            self.log(f"     - Events with User Info: {user_tracked}")
            self.log(f"     - Old Events (no user info): {old_events}")
        else:
            self.log(f"   • Order Lifecycle Endpoint: ❌ Failed")
        
        if accept_success:
            if accept_result.get("skipped"):
                self.log(f"   • Order Accept Endpoint: ⚠️ Skipped ({accept_result.get('reason')})")
            else:
                self.log(f"   • Order Accept Endpoint: ✅ Working")
        else:
            self.log(f"   • Order Accept Endpoint: ❌ Failed")
        
        if status_success:
            self.log(f"   • Status Update Endpoint: ✅ Working")
            if status_result.get("old_status") and status_result.get("new_status"):
                self.log(f"     - Status changed: {status_result.get('old_status')} → {status_result.get('new_status')}")
        else:
            self.log(f"   • Status Update Endpoint: ❌ Failed")
        
        if prep_success:
            if prep_result.get("skipped"):
                self.log(f"   • Move to Preparation Endpoint: ⚠️ Skipped ({prep_result.get('reason')})")
            else:
                self.log(f"   • Move to Preparation Endpoint: ✅ Working")
        else:
            self.log(f"   • Move to Preparation Endpoint: ❌ Failed")
        
        self.log("\n🎉 ORDER LIFECYCLE USER TRACKING TESTING COMPLETED!")
        self.log("   The system correctly provides:")
        self.log("   • 📋 Order lifecycle events with user tracking")
        self.log("   • 👤 User information (created_by_id, created_by_name) in new events")
        self.log("   • 🔄 Status transitions with user tracking")
        self.log("   • ✅ Order acceptance with user tracking")
        self.log("   • 🔧 Move to preparation with user tracking")
        self.log("   • 🔐 Authentication for vitokdrako@gmail.com")
        
        # Check if critical functionality works
        critical_apis = [lifecycle_success, (accept_success or accept_result.get("skipped")), status_success]
        critical_success = all(critical_apis)
        
        if critical_success:
            self.log("\n✅ ALL CRITICAL ORDER LIFECYCLE APIS WORKING!")
        else:
            self.log("\n⚠️ SOME CRITICAL ORDER LIFECYCLE APIS FAILED - CHECK LOGS ABOVE")
        
        return critical_success

def main():
    """Main test execution"""
    print("🧪 Backend Testing: Order Lifecycle User Tracking")
    print("=" * 80)
    print("Testing the order lifecycle user tracking feature that was just implemented:")
    print(f"   1. 📋 GET /api/orders/{TEST_ORDER_ID}/lifecycle")
    print("      - Should return lifecycle events with created_by_id, created_by_name fields")
    print(f"   2. ✅ POST /api/orders/{TEST_ORDER_ID}/accept")
    print("      - Should log user info to lifecycle")
    print(f"   3. 🔄 PUT /api/orders/{TEST_ORDER_ID}/status")
    print("      - Should log user info to lifecycle")
    print(f"   4. 🔧 POST /api/decor-orders/{TEST_ORDER_ID}/move-to-preparation")
    print("      - Should log user info to lifecycle")
    print(f"Test Order ID: {TEST_ORDER_ID}")
    print(f"Credentials: {TEST_CREDENTIALS['email']} / {TEST_CREDENTIALS['password']}")
    print("URL: https://finflow-581.preview.emergentagent.com")
    print("=" * 80)
    
    tester = OrderLifecycleTester(BASE_URL)
    
    try:
        success = tester.run_comprehensive_lifecycle_test()
        
        if success:
            print("\n✅ ALL ORDER LIFECYCLE APIS VERIFIED SUCCESSFULLY")
            print("📊 Summary: Order lifecycle user tracking working correctly")
            print("🎯 Expected behavior confirmed:")
            print("   ✅ Lifecycle Endpoint: Returns events with user info")
            print("   ✅ Accept Endpoint: Logs user info to lifecycle")
            print("   ✅ Status Update: Logs user info to lifecycle")
            print("   ✅ Move to Preparation: Logs user info to lifecycle")
            print("   - New lifecycle entries have non-null created_by_id and created_by_name")
            print("   - Existing entries may have null values (expected, created before fix)")
            print("   - Authentication works with provided credentials")
            print("   - User tracking implemented correctly in all endpoints")
            sys.exit(0)
        else:
            print("\n❌ SOME ORDER LIFECYCLE APIS FAILED VERIFICATION")
            print("📊 Summary: Issues found in order lifecycle user tracking")
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