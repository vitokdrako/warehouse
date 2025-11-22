/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const NewOrderClean = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientType, setClientType] = useState('ФОП/Компанія');
  const [discount, setDiscount] = useState(0);
  const [manager, setManager] = useState('Вікторія');
  const [issueDate, setIssueDate] = useState('');
  const [issueTime, setIssueTime] = useState('11:30–12:00');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('до 17:00');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ sku: '', name: '', qty: 1, price: 0, depositTier: 'medium' }]);
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositMethod, setDepositMethod] = useState('Картка (холд)');
  const [depositRelease, setDepositRelease] = useState('Після приймання');
  const [depositNote, setDepositNote] = useState('');
  const [inventory, setInventory] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

  // Load inventory on mount
  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoadingInventory(true);
      const response = await axios.get(`${BACKEND_URL}/api/inventory`);
      setInventory(response.data);
    } catch (error) {
      console.error('Error loading inventory:', error);
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося завантажити інвентар',
        variant: 'destructive',
      });
    } finally {
      setLoadingInventory(false);
    }
  };

  const searchInventoryBySKU = (sku) => {
    return inventory.find(item => 
      item.article.toLowerCase() === sku.toLowerCase() || 
      item.id.toLowerCase() === sku.toLowerCase()
    );
  };

  const handleSKUSearch = async (index, sku) => {
    updateItem(index, 'sku', sku);
    
    if (sku.length >= 3) {
      try {
        // First try API search for exact SKU match
        const response = await axios.get(`${BACKEND_URL}/api/inventory?search=${sku}`);
        if (response.data && response.data.length > 0) {
          // Find exact match by SKU
          const found = response.data.find(item => 
            item.article && item.article.toLowerCase() === sku.toLowerCase()
          );
          
          if (found) {
            updateItem(index, 'name', found.name);
            updateItem(index, 'price', found.price_per_day);
            updateItem(index, 'depositTier', found.deposit_tier || 'medium');
            return;
          }
        }
        
        // Fallback to local search if API fails or no match
        const localFound = searchInventoryBySKU(sku);
        if (localFound) {
          updateItem(index, 'name', localFound.name);
          updateItem(index, 'price', localFound.price_per_day);
          updateItem(index, 'depositTier', localFound.deposit_tier || 'medium');
        }
      } catch (error) {
        console.error('Error searching inventory:', error);
        // Try local search as fallback
        const localFound = searchInventoryBySKU(sku);
        if (localFound) {
          updateItem(index, 'name', localFound.name);
          updateItem(index, 'price', localFound.price_per_day);
          updateItem(index, 'depositTier', localFound.deposit_tier || 'medium');
        }
      }
    }
  };

  const addItemFromInventory = (invItem) => {
    const newItem = {
      sku: invItem.article,
      name: invItem.name,
      qty: 1,
      price: invItem.price_per_day,
      depositTier: invItem.deposit_tier || 'medium'
    };
    
    // Check if last item is empty, replace it, otherwise add new
    const lastItem = items[items.length - 1];
    if (lastItem && !lastItem.sku && !lastItem.name) {
      const newItems = [...items];
      newItems[items.length - 1] = newItem;
      setItems(newItems);
    } else {
      setItems([...items, newItem]);
    }
    
    setShowInventoryPicker(false);
    setSearchTerm('');
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.article.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = () => {
    setItems([...items, { sku: '', name: '', qty: 1, price: 0, depositTier: 'medium' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  };

  const calculateDays = () => {
    if (!issueDate || !returnDate) return 0;
    const issue = new Date(issueDate);
    const ret = new Date(returnDate);
    const diffTime = Math.abs(ret - issue);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  const handleCreateOrder = async () => {
    // Validation
    if (!clientName || !clientPhone) {
      toast({
        title: '❌ Помилка',
        description: 'Заповніть імʼя та телефон клієнта',
        variant: 'destructive',
      });
      return;
    }

    if (!issueDate || !returnDate) {
      toast({
        title: '❌ Помилка',
        description: 'Виберіть дати видачі та повернення',
        variant: 'destructive',
      });
      return;
    }

    const validItems = items.filter(i => i.name && i.price > 0);
    if (validItems.length === 0) {
      toast({
        title: '❌ Помилка',
        description: 'Додайте хоча б одну позицію',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Calculate totals for each item based on rental period
      const rentalDays = days || 1;
      
      const orderData = {
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || undefined,
        issue_date: issueDate,
        return_date: returnDate,
        manager_comment: notes || undefined,
        discount_percent: discount || 0,
        items: validItems.map(i => {
          const totalRental = i.price * i.qty * rentalDays;
          const depositPerItem = i.price * 2; // 2x daily price as deposit
          const totalDeposit = depositPerItem * i.qty;
          
          return {
            inventory_id: i.sku || `TEMP-${Date.now()}`,
            name: i.name,
            article: i.sku || 'CUSTOM',
            quantity: i.qty,
            price_per_day: i.price,
            deposit: depositPerItem,
            total_rental: totalRental,
            total_deposit: totalDeposit
          };
        })
      };

      const response = await axios.post(`${BACKEND_URL}/api/orders`, orderData);
      
      toast({
        title: '✅ Успіх',
        description: `Замовлення #${response.data.order_number} створено`,
      });
      
      setTimeout(() => navigate('/'), 1000);
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMsg = error.response?.data?.detail 
        || (typeof error.response?.data === 'string' ? error.response.data : 'Не вдалося створити замовлення');
      toast({
        title: '❌ Помилка',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const totalRent = calculateTotal();
  const days = calculateDays();
  const totalRentForPeriod = totalRent * days;
  const estimatedDeposit = totalRentForPeriod * 1.5;
  
  // Update deposit amount when total changes
  useEffect(() => {
    setDepositAmount(estimatedDeposit);
  }, [estimatedDeposit]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-slate-300 grid place-content-center font-semibold text-sm">
              FD
            </div>
            <span className="text-lg font-semibold tracking-tight">Нове замовлення</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="h-9 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
              Чернетка
            </button>
            <button 
              onClick={handleCreateOrder}
              className="h-9 rounded-xl bg-teal-600 px-3 text-sm text-white hover:bg-teal-700"
            >
              Створити замовлення
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6">
        {/* Summary Strip */}
        <section className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid md:grid-cols-4 gap-0">
            <SummaryCell title="Статус" value="Чернетка" note="буде #авто" tone="info" />
            <SummaryCell title="Клієнт" value={clientName || '—'} note={clientName ? clientPhone : 'додайте контакт'} />
            <SummaryCell title="Оренда (оціночно)" value={`₴ ${Math.round(totalRentForPeriod).toLocaleString('uk-UA')}`} note={days > 0 ? `${days} ${days === 1 ? 'доба' : days < 5 ? 'доби' : 'діб'}` : 'без знижок'} />
            <SummaryCell title="Застава (оціночно)" value={`₴ ${Math.round(estimatedDeposit).toLocaleString('uk-UA')}`} note="автопідбір" />
          </div>
        </section>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Main form */}
          <section className="lg:col-span-2 grid gap-6">
            {/* Customer Block */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header 
                title="Клієнт" 
                right={
                  <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                    Імпорт з CRM
                  </button>
                }
              />
              <div className="grid md:grid-cols-3 gap-4 p-4 text-sm">
                <Field label="Імʼя / Компанія">
                  <input 
                    placeholder="Напр., Daria Studio" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Телефон">
                  <input 
                    placeholder="+380…" 
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Email">
                  <input 
                    placeholder="mail@client.ua" 
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Тип клієнта">
                  <select 
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option>ФОП/Компанія</option>
                    <option>Фізична особа</option>
                  </select>
                </Field>
                <Field label="Знижка, %">
                  <input 
                    value={discount} 
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    type="number"
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none text-right tabular-nums focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Менеджер">
                  <select 
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option>Вікторія</option>
                    <option>Богдан</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Schedule Block */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header title="Графік: видача / повернення" />
              <div className="grid md:grid-cols-4 gap-4 p-4 text-sm">
                <Field label="Дата видачі">
                  <input 
                    type="date" 
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Час вікна видачі">
                  <select 
                    value={issueTime}
                    onChange={(e) => setIssueTime(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option>11:30–12:00</option>
                    <option>12:00–12:30</option>
                    <option>16:30–17:00</option>
                  </select>
                </Field>
                <Field label="Дата повернення">
                  <input 
                    type="date" 
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Час повернення">
                  <select 
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option>до 17:00</option>
                    <option>до 16:00</option>
                  </select>
                </Field>
              </div>
              <div className="px-4 pb-4 text-xs text-slate-500">
                Правила підрахунку діб застосовуються автоматично (T+1, T+2, вихідні тощо).
              </div>
            </div>

            {/* Items Picker */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header 
                title="Позиції замовлення" 
                right={
                  <div className="flex gap-2">
                    <button 
                      className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow"
                      onClick={() => setShowInventoryPicker(true)}
                    >
                      Вибрати з каталогу ({inventory.length})
                    </button>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">SKU</th>
                      <th className="px-4 py-2 text-left font-medium">Назва</th>
                      <th className="px-4 py-2 text-left font-medium">К-сть</th>
                      <th className="px-4 py-2 text-left font-medium">Ціна/доба</th>
                      <th className="px-4 py-2 text-left font-medium">Депозит-тір</th>
                      <th className="px-4 py-2 text-left font-medium">Наявність</th>
                      <th className="px-4 py-2 text-left font-medium">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <input 
                              placeholder="SKU…" 
                              value={item.sku}
                              onChange={(e) => handleSKUSearch(i, e.target.value)}
                              list={`inventory-list-${i}`}
                              className="w-32 rounded-md border border-slate-200 px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400"
                            />
                            <datalist id={`inventory-list-${i}`}>
                              {inventory.map((inv) => (
                                <option key={inv.id} value={inv.article}>
                                  {inv.name} - ₴{inv.price_per_day}/день
                                </option>
                              ))}
                            </datalist>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            placeholder="Назва товару (автопідтягнеться)" 
                            value={item.name}
                            onChange={(e) => updateItem(i, 'name', e.target.value)}
                            className="w-full min-w-[300px] rounded-md border border-slate-200 px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <NumberInput 
                            value={item.qty}
                            onChange={(val) => updateItem(i, 'qty', val)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            value={item.price} 
                            type="number"
                            onChange={(e) => updateItem(i, 'price', parseFloat(e.target.value) || 0)}
                            className="w-24 text-right tabular-nums rounded-md border border-slate-200 px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select 
                            value={item.depositTier}
                            onChange={(e) => updateItem(i, 'depositTier', e.target.value)}
                            className="w-32 rounded-md border border-slate-200 px-2 py-1 outline-none focus:ring-2 focus:ring-teal-400"
                          >
                            <option>low</option>
                            <option>medium</option>
                            <option>high</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <Badge value="in_stock" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => removeItem(i)}
                              className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow"
                            >
                              Видалити
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                <button 
                  onClick={addItem}
                  className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow"
                >
                  + Додати позицію
                </button>
                <div className="text-sm text-slate-600">
                  Резерв по складу: <span className="font-medium">OK</span> • Конфлікти: <span className="font-medium text-amber-700">0</span>
                </div>
              </div>
            </div>

            {/* Pricing Block */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header 
                title="Розрахунок" 
                right={
                  <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                    Зберегти як оферту
                  </button>
                }
              />
              <div className="grid md:grid-cols-4 gap-4 p-4">
                <Stat label="Оренда (період)" value={`₴ ${Math.round(totalRentForPeriod).toLocaleString('uk-UA')}`} />
                <Stat label="Застава (оціночно)" value={`₴ ${Math.round(estimatedDeposit).toLocaleString('uk-UA')}`} />
                <Stat label="Передплата" value="₴ 0" />
                <Stat label="До оплати зараз" value={`₴ ${Math.round(totalRentForPeriod).toLocaleString('uk-UA')}`} emphasize />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Стаття</th>
                      <th className="px-4 py-2 text-left font-medium">Сума</th>
                      <th className="px-4 py-2 text-left font-medium">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-2">Оренда ({days} {days === 1 ? 'доба' : days < 5 ? 'доби' : 'діб'})</td>
                      <td className="px-4 py-2 tabular-nums">₴ {Math.round(totalRentForPeriod).toLocaleString('uk-UA')}</td>
                      <td className="px-4 py-2">
                        <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                          Редагувати
                        </button>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-2">Послуги (миття/сушка)</td>
                      <td className="px-4 py-2 tabular-nums">₴ 0</td>
                      <td className="px-4 py-2">
                        <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                          Редагувати
                        </button>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-2">Знижка</td>
                      <td className="px-4 py-2 tabular-nums">₴ 0</td>
                      <td className="px-4 py-2">
                        <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                          Редагувати
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Метод: <Badge value="card" /> • Можна зробити <Badge value="hold" /> на заставу
                </div>
                <div className="flex gap-2">
                  <button className="h-9 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                    Рахунок/інвойс
                  </button>
                  <button className="h-9 rounded-xl bg-teal-600 px-3 text-sm text-white hover:bg-teal-700">
                    Оплатити зараз
                  </button>
                </div>
              </div>
            </div>

            {/* Notes Block */}
            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-base font-semibold mb-3">Коментар до замовлення</h3>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400" 
                rows={4} 
                placeholder="Текст для складу / менеджера…"
              />
              <div className="mt-2 flex gap-2">
                <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                  Зберегти
                </button>
                <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                  Прикріпити файл
                </button>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                Статус: <Badge value="draft" /> → після створення стане <Badge value="new" />
              </div>
              <div className="flex gap-2">
                <button className="h-9 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                  Зберегти чернетку
                </button>
                <button className="h-9 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                  Попередній перегляд
                </button>
                <button 
                  onClick={handleCreateOrder}
                  className="h-9 rounded-xl bg-teal-600 px-3 text-sm text-white hover:bg-teal-700"
                >
                  Створити замовлення
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header title="Історія подій" />
              <ul className="p-4 space-y-2 text-sm">
                <li className="flex gap-3">
                  <span className="w-14 shrink-0 tabular-nums text-slate-500">
                    {new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>Створено чернетку</span>
                </li>
              </ul>
            </div>
          </section>

          {/* RIGHT: Context */}
          <aside className="grid gap-6">
            {/* Delivery Block */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header title="Доставка / самовивіз" />
              <div className="p-4 grid gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="delivery" 
                    checked={deliveryType === 'pickup'}
                    onChange={() => setDeliveryType('pickup')}
                  /> Самовивіз
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="delivery"
                    checked={deliveryType === 'delivery'}
                    onChange={() => setDeliveryType('delivery')}
                  /> Доставка (Нова Пошта/курʼєр)
                </label>
                <Field label="Адреса/відділення">
                  <input 
                    placeholder="вул. Прикладна, 1 / ВП №…"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Інструкції для складу">
                  <input 
                    placeholder="Ліфт/рампа/контакти…"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
              </div>
            </div>

            {/* Deposit Block */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <Header title="Застава (попередній розрахунок)" />
              <div className="grid grid-cols-2 gap-4 p-4 text-sm">
                <Field label="Розмір застави (сумарно)">
                  <input 
                    value={Math.round(depositAmount)} 
                    onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                    type="number"
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none text-right tabular-nums focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
                <Field label="Метод">
                  <select 
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option>Картка (холд)</option>
                    <option>Готівка</option>
                  </select>
                </Field>
                <Field label="Автозвільнення">
                  <select 
                    value={depositRelease}
                    onChange={(e) => setDepositRelease(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option>Після приймання</option>
                    <option>+24 год</option>
                  </select>
                </Field>
                <Field label="Примітка до застави">
                  <input 
                    placeholder="Напр., підвищений ризик скло"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </Field>
              </div>
            </div>

            {/* Tasks Panel */}
            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-base font-semibold mb-3">Автозавдання складу</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge value="high" />
                    <span>Зібрати замовлення</span>
                  </div>
                  <div className="text-slate-500 text-xs">у день видачі 09:00</div>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge value="medium" />
                    <span>Підготувати пакування</span>
                  </div>
                  <div className="text-slate-500 text-xs">за день до видачі</div>
                </li>
              </ul>
              <div className="mt-3 flex gap-2">
                <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                  Додати задачу
                </button>
                <button className="h-8 rounded-xl border border-slate-200 px-3 text-sm hover:shadow">
                  Відкрити в задачах
                </button>
              </div>
            </div>

            {/* Docs Panel */}
            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-base font-semibold mb-3">Документи</h3>
              <ul className="space-y-2 text-sm">
                <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge value="draft" />
                    <span>Оферта/рахунок</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="h-7 rounded-lg border border-slate-200 px-2 text-xs hover:shadow">
                      Згенерувати
                    </button>
                    <button className="h-7 rounded-lg border border-slate-200 px-2 text-xs hover:shadow">
                      Підписати
                    </button>
                  </div>
                </li>
                <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge value="draft" />
                    <span>Договір</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="h-7 rounded-lg border border-slate-200 px-2 text-xs hover:shadow">
                      Згенерувати
                    </button>
                    <button className="h-7 rounded-lg border border-slate-200 px-2 text-xs hover:shadow">
                      Підписати
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </aside>
        </main>
      </div>

      <footer className="border-t border-slate-200 py-6 text-center text-slate-500 text-sm">
        © FarforRent • new order
      </footer>

      {/* Inventory Picker Modal */}
      {showInventoryPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">Вибрати товар з каталогу</h2>
              <button 
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm hover:shadow"
                onClick={() => {
                  setShowInventoryPicker(false);
                  setSearchTerm('');
                }}
              >
                Закрити
              </button>
            </div>
            
            <div className="p-5">
              <input
                type="text"
                placeholder="Пошук по назві, SKU або категорії..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400 mb-4"
              />
              
              {loadingInventory ? (
                <div className="text-center py-8 text-slate-500">Завантаження...</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">SKU</th>
                        <th className="px-4 py-3 text-left font-medium">Назва</th>
                        <th className="px-4 py-3 text-left font-medium">Категорія</th>
                        <th className="px-4 py-3 text-right font-medium">Ціна/доба</th>
                        <th className="px-4 py-3 text-right font-medium">Наявність</th>
                        <th className="px-4 py-3 text-left font-medium">Дія</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredInventory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            {searchTerm ? 'Нічого не знайдено' : 'Інвентар порожній'}
                          </td>
                        </tr>
                      ) : (
                        filteredInventory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-xs">{item.article}</td>
                            <td className="px-4 py-3">{item.name}</td>
                            <td className="px-4 py-3 text-slate-600">{item.category}</td>
                            <td className="px-4 py-3 text-right tabular-nums">₴ {item.price_per_day}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                item.quantity_available > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.quantity_available}/{item.quantity_total}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => addItemFromInventory(item)}
                                className="h-8 rounded-xl bg-teal-600 px-3 text-sm text-white hover:bg-teal-700"
                              >
                                Додати
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const SummaryCell = ({ title, value, note, tone }) => {
  const toneMap = {
    ok: 'bg-emerald-50',
    warn: 'bg-amber-50',
    info: 'bg-slate-50'
  };
  
  return (
    <div className={`px-4 py-3 border-b md:border-b-0 md:border-r border-slate-200 last:border-r-0 ${tone ? toneMap[tone] : ''}`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-lg font-semibold tracking-tight tabular-nums">{value}</div>
      {note && <div className="text-xs text-slate-500 mt-0.5">{note}</div>}
    </div>
  );
};

const Header = ({ title, right }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
      <h3 className="text-base font-semibold">{title}</h3>
      {right}
    </div>
  );
};

const Field = ({ label, children }) => {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  );
};

const NumberInput = ({ value, onChange }) => {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
      <button 
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-8 w-8 text-slate-500 hover:bg-slate-50"
      >
        −
      </button>
      <input 
        value={value} 
        readOnly
        className="w-12 text-center outline-none tabular-nums text-sm"
      />
      <button 
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 text-slate-500 hover:bg-slate-50"
      >
        +
      </button>
    </div>
  );
};

const Stat = ({ label, value, emphasize }) => {
  return (
    <div className={`rounded-xl border ${emphasize ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
};

const Badge = ({ value }) => {
  const badgeMap = {
    draft: ['bg-slate-100', 'text-slate-700', 'Чернетка'],
    new: ['bg-sky-100', 'text-sky-800', 'Нове'],
    in_stock: ['bg-emerald-100', 'text-emerald-800', 'В наявності'],
    card: ['bg-sky-100', 'text-sky-800', 'картка'],
    hold: ['bg-slate-100', 'text-slate-700', 'холд'],
    high: ['bg-amber-100', 'text-amber-800', 'високий'],
    medium: ['bg-sky-100', 'text-sky-800', 'середній'],
    low: ['bg-slate-100', 'text-slate-700', 'низький']
  };
  
  const [bg, tc, label] = badgeMap[value] || ['bg-slate-100', 'text-slate-700', value];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bg} ${tc}`}>
      {label}
    </span>
  );
};

export default NewOrderClean;
