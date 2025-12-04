/* eslint-disable */
// Return Card — full-screen for warehouse clerk + manager
import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import axios from 'axios'
import { getImageUrl } from '../utils/imageHelper'
import DamageModal from '../components/DamageModal'
import FinanceStatusCard from '../components/FinanceStatusCard'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/******************** tiny utils ********************/
const cls = (...a)=> a.filter(Boolean).join(' ')
const fmtUA = (n)=> (Number(n)||0).toLocaleString('uk-UA', {maximumFractionDigits:2})
const todayISO = ()=> new Date().toISOString().slice(0,10)
const nowISO = ()=> new Date().toISOString().replace('T',' ').slice(0,19)

/******************** small UI ********************/
function Badge({tone='slate', children}){
  const tones={
    slate:'bg-slate-100 text-slate-700 border-slate-200',
    green:'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber:'bg-amber-100 text-amber-800 border-amber-200',
    red:'bg-rose-100 text-rose-700 border-rose-200',
    blue:'bg-blue-100 text-blue-700 border-blue-200',
    violet:'bg-violet-100 text-violet-700 border-violet-200'
  }
  return <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', tones[tone])}>{children}</span>
}

function LocationBadge({state, zone}){
  const map = {
    wash:   {tone:'blue',   text:'Мийка'},
    shelf:  {tone:'slate',  text:'Полиця'},
    restore:{tone:'violet', text:'Реставрація'},
    intake: {tone:'amber',  text:'Приймання'},
    unknown:{tone:'amber',  text:'Невідомо'},
  }
  const t = map[state] || map.unknown
  return <Badge tone={t.tone}>{t.text}: {zone || '—'}</Badge>
}
function Pill({tone='slate', onClick, children, disabled=false}){
  const tones={
    slate:'bg-slate-800 hover:bg-slate-900 text-white',
    green:'bg-emerald-600 hover:bg-emerald-700 text-white',
    red:'bg-rose-600 hover:bg-rose-700 text-white',
    blue:'bg-blue-600 hover:bg-blue-700 text-white',
    yellow:'bg-amber-500 hover:bg-amber-600 text-slate-900'
  }
  return <button disabled={disabled} onClick={onClick} className={cls('rounded-full px-3 py-1 text-sm transition disabled:opacity-50 disabled:pointer-events-none', tones[tone])}>{children}</button>
}
function Card({title, right=null, children}){
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

/******************** header ********************/
function Header({order}){
  const statusMap = {
    6: 'intake',
    7: 'inspecting', 
    8: 'settled'
  }
  const status = statusMap[order.order_status_id] || 'intake'
  const tone = status==='settled' ? 'green' : status==='inspecting' ? 'blue' : 'amber'
  
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold">Повернення · #{order.order_id}</div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="text-sm text-slate-600">
        Видали: <b>{order.rent_issue_date || '—'}</b> · Повернення за планом: <b>{order.rent_return_date || '—'}</b> · Факт: <b>{todayISO()}</b>
      </div>
    </div>
  )
}

/******************** items table ********************/
function ItemsTable({items, onToggleSerialOK, onSetCounts, onOpenFinding, onToggleFlags}){
  return (
    <Card title="Перелік позицій">
      <div className="overflow-hidden rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Фото</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Назва</th>
              <th className="px-3 py-2">Оренда</th>
              <th className="px-3 py-2">Повернуто</th>
              <th className="px-3 py-2">Стан</th>
              <th className="px-3 py-2">Серійні</th>
              <th className="px-3 py-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              // Фото товару
              const photoUrl = getImageUrl(it.image) || `https://picsum.photos/seed/${it.inventory_id}/60/40`
              
              // Клік на фото - відкрити каталог
              const handlePhotoClick = () => {
                window.open(`/catalog?product=${it.inventory_id}`, '_blank')
              }
              
              return (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">
                  <img 
                    src={photoUrl} 
                    alt={it.name}
                    className="h-10 w-14 rounded object-cover cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
                    onClick={handlePhotoClick}
                    title="Натисніть щоб відкрити картку товару"
                  />
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{it.sku}</td>
                <td className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span>{it.name}</span>
                    {it.findings.length>0 && <Badge tone='amber'>{it.findings.length} зауважень</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    <LocationBadge state={it.location?.state || 'shelf'} zone={it.location?.zone || it.shelf || ''} />
                  </div>
                </td>
                <td className="px-3 py-2">{it.rented_qty}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button className="h-7 w-7 rounded-lg border hover:bg-slate-50" onClick={()=>onSetCounts(it.id, Math.max(0,it.returned_qty-1))}>-</button>
                    <div className="w-10 text-center font-semibold">{it.returned_qty}</div>
                    <button className="h-7 w-7 rounded-lg border hover:bg-slate-50" onClick={()=>onSetCounts(it.id, it.returned_qty+1)}>+</button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {(it.returned_qty === it.rented_qty && it.findings.length===0) ? <Badge tone='green'>OK</Badge> :
                   (it.findings.length>0) ? <Badge tone='red'>Є пошкодження</Badge> : <Badge tone='amber'>Частк. повернення</Badge>}
                </td>
                <td className="px-3 py-2">
                  {!it.serials || it.serials.length===0 ? (
                    <span className="text-xs text-slate-500">безсерійний</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {it.serials.map(s => (
                        <button key={s} onClick={()=>onToggleSerialOK(it.id, s)} className={cls('rounded-md border px-2 py-0.5 text-xs', it.ok_serials.includes(s) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white hover:bg-slate-50')}>{s}</button>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Pill tone='amber' onClick={()=>onOpenFinding(it.id)}>Зафіксувати пошкодження</Pill>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/******************** finance panel ********************/
function FinancePanel({order, onSetFees, onDecideDeposit}){
  const total = parseFloat(order.total || 0)
  const prepay = parseFloat(order.prepayment || 0)
  const deposit = parseFloat(order.deposit || 0)
  
  const rentDue = Math.max(0, total - prepay)
  const totalFees = (order.late_fee||0) + (order.cleaning_fee||0) + (order.damage_fee||0)
  const totalDue = rentDue + totalFees
  const canCover = deposit >= totalDue

  return (
    <Card title="Фінанси" right={<Badge tone={totalFees>0?'amber':'green'}>{totalFees>0? `До доплати ₴ ${fmtUA(totalFees)}`:'Без збитків'}</Badge>}>
      <div className="space-y-3">
        <div className="text-sm text-slate-600">Нараховані збитки після повернення:</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Пеня за прострочку</span>
            <input type="number" className="w-28 rounded-lg border px-2 py-1 text-right" value={order.late_fee||0}
                   onChange={e=>onSetFees('late_fee', Number(e.target.value)||0)} />
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Миття/сушка/чистка</span>
            <input type="number" className="w-28 rounded-lg border px-2 py-1 text-right" value={order.cleaning_fee||0}
                   onChange={e=>onSetFees('cleaning_fee', Number(e.target.value)||0)} />
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Збитки (пошкодження)</span>
            <input type="number" className="w-28 rounded-lg border px-2 py-1 text-right" value={order.damage_fee||0}
                   onChange={e=>onSetFees('damage_fee', Number(e.target.value)||0)} />
          </div>
          <div className="flex justify-between border-t pt-2"><span className="font-medium">Разом до доплати</span><span className="font-semibold">₴ {fmtUA(totalFees)}</span></div>
        </div>
        {totalFees > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
            <div className="font-medium text-amber-800 mb-1">💰 Інформація</div>
            <div className="text-amber-700">Після завершення приймання дані про доплату будуть передані у фінансовий кабінет для прийняття коштів менеджером.</div>
          </div>
        )}
      </div>
    </Card>
  )
}

/******************** timeline ********************/
function Timeline({events}){
  return (
    <Card title="Таймлайн">
      <ol className="space-y-2 text-sm max-h-60 overflow-auto">
        {events.map((e,i)=> (
          <li key={i} className="flex items-start gap-2">
            <div className={cls('mt-1 h-2 w-2 rounded-full flex-shrink-0', e.tone==='green'?'bg-emerald-500':e.tone==='red'?'bg-rose-500':'bg-blue-500')} />
            <div>
              <div className="font-medium">{e.text}</div>
              <div className="text-xs text-slate-500">{e.at}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/******************** main ********************/
export default function ReturnCard(){
  const { id: orderId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState('')
  const [events, setEvents] = useState([])
  const [findingOpen, setFindingOpen] = useState({open:false, itemId:null})
  const [transactions, setTransactions] = useState([]) // Фінансові транзакції

  useEffect(()=>{
    loadOrder()
  },[orderId])

  const loadOrder = async ()=>{
    try {
      setLoading(true)
      
      // Спробуємо завантажити з decor_orders спочатку
      let res, orderData
      try {
        res = await axios.get(`${BACKEND_URL}/api/decor-orders/${orderId}`)
        orderData = res.data
        console.log('[Return] Order loaded from decor_orders:', orderData)
      } catch (decorErr) {
        // Якщо не знайдено в decor_orders, спробуємо OpenCart
        console.log('[Return] Not in decor_orders, trying OpenCart...')
        res = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`)
        orderData = res.data
        console.log('[Return] Order loaded from OpenCart:', orderData)
      }
      
      // Transform order data
      const transformedOrder = {
        order_id: orderData.id || orderData.order_id,
        order_status_id: orderData.order_status_id || 24,
        firstname: orderData.client_name?.split(' ')[0] || '',
        lastname: orderData.client_name?.split(' ').slice(1).join(' ') || '',
        telephone: orderData.client_phone || '',
        email: orderData.client_email || '',
        total: orderData.total_rental || 0,
        prepayment: 0,
        deposit: orderData.deposit_held || orderData.total_deposit || 0,
        rent_issue_date: orderData.rent_date || orderData.issue_date || todayISO(),
        rent_return_date: orderData.rent_return_date || orderData.return_date || todayISO(),
        date_added: orderData.created_at || nowISO(),
        manager_comment: orderData.notes || orderData.manager_comment || '',
        late_fee: 0,
        cleaning_fee: 0,
        damage_fee: 0
      }
      
      setOrder(transformedOrder)
      setNotes(orderData.notes || orderData.manager_comment || '')
      
      // Transform items
      const transformedItems = (orderData.items || []).map((p, idx) => ({
        id: p.id || p.order_product_id || p.inventory_id || idx,
        sku: p.article || p.sku || p.model || '',
        name: p.name || p.product_name || '',
        image: p.image || '',  // Додано image
        category: p.category || 'Меблі',
        rented_qty: parseInt(p.quantity || p.qty) || 0,
        returned_qty: 0,
        serials: p.serials || [],
        ok_serials: [],
        findings: [],
        location: {
          state: 'shelf',
          zone: p.article || p.sku || p.model || 'A-01'
        },
        location_after: 'intake'
      }))
      
      console.log('Transformed return items:', transformedItems)
      setItems(transformedItems)
      
      // Initialize events
      setEvents([
        {at: nowISO(), text:'Повернення розпочато', tone:'blue'}
      ])
      
      // Завантажити фінансові транзакції
      try {
        const txRes = await axios.get(`${BACKEND_URL}/api/finance/transactions?order_id=${orderId}`)
        const txData = Array.isArray(txRes.data) ? txRes.data : []
        setTransactions(txData)
        
        // Розрахувати реальну заставу з транзакцій
        const depositHoldTx = txData.filter(t => t.type === 'deposit_hold')
        const depositReceivedAmount = depositHoldTx.reduce((sum, t) => sum + (t.amount || 0), 0)
        
        if (depositReceivedAmount > 0) {
          // Оновити order з реальною заставою
          setOrder(o => ({...o, deposit: depositReceivedAmount}))
          console.log('[Return] Real deposit from transactions:', depositReceivedAmount)
        }
      } catch (txErr) {
        console.error('[Return] Failed to load transactions:', txErr)
      }
      
    } catch(e){
      console.error('Error loading order for return:', e)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося завантажити замовлення',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const onToggleSerialOK = (id, serial)=> setItems(items => items.map(it=>{
    if(it.id!==id) return it
    const ok = it.ok_serials.includes(serial) ? it.ok_serials.filter(s=>s!==serial) : [...it.ok_serials, serial]
    const returned_qty = Math.max(it.returned_qty, ok.length)
    return {...it, ok_serials: ok, returned_qty}
  }))

  const onSetCounts = (id, qty)=> setItems(items => items.map(it => it.id===id ? {...it, returned_qty: Math.max(0, Math.min(qty, it.rented_qty))} : it))

  const onOpenFinding = (id)=> setFindingOpen({open:true, itemId:id})
  
  const onSaveFinding = (damageRecord)=>{
    // DamageModal вже зберіг в API, тут оновлюємо локальний стан
    setItems(items => items.map(it=> it.id===findingOpen.itemId ? {...it, findings:[...it.findings, damageRecord]} : it))
    setFindingOpen({open:false, itemId:null})
    setOrder(o=> ({...o, damage_fee:(o.damage_fee||0)+ (Number(damageRecord.fee)||0)}))
    setEvents(e=>[{at: nowISO(), text:`Зафіксовано пошкодження: ${damageRecord.category} - ${damageRecord.kind}`, tone:'amber'}, ...e])
  }

  const onToggleFlags = (id, key)=> setItems(items => items.map(it => it.id===id ? {...it, [key]: !it[key]} : it))

  const allScannedOK = useMemo(()=> items.every(it => (it.serials.length===0) || it.ok_serials.length===it.rented_qty), [items])
  const allCountsOK  = useMemo(()=> items.every(it => it.returned_qty<=it.rented_qty), [items])

  const setFees = (key, val)=> setOrder(o=> ({...o, [key]: val}))

  const decideDeposit = async (action)=>{
    const total = parseFloat(order.total || 0)
    const prepay = parseFloat(order.prepayment || 0)
    const deposit = parseFloat(order.deposit || 0)
    
    const rentDue = Math.max(0, total - prepay)
    const totalDue = rentDue + (order.late_fee||0) + (order.cleaning_fee||0) + (order.damage_fee||0)
    
    try {
      if(action==='use'){
        const left = Math.max(0, deposit - totalDue)
        setOrder(o=> ({...o, deposit: left}))
        
        // Create finance transaction for writeoff
        await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, {
          order_id: parseInt(orderId),
          type: 'deposit_writeoff',
          title: 'Списання із застави',
          debit: 0,
          credit: 0,
          currency: 'UAH',
          status: 'completed',
          notes: `Списано ₴${Math.min(deposit, totalDue)}`
        })
        
        toast({ title: '✅ Успіх', description: 'Списано з застави' })
      }
      
      if(action==='release'){
        setOrder(o=> ({...o, deposit: 0}))
        
        // Create finance transaction for release
        await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, {
          order_id: parseInt(orderId),
          type: 'deposit_release',
          title: 'Повернення застави',
          debit: 0,
          credit: 0,
          currency: 'UAH',
          status: 'completed',
          notes: `Повернено ₴${deposit}`
        })
        
        toast({ title: '✅ Успіх', description: 'Заставу повернено' })
      }
      
      if(action==='part-release'){
        const left = Math.max(0, deposit - totalDue)
        setOrder(o=> ({...o, deposit: left}))
        
        toast({ title: '✅ Успіх', description: 'Частково повернено заставу' })
      }
    } catch(e){
      console.error('Error with deposit operation:', e)
      toast({ title: '❌ Помилка', description: 'Не вдалося виконати операцію', variant: 'destructive' })
    }
  }

  const allOkToSettle = allScannedOK && allCountsOK

  const settle = async ()=>{
    try {
      // Визначити дію з заставою на основі поточних fee
      const total = parseFloat(order.total || 0)
      const prepay = parseFloat(order.prepayment || 0)
      const deposit = parseFloat(order.deposit || 0)
      const rentDue = Math.max(0, total - prepay)
      const totalFees = (order.late_fee||0) + (order.cleaning_fee||0) + (order.damage_fee||0)
      const totalDue = rentDue + totalFees
      
      let depositAction = 'release' // За замовчуванням повертаємо
      if (totalFees > 0 && deposit > 0) {
        depositAction = 'part-release' // Якщо є штрафи, частково списуємо
      }
      
      // Використовуємо новий decor-orders API
      await axios.post(`${BACKEND_URL}/api/decor-orders/${orderId}/complete-return`, {
        items_returned: items.map(item => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          rented_qty: item.rented_qty,
          returned_qty: item.returned_qty,
          ok_serials: item.ok_serials,
          findings: item.findings,
          location_state: item.location_state,
          location_zone: item.location_zone
        })),
        late_fee: order.late_fee || 0,
        cleaning_fee: order.cleaning_fee || 0,
        damage_fee: order.damage_fee || 0,
        deposit_action: depositAction,
        manager_notes: notes
      })
      
      setOrder(o=> ({...o, order_status_id: 13})) // 13 = Повернуто
      setEvents(e=>[{at: nowISO(), text:'Повернення завершено через decor_orders', tone:'green'}, ...e])
      
      toast({ 
        title: '✅ Успіх', 
        description: 'Повернення завершено (decor_orders API)' 
      })
      
      // Navigate back after delay
      setTimeout(()=> navigate('/'), 2000)
      
    } catch(e){
      console.error('Error settling return:', e)
      toast({ 
        title: '❌ Помилка', 
        description: `Не вдалося завершити повернення: ${e.response?.data?.detail || e.message}`, 
        variant: 'destructive' 
      })
    }
  }

  const totals = useMemo(()=>{
    const total = parseFloat(order?.total || 0)
    const prepay = parseFloat(order?.prepayment || 0)
    const rentDue = Math.max(0, total - prepay)
    const totalFees = (order?.late_fee||0) + (order?.cleaning_fee||0) + (order?.damage_fee||0)
    const totalDue = rentDue + totalFees
    return {rentDue, totalFees, totalDue}
  },[order])

  const currentItem = items.find(i=> i.id===findingOpen.itemId)

  if(loading) return <div className="flex items-center justify-center h-screen"><div className="text-xl">Завантаження...</div></div>
  if(!order) return <div className="flex items-center justify-center h-screen"><div className="text-xl">Замовлення не знайдено</div></div>

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <Header order={order} />

      {/* Фінансовий статус - показується ПЕРШИЙ */}
      <FinanceStatusCard orderId={order?.order_id} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Клієнт">
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-slate-500 text-xs">Імʼя</div>
              <div className="font-medium" title={`${order.firstname} ${order.lastname}`}>
                {order.firstname} {order.lastname}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Телефон</div>
              <div className="font-medium" title={order.telephone}>
                {order.telephone}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Email</div>
              <div className="font-medium break-words" title={order.email}>
                {order.email}
              </div>
            </div>
          </div>
        </Card>
        <FinancePanel order={order} onSetFees={setFees} onDecideDeposit={decideDeposit} />
        <Timeline events={events} />
      </div>

      <ItemsTable 
        items={items}
        onToggleSerialOK={onToggleSerialOK}
        onSetCounts={onSetCounts}
        onOpenFinding={onOpenFinding}
        onToggleFlags={onToggleFlags}
      />

      <Card title="Коментарі">
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full rounded-xl border p-3 text-sm" rows={3} placeholder="Службова нотатка про повернення"/>
      </Card>

      <Card title="Підсумок приймання" right={<Badge tone={allOkToSettle?'green':'amber'}>{allOkToSettle?'Можна завершити':'Ще є невідповідності'}</Badge>}>
        <div className="grid gap-3 md:grid-cols-4 text-sm">
          <div><div className="text-slate-500">Повернуто позицій</div><div className="font-semibold">{items.reduce((s,i)=>s + i.returned_qty,0)} / {items.reduce((s,i)=>s + i.rented_qty,0)}</div></div>
          <div><div className="text-slate-500">Фіксацій пошкоджень</div><div className="font-semibold">{items.reduce((s,i)=>s + i.findings.length,0)}</div></div>
          <div><div className="text-slate-500">Додаткові витрати</div><div className="font-semibold">₴ {fmtUA(totals.totalFees)}</div></div>
          <div><div className="text-slate-500">До сплати</div><div className="font-semibold">₴ {fmtUA(totals.totalDue)}</div></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone='green' onClick={settle} disabled={!allOkToSettle}>Завершити приймання</Pill>
          <Pill tone='blue' onClick={()=>window.print()}>Друк акта</Pill>
          <Pill tone='slate' onClick={()=>navigate('/')}>Назад</Pill>
        </div>
      </Card>

      <DamageModal 
        isOpen={findingOpen.open}
        onClose={()=>setFindingOpen({open:false,itemId:null})}
        item={currentItem}
        order={{ order_id: orderId, order_number: order?.order_id }}
        stage='return'
        onSave={onSaveFinding}
        existingHistory={currentItem?.findings || []}
      />

      <div className="text-xs text-slate-500 text-center">Підказка: клік по серійному номеру відмічає, що екземпляр повернувся та OK.</div>
    </div>
  )
}
