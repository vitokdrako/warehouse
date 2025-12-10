/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [decorOrders, setDecorOrders] = useState([]);  // Наші замовлення
  const [issueCards, setIssueCards] = useState([]);  // Картки видачі
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState({ revenue: 0, deposits: 0 });
  const [cleaningStats, setCleaningStats] = useState({ repair: 0 });
  
  // Стани для розгортання карток
  const [showAllAwaiting, setShowAllAwaiting] = useState(false);
  const [showAllReturns, setShowAllReturns] = useState(true);  // За замовчуванням показуємо всі
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Всі');
  const [user, setUser] = useState(null);
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
      const response = await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/cancel-by-client`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/archive`, {
        method: 'POST',
        mode: 'cors'
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

  // Функція для оновлення дат замовлення
  const handleDateUpdate = async (orderId, issueDate, returnDate) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
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

  // Функція для завантаження всіх даних
  const fetchAllData = () => {
    console.log('[Dashboard] 📊 Loading orders for today...');
    
    // Завантажити ВСІ замовлення що очікують підтвердження (вони одразу синхронізуються з OpenCart)
    fetch(`${BACKEND_URL}/api/orders?status=awaiting_customer`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
      console.log('[Dashboard] Orders awaiting confirmation:', data.orders?.length || 0);
      setOrders(data.orders || []);
    })
    .catch(err => console.error('[Dashboard] Error loading orders:', err));
    
    // Завантажити ВСІ замовлення на комплектації та поверненні
    fetch(`${BACKEND_URL}/api/decor-orders?status=processing,ready_for_issue,issued,on_rent,shipped,delivered,returning`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
      setDecorOrders(data.orders || []);
      setLoading(false);
    })
    .catch(err => {
      console.error('[Dashboard] Error loading decor orders:', err);
      setLoading(false);
    });
    
    // Завантажити Issue Cards (картки видачі)
    fetch(`${BACKEND_URL}/api/issue-cards`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
      console.log('[Dashboard] Issue cards:', data.length);
      setIssueCards(data);
    })
    .catch(err => console.error('[Dashboard] Error loading issue cards:', err));
    
    // Завантажити фінанси (виручка і застави)
    fetch(`${BACKEND_URL}/api/manager/finance/summary`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
      console.log('[Dashboard] Finance summary:', data);
      setFinanceData({
        revenue: data.total_revenue || 0,  // ОПЛАЧЕНІ (payment completed)
        deposits: data.deposits_count || 0  // КІЛЬКІСТЬ замовлень з заставами
      });
    })
    .catch(err => console.error('[Dashboard] Error loading finance:', err));
  };

  useEffect(() => {
    fetchAllData();
    
    // Завантажити статистику товарів на реставрації
    fetch(`${BACKEND_URL}/api/product-cleaning/stats/summary`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
      console.log('[Dashboard] Cleaning stats:', data);
      setCleaningStats({
        repair: data.repair || 0
      });
    })
    .catch(err => console.error('[Dashboard] Error loading cleaning stats:', err));
  }, []);
  
  // Manual reload function
  const handleReload = () => {
    setLoading(true);
    setOrders([]);
    
    const today = new Date().toISOString().split('T')[0];
    const queryParams = `?limit=100&from_date=${today}&to_date=${today}`;
    
    fetch(`${BACKEND_URL}/api/orders${queryParams}`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => {
      console.log('[Dashboard] Manual reload:', data.orders?.length || 0, 'orders');
      setOrders(data.orders || []);
      setLoading(false);
    })
    .catch(err => {
      console.error('[Dashboard] Manual reload error:', err);
      setLoading(false);
    });
  };

  // Логіка розподілу замовлень БЕЗ ФІЛЬТРАЦІЇ ПО ДАТІ:
  // Показуємо ВСІ замовлення в певних статусах
  
  // 1. Очікують підтвердження (awaiting_customer)
  const awaitingOrders = orders; // Вже фільтруються по status=awaiting_customer в API
  const newOrders = orders; // Для сумісності з KPI
  
  // 2. В обробці (processing) - на комплектації
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
  // Видані замовлення зберігаються в issueCards, а не в decorOrders!
  const returnOrders = issueCards.filter(c => c.status === 'issued');

  const kpis = {
    today: newOrders.length + preparationCards.length + readyCards.length + returnOrders.length,  // Всі активні замовлення
    revenue: financeData.revenue,  // З Finance API
    deposits: financeData.deposits,  // З Finance API
    problems: 0
  };

  return (
    <div className="min-h-screen bg-corp-bg-page font-montserrat">
      {/* Corporate Header */}
      <header className="corp-header sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-corp-primary grid place-content-center text-white font-bold text-sm">RH</div>
            <div>
              <h1 className="text-lg font-semibold text-corp-text-dark">Rental Hub</h1>
              <p className="text-xs text-corp-text-muted">Кабінет менеджера</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-corp-bg-light rounded-corp border border-corp-border">
              <div className="h-8 w-8 rounded-full bg-corp-gold grid place-content-center text-white text-xs font-semibold">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-sm">
                <div className="font-medium text-corp-text-dark">{user?.email || 'Користувач'}</div>
                <div className="text-xs text-corp-text-muted">{user?.role === 'admin' ? 'Адміністратор' : user?.role === 'manager' ? 'Менеджер' : 'Реквізитор'}</div>
              </div>
            </div>
            <button 
              className="corp-btn corp-btn-secondary"
              onClick={() => navigate('/settings')}
              title="Налаштування"
            >
              ⚙️
            </button>
            <button 
              className="corp-btn corp-btn-gold"
              onClick={handleReload}
            >
              🔄
            </button>
            <button 
              className="corp-btn corp-btn-primary"
              onClick={() => navigate('/order/new')}
            >
              + Новий замовлення
            </button>
            <button 
              className="corp-btn corp-btn-secondary text-corp-error hover:bg-corp-error hover:text-white"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
              }}
            >
              Вихід
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Filter label="Менеджер">
            <select className="corp-select">
              <option>Всі</option>
            </select>
          </Filter>
          <Filter label="Статус замовлення">
            <select 
              className="corp-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Всі</option>
              <option>Нове</option>
              <option>Видача</option>
              <option>В оренді</option>
            </select>
          </Filter>
          <Filter label="Фінанси">
            <select className="corp-select">
              <option>Всі</option>
              <option>Очікує оплати</option>
              <option>Закрито</option>
            </select>
          </Filter>
          <Filter label="Пошук">
            <input 
              placeholder="Імʼя / телефон / №" 
              className="corp-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Filter>
          <div className="flex items-end">
            <button
              onClick={() => navigate('/orders-archive')}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors"
            >
              📂 Архів замовлень
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi title="Замовлення" value={kpis.today.toString()} note={`${newOrders.length} нові / ${preparationCards.length} комплектації / ${readyCards.length} видач / ${returnOrders.length} повернення`}/>
          <Kpi title="Виручка" value={`₴ ${kpis.revenue.toFixed(0)}`} note="з фін. кабінету"/>
          <Kpi title="Застави в холді" value={`₴ ${kpis.deposits.toFixed(0)}`} note="з фін. кабінету"/>
          <Kpi 
            title="🔧 На реставрації" 
            value={cleaningStats.repair.toString()} 
            note="товари у відновленні" 
            tone={cleaningStats.repair > 0 ? "info" : undefined}
          />
          <Kpi title="Проблеми" value={kpis.problems.toString()} note="є шкода/прострочка" tone={kpis.problems > 0 ? "warn" : undefined}/>
        </div>
      </section>

      {/* Boards */}
      <main className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* КОЛОНКА 1: Очікують підтвердження (замовлення одразу з нашої бази) */}
        <Column title="⏳ Очікують підтвердження" subtitle="Нові замовлення → Редагувати → Email" tone="warning">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : awaitingOrders.length > 0 ? (
            <>
              {(showAllAwaiting ? awaitingOrders : awaitingOrders.slice(0, 4)).map(order => (
                <OrderCard 
                  key={order.id}
                  id={order.order_number}
                  name={order.client_name}
                  phone={order.client_phone}
                  rent={`₴ ${order.total_rental?.toFixed(0)}`}
                  deposit={`₴ ${(order.total_deposit || 0).toFixed(0)}`}
                  badge="awaiting"
                  order={order}
                  onDateUpdate={null}
                  onCancelByClient={handleCancelByClient}
                  onClick={() => navigate(`/order/${order.id}/view`)}
                />
              ))}
              {awaitingOrders.length > 4 && !showAllAwaiting && (
                <button 
                  onClick={() => setShowAllAwaiting(true)}
                  className="text-center py-3 text-sm text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  +{awaitingOrders.length - 4} більше замовлень - Показати всі
                </button>
              )}
              {awaitingOrders.length > 4 && showAllAwaiting && (
                <button 
                  onClick={() => setShowAllAwaiting(false)}
                  className="text-center py-3 text-sm text-slate-600 hover:text-slate-800 font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Згорнути ↑
                </button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Немає замовлень що очікують
            </div>
          )}
        </Column>

        {/* КОЛОНКА 2: На комплектації / Видача сьогодні */}
        <Column title="📦 На комплектації" subtitle="Збір товарів + видача сьогодні" tone="ok">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : preparationCards.length > 0 ? (
            <>
              {preparationCards.slice(0, 4).map(card => (
                <OrderCard 
                  key={card.id}
                  id={`#${card.order_id}`}
                  name={card.customer_name || '—'}
                  phone={card.customer_phone || '—'}
                  rent={`₴ ${card.total_rental?.toFixed(0) || 0}`}
                  deposit={`₴ ${card.deposit_amount?.toFixed(0) || 0}`}
                  badge="preparation"
                  order={card}
                  onDateUpdate={null}
                  onCancelByClient={handleCancelByClient}
                  onClick={() => navigate(`/issue/${card.id}`)}
                />
              ))}
              {preparationCards.length > 4 && (
                <div className="text-center py-2 text-sm text-slate-500">
                  +{preparationCards.length - 4} більше карток
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Немає карток на комплектації
            </div>
          )}
        </Column>

        {/* КОЛОНКА 3: Готові до видачі */}
        <Column title="✅ Готові до видачі" subtitle="Скомплектовано → готово до передачі клієнту" tone="ok">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 p-4 h-32 bg-slate-50 animate-pulse" />
          ) : readyCards.length > 0 ? (
            <>
              {readyCards.slice(0, 4).map(card => (
                <OrderCard 
                  key={card.id}
                  id={`#${card.order_id}`}
                  name={card.customer_name || '—'}
                  phone={card.customer_phone || '—'}
                  rent={`₴ ${card.total_rental?.toFixed(0) || 0}`}
                  deposit={`₴ ${card.deposit_amount?.toFixed(0) || 0}`}
                  badge="ready"
                  order={card}
                  onDateUpdate={null}
                  onCancelByClient={handleCancelByClient}
                  onClick={() => navigate(`/issue/${card.id}`)}
                />
              ))}
              {readyCards.length > 4 && (
                <div className="text-center py-2 text-sm text-slate-500">
                  +{readyCards.length - 4} більше карток
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              Немає готових карток
            </div>
          )}
        </Column>

        {/* КОЛОНКА 4: Повернення */}
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
                  rent={`₴ ${card.total_rental?.toFixed(0)}`}
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
                  className="text-center py-3 text-sm text-slate-600 hover:text-slate-800 font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
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
      </main>

      {/* Bottom nav */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NavCard 
            title="💰 Фінанси" 
            description="Платежі, рахунки, застави"
            onClick={() => navigate('/finance')}
          />
          <NavCard 
            title="📅 Календар" 
            description="Події, картки видачі/повернення"
            onClick={() => navigate('/calendar')}
          />
          <NavCard 
            title="📦 Каталог" 
            description="Товари, керування наборами"
            onClick={() => navigate('/catalog')}
          />
          <NavCard 
            title="⚠️ Шкоди PRO" 
            description="Кейси пошкоджень, реставрація"
            onClick={() => navigate('/damages')}
          />
          <NavCard 
            title="🧾 Завдання PRO" 
            description="Kanban дошка, мийка, збір"
            onClick={() => navigate('/tasks')}
          />
          <NavCard 
            title="🔍 Переоблік PRO" 
            description="Каталог декору, історія оренд"
            onClick={() => navigate('/reaudit')}
          />
          <NavCard 
            title="📦 Комплектація" 
            description="Збір товарів для видачі"
            onClick={() => navigate('/packing')}
          />
          <NavCard 
            title="🧺 Хімчистка" 
            description="Управління текстилем у хімчистці"
            onClick={() => navigate('/laundry')}
          />
          {user?.role === 'admin' && (
            <NavCard 
              title="⚙️ Адмін-панель" 
              description="Користувачі, категорії, налаштування"
              onClick={() => navigate('/admin')}
            />
          )}
        </div>
      </section>

      <footer className="border-t border-corp-border-light py-8 text-center text-corp-text-muted text-sm">
        <p className="font-montserrat">© 2024 Rental Hub • Система управління орендою</p>
        <p className="text-xs mt-2 text-corp-text-muted">Powered by <span className="text-corp-primary font-semibold">FarforRent</span></p>
      </footer>
    </div>
  );
}

function Filter({label, children}:{label:string, children:any}){
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs text-corp-text-muted uppercase tracking-wide font-medium">{label}</span>
      {children}
    </label>
  );
}

function Kpi({title, value, note, tone}:{title:string,value:string,note?:string,tone?:'ok'|'warn'|'info'}){
  const toneMap:any={
    ok:'text-corp-success',
    warn:'text-corp-warning',
    info:'text-corp-primary'
  };
  return (
    <div className="corp-stat-card">
      <div className="corp-stat-label">{title}</div>
      <div className={`corp-stat-value ${tone?toneMap[tone]:''}`}>{value}</div>
      {note && <div className="text-xs text-corp-text-muted mt-2">{note}</div>}
    </div>
  );
}

function Column({title, subtitle, children, tone}:{title:string,subtitle?:string,children:any,tone?:'ok'|'warn'|'info'}){
  const ring:any={ok:'ring-emerald-100',warn:'ring-amber-100',info:'ring-slate-100'}
  return (
    <section className={`rounded-2xl border border-slate-200 p-4 shadow-sm ring-2 ${tone?ring[tone]:"ring-transparent"}`}>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold leading-none">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function OrderCard({id,name,phone,rent,deposit,badge,onClick,order,onDateUpdate,onCancelByClient}:{id:string,name:string,phone:string,rent:string,deposit:string,badge:'new'|'issue'|'return'|'ready'|'issued'|'awaiting'|'processing'|'preparation',onClick:()=>void,order?:any,onDateUpdate?:(orderId:string,issueDate:string,returnDate:string)=>void,onCancelByClient?:(orderId:number,orderNumber:string)=>void}){
  const map:any={
    new:{label:'Нове',css:'corp-badge corp-badge-info'},
    awaiting:{label:'Очікує',css:'corp-badge corp-badge-warning'},
    processing:{label:'В роботі',css:'corp-badge corp-badge-primary'},
    preparation:{label:'На комплектації',css:'corp-badge corp-badge-gold'},
    issue:{label:'Видача',css:'corp-badge corp-badge-success'},
    return:{label:'Повернення',css:'corp-badge corp-badge-warning'},
    ready:{label:'Готово',css:'corp-badge corp-badge-success'},
    issued:{label:'Видано',css:'corp-badge corp-badge-success'}
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
  
  return (
    <article className="corp-card-flat cursor-pointer hover:shadow-corp transition-shadow" onClick={isEditing ? undefined : onClick}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={badgeInfo.css}>{badgeInfo.label}</span>
          <span className="text-corp-text-muted text-sm">#{id}</span>
        </div>
        {badge === 'new' && onDateUpdate && !isEditing && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="text-xs text-corp-primary hover:text-corp-primary-hover font-medium"
            title="Редагувати дати"
          >
            📅 Змінити дати
          </button>
        )}
      </div>
      <div className="text-sm mb-3">
        <div className="font-medium text-corp-text-dark">{name}</div>
        <div className="text-corp-text-muted">{phone}</div>
      </div>
      
      {/* Дати (з можливістю редагування для нових замовлень) */}
      {badge === 'new' && isEditing ? (
        <div className="mb-3 space-y-2 bg-corp-bg-light p-3 rounded-corp" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs text-corp-text-muted uppercase tracking-wide block mb-1">Дата видачі</label>
            <input 
              type="date" 
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="corp-input text-sm"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="text-xs text-corp-text-muted uppercase tracking-wide block mb-1">Дата повернення</label>
            <input 
              type="date" 
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="corp-input text-sm"
              disabled={isSaving}
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleSaveDates}
              disabled={isSaving}
              className="flex-1 corp-btn corp-btn-primary text-xs disabled:opacity-50"
            >
              {isSaving ? '⏳ Збереження...' : '✓ Зберегти'}
            </button>
            <button 
              onClick={handleCancel}
              disabled={isSaving}
              className="corp-btn corp-btn-secondary text-xs disabled:opacity-50"
            >
              ✕ Скасувати
            </button>
          </div>
        </div>
      ) : (
        order?.issue_date || order?.return_date ? (
          <div className="mb-3 text-xs text-corp-text-main bg-corp-bg-card p-2 rounded-corp-sm">
            {order.issue_date && <div>📅 Видача: {order.issue_date}</div>}
            {order.return_date && <div>📅 Повернення: {order.return_date}</div>}
          </div>
        ) : null
      )}
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">Сума</div>
          <div className="font-semibold tabular-nums">{rent}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">Застава</div>
          <div className="font-semibold tabular-nums">{deposit}</div>
        </div>
      </div>
      
      {/* Кнопка "Клієнт відмовився" для статусів до видачі */}
      {onCancelByClient && ['awaiting', 'processing', 'preparation', 'ready'].includes(badge) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancelByClient(order?.order_id, id);
          }}
          className="mt-2 w-full text-xs text-rose-600 border border-rose-300 rounded-lg px-2 py-1.5 hover:bg-rose-50 transition-colors"
        >
          🚫 Клієнт відмовився
        </button>
      )}
    </article>
  );
}

function OrderCardWithArchive({id,name,phone,rent,deposit,badge,onClick,order,onArchive}:{id:string,name:string,phone:string,rent:string,deposit:string,badge:string,onClick:()=>void,order?:any,onArchive?:(orderId:number,orderNumber:string)=>void}){
  return (
    <article onClick={onClick} className="relative cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition hover:border-teal-400 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{id}</div>
      </div>
      
      <div className="mb-2 text-xs text-slate-500">{name}</div>
      <div className="mb-3 text-xs text-slate-500">{phone}</div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">Сума</div>
          <div className="font-semibold tabular-nums">{rent}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">Застава</div>
          <div className="font-semibold tabular-nums">{deposit}</div>
        </div>
      </div>
      
      {onArchive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive(order?.order_id, id);
          }}
          className="mt-2 w-full text-xs text-slate-600 border border-slate-300 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
        >
          📂 В архів
        </button>
      )}
    </article>
  );
}

function NavCard({title, description, onClick}:{title:string, description:string, onClick:()=>void}){
  return (
    <article 
      className="rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </article>
  );
}
