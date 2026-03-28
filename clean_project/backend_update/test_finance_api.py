"""
Test finance API to verify data format
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')

try:
    print("=" * 100)
    print("ТЕСТ FINANCE API")
    print("=" * 100)
    
    # Test ledger endpoint
    print(f"\nЗапит до: {BACKEND_URL}/api/manager/finance/ledger?limit=5")
    
    response = requests.get(f"{BACKEND_URL}/api/manager/finance/ledger?limit=5")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n✅ Отримано {len(data)} транзакцій")
        
        if data:
            print("\n" + "=" * 100)
            print("ПРИКЛАД ТРАНЗАКЦІЇ:")
            print("=" * 100)
            
            first = data[0]
            print(f"\nПоля транзакції:")
            for key, value in first.items():
                print(f"  {key:20} = {value}")
            
            print("\n" + "=" * 100)
            print("ВСІ ТРАНЗАКЦІЇ:")
            print("=" * 100)
            
            for i, tx in enumerate(data, 1):
                print(f"\n{i}. {tx.get('type', 'N/A')}")
                print(f"   Замовлення: {tx.get('order_id', 'N/A')}")
                print(f"   Дата: {tx.get('date', 'N/A')}")
                print(f"   Debit: {tx.get('debit', 0)} грн")
                print(f"   Credit: {tx.get('credit', 0)} грн")
                print(f"   Метод: {tx.get('payment_method', 'N/A')}")
                print(f"   Статус: {tx.get('status', 'N/A')}")
        else:
            print("\n⚠️ Немає транзакцій в базі даних")
            print("\nСтворіть тестові транзакції через додавання оплати або застави")
    else:
        print(f"\n❌ Помилка: {response.status_code}")
        print(response.text)
    
    print("\n" + "=" * 100)
    print("✅ Тест завершено!")
    print("=" * 100)
    
except Exception as e:
    print(f"\n❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
