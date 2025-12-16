/**
 * Finance API Service
 * Підключення до /api/finance/* з fallback на mock
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Mock data for fallback
const mockDashboard = {
  period: 'month',
  metrics: {
    net_profit: 4700,
    rent_revenue: 5000,
    damage_compensation: 500,
    operating_expenses: 800,
    cash_balance: 6200,
  },
  deposits: {
    held: 2000,
    used: 500,
    refunded: 0,
    available_to_refund: 1500,
  },
};

const mockAccounts = [
  { id: 1, code: 'CASH', name: 'Каса (готівка)', kind: 'asset', balance: 1200 },
  { id: 2, code: 'BANK', name: 'Банківський рахунок', kind: 'asset', balance: 5000 },
  { id: 3, code: 'RENT_REV', name: 'Дохід з оренди', kind: 'income', balance: 5000 },
  { id: 4, code: 'DMG_COMP', name: 'Компенсація пошкоджень', kind: 'income', balance: 500 },
  { id: 5, code: 'DEP_HOLD', name: 'Застави в холді', kind: 'off_balance', balance: 1500 },
  { id: 6, code: 'OPEX', name: 'Операційні витрати', kind: 'expense', balance: 800 },
];

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isMock: boolean;
}

async function fetchWithFallback<T>(endpoint: string, mockData: T, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null, isMock: false };
  } catch (err) {
    console.warn(`Finance API fallback for ${endpoint}:`, err);
    return { data: mockData, error: String(err), isMock: true };
  }
}

export const financeApi = {
  // Dashboard
  getDashboard: async (period: string = 'month') => {
    return fetchWithFallback(
      `/api/finance/dashboard?period=${period}`,
      mockDashboard
    );
  },

  // Accounts
  getAccounts: async () => {
    return fetchWithFallback('/api/finance/accounts', mockAccounts);
  },

  // Categories
  getCategories: async (type?: string) => {
    const url = type ? `/api/finance/categories?type=${type}` : '/api/finance/categories';
    return fetchWithFallback(url, []);
  },

  // Payments
  getPayments: async (filters?: { order_id?: number; payment_type?: string }) => {
    let url = '/api/finance/payments';
    const params = new URLSearchParams();
    if (filters?.order_id) params.append('order_id', String(filters.order_id));
    if (filters?.payment_type) params.append('payment_type', filters.payment_type);
    if (params.toString()) url += `?${params}`;
    
    return fetchWithFallback(url, { payments: [] });
  },

  createPayment: async (data: {
    payment_type: 'rent' | 'deposit' | 'damage' | 'refund';
    method: string;
    amount: number;
    order_id?: number;
    damage_case_id?: number;
    payer_name?: string;
    note?: string;
  }) => {
    return fetchWithFallback('/api/finance/payments', null, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Expenses
  getExpenses: async (filters?: { category_code?: string; expense_type?: string }) => {
    let url = '/api/finance/expenses';
    const params = new URLSearchParams();
    if (filters?.category_code) params.append('category_code', filters.category_code);
    if (filters?.expense_type) params.append('expense_type', filters.expense_type);
    if (params.toString()) url += `?${params}`;
    
    return fetchWithFallback(url, { expenses: [] });
  },

  createExpense: async (data: {
    expense_type: string;
    category_code: string;
    amount: number;
    method: string;
    vendor_id?: number;
    order_id?: number;
    note?: string;
  }) => {
    return fetchWithFallback('/api/finance/expenses', null, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Deposits
  getDeposits: async (status?: string) => {
    const url = status ? `/api/finance/deposits?status=${status}` : '/api/finance/deposits';
    return fetchWithFallback(url, []);
  },

  useDeposit: async (depositId: number, amount: number, note?: string, damageCaseId?: number) => {
    const params = new URLSearchParams({ amount: String(amount) });
    if (note) params.append('note', note);
    if (damageCaseId) params.append('damage_case_id', String(damageCaseId));
    
    return fetchWithFallback(`/api/finance/deposits/${depositId}/use?${params}`, null, {
      method: 'POST',
    });
  },

  refundDeposit: async (depositId: number, amount: number, method: string = 'cash', note?: string) => {
    const params = new URLSearchParams({ amount: String(amount), method });
    if (note) params.append('note', note);
    
    return fetchWithFallback(`/api/finance/deposits/${depositId}/refund?${params}`, null, {
      method: 'POST',
    });
  },

  // Ledger
  getLedger: async (filters?: { tx_type?: string; account_code?: string; date_from?: string; date_to?: string }) => {
    let url = '/api/finance/ledger';
    const params = new URLSearchParams();
    if (filters?.tx_type) params.append('tx_type', filters.tx_type);
    if (filters?.account_code) params.append('account_code', filters.account_code);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (params.toString()) url += `?${params}`;
    
    return fetchWithFallback(url, { transactions: [] });
  },
};

export default financeApi;
