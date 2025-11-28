/* eslint-disable */
// RentalHub — Вхідне замовлення від клієнта
// order_status_id = 2 (В обработке)

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/imageHelper';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function NewOrderView() {
  console.log('🔄 NewOrderView component loaded - VERSION 2024-11-28-v3-FINAL - NO checkConflicts function exists!');
  const { id } = useParams();
  const orderId = id;
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [decorOrderStatus, setDecorOrderStatus] = useState(null); // awaiting_customer, processing, etc.
  const [customerStats, setCustomerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issueDate, setIssueDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [rentalDays, setRentalDays] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [clientComment, setClientComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Для пошуку товарів
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState([]);
  
  // Для конфліктів
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  
  // Для доступності товарів
  const [availability, setAvailability] = useState({});

  // Завантажити замовлення
  useEffect(() => {
    if (!orderId) return;
    
    const loadOrder = async () => {
      try {
        // СПОЧАТКУ перевірити чи замовлення вже в decor_orders
        console.log('[NewOrderView] Перевірка чи замовлення в DecorOrder...');
        const decorResponse = await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}`);
        
        if (decorResponse.ok) {
          // Замовлення вже прийнято - читаємо з DecorOrder
          const decorOrder = await decorResponse.json();
          console.log('[NewOrderView] ✅ Завантажено з DecorOrder (прийняте замовлення)');
          console.log('[NewOrderView] 📅 Дати з DecorOrder API:', {
            issue_date: decorOrder.issue_date,
            return_date: decorOrder.return_date,
            rent_date: decorOrder.rent_date,
            rent_return_date: decorOrder.rent_return_date
          });
          
          // API тепер повертає issue_date/return_date (не rent_date/rent_return_date)
          const issueDate = decorOrder.issue_date || decorOrder.rent_date || '';
          const returnDate = decorOrder.return_date || decorOrder.rent_return_date || '';
          
          setOrder({
            ...decorOrder,
            order_number: decorOrder.order_number || orderId,
            issue_date: issueDate,
            return_date: returnDate,
            manager_comment: decorOrder.manager_notes || decorOrder.manager_comment
          });
          setItems(decorOrder.items || []);
          setIssueDate(issueDate);
          setReturnDate(returnDate);
          console.log('[NewOrderView] 📅 Встановлено стейт дат:', { issueDate, returnDate });
          setNotes(decorOrder.manager_notes || decorOrder.manager_comment || '');
          setDecorOrderStatus(decorOrder.status);
          
          // Завантажити збережені rental_days та discount
          setRentalDays(decorOrder.rental_days || 1);
          console.log('[NewOrderView] Завантажено rental_days:', decorOrder.rental_days || 1);
          
          if (decorOrder.discount !== undefined) {
            setDiscount(decorOrder.discount);
            console.log('[NewOrderView] Завантажено discount:', decorOrder.discount);
          }
          
          setLoading(false);
        } else {
          // Замовлення ще не прийнято (404) - читаємо з OpenCart
          console.log('[NewOrderView] ⚠️ Не знайдено в DecorOrder, завантаження з OpenCart...');
          
          const ocResponse = await fetch(`${BACKEND_URL}/api/orders/${orderId}`);
          if (!ocResponse.ok) {
            throw new Error('Замовлення не знайдено');
          }
          
          const data = await ocResponse.json();
          console.log('[NewOrderView] ✅ Завантажено з OpenCart (нове замовлення)');
          console.log('[NewOrderView] 📅 Дати з API:', {
            issue_date: data.issue_date,
            return_date: data.return_date
          });
          
          setOrder(data);
          setItems(data.items || []);
          setIssueDate(data.issue_date || '');
          setReturnDate(data.return_date || '');
          console.log('[NewOrderView] 📅 Встановлено стейт дат:', {
            issueDate: data.issue_date || '',
            returnDate: data.return_date || ''
          });
          setNotes(data.manager_comment || '');
          setRentalDays(1); // За замовчуванням 1 день
          
          // Завантажити статистику клієнта
          if (data.client_id) {
            try {
              const statsResponse = await fetch(`${BACKEND_URL}/api/orders/customer/${data.client_id}/stats`);
              if (statsResponse.ok) {
                const stats = await statsResponse.json();
                setCustomerStats(stats);
              }
            } catch (e) {
              console.error('Error loading stats:', e);
            }
          }
          
          setLoading(false);
        }
      } catch (err) {
        console.error('[NewOrderView] ❌ Error loading order:', err);
        setLoading(false);
      }
    };
    
    loadOrder();
  }, [orderId]);

  // Кількість днів НЕ залежить від дат - користувач вводить вручну

  // Перевірка конфліктів - НОВА ВЕРСІЯ (проста і надійна)
  useEffect(() => {
    // Якщо немає дат або товарів - очистити конфлікти
    if (!issueDate || !returnDate || items.length === 0) {
      setConflicts([]);
      setAvailability({});
      return;
    }
    
    // Функція перевірки (inline в useEffect, не винесена окремо)
    const checkAvailability = async () => {
      setCheckingConflicts(true);
      try {
        const requestBody = {
          start_date: issueDate,
          end_date: returnDate,
          items: items.map(i => ({
            product_id: parseInt(i.inventory_id || i.product_id),
            sku: i.article || i.sku,
            quantity: i.quantity
          }))
        };
        
        const response = await fetch(`${BACKEND_URL}/api/orders/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Мапінг для availability
          const availabilityMap = {};
          if (result.items) {
            result.items.forEach(item => {
              availabilityMap[item.product_id] = {
                total: item.total_quantity || 0,
                reserved: item.reserved_quantity || 0,
                available: item.available_quantity || 0
              };
            });
          }
          setAvailability(availabilityMap);
          
          // Визначити конфлікти
          const foundConflicts = result.items?.map(item => {
            let conflictType = null;
            let level = 'warning';
            
            if (item.total_quantity === 0) {
              conflictType = 'out_of_stock';
              level = 'error';
            } else if (item.available_quantity < item.requested_quantity) {
              conflictType = 'insufficient';
              level = 'error';
            } else if (item.has_tight_schedule) {
              conflictType = 'tight_schedule';
              level = 'warning';
            } else if (item.available_quantity < item.total_quantity * 0.2) {
              conflictType = 'low_stock';
              level = 'warning';
            }
            
            if (conflictType) {
              return {
                ...item,
                type: conflictType,
                level: level,
                available: item.available_quantity,
                in_rent: item.reserved_quantity || 0,
                requested: item.requested_quantity
              };
            }
            return null;
          }).filter(Boolean) || [];
          
          setConflicts(foundConflicts);
        }
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setCheckingConflicts(false);
      }
    };
    
    checkAvailability();
  }, [issueDate, returnDate, items]);

  // Пошук товарів
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/inventory/search?query=${encodeURIComponent(query)}&limit=9999`);
      if (response.ok) {
        const data = await response.json();
        // API returns {products: [...], total: N}
        const results = (data.products || []).map(p => ({
          product_id: p.product_id,
          sku: p.sku,
          name: p.name,
          price_per_day: p.price || 0,
          damage_cost: 0, // not provided by API
          deposit: 0, // not provided by API
          image_url: p.image,
          available_quantity: p.available_quantity || 0
        }));
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  // Додати товар
  const handleAddItem = async (product) => {
    let updatedItems;
    const existing = items.find(i => i.inventory_id === product.product_id.toString());
    
    if (existing) {
      // Збільшити кількість
      updatedItems = items.map(i => 
        i.inventory_id === product.product_id.toString() 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
      );
    } else {
      // Додати новий
      updatedItems = [...items, {
        inventory_id: product.product_id.toString(),
        article: product.sku,
        name: product.name,
        quantity: 1,
        price_per_day: product.price_per_day,
        damage_cost: product.damage_cost,
        deposit: product.deposit,
        total_rental: product.price_per_day * rentalDays,
        total_deposit: product.deposit
      }];
    }
    
    setItems(updatedItems);
    setSearchQuery('');
    setSearchResults([]);
    
    // Автоматично зберегти на backend
    await saveItems(updatedItems);
  };

  // Змінити кількість товару
  const handleUpdateQuantity = async (inventoryId, newQty) => {
    if (newQty < 1) return;
    const updatedItems = items.map(i => {
      if (i.inventory_id === inventoryId) {
        // Вирахувати deposit на одиницю (або використати damage_cost якщо є)
        const depositPerUnit = i.damage_cost || (i.deposit / i.quantity);
        return {
          ...i,
          quantity: newQty,
          deposit: depositPerUnit * newQty,
          total_deposit: depositPerUnit * newQty
        };
      }
      return i;
    });
    setItems(updatedItems);
    
    // Автоматично зберегти на backend
    await saveItems(updatedItems);
  };

  // Видалити товар
  const handleRemoveItem = async (inventoryId) => {
    const updatedItems = items.filter(i => i.inventory_id !== inventoryId);
    setItems(updatedItems);
    
    // Автоматично зберегти на backend
    await saveItems(updatedItems);
  };

  // Зберегти товари на backend
  const saveItems = async (itemsToSave) => {
    try {
      console.log('[SAVE ITEMS] Збереження товарів...', itemsToSave.length);
      
      const response = await fetch(`${BACKEND_URL}/api/decor-orders/${orderId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSave
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[SAVE ITEMS] ✅ Товари збережено', result);
        return true;
      } else {
        console.error('[SAVE ITEMS] ❌ Помилка збереження');
        return false;
      }
    } catch (error) {
      console.error('[SAVE ITEMS] ❌ Помилка:', error);
      return false;
    }
  };

  // Зберегти дати
  const handleSaveDates = async () => {
    setSaving(true);
    try {
      // Визначити який endpoint використовувати
      const endpoint = decorOrderStatus 
        ? `${BACKEND_URL}/api/decor-orders/${orderId}` 
        : `${BACKEND_URL}/api/orders/${orderId}`;
      
      console.log(`[SAVE] Збереження через: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rental_start_date: issueDate,
          rental_end_date: returnDate,
          notes: notes,
          rental_days: rentalDays,
          discount: discount,
          total_amount: calculations.totalWithDiscount,
          deposit_amount: calculations.depositToHold,
          total_loss_value: calculations.totalLossValue
        })
      });
      
      if (response.ok) {
        const updated = await response.json();
        console.log('[SAVE] ✅ Відповідь від сервера:', updated);
        
        // Оновити state з правильними полями
        // API тепер повертає issue_date/return_date для обох типів замовлень
        const savedIssueDate = updated.issue_date || updated.rent_date || issueDate;
        const savedReturnDate = updated.return_date || updated.rent_return_date || returnDate;
        const savedNotes = updated.notes || updated.manager_notes || updated.manager_comment || notes;
        
        setOrder({
          ...updated,
          issue_date: savedIssueDate,
          return_date: savedReturnDate,
          manager_comment: savedNotes
        });
        
        setIssueDate(savedIssueDate);
        setReturnDate(savedReturnDate);
        setNotes(savedNotes);
        setRentalDays(updated.rental_days || rentalDays);
        setDiscount(updated.discount || discount);
        
        console.log('[SAVE] Оновлено дані:', {
          issue_date: savedIssueDate,
          return_date: savedReturnDate,
          rental_days: updated.rental_days || rentalDays,
          discount: updated.discount || discount
        });
        
        // Оновити items якщо прийшли з сервера
        if (updated.items && updated.items.length > 0) {
          console.log('[SAVE] Оновлення items з сервера:', updated.items.length);
          setItems(updated.items);
        }
        
        // rentalDays вже оновлено вище - не перераховуємо
        
        alert('✅ Дані збережено');
        
        // Перезавантажити order щоб синхронізувати всі дані
        window.location.reload();
      } else {
        const error = await response.text();
        console.error('[SAVE] ❌ Помилка:', error);
        alert('❌ Помилка збереження');
      }
    } catch (error) {
      console.error('[SAVE] ❌ Exception:', error);
      alert('❌ Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  // Старий handleSendEmail видалено - тепер використовується тільки новий в ActionsRow

  // Розрахунки з урахуванням знижки і днів
  const calculations = useMemo(() => {
    if (!items || items.length === 0) return { 
      totalRent: 0, 
      totalLossValue: 0, 
      depositToHold: 0, 
      totalWithDiscount: 0, 
      discountAmount: 0 
    };
    
    const totalRent = items.reduce((sum, item) => {
      return sum + (item.price_per_day * item.quantity * rentalDays);
    }, 0);
    
    // Повна вартість втрати декору (сума всіх EAN)
    const totalLossValue = items.reduce((sum, item) => {
      return sum + (item.deposit * item.quantity);
    }, 0);
    
    // Застава до холду = половина від повної вартості втрати
    const depositToHold = totalLossValue / 2;
    
    const discountAmount = (totalRent * discount) / 100;
    const totalWithDiscount = totalRent - discountAmount;
    
    return { totalRent, totalLossValue, depositToHold, totalWithDiscount, discountAmount };
  }, [items, rentalDays, discount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white grid place-content-center">
        <div className="text-slate-500">Завантаження...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white grid place-content-center">
        <div className="text-slate-500">Замовлення не знайдено</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header order={order} customerStats={customerStats} />
      
      <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6">
        <Breadcrumbs orderId={order.order_number} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT */}
          <section className="lg:col-span-2 grid gap-6">
            <Card title="Клієнт">
              <div className="grid md:grid-cols-4 gap-4">
                <Field label="Ім'я">
                  <input 
                    value={order.client_name} 
                    readOnly 
                    disabled 
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </Field>
                <Field label="Телефон">
                  <input 
                    value={order.client_phone} 
                    readOnly 
                    disabled 
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </Field>
                <Field label="Email">
                  <input 
                    value={order.client_email || 'Не вказано'} 
                    readOnly 
                    disabled 
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </Field>
                {customerStats && (
                  <Field label="Статус клієнта">
                    <div className="flex items-center gap-2 h-10">
                      <CustomerBadge tier={customerStats.tier} />
                      <span className="text-xs text-slate-500">({customerStats.order_count} зам.)</span>
                    </div>
                  </Field>
                )}
              </div>
            </Card>

            <Card title="Дати оренди та тривалість">
              <div className="grid md:grid-cols-4 gap-4">
                <Field label="Дата видачі">
                  <input 
                    type="date" 
                    value={issueDate} 
                    onChange={e => setIssueDate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none"
                  />
                </Field>
                <Field label="Дата повернення">
                  <input 
                    type="date" 
                    value={returnDate} 
                    onChange={e => setReturnDate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none"
                  />
                </Field>
                <Field label="Кількість діб оренди">
                  <input 
                    type="number"
                    min="1"
                    value={rentalDays} 
                    onChange={e => setRentalDays(parseInt(e.target.value) || 1)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none"
                  />
                </Field>
                <div className="grid items-end">
                  <button 
                    onClick={handleSaveDates}
                    disabled={saving}
                    className="h-10 rounded-xl bg-teal-600 text-white px-4 text-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? '⏳ Збереження...' : '💾 Зберегти'}
                  </button>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Оренда рахується за кількістю діб, вказаною вище (можна змінювати окремо від дат)
              </div>
            </Card>

            {/* Конфлікти */}
            <Card title={conflicts.length > 0 ? `⚠️ Конфлікти наявності (${conflicts.length})` : "✅ Конфлікти наявності"}>
              {checkingConflicts ? (
                <div className="p-4 text-center text-blue-600">
                  <span className="animate-pulse">Перевірка доступності...</span>
                </div>
              ) : conflicts.length > 0 ? (
                <ConflictsPanel conflicts={conflicts} />
              ) : issueDate && returnDate && items.length > 0 ? (
                <div className="p-4 text-center text-emerald-600">
                  ✅ Всі товари доступні на вказані дати
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400">
                  Додайте товари та вкажіть дати оренди для перевірки доступності
                </div>
              )}
            </Card>

            {/* Пошук та додавання товарів */}
            <Card title="Додати товари (пошук по SKU)">
              <ItemSearch 
                searchQuery={searchQuery}
                onSearchChange={handleSearch}
                searchResults={searchResults}
                searching={searching}
                onAddItem={handleAddItem}
              />
            </Card>

            <Card title="Позиції замовлення">
              <ItemsTable 
                items={items} 
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveItem}
                availability={availability}
              />
            </Card>

            <Card title="Знижка">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Знижка (%)">
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={discount} 
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none"
                  />
                </Field>
                <div className="grid items-end">
                  <div className="text-sm">
                    <span className="text-slate-600">Економія: </span>
                    <b className="text-emerald-600">₴ {calculations.discountAmount.toLocaleString('uk-UA')}</b>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Нотатки менеджера (внутрішні)">
              <textarea 
                rows={2} 
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none" 
                placeholder="Внутрішні нотатки для команди..."
              />
            </Card>

            {/* Старий блок email видалено - тепер email відправляється через ActionsRow після прийняття */}

            <ActionsRow order={order} orderId={orderId} onSave={handleSaveDates} saving={saving} decorOrderStatus={decorOrderStatus} />
          </section>

          {/* RIGHT */}
          <aside className="grid gap-6">
            <Summary 
              calculations={calculations} 
              rentalDays={rentalDays} 
              discount={discount}
            />
            <Checklist order={order} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ——— Item Search Component ——— */
function ItemSearch({ searchQuery, onSearchChange, searchResults, searching, onAddItem }) {
  return (
    <div className="grid gap-3">
      <div className="relative">
        <input 
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Введіть SKU або назву товару..."
          className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none"
        />
        {searching && (
          <div className="absolute right-3 top-2.5 text-slate-400">
            Пошук...
          </div>
        )}
      </div>
      
      {searchResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {searchResults.map(product => (
            <div key={product.product_id} className="rounded-xl border border-slate-200 p-3 hover:border-teal-300 transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-slate-500">SKU: {product.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">₴ {product.price_per_day.toLocaleString('uk-UA')}/д</div>
                  <div className="text-xs text-slate-500">Застава: ₴{product.deposit.toLocaleString('uk-UA')}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-slate-500">
                  На складі: {product.total_quantity} шт
                </div>
                <button 
                  onClick={() => onAddItem(product)}
                  className="h-8 rounded-xl bg-teal-600 text-white px-3 text-xs hover:bg-teal-700"
                >
                  + Додати
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
        <div className="text-center py-4 text-slate-500 text-sm">
          Товарів не знайдено
        </div>
      )}
    </div>
  );
}

/* ——— Conflicts Panel ——— */
function ConflictsPanel({ conflicts }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">SKU / Назва</th>
            <th className="px-3 py-2 text-left font-medium">Тип конфлікту</th>
            <th className="px-3 py-2 text-left font-medium">Деталь</th>
            <th className="px-3 py-2 text-right font-medium">Всього</th>
            <th className="px-3 py-2 text-right font-medium">В оренді</th>
            <th className="px-3 py-2 text-right font-medium">Доступно</th>
            <th className="px-3 py-2 text-right font-medium">Запитано</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {conflicts.map((c, i) => (
            <tr key={i} className={c.level === 'error' ? 'bg-rose-50' : 'bg-amber-50'}>
              <td className="px-3 py-2">
                <div className="font-mono text-xs font-semibold text-slate-900">{c.sku || 'N/A'}</div>
                <div className="text-xs text-slate-600 mt-0.5">{c.product_name || c.name || 'Невідомий товар'}</div>
              </td>
              <td className="px-3 py-2">
                <Badge tone={c.level === 'error' ? 'rose' : 'amber'}>
                  {c.type === 'out_of_stock' && '🔴 Немає на складі'}
                  {c.type === 'insufficient' && '❌ Недоступно'}
                  {c.type === 'tight_schedule' && '⚠️ Щільний графік'}
                  {c.type === 'low_stock' && '📦 Малий запас'}
                  {!['out_of_stock', 'insufficient', 'tight_schedule', 'low_stock'].includes(c.type) && c.type}
                </Badge>
              </td>
              <td className="px-3 py-2 text-slate-600">
                {/* Основне повідомлення в залежності від типу */}
                {c.type === 'out_of_stock' && 'Товар відсутній на складі (загальна кількість = 0)'}
                {c.type === 'insufficient' && 'Товар зарезервований на ці дати іншими замовленнями'}
                {c.type === 'tight_schedule' && 'Товар доступний, але є близькі замовлення з ризиком затримки'}
                {c.type === 'low_stock' && `Товар доступний, але залишок критично малий (${c.available_quantity} з ${c.total_quantity} шт)`}
                
                {c.available_quantity !== undefined && c.requested_quantity !== undefined && c.available_quantity < c.requested_quantity && (
                  <div className="text-xs text-rose-600 mt-1">
                    Бракує: {c.requested_quantity - c.available_quantity} шт
                  </div>
                )}
                {c.nearby_orders && c.nearby_orders.length > 0 && (
                  <div className="text-xs text-slate-600 mt-2 space-y-1">
                    <div className="font-semibold">
                      {c.is_available ? '⚠️ Близькі замовлення (ризик):' : '🔒 Товар зайнятий в замовленнях:'}
                    </div>
                    {c.nearby_orders.map((order, idx) => (
                      <div key={idx} className="pl-2">
                        • <span className="font-mono">{order.order_number}</span>
                        {' '}<span className={order.status === 'issued' || order.status === 'on_rent' ? 'text-rose-600 font-semibold' : 'text-blue-600'}>
                          ({order.status})
                        </span>
                        {' '}{order.rental_start_date} → {order.rental_end_date}
                        {' '}[{order.quantity} шт]
                        {order.days_gap !== null && order.days_gap >= 0 && order.days_gap <= 1 && (
                          <span className="text-amber-600 font-semibold ml-1">
                            (↔ {order.days_gap} дн. до видачі)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className="font-medium">{c.total_quantity !== undefined ? c.total_quantity : '?'}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                {c.in_rent !== undefined ? c.in_rent : '?'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={c.available === 0 ? 'font-bold text-rose-600' : 'font-medium text-emerald-600'}>
                  {c.available !== undefined ? c.available : '?'}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-bold">
                {c.requested !== undefined ? c.requested : '?'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ——— Helper functions ——— */
function daysDiff(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.max(1, Math.ceil((b - a) / (1000 * 60 * 60 * 24)));
}

/* ——— Components ——— */
function Header({ order, customerStats }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-4 flex flex-wrap items-center gap-4">
        <h1 className="text-lg font-semibold">Нове замовлення • #{order.order_number}</h1>
        <div className="text-sm text-slate-600">Клієнт: <b>{order.client_name}</b></div>
        {customerStats && (
          <CustomerBadge tier={customerStats.tier} count={customerStats.order_count} />
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Badge tone="slate">Статус: В обробці</Badge>
        </div>
      </div>
    </header>
  );
}

function CustomerBadge({ tier, count }) {
  const map = {
    novice: { label: 'Новачок', bg: 'bg-slate-100 text-slate-700' },
    regular: { label: 'Постійний', bg: 'bg-blue-100 text-blue-700' },
    silver: { label: 'Срібний', bg: 'bg-slate-200 text-slate-800' },
    gold: { label: 'Золотий', bg: 'bg-amber-100 text-amber-700' },
    platinum: { label: 'Платина', bg: 'bg-purple-100 text-purple-700' }
  };
  const { label, bg } = map[tier] || map.novice;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${bg}`}>
      {label} {count !== undefined && `(${count})`}
    </span>
  );
}

function Breadcrumbs({ orderId }) {
  return (
    <nav className="text-sm text-slate-500">
      <ol className="flex items-center gap-2">
        <li><a href="/" className="hover:text-slate-900">Менеджер</a></li>
        <li>›</li>
        <li>Вхідні замовлення</li>
        <li>›</li>
        <li className="text-slate-900">#{orderId}</li>
      </ol>
    </nav>
  );
}

function Card({ title, children, right }) {
  return (
    <section className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Badge({ children, tone = 'slate' }) {
  const map = {
    slate: 'bg-slate-100 text-slate-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    emerald: 'bg-emerald-100 text-emerald-800'
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

function ItemsTable({ items, onUpdateQuantity, onRemove, availability }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Фото</th>
            <th className="px-3 py-2 text-left font-medium">Назва</th>
            <th className="px-3 py-2 text-left font-medium">SKU</th>
            <th className="px-3 py-2 text-right font-medium">Ціна/д</th>
            <th className="px-3 py-2 text-right font-medium">Збиток</th>
            <th className="px-3 py-2 text-right font-medium">Кількість</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                Додайте товари через пошук вище
              </td>
            </tr>
          )}
          {items.map((item, idx) => {
            const imageUrl = getImageUrl(item.image);
            return (
              <tr key={idx}>
                <td className="px-3 py-2">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={item.name}
                      className="w-16 h-16 rounded-lg border border-slate-200 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'grid';
                      }}
                    />
                  ) : null}
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 grid place-content-center text-xs text-slate-400" style={{display: imageUrl ? 'none' : 'grid'}}>
                    📦
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{item.article || item.sku || '-'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  ₴ {item.price_per_day?.toLocaleString('uk-UA') || '0'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  ₴ {item.damage_cost?.toLocaleString('uk-UA') || item.price_per_day?.toLocaleString('uk-UA') || '0'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => onUpdateQuantity(item.inventory_id, item.quantity - 1)}
                      className="h-7 w-7 rounded-lg border hover:bg-slate-50"
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <input 
                      value={item.quantity} 
                      onChange={e => onUpdateQuantity(item.inventory_id, parseInt(e.target.value) || 1)}
                      className="w-14 rounded-md border border-slate-200 px-2 py-1 text-right tabular-nums outline-none"
                    />
                    <button 
                      onClick={() => onUpdateQuantity(item.inventory_id, item.quantity + 1)}
                      className="h-7 w-7 rounded-lg border hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button 
                    onClick={() => onRemove(item.inventory_id)}
                    className="h-7 rounded-lg border px-2 text-xs hover:bg-rose-50 hover:text-rose-700"
                  >
                    Видалити
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ calculations, rentalDays, discount }) {
  return (
    <Card title="Підсумок">
      <div className="grid gap-3 text-sm">
        <Row k="Діб оренди" v={<b className="tabular-nums">{rentalDays}</b>} />
        
        {/* Оренда */}
        <Row k="Оренда (без знижки)" v={`₴ ${calculations.totalRent.toLocaleString('uk-UA')}`} />
        {discount > 0 && (
          <>
            <Row k={`Знижка (${discount}%)`} v={<span className="text-emerald-600">-₴ {calculations.discountAmount.toLocaleString('uk-UA')}</span>} />
            <Row k="Оренда зі знижкою" v={<b>₴ {calculations.totalWithDiscount.toLocaleString('uk-UA')}</b>} />
          </>
        )}
        
        <div className="border-t border-slate-200" />
        
        {/* Вартість втрати та застава */}
        <Row 
          k={<span className="text-slate-500 text-xs">Повна вартість втрати декору (збиток)</span>} 
          v={<span className="text-rose-600">₴ {calculations.totalLossValue.toLocaleString('uk-UA')}</span>} 
        />
        <Row 
          k="Застава до оплати (холд)" 
          v={<span className="text-amber-700 font-medium">₴ {calculations.depositToHold.toLocaleString('uk-UA')}</span>} 
        />
        
        <div className="border-t border-slate-300" />
        
        {/* Загальна сума */}
        <Row 
          k={<b className="text-base">До оплати зараз</b>} 
          v={<b className="text-lg text-emerald-700">₴ {(calculations.totalWithDiscount + calculations.depositToHold).toLocaleString('uk-UA')}</b>} 
        />
      </div>
    </Card>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-slate-600">{k}</div>
      <div className="text-slate-900">{v}</div>
    </div>
  );
}

function Checklist({ order }) {
  const hasClient = !!order.client_name;
  const hasDates = !!order.issue_date && !!order.return_date;
  const hasItems = order.items && order.items.length > 0;
  
  const items = [
    ['Клієнт вказаний', hasClient],
    ['Дати видачі/повернення заповнені', hasDates],
    ['Позиції додані', hasItems],
    ['Готово до підтвердження', hasClient && hasDates && hasItems],
  ];
  
  return (
    <Card title="Чекліст">
      <ul className="grid gap-2 text-sm">
        {items.map(([label, ok], i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActionsRow({ order, orderId, onSave, saving, decorOrderStatus }) {
  const [accepting, setAccepting] = React.useState(false);
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [movingToPrep, setMovingToPrep] = React.useState(false);
  const navigate = useNavigate();
  
  const handleAccept = async () => {
    if (!confirm('Підтвердити прийняття замовлення? Буде створено картки видачі та повернення.')) {
      return;
    }
    
    console.log('[NewOrder] Accepting order:', {
      order_number: order.order_number,
      order_id: order.order_id,
      url: `${process.env.REACT_APP_BACKEND_URL}/api/orders/${order.order_number}/accept`
    });
    
    setAccepting(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/orders/${order.order_number}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Замовлення прийнято!\n\n` +
              `📋 Статус: Очікує підтвердження клієнта\n` +
              `📋 Картка видачі створена\n` +
              `📋 Картка повернення створена\n\n` +
              `Тепер можна відправити email підтвердження клієнту`);
        
        // Перезавантажити сторінку щоб оновити статус
        window.location.reload();
      } else {
        alert(`❌ Помилка: ${result.detail || 'Невідома помилка'}`);
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('❌ Помилка прийняття замовлення');
    } finally {
      setAccepting(false);
    }
  };
  
  const handleSendEmail = async () => {
    const changes = prompt('Які зміни були внесені? (через кому)\nНаприклад: Дата повернення змінена, Кількість стільців +2');
    
    setSendingEmail(true);
    try {
      // 🔥 КРОК 1: СПОЧАТКУ ЗБЕРЕГТИ ВСІ ЗМІНИ через onSave callback
      console.log('📝 Збереження змін перед відправкою email...');
      await onSave();
      
      console.log('✅ Зміни збережено, відправка email...');
      
      // 🔥 КРОК 2: ТЕПЕР ВІДПРАВИТИ EMAIL З ОНОВЛЕНИМИ ДАНИМИ
      console.log('[EMAIL] Відправка email для order_id:', orderId);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/decor-orders/${orderId}/send-confirmation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: changes ? changes.split(',').map(c => c.trim()) : []
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Email відправлено!\n\nЗміни збережено та відправлено клієнту на ${order.client_email}`);
        // Перезавантажити дані замовлення
        window.location.reload();
      } else {
        alert(`❌ Помилка: ${result.detail || 'Невідома помилка'}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert(`❌ Помилка: ${error.message || 'Не вдалося відправити email'}`);
    } finally {
      setSendingEmail(false);
    }
  };
  
  const handleMoveToPreparation = async () => {
    console.log('[MOVE TO PREP] Starting - no conflict check');
    
    if (!confirm('Відправити замовлення на збір? Комірники зможуть почати збирати товари.')) {
      return;
    }
    
    setMovingToPrep(true);
    try {
      console.log('[MOVE TO PREP] Відправка на збір order_id:', orderId);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/decor-orders/${orderId}/move-to-preparation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Замовлення відправлено на збір!\n\n• Клієнт автоматично підтверджений\n• Комірники можуть почати підготовку`);
        // Перейти на картку видачі (Issue Card) з правильним ID
        console.log('[MOVE TO PREP] Навігація до /issue/' + result.issue_card_id);
        navigate(`/issue/${result.issue_card_id}`);
      } else {
        alert(`❌ Помилка: ${result.detail || 'Невідома помилка'}\n\nЯкщо проблема з наявністю - перевірте конфлікти та збережіть зміни.`);
      }
    } catch (error) {
      console.error('[MOVE TO PREP] Error:', error);
      alert(`❌ Помилка відправки на збір: ${error.message}`);
    } finally {
      setMovingToPrep(false);
    }
  };
  
  const handleCancelByClient = async () => {
    const reason = prompt('Причина відмови клієнта (опціонально):');
    if (reason === null) return; // User clicked Cancel
    
    if (!confirm('⚠️ Клієнт відмовився від замовлення?\n\nЗамовлення буде скасовано і товари розморожено.')) {
      return;
    }
    
    try {
      await axios.post(`${BACKEND_URL}/api/decor-orders/${order.order_id}/cancel-by-client`, {
        reason: reason || 'Клієнт відмовився без пояснень'
      });
      
      alert('✅ Замовлення скасовано. Товари розморожено.');
      window.location.href = '/manager'; // Redirect to dashboard
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert(`❌ Помилка: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDecline = async () => {
    const reason = prompt('Вкажіть причину відхилення замовлення:\n(ця інформація буде збережена в системі)');
    
    if (!reason) return; // Користувач натиснув Cancel
    
    if (!confirm('Підтвердити відхилення замовлення?\nЗамовлення буде помічено як відхилене.')) {
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${order.order_number}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason,
          declined_by: 'Менеджер'
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Замовлення #${order.order_number} відхилено\n\nПричина: ${reason}\n\nКлієнт буде повідомлений.`);
        // Повернутися на dashboard
        navigate('/');
      } else {
        alert(`❌ Помилка: ${result.detail || 'Невідома помилка'}`);
      }
    } catch (error) {
      console.error('Error declining order:', error);
      alert('❌ Помилка відхилення замовлення');
    }
  };
  
  // Якщо замовлення вже в системі (awaiting_customer)
  if (decorOrderStatus === 'awaiting_customer') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <span>⏳</span>
          <span>Замовлення прийнято. Очікує підтвердження клієнта.</span>
        </div>
        
        {order.client_confirmed && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            <span>✅</span>
            <span><strong>Клієнт підтвердив замовлення!</strong> Можете відправити на комплектацію.</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Внесіть необхідні зміни, збережіть, та відправте email підтвердження клієнту.
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onSave}
              disabled={saving || sendingEmail || movingToPrep}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? '⏳ Збереження...' : '💾 Зберегти зміни'}
            </button>
            <button 
              onClick={handleSendEmail}
              disabled={sendingEmail || saving || movingToPrep}
              className="h-10 rounded-xl bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sendingEmail ? '⏳ Відправка...' : '📧 Відправити email'}
            </button>
            <button 
              onClick={handleMoveToPreparation}
              disabled={movingToPrep || saving || sendingEmail}
              className="h-10 rounded-xl bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {movingToPrep ? '⏳ Відправка...' : '📦 Відправити на збір'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Якщо замовлення ще не прийнято (нове з OpenCart)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-slate-600">
        Це замовлення створено клієнтом. Перевірте дати, кількість товарів і підтвердіть бронь.
      </div>
      <div className="flex gap-2">
        <button 
          onClick={onSave}
          disabled={saving || accepting}
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? '⏳ Збереження...' : '💾 Зберегти'}
        </button>
        <button 
          onClick={handleCancelByClient}
          disabled={accepting || saving}
          className="h-10 rounded-xl border-2 border-rose-300 px-4 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          🚫 Клієнт відмовився
        </button>
        <button 
          onClick={handleDecline}
          disabled={accepting}
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          ❌ Відхилити
        </button>
        <button 
          onClick={handleAccept}
          disabled={accepting || saving}
          className="h-10 rounded-xl bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {accepting ? '⏳ Прийняття...' : '✓ Прийняти замовлення'}
        </button>
      </div>
    </div>
  );
}
