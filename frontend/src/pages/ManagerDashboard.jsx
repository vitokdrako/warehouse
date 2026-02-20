/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CorporateHeader from '../components/CorporateHeader';
import OrdersChatModal from '../components/OrdersChatModal';  // ✅ Чат замовлень
import { limitedAuthFetch } from '../utils/requestLimiter';  // ✅ Request limiter

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Utility function for authenticated fetch - тепер з лімітером
const authFetch = (url, options = {}) => {
  return limitedAuthFetch(url, options);
};

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [decorOrders, setDecorOrders] = useState([]);  // Наші замовлення
  const [issueCards, setIssueCards] = useState([]);  // Картки видачі
  const [partialReturnVersions, setPartialReturnVersions] = useState([]);  // ✅ Версії часткових повернень
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState({ revenue: 0, deposits: 0 });
  const [cleaningStats, setCleaningStats] = useState({ repair: 0 });
  const [showChatModal, setShowChatModal] = useState(false);  // ✅ Стан для модалки чату
  
  // Стани для розгортання карток
  const [showAllAwaiting, setShowAllAwaiting] = useState(false);
  const [showAllReturns, setShowAllReturns] = useState(true);  // За замовчуванням показуємо всі
  const [showAllPreparation, setShowAllPreparation] = useState(false);  // Комплектація
  const [showAllReady, setShowAllReady] = useState(false);  // Готові до видачі
  const [showAllPartial, setShowAllPartial] = useState(false);  // Часткове повернення
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Всі');
  const [user, setUser] = useState(null);
  
  // ✅ Режим об'єднання замовлень
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  
  const navigate = useNavigate();

  // Завантажити дані користувача
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Функція для скасування замовлення клієнтом
  const handleCancelByClient = async (orderId, orderNumber) => {
    const reason = prompt(`Скасувати замовлення ${orderNumber}?\n\nПричина відмови клієнта (опціонально):`);
    if (reason === null) return; // User clicked Cancel
    
    if (!confirm(`⚠️ Клієнт відмовився від замовлення ${orderNumber}?\n\nЗамовлення буде скасовано і товари розморожено.`)) {
      return;
    }
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/decor-orders/${orderId}/cancel-by-client`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason || 'Клієнт відмовився без пояснень'
        })
      });
      
      if (response.ok) {
        alert('✅ Замовлення скасовано. Товари розморожено.');
        fetchAllData(); // Перезавантажити дані
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail || 'Не вдалося скасувати замовлення'}`);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert(`❌ Помилка: ${error.message}`);
    }
  };
  
  // Функція для архівування замовлення
  const handleArchiveOrder = async (orderId, orderNumber) => {
    if (!confirm(`Архівувати замовлення ${orderNumber}?\n\nВоно буде приховано з основного дашборду.`)) {
      return;
    }
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/decor-orders/${orderId}/archive`, {
        method: 'POST'
      });
      
      if (response.ok) {
        alert('✅ Замовлення архівовано');
        fetchAllData(); // Перезавантажити дані
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail || 'Не вдалося архівувати'}`);
      }
    } catch (error) {
      console.error('Error archiving order:', error);
      alert(`❌ Помилка: ${error.message}`);
    }
  };

  // ✅ Функція для об'єднання замовлень
  const handleMergeOrders = async () => {
    if (selectedForMerge.length < 2) {
      alert('Виберіть мінімум 2 замовлення для об\'єднання');
      return;
    }
    
    // Останнє вибране буде цільовим (його номер залишиться)
    const targetOrderId = selectedForMerge[selectedForMerge.length - 1];
    const sourceOrderIds = selectedForMerge.slice(0, -1);
    
    const targetOrder = awaitingOrders.find(o => (o.order_id || o.id) === targetOrderId);
    const sourceOrders = sourceOrderIds.map(id => awaitingOrders.find(o => (o.order_id || o.id) === id)).filter(Boolean);
    
    const confirmMsg = `Об'єднати ${selectedForMerge.length} замовлень?\n\n` +
      `Товари з:\n${sourceOrders.map(o => `  • ${o.order_number} (${o.customer_name || o.client_name})`).join('\n')}\n\n` +
      `Будуть перенесені в:\n  → ${targetOrder?.order_number} (${targetOrder?.customer_name || targetOrder?.client_name})\n\n` +
      `⚠️ Старі замовлення будуть видалені!`;
    
    if (!confirm(confirmMsg)) {
      return;
    }
    
    try {
      const response = await authFetch(`${BACKEND_URL}/api/orders/merge`, {
        method: 'POST',
        body: JSON.stringify({
          target_order_id: targetOrderId,
          source_order_ids: sourceOrderIds
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`✅ Замовлення об'єднано!\n\nНовий номер: ${result.order_number}\nТоварів: ${result.items_count}\nСума: ₴${result.total_price}`);
        setMergeMode(false);
        setSelectedForMerge([]);
        fetchAllData(); // Перезавантажити дані
      } else {
        const error = await response.json();
        alert(`❌ Помилка: ${error.detail || 'Не вдалося об\'єднати замовлення'}`);
      }
    } catch (error) {
      console.error('Error merging orders:', error);
      alert(`❌ Помилка: ${error.message}`);
    }
  };

  // Функція для оновлення дат замовлення
  const handleDateUpdate = async (orderId, issueDate, returnDate) => {
    try {
      const response = await authFetch(`${BACKEND_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          issue_date: issueDate,
          return_date: returnDate
        })
      });

      if (response.ok) {
        const updatedOrder = await response.json();
        console.log('[Dashboard] ✅ Order dates updated:', orderId);
        
        // Оновити локальний стан
        setOrders(prevOrders => 
          prevOrders.map(o => o.id === orderId ? updatedOrder : o)
        );
        
        return updatedOrder;
      } else {
        throw new Error('Failed to update dates');
      }
    } catch (error) {
      console.error('[Dashboard] Error updating dates:', error);
      throw error;
    }
  };

  // ============================================================
  // ОПТИМІЗОВАНИЙ ЗАВАНТАЖУВАЧ ДАНИХ - ОДИН ЗАПИТ ЗАМІСТЬ 6-8
  // ============================================================
  
  // AbortController для скасування запитів при unmount
  const abortControllerRef = React.useRef(null);
  
  // Retry fetch з exponential backoff та більшими затримками
  const fetchWithRetry = async (url, options = {}, retries = 3) => {
    const delays = [1000, 3000, 6000]; // Більші затримки для production
    
    for (let i = 0; i <= retries; i++) {
      try {
        // Додаємо випадкову затримку 0-500ms для уникнення "thundering herd"
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
        }
        
        const response = await authFetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (error.name === 'AbortError') throw error; // Не retry при abort
        if (i === retries) throw error;
        console.log(`[Dashboard] Retry ${i + 1}/${retries} after ${delays[i]}ms...`);
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  };

  // Функція для завантаження всіх даних ОДНИМ ЗАПИТОМ
  const fetchAllData = async () => {
    console.log('[Dashboard] 📊 Loading dashboard overview (single request)...');
    
    // Скасовуємо попередній запит якщо є
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const data = await fetchWithRetry(
        `${BACKEND_URL}/api/manager/dashboard/overview`,
        { signal: abortControllerRef.current.signal }
      );
      
      console.log('[Dashboard] ✅ Overview loaded:', {
        awaiting: data.orders_awaiting?.length || 0,
        decor: data.decor_orders?.length || 0,
        cards: data.issue_cards?.length || 0
      });
      
      // Оновлюємо всі стани одночасно
      setOrders(data.orders_awaiting || []);
      setDecorOrders(data.decor_orders || []);
      setIssueCards(data.issue_cards || []);
      setFinanceData({
        revenue: data.finance_summary?.total_revenue || data.finance_summary?.rent_paid || 0,
        deposits: data.finance_summary?.deposits_count || 0
      });
      setCleaningStats({
        repair: data.cleaning_stats?.repair || 0
      });
      
      // ✅ Завантажуємо версії часткових повернень окремо
      try {
        const versionsRes = await authFetch(`${BACKEND_URL}/api/return-versions/active`);
        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          setPartialReturnVersions(versionsData.versions || []);
          console.log('[Dashboard] ✅ Partial return versions loaded:', versionsData.count);
        }
      } catch (e) {
        console.log('[Dashboard] Partial return versions not available');
      }
      
      setLoading(false);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[Dashboard] Request aborted');
        return;
      }
      console.error('[Dashboard] ❌ Error loading overview:', error);
      setLoading(false);
      
      // Fallback до старих endpoints якщо overview не працює
      console.log('[Dashboard] Falling back to individual requests...');
      fetchAllDataLegacy();
    }
  };
  
  // Legacy fallback (старі окремі запити) - ПОСЛІДОВНО з затримками
  const fetchAllDataLegacy = async () => {
    console.log('[Dashboard] 🔄 Legacy fallback: sequential requests with delays...');
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
      // 1. Критичні дані - orders
      const ordersRes = await authFetch(`${BACKEND_URL}/api/orders?status=awaiting_customer`);
      const ordersData = await ordersRes.json();
      setOrders(ordersData.orders || []);
      await delay(300); // Пауза між запитами
      
      // 2. Decor orders
      const decorRes = await authFetch(`${BACKEND_URL}/api/decor-orders?status=processing,ready_for_issue,issued,on_rent,shipped,delivered,returning`);
      const decorData = await decorRes.json();
      setDecorOrders(decorData.orders || []);
      await delay(300);
      
      // 3. Issue cards
      const cardsRes = await authFetch(`${BACKEND_URL}/api/issue-cards`);
      const cardsData = await cardsRes.json();
      setIssueCards(cardsData || []);
      await delay(300);
      
      // 4. Finance (не критичне)
      try {
        const finRes = await authFetch(`${BACKEND_URL}/api/manager/finance/summary`);
        const finData = await finRes.json();
        setFinanceData({
          revenue: finData.total_revenue || finData.rent_paid || 0,
          deposits: finData.deposits_count || 0
        });
      } catch (e) {
        console.log('[Dashboard] Finance fallback skipped');
      }
      
      setLoading(false);
      console.log('[Dashboard] ✅ Legacy fallback completed');
    } catch (err) {
      console.error('[Dashboard] Legacy fallback error:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    
    // Cleanup - скасовуємо запит при unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // Manual reload function - оновити ВСІ дані
  const handleReload = () => {
    setLoading(true);
    console.log('[Dashboard] 🔄 Manual reload triggered');
    fetchAllData();
  };

  // Логіка розподілу замовлень БЕЗ ФІЛЬТРАЦІЇ ПО ДАТІ:
  // Показуємо ВСІ замовлення в певних статусах
  
  // 1. Очікують підтвердження (awaiting_customer)
  const awaitingOrders = orders; // Вже фільтруються по status=awaiting_customer в API
  const newOrders = orders; // Для сумісності з KPI
  
  // 2. В обробці (processing) - на комплектації
  // Фільтрація карток по пошуку
  const filterBySearch = (cards) => {
    if (!searchQuery.trim()) return cards;
    const q = searchQuery.toLowerCase().trim();
    return cards.filter(card => {
      const name = (card.customer_name || '').toLowerCase();
      const phone = (card.customer_phone || '').toLowerCase();
      const orderNum = String(card.order_id || card.id || '').toLowerCase();
      const orderNumber = (card.order_number || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || orderNum.includes(q) || orderNumber.includes(q);
    });
  };

  const processingOrders = decorOrders.filter(o => o.status === 'processing');
  
  // 3. Готові до видачі - ВСІ замовлення що готові до видачі (різні варіанти статусів)
  const readyOrders = decorOrders.filter(o => 
    o.status === 'processing' || 
    o.status === 'ready' || 
    o.status === 'ready_for_issue'
  );
  
  // Issue Cards (картки видачі) по статусам - ВСІ без фільтрації по даті:
  const preparationCards = issueCards.filter(c => c.status === 'preparation');
  const readyCards = issueCards.filter(c => 
    c.status === 'ready' || 
    c.status === 'ready_for_issue'
  );
  const issuedCards = issueCards.filter(c => c.status === 'issued');
  
  // 4. На поверненні - ВСІ issue cards що видані (статус 'issued')
  const returnOrders = issueCards.filter(c => c.status === 'issued');
  
  // 5. Часткові повернення - ТЕПЕР беремо з окремої таблиці версій
  // Старі картки з partial_return статусом ігноруємо - вони тепер в архіві
  // const partialReturnCards = issueCards.filter(c => c.status === 'partial_return');

  const kpis = {
    today: newOrders.length + preparationCards.length + readyCards.length + returnOrders.length + partialReturnVersions.length,
    revenue: financeData.revenue,
    deposits: financeData.deposits,
    problems: partialReturnVersions.length
  };

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      <CorporateHeader cabinetName="Реквізиторська" />
      
      {/* Quick Actions Bar */}
      <div className="bg-white border-b border-corp-border">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              className="corp-btn corp-btn-primary"
              onClick={() => navigate('/order/new')}
            >
              + Нове замовлення
            </button>
            
            {/* ✅ Кнопка режиму об'єднання */}
            <button 
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
                mergeMode 
                  ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100' 
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => {
                setMergeMode(!mergeMode);
                setSelectedForMerge([]);
              }}
            >
              🔗 {mergeMode ? 'Скасувати' : 'Об\'єднати'}
            </button>
            
            {/* ✅ Кнопка чату */}
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-1.5"
              onClick={() => setShowChatModal(true)}
            >
              💬 Чат
            </button>
            
            {/* Панель об'єднання */}
            {mergeMode && selectedForMerge.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-sm text-amber-700">
                  Вибрано: <b>{selectedForMerge.length}</b>
                </span>
                <button
                  onClick={handleMergeOrders}
                  disabled={selectedForMerge.length < 2}
                  className="px-3 py-1 rounded bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Об'єднати →
                </button>
              </div>
            )}
            
            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />
            
            {/* Кнопка оновлення */}
            <button 
              onClick={handleReload}
              disabled={loading}
              className="px-3 py-2 rounded-lg border border-corp-border text-corp-text-muted hover:bg-corp-bg-light hover:text-corp-text-dark transition-colors flex items-center gap-2"
              title="Оновити всі дані"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span className="hidden sm:inline">Оновити</span>
            </button>
            
            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />
            <button 
              className="rounded-lg border border-corp-primary bg-corp-primary/5 px-3 py-2 text-sm font-medium text-corp-primary hover:bg-corp-primary hover:text-white transition-colors"
              onClick={() => navigate('/manager-cabinet')}
            >
              👔 Менеджерська
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/calendar')}
            >
              Календар
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/finance')}
            >
              Фінанси
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/catalog')}
            >
              Каталог
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/damages')}
            >
              Шкоди
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/tasks')}
            >
              Завдання
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/reaudit')}
            >
              Переоблік
            </button>
            <button 
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => navigate('/orders-archive')}
            >
              Архів
            </button>
            {user?.role === 'admin' && (
              <button 
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                onClick={() => navigate('/admin')}
              >
                Адмін
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters - тільки пошук */}
      <section className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-medium text-slate-500 mb-1">Пошук</label>
            <input 
              placeholder="Номер ордеру / Ім'я / Телефон" 
              className="corp-input w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* KPIs - тільки Замовлення */}
      <section className="mx-auto max-w-7xl px-6">
        <div className="max-w-md">
          <Kpi title="Замовлення" value={kpis.today.toString()} note={`${newOrders.length} нові / ${preparationCards.length} комплектації / ${readyCards.length} видач / ${returnOrders.length} повернення`}/>
        </div>
      </section>

      {/* Boards - 4 колонки: Комплектація, Готово, Повернення, Часткове */}
      <main className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* КОЛОНКА 1: На комплектації / Видача сьогодні */}
        <Column title="📦 На комплектації" subtitle="Збір товарів + видача сьогодні" tone="ok">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : preparationCards.length > 0 ? (
            <>
              {(showAllPreparation ? preparationCards : preparationCards.slice(0, 4)).map(card => (
                <OrderCard 
                  key={card.id}
                  id={`#${card.order_id}`}
                  name={card.customer_name || '—'}
                  phone={card.customer_phone || '—'}
                  rent={`₴ ${(card.total_after_discount || card.total_rental || 0).toFixed(0)}`}
                  deposit={`₴ ${(card.deposit_amount || 0).toFixed(0)}`}
                  badge="preparation"
                  order={card}
                  onDateUpdate={null}
                  onCancelByClient={handleCancelByClient}
                  onClick={() => navigate(`/issue/${card.id}`)}
                />
              ))}
              {preparationCards.length > 4 && !showAllPreparation && (
                <button 
                  onClick={() => setShowAllPreparation(true)}
                  className="text-center py-3 text-sm text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 rounded-lg transition-colors cursor-pointer w-full"
                >
                  +{preparationCards.length - 4} більше карток - Показати всі
                </button>
              )}
              {preparationCards.length > 4 && showAllPreparation && (
                <button 
                  onClick={() => setShowAllPreparation(false)}
                  className="text-center py-3 text-sm text-corp-text-main hover:text-corp-text-dark font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer w-full"
                >
                  Згорнути ↑
                </button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Немає карток на комплектації
            </div>
          )}
        </Column>

        {/* КОЛОНКА 2: Готові до видачі */}
        <Column title="✅ Готові до видачі" subtitle="Скомплектовано → готово до передачі клієнту" tone="ok">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : readyCards.length > 0 ? (
            <>
              {(showAllReady ? readyCards : readyCards.slice(0, 4)).map(card => (
                <OrderCard 
                  key={card.id}
                  id={`#${card.order_id}`}
                  name={card.customer_name || '—'}
                  phone={card.customer_phone || '—'}
                  rent={`₴ ${(card.total_after_discount || card.total_rental || 0).toFixed(0)}`}
                  deposit={`₴ ${(card.deposit_amount || 0).toFixed(0)}`}
                  badge="ready"
                  order={card}
                  onDateUpdate={null}
                  onCancelByClient={handleCancelByClient}
                  onClick={() => navigate(`/issue/${card.id}`)}
                />
              ))}
              {readyCards.length > 4 && !showAllReady && (
                <button 
                  onClick={() => setShowAllReady(true)}
                  className="text-center py-3 text-sm text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 rounded-lg transition-colors cursor-pointer w-full"
                >
                  +{readyCards.length - 4} більше карток - Показати всі
                </button>
              )}
              {readyCards.length > 4 && showAllReady && (
                <button 
                  onClick={() => setShowAllReady(false)}
                  className="text-center py-3 text-sm text-corp-text-main hover:text-corp-text-dark font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer w-full"
                >
                  Згорнути ↑
                </button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Немає готових карток
            </div>
          )}
        </Column>

        {/* КОЛОНКА 3: Повернення */}
        <Column title="🔙 Повернення" subtitle="Видані замовлення, які очікують повернення" tone="warn">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : returnOrders.length > 0 ? (
            <>
              {(showAllReturns ? returnOrders : returnOrders.slice(0, 4)).map(card => (
                <OrderCard 
                  key={card.id}
                  id={card.order_number}
                  name={card.customer_name}
                  phone={card.customer_phone}
                  rent={`₴ ${(card.total_after_discount || card.total_rental || 0).toFixed(0)}`}
                  deposit={`₴ ${(card.deposit_amount || 0).toFixed(0)}`}
                  badge="return"
                  order={card}
                  onClick={() => navigate(`/return/${card.order_id}`)}
                />
              ))}
              {returnOrders.length > 4 && !showAllReturns && (
                <button 
                  onClick={() => setShowAllReturns(true)}
                  className="text-center py-3 text-sm text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  +{returnOrders.length - 4} більше замовлень - Показати всі
                </button>
              )}
              {returnOrders.length > 4 && showAllReturns && (
                <button 
                  onClick={() => setShowAllReturns(false)}
                  className="text-center py-3 text-sm text-corp-text-main hover:text-corp-text-dark font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Згорнути ↑
                </button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Немає повернень сьогодні
            </div>
          )}
        </Column>
        
        {/* КОЛОНКА 4: Часткове повернення - ВЕРСІЇ */}
        <Column title="⚠️ Часткове повернення" subtitle="Товари що залишились у клієнтів" tone="warn">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : partialReturnVersions.length > 0 ? (
            <>
              {(showAllPartial ? partialReturnVersions : partialReturnVersions.slice(0, 4)).map(version => (
                <div 
                  key={version.version_id}
                  onClick={() => navigate(`/partial-return/${version.version_id}`)}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-slate-800">{version.display_number}</div>
                      <div className="text-sm text-slate-600">{version.customer_name}</div>
                    </div>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {version.items_count} поз.
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{version.customer_phone}</span>
                    {version.days_overdue > 0 && (
                      <span className="text-red-600 font-medium">+{version.days_overdue} дн.</span>
                    )}
                  </div>
                </div>
              ))}
              {partialReturnVersions.length > 4 && !showAllPartial && (
                <button 
                  onClick={() => setShowAllPartial(true)}
                  className="text-center py-3 text-sm text-amber-600 hover:text-amber-800 font-medium hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                >
                  +{partialReturnVersions.length - 4} більше - Показати всі
                </button>
              )}
              {partialReturnVersions.length > 4 && showAllPartial && (
                <button 
                  onClick={() => setShowAllPartial(false)}
                  className="text-center py-3 text-sm text-corp-text-main hover:text-corp-text-dark font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Згорнути ↑
                </button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Всі товари повернено ✓
            </div>
          )}
        </Column>
      </main>
      {/* Footer moved to global LegalFooter in App.tsx */}
      
      {/* ✅ Модалка чату */}
      <OrdersChatModal 
        isOpen={showChatModal} 
        onClose={() => setShowChatModal(false)} 
      />
    </div>
  );
}

function Filter({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs text-corp-text-muted uppercase tracking-wide font-medium">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ title, value, note, tone }) {
  const toneMap = {
    ok: 'text-corp-success',
    warn: 'text-corp-warning',
    info: 'text-corp-primary'
  };
  return (
    <div className="corp-stat-card">
      <div className="corp-stat-label">{title}</div>
      <div className={`corp-stat-value ${tone?toneMap[tone]:''}`}>{value}</div>
      {note && <div className="text-xs text-corp-text-muted mt-2">{note}</div>}
    </div>
  );
}

function Column({ title, subtitle, children, tone }) {
  const ring = { ok: 'ring-emerald-100', warn: 'ring-amber-100', info: 'ring-slate-100' }
  return (
    <section className={`rounded-2xl border border-slate-200 p-4 shadow-sm ring-2 ${tone ? ring[tone] : "ring-transparent"}`}>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold leading-none">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-corp-text-muted">{subtitle}</p>}
        </div>
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function OrderCard({ id, name, phone, rent, deposit, badge, onClick, order, onDateUpdate, onCancelByClient }) {
  const map = {
    new: { label: 'Нове', css: 'corp-badge corp-badge-info' },
    awaiting: { label: 'Очікує', css: 'corp-badge corp-badge-warning' },
    processing: { label: 'В роботі', css: 'corp-badge corp-badge-primary' },
    preparation: { label: 'На комплектації', css: 'corp-badge corp-badge-gold' },
    issue: { label: 'Видача', css: 'corp-badge corp-badge-success' },
    return: { label: 'Повернення', css: 'corp-badge corp-badge-warning' },
    ready:{label:'Готово',css:'corp-badge corp-badge-success'},
    issued:{label:'Видано',css:'corp-badge corp-badge-success'},
    partial:{label:'⚠️ Часткове',css:'bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium'}
  }
  
  // Fallback якщо badge невідомий
  const badgeInfo = map[badge] || {label: badge, css: 'corp-badge corp-badge-neutral'}
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [issueDate, setIssueDate] = React.useState(order?.issue_date || '');
  const [returnDate, setReturnDate] = React.useState(order?.return_date || '');
  const [isSaving, setIsSaving] = React.useState(false);
  
  const handleSaveDates = async (e) => {
    e.stopPropagation();
    if (!onDateUpdate) return;
    
    setIsSaving(true);
    try {
      await onDateUpdate(id, issueDate, returnDate);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating dates:', error);
      alert('Помилка оновлення дат');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancel = (e) => {
    e.stopPropagation();
    setIsEditing(false);
    setIssueDate(order?.issue_date || '');
    setReturnDate(order?.return_date || '');
  };

  const handlePhoneClick = (e) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };
  
  return (
    <article className="corp-card-flat cursor-pointer hover:shadow-corp transition-shadow active:bg-slate-50" onClick={isEditing ? undefined : onClick}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={badgeInfo.css}>{badgeInfo.label}</span>
          <span className="text-corp-text-muted text-sm font-medium">#{id}</span>
        </div>
        {badge === 'new' && onDateUpdate && !isEditing && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="text-xs text-corp-primary hover:text-corp-primary-hover font-medium px-2 py-1 rounded-lg bg-blue-50 active:bg-blue-100"
            title="Редагувати дати"
          >
            📅 Дати
          </button>
        )}
      </div>
      
      {/* Customer info - mobile optimized */}
      <div className="mb-3">
        <div className="font-semibold text-corp-text-dark text-base">{name}</div>
        <a 
          href={`tel:${phone}`}
          onClick={handlePhoneClick}
          className="text-blue-600 font-medium text-sm flex items-center gap-1 mt-1"
        >
          📞 {phone}
        </a>
      </div>
      
      {/* Dates section */}
      {badge === 'new' && isEditing ? (
        <div className="mb-3 space-y-3 bg-corp-bg-light p-3 rounded-xl" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs text-corp-text-muted uppercase tracking-wide block mb-1">Дата видачі</label>
            <input 
              type="date" 
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="text-xs text-corp-text-muted uppercase tracking-wide block mb-1">Дата повернення</label>
            <input 
              type="date" 
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              disabled={isSaving}
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleSaveDates}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 active:bg-emerald-600"
            >
              {isSaving ? '⏳ ...' : '✓ Зберегти'}
            </button>
            <button 
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white font-medium text-sm disabled:opacity-50 active:bg-slate-50"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        // Відображення дат оренди - перевіряємо різні поля
        (order?.rental_start_date || order?.rental_end_date || order?.issue_date || order?.return_date) ? (
          <div className="mb-3 text-sm text-corp-text-main bg-slate-50 p-2.5 rounded-lg space-y-1">
            {(order.rental_start_date || order.issue_date) && (
              <div>📅 Видача: <span className="font-medium">{order.rental_start_date || order.issue_date}</span></div>
            )}
            {(order.rental_end_date || order.return_date) && (
              <div>📆 Поверн.: <span className="font-medium">{order.rental_end_date || order.return_date}</span></div>
            )}
          </div>
        ) : null
      )}
      
      {/* Finance row */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
          <div className="text-corp-text-muted text-xs">Сума</div>
          <div className="font-bold text-base tabular-nums">{rent}</div>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center">
          <div className="text-corp-text-muted text-xs">Застава</div>
          <div className="font-bold text-base tabular-nums text-amber-700">{deposit}</div>
        </div>
      </div>
      
      {/* Cancel button - bigger for mobile */}
      {onCancelByClient && ['awaiting', 'processing', 'preparation', 'ready'].includes(badge) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancelByClient(order?.order_id, id);
          }}
          className="mt-3 w-full text-sm text-rose-600 border-2 border-rose-200 rounded-xl px-3 py-2.5 font-medium hover:bg-rose-50 active:bg-rose-100 transition-colors"
        >
          🚫 Клієнт відмовився
        </button>
      )}
    </article>
  );
}

function OrderCardWithArchive({ id, name, phone, rent, deposit, badge, onClick, order, onArchive }) {
  return (
    <article onClick={onClick} className="relative cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition hover:border-teal-400 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-corp-text-dark">{id}</div>
      </div>
      
      <div className="mb-2 text-xs text-corp-text-muted">{name}</div>
      <div className="mb-3 text-xs text-corp-text-muted">{phone}</div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-corp-text-muted">Сума</div>
          <div className="font-semibold tabular-nums">{rent}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-corp-text-muted">Застава</div>
          <div className="font-semibold tabular-nums">{deposit}</div>
        </div>
      </div>
      
      {onArchive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive(order?.order_id, id);
          }}
          className="mt-2 w-full text-xs text-corp-text-main border border-slate-300 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
        >
          📂 В архів
        </button>
      )}
    </article>
  );
}

function NavCard({ title, description, onClick }) {
  return (
    <article 
      className="corp-card cursor-pointer hover:border-corp-primary group"
      onClick={onClick}
    >
      <h3 className="text-lg font-semibold text-corp-text-dark mb-2 group-hover:text-corp-primary transition-colors">{title}</h3>
      <p className="text-sm text-corp-text-muted group-hover:text-corp-text-main transition-colors">{description}</p>
    </article>
  );
}
