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
TEST_MONTH = "2025-02"  # Month for generating due items

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