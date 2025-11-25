/* eslint-disable */
import React, { useMemo, useState, useEffect } from "react";
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/*********** utils ***********/
const cls = (...a)=> a.filter(Boolean).join(' ')
const fmtUA = (n)=> (Number(n)||0).toLocaleString('uk-UA', {maximumFractionDigits:2})
const todayISO = ()=> new Date().toISOString().slice(0,10)

/*********** ui ***********/
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
function PillButton({tone='slate', onClick, children, disabled=false}){
  const tones={
    slate:'bg-slate-800 hover:bg-slate-900 text-white',
    green:'bg-emerald-600 hover:bg-emerald-700 text-white',
    red:'bg-rose-600 hover:bg-rose-700 text-white',
    blue:'bg-blue-600 hover:bg-blue-700 text-white',
    yellow:'bg-amber-500 hover:bg-amber-600 text-slate-900'
  }
  return <button disabled={disabled} onClick={onClick} className={cls('rounded-full px-3 py-1 text-sm transition disabled:opacity-50', tones[tone])}>{children}</button>
}
function Card({title, right=null, children}){
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>{right}
      </div>
      {children}
    </div>
  )
}

/*********** helpers for calculations ***********/
const isPayment = (r)=> ['prepayment','payment'].includes(r.type)
const isRentOrCharge = (r)=> ['rent','balance_due','damage','rent_accrual'].includes(r.type)
const isHold = (r)=> r.type==='deposit_hold'
const isHoldRelease = (r)=> r.type==='deposit_release'
const isHoldWriteoff = (r)=> r.type==='deposit_writeoff'

function heldAmount(rows){
  const hold = rows.filter(isHold).reduce((s,r)=>s+(r.credit||0),0)
  const release = rows.filter(isHoldRelease).reduce((s,r)=>s+(r.amount||0),0)
  const writeoff = rows.filter(isHoldWriteoff).reduce((s,r)=>s+(r.amount||0),0)
  return Math.max(0, hold - release - writeoff)
}

function heldAmountByCurrency(rows){
  // Рахуємо кожну валюту окремо
  const byCurrency = {}
  
  rows.forEach(r => {
    const curr = r.currency || 'UAH'
    
    // Додаємо холд
    if (r.type === 'deposit_hold') {
      byCurrency[curr] = (byCurrency[curr] || 0) + (r.credit || 0)
    }
    
    // Віднімаємо release та writeoff (у тій же валюті)
    if (r.type === 'deposit_release' || r.type === 'deposit_writeoff') {
      byCurrency[curr] = (byCurrency[curr] || 0) - (r.amount || 0)
    }
  })
  
  // Видалити валюти з нульовим або від'ємним балансом
  Object.keys(byCurrency).forEach(curr => {
    if (byCurrency[curr] <= 0) {
      delete byCurrency[curr]
    }
  })
  
  return byCurrency
}

function balanceDue(rows){
  const deb = rows.filter(isRentOrCharge).reduce((s,r)=>s+(r.debit||0),0)
  const cred = rows.filter(isPayment).reduce((s,r)=>s+(r.credit||0),0)
  return Math.max(0, deb - cred)
}

/*********** Order Finance Card ***********/
function OrderFinanceCard({orderId, rows, onAddPayment, onAddDeposit, onWriteoff, onReleaseDeposit, onAddDamage, onCollapse, onDelete}){
  const orderRows = rows.filter(r=>r.order_id===orderId)
  const held = heldAmount(orderRows)
  const heldByCurrency = heldAmountByCurrency(orderRows)
  const due  = balanceDue(orderRows)
  const [emailInput, setEmailInput] = useState('')
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  
  // Очікуваний депозит (з orders.deposit_amount)
  const expectedDeposit = orderRows.length > 0 ? (orderRows[0].expected_deposit || 0) : 0

  // forms
  const [pay, setPay] = useState({amount:due>0?due:500, method:'cash', note:''})
  const [dep, setDep] = useState({code:'UAH', amount:3000})
  const [dmg, setDmg] = useState({amount:0, note:''})

  useEffect(()=>{
    if(due>0) setPay(prev=>({...prev, amount:due}))
  },[due])

  const handlePrint = async () => {
    try {
      window.open(`${BACKEND_URL}/api/manager/finance/report/${orderId}/pdf`, '_blank')
    } catch(e){
      alert('Помилка відкриття PDF')
    }
  }

  const handleEmail = async () => {
    if(!emailInput){
      alert('Введіть email для відправки')
      return
    }
    try {
      const res = await axios.post(`${BACKEND_URL}/api/manager/finance/report/${orderId}/email`, {
        email: emailInput
      })
      alert(res.data.message + (res.data.note ? '\n\n' + res.data.note : ''))
      setShowEmailDialog(false)
    } catch(e){
      alert('Помилка відправки email')
    }
  }

  return (
    <Card title={`Замовлення #${orderId}`} right={
      <div className="flex items-center gap-2">
        <PillButton tone='slate' onClick={handlePrint}>🖨️ Роздрукувати</PillButton>
        <PillButton tone='blue' onClick={()=>setShowEmailDialog(true)}>📧 Email</PillButton>
        <PillButton tone='red' onClick={()=>onDelete(orderId)}>🗑️ Видалити</PillButton>
        <Badge tone={due>0? 'amber':'green'}>{due>0? `Борг ₴ ${fmtUA(due)}` : 'Боргів немає'}</Badge>
        <button onClick={onCollapse} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>
    }>
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Нараховано</div>
          <div className="text-xl font-semibold">₴ {fmtUA(orderRows.filter(isRentOrCharge).reduce((s,r)=>s+(r.debit||0),0))}</div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Оплачено</div>
          <div className="text-xl font-semibold">₴ {fmtUA(orderRows.filter(isPayment).reduce((s,r)=>s+(r.credit||0),0))}</div>
        </div>
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-3">
          <div className="text-xs text-blue-600 font-medium">Очікувана застава</div>
          <div className="text-lg font-semibold text-blue-800">₴ {fmtUA(expectedDeposit)}</div>
          <div className="text-[10px] text-blue-500 mt-0.5">розрахункова</div>
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <div className="text-xs text-emerald-600 font-medium">Фактична застава</div>
          {Object.keys(heldByCurrency).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(heldByCurrency).map(([curr, amt]) => (
                amt > 0 && (
                  <div key={curr} className="text-base font-semibold text-emerald-800">
                    {curr === 'UAH' ? '₴' : curr === 'USD' ? '$' : '€'} {fmtUA(amt)} {curr !== 'UAH' && <span className="text-xs text-emerald-600">{curr}</span>}
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="text-lg font-semibold text-slate-400">₴ 0</div>
          )}
          <div className="text-[10px] text-emerald-500 mt-0.5">прийнято від клієнта</div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">До сплати</div>
          <div className={cls('text-xl font-semibold', due>0 && 'text-rose-600')}>₴ {fmtUA(due)}</div>
        </div>
      </div>

      {/* payments */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Прийом оплати (готівка / WayForPay / ФОП)" right={<Badge tone='green'>в касу</Badge>}>
          <div className="grid gap-2 md:grid-cols-5">
            <select className="rounded-xl border px-3 py-2" value={pay.method} onChange={e=>setPay({...pay, method:e.target.value})}>
              <option value="cash">Готівка</option>
              <option value="wayforpay">WayForPay</option>
              <option value="bank_transfer">Переказ на ФОП</option>
              <option value="card">Карта</option>
            </select>
            <input className="rounded-xl border px-3 py-2" type="number" value={pay.amount} onChange={e=>setPay({...pay, amount:Number(e.target.value)})} placeholder="Сума"/>
            <input className="md:col-span-3 rounded-xl border px-3 py-2" value={pay.note} onChange={e=>setPay({...pay, note:e.target.value})} placeholder="Примітка"/>
          </div>
          <div className="mt-3"><PillButton tone='green' onClick={()=>onAddPayment(orderId, pay)}>Зарахувати оплату</PillButton></div>
        </Card>

        <Card title="Прийом застави" right={<Badge tone='blue'>холд</Badge>}>
          <div className="grid gap-2 md:grid-cols-3">
            <select className="rounded-xl border px-3 py-2" value={dep.code} onChange={e=>setDep({...dep, code:e.target.value})}>
              <option value="UAH">UAH</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <input className="md:col-span-2 rounded-xl border px-3 py-2" type="number" value={dep.amount} onChange={e=>setDep({...dep, amount:Number(e.target.value)})} placeholder="Сума"/>
          </div>
          <div className="mt-3"><PillButton tone='blue' onClick={()=>onAddDeposit(orderId, dep)}>Прийняти заставу</PillButton></div>
        </Card>
      </div>

      {/* damage / settlement */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Шкода від складу/повернення" right={<Badge tone='amber'>з комірника</Badge>}>
          <div className="grid gap-2 md:grid-cols-5">
            <input className="rounded-xl border px-3 py-2" type="number" value={dmg.amount} onChange={e=>setDmg({...dmg, amount:Number(e.target.value)})} placeholder="Сума збитків"/>
            <input className="md:col-span-3 rounded-xl border px-3 py-2" value={dmg.note} onChange={e=>setDmg({...dmg, note:e.target.value})} placeholder="Коментар / кейс"/>
            <PillButton tone='amber' onClick={()=>onAddDamage(orderId, dmg)}>Нарахувати збитки</PillButton>
          </div>
          <div className="mt-2 text-xs text-slate-500">Після нарахування можна або списати частково/повністю із застави, або чекати доплату.</div>
        </Card>

        <Card title="Операції із заставою">
          <div className="flex flex-wrap gap-2">
            <PillButton tone='red' onClick={()=>{
              const amt = Math.min(held, due)
              if(amt<=0) return alert('Немає що списувати');
              onWriteoff(orderId, amt)
            }}>Списати з застави (до суми боргу)</PillButton>
            <PillButton tone='yellow' onClick={()=>{
              if(held<=0) return alert('Немає активного холду');
              onReleaseDeposit(orderId, held)
            }}>Повернути заставу</PillButton>
          </div>
          <div className="mt-2 text-xs text-slate-500">Повернення повертає залишок холду. Списання створює кредитну проводку «deposit_writeoff» і зменшує холд.</div>
        </Card>
      </div>

      {/* journal for order */}
      <div className="mt-6">
        <Card title="Журнал по замовленню">
          <div className="overflow-hidden rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Назва</th>
                  <th className="px-3 py-2">Метод</th>
                  <th className="px-3 py-2">Дебет</th>
                  <th className="px-3 py-2">Кредит</th>
                  <th className="px-3 py-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map(r=> (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2">{r.method||'—'}</td>
                    <td className="px-3 py-2 text-rose-600">{r.debit? `₴ ${fmtUA(r.debit)}` : '—'}</td>
                    <td className="px-3 py-2 text-emerald-700">{r.credit? `₴ ${fmtUA(r.credit)}` : (r.amount? `₴ ${fmtUA(r.amount)}` : '—')}</td>
                    <td className="px-3 py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Email dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Відправити фінансовий звіт на email</h3>
            <input 
              type="email" 
              value={emailInput} 
              onChange={e=>setEmailInput(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-xl border px-3 py-2 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <PillButton tone='slate' onClick={()=>setShowEmailDialog(false)}>Скасувати</PillButton>
              <PillButton tone='blue' onClick={handleEmail}>Відправити</PillButton>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

/*********** Order List Item (compact) ***********/
function OrderListItem({orderId, rows, onClick, isExpanded}){
  const orderRows = rows.filter(r=>r.order_id===orderId)
  const held = heldAmount(orderRows)
  const heldByCurrency = heldAmountByCurrency(orderRows)
  const due  = balanceDue(orderRows)
  const accrued = orderRows.filter(isRentOrCharge).reduce((s,r)=>s+(r.debit||0),0)
  const paid = orderRows.filter(isPayment).reduce((s,r)=>s+(r.credit||0),0)
  
  // Get client name and expected deposit from first transaction of this order
  const clientName = orderRows[0]?.client_name || ''
  const expectedDeposit = orderRows.length > 0 ? (orderRows[0].expected_deposit || 0) : 0
  
  // Format held amounts by currency for badge
  const heldDisplay = Object.entries(heldByCurrency)
    .filter(([, amt]) => amt > 0)
    .map(([curr, amt]) => {
      const symbol = curr === 'UAH' ? '₴' : curr === 'USD' ? '$' : '€'
      return `${symbol}${fmtUA(amt)}`
    })
    .join(' + ')

  return (
    <div 
      onClick={onClick}
      className={cls(
        'rounded-xl border p-4 cursor-pointer transition',
        isExpanded ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-lg">
            Замовлення #{orderId}
            {clientName && <span className="text-slate-600 font-normal ml-2">· {clientName}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {orderRows.length} транзакцій · Нараховано: ₴{fmtUA(accrued)} · Оплачено: ₴{fmtUA(paid)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {held > 0 && <Badge tone='blue'>Застава {heldDisplay || `₴${fmtUA(held)}`}</Badge>}
          {due > 0 ? (
            <Badge tone='amber'>Борг ₴{fmtUA(due)}</Badge>
          ) : (
            <Badge tone='green'>✓ Закрито</Badge>
          )}
          <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>
    </div>
  )
}

/*********** Ledger (tab 2) ***********/
function LedgerTable({rows}){
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr><th className="px-3 py-2">Дата</th><th className="px-3 py-2">Замовлення</th><th className="px-3 py-2">Тип</th><th className="px-3 py-2">Назва</th><th className="px-3 py-2">Метод</th><th className="px-3 py-2">Дебет</th><th className="px-3 py-2">Кредит</th></tr>
        </thead>
        <tbody>
          {rows.map(r=> (
            <tr key={r.id} className="border-t hover:bg-slate-50">
              <td className="px-3 py-2">{r.date}</td>
              <td className="px-3 py-2">#{r.order_id}</td>
              <td className="px-3 py-2">{r.type}</td>
              <td className="px-3 py-2">{r.title}</td>
              <td className="px-3 py-2">{r.method||'—'}</td>
              <td className="px-3 py-2 text-rose-600">{r.debit? `₴ ${fmtUA(r.debit)}` : '—'}</td>
              <td className="px-3 py-2 text-emerald-700">{r.credit? `₴ ${fmtUA(r.credit)}` : (r.amount? `₴ ${fmtUA(r.amount)}` : '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/*********** Monthly (tab 3) ***********/
function MonthlyArchive({rows}){
  const groups = useMemo(()=>{
    const m = new Map()
    rows.forEach(r=>{
      const key = (r.date||todayISO()).slice(0,7)
      const g = m.get(key) || {month:key, debit:0, credit:0, count:0}
      g.debit += (r.debit||0); g.credit += (r.credit||0); g.count += 1
      m.set(key,g)
    })
    return Array.from(m.values()).sort((a,b)=> a.month<b.month?1:-1)
  },[rows])
  return (
    <div className="space-y-3">
      {groups.map(g=> (
        <div key={g.month} className="rounded-xl border p-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">{g.month}</div>
            <div className="text-xs text-slate-500">записів: {g.count}</div>
          </div>
          <div className="text-sm">
            <span className="mr-4">Дебет: ₴ {fmtUA(g.debit)}</span>
            <span>Кредит: ₴ {fmtUA(g.credit)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/*********** main ***********/
export default function FinanceCabinet(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  // Load all transactions
  useEffect(()=>{
    loadTransactions()
  },[])

  const loadTransactions = async ()=>{
    try {
      setLoading(true)
      const res = await axios.get(`${BACKEND_URL}/api/manager/finance/ledger`)
      setRows(res.data.map(r=>({
        id: r.id,
        date: r.date,
        order_id: r.order_id,
        type: r.type,
        title: r.title,
        method: r.payment_method,
        debit: r.debit || 0,
        credit: r.credit || 0,
        amount: r.amount || 0,
        currency: r.currency || 'UAH',
        status: r.status,
        counterparty: r.counterparty,
        client_name: r.client_name,
        expected_deposit: r.expected_deposit || 0
      })))
    } catch(e){
      console.error('Error loading transactions:', e)
      alert('Помилка завантаження фінансових даних')
    } finally {
      setLoading(false)
    }
  }

  const addPayment = async (orderId, p)=>{
    try {
      const payload = {
        order_id: orderId,
        transaction_type: 'payment',
        payment_method: p.method,
        amount: Number(p.amount||0),
        currency: 'UAH',
        status: 'completed',
        description: `Оплата (${p.method})`,
        notes: p.note||''
      }
      await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, payload)
      await loadTransactions()
      alert('Оплату зараховано!')
    } catch(e){
      console.error('Error adding payment:', e)
      alert('Помилка при зарахуванні оплати')
    }
  }

  const addDeposit = async (orderId, dep)=>{
    try {
      const payload = {
        order_id: orderId,
        transaction_type: 'deposit_hold',
        payment_method: 'cash',
        amount: Number(dep.amount||0),
        currency: dep.code,
        status: 'held',
        description: `Застава (${dep.code})`,
        notes: ''
      }
      await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, payload)
      await loadTransactions()
      alert('Заставу прийнято!')
    } catch(e){
      console.error('Error adding deposit:', e)
      alert('Помилка при прийманні застави')
    }
  }

  const writeoff = async (orderId, amount)=>{
    try {
      // Create writeoff record
      await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, {
        order_id: orderId,
        transaction_type: 'deposit_writeoff',
        amount: amount,
        currency: 'UAH',
        status: 'completed',
        description: 'Списання із застави',
        notes: `Списано ₴${amount}`
      })
      // Create payment from deposit
      await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, {
        order_id: orderId,
        transaction_type: 'payment',
        payment_method: 'deposit',
        amount: amount,
        currency: 'UAH',
        status: 'completed',
        description: 'Оплата за рахунок застави'
      })
      await loadTransactions()
      alert('Списано з застави!')
    } catch(e){
      console.error('Error writeoff:', e)
      alert('Помилка при списанні')
    }
  }

  const releaseDeposit = async (orderId, amount)=>{
    try {
      await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, {
        order_id: orderId,
        transaction_type: 'deposit_release',
        amount: amount,
        currency: 'UAH',
        status: 'completed',
        description: 'Повернення застави',
        notes: `Повернено ₴${amount}`
      })
      await loadTransactions()
      alert('Заставу повернено!')
    } catch(e){
      console.error('Error release:', e)
      alert('Помилка при поверненні')
    }
  }

  const addDamage = async (orderId, dmg)=>{
    try {
      await axios.post(`${BACKEND_URL}/api/manager/finance/transactions`, {
        order_id: orderId,
        transaction_type: 'damage',
        amount: Number(dmg.amount||0),
        currency: 'UAH',
        status: 'unpaid',
        description: `Шкода: ${dmg.note||''}`
      })
      await loadTransactions()
      alert('Збитки нараховано!')
    } catch(e){
      console.error('Error adding damage:', e)
      alert('Помилка при нарахуванні збитків')
    }
  }

  const deleteOrder = async (orderId)=>{
    if(!window.confirm(`Видалити замовлення #${orderId}? Це також видалить всі пов'язані картки (Issue/Return).`)) return
    
    try {
      await axios.delete(`${BACKEND_URL}/api/orders/${orderId}`)
      await loadTransactions()
      setExpandedOrderId(null)
      alert('Замовлення видалено!')
    } catch(e){
      console.error('Error deleting order:', e)
      alert('Помилка при видаленні замовлення')
    }
  }

  const rowsFiltered = useMemo(()=> rows.sort((a,b)=> (b.date||'').localeCompare(a.date||'')),[rows])
  
  // Get unique order IDs
  const orderIds = useMemo(()=>{
    const ids = new Set(rows.map(r=>r.order_id))
    return Array.from(ids).sort((a,b)=>b-a)
  },[rows])

  if(loading) return <div className="flex items-center justify-center h-screen"><div className="text-xl">Завантаження...</div></div>

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Фінансовий кабінет</h1>
        <div className="flex gap-2">
          {['orders','ledger','monthly'].map(t => (
            <button key={t} onClick={()=>{setTab(t); setExpandedOrderId(null)}} className={cls('rounded-full px-3 py-1 text-sm', tab===t? 'bg-slate-900 text-white':'bg-slate-200 text-slate-800')}>
              {t==='orders'?'Замовлення':t==='ledger'?'Журнал':'Архів'}
            </button>
          ))}
        </div>
      </div>

      {tab==='orders' && (
        <div className="space-y-4">
          <Card title={`Список замовлень (${orderIds.length})`} right={<Badge tone='slate'>Клікни на замовлення для деталей</Badge>}>
            <div className="text-xs text-slate-500 mb-3">Показано всі замовлення з фінансовими транзакціями</div>
          </Card>

          {orderIds.map(orderId=> (
            <div key={orderId}>
              <OrderListItem 
                orderId={orderId} 
                rows={rowsFiltered} 
                onClick={()=>setExpandedOrderId(expandedOrderId===orderId? null : orderId)}
                isExpanded={expandedOrderId===orderId}
              />
              
              {expandedOrderId===orderId && (
                <div className="mt-4">
                  <OrderFinanceCard
                    orderId={orderId}
                    rows={rowsFiltered}
                    onAddPayment={addPayment}
                    onAddDeposit={addDeposit}
                    onWriteoff={writeoff}
                    onReleaseDeposit={releaseDeposit}
                    onAddDamage={addDamage}
                    onCollapse={()=>setExpandedOrderId(null)}
                    onDelete={deleteOrder}
                  />
                </div>
              )}
            </div>
          ))}

          {orderIds.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <div className="text-lg">Немає фінансових транзакцій</div>
              <div className="text-sm mt-2">Транзакції з'являться після прийняття замовлень</div>
            </div>
          )}
        </div>
      )}

      {tab==='ledger' && (
        <Card title="Повний журнал транзакцій">
          <LedgerTable rows={rowsFiltered} />
        </Card>
      )}

      {tab==='monthly' && (
        <Card title="Місячні підсумки та архів"><MonthlyArchive rows={rowsFiltered} /></Card>
      )}
    </div>
  )
}
