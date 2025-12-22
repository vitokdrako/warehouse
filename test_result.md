# Test Results - Finance Console (Simplified)

## Test Focus
Testing the simplified FinanceConsoleApp with 3 tabs instead of 6:
1. Ордери - Shell layout (list + detail panel)
2. Облік - Ledger journal 
3. Витрати - One-off expenses + Payroll

## Test Credentials
- email: vitokdrako@gmail.com
- password: test123

## API Endpoints
- GET /api/manager/finance/orders-with-finance - Orders with financial data
- GET /api/finance/deposits - Deposit list
- GET /api/finance/ledger - Transaction journal
- GET /api/finance/expenses - Expense list
- GET /api/finance/employees - Employee list
- GET /api/finance/payroll - Payroll records
- POST /api/finance/payments - Accept payment
- POST /api/finance/deposits/create - Create deposit
- POST /api/finance/expenses - Create expense
- POST /api/finance/payroll - Create payroll

## Expected UI
- 3 tabs only: Ордери, Облік, Витрати
- Shell layout on Orders tab (left list, right detail)
- CorporateHeader with "Фінансова консоль"
