import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { getImageUrl } from '../utils/imageHelper'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

/************************ Utils ************************/
const cls = (...a)=> a.filter(Boolean).join(' ')
const fmtUA = (n)=> (Number(n)||0).toLocaleString('uk-UA', {maximumFractionDigits:2})
const todayISO = ()=> new Date().toISOString().slice(0,10)
const nowISO = ()=> new Date().toISOString()

/************************ Small UI ************************/
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

/*********************** Subcomponents ************************/ 
function Header({order, issueCard}){
  // Використовуємо статус з issue_card
  const statusMap = {
    'preparation': { text: 'На комплектації', tone: 'amber' },
    'ready': { text: 'Готово до видачі', tone: 'blue' },
    'issued': { text: 'Видано', tone: 'green' }
  }
  
  const statusInfo = statusMap[issueCard?.status] || { text: 'В обробці', tone: 'slate' }
  
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold">Видача · #{issueCard?.order_id || order.order_id}</div>
        <Badge tone={statusInfo.tone}>{statusInfo.text}</Badge>
      </div>
      <div className="flex flex-col items-end text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span>Дата видачі: <b>{order.rent_issue_date || todayISO()}</b></span>
          <span className="mx-1">·</span>
          <span>Повернення: <b>{order.rent_return_date || todayISO()}</b></span>
        </div>
        <div className="mt-1"><Badge tone='slate'>Замовлення від: {order.date_added?.slice(0,10) || '—'}</Badge></div>
      </div>
    </div>
  )
}

function CustomerBlock({order}){
  return (
    <Card title="Клієнт">
      <div className="grid gap-2 md:grid-cols-3 text-sm">
        <div><div className="text-slate-500">Імʼя</div><div className="font-medium">{order.firstname} {order.lastname}</div></div>
        <div><div className="text-slate-500">Телефон</div><div className="font-medium">{order.telephone}</div></div>
        <div><div className="text-slate-500">Email</div><div className="font-medium">{order.email}</div></div>
      </div>
    </Card>
  )
}

function FinanceSummary({order}){
  const total = parseFloat(order.total || 0)
  const prepay = parseFloat(order.prepayment || 0)
  const deposit = parseFloat(order.deposit || 0)
  const due = Math.max(0, total - prepay)
  
  return (
    <Card title="Фінанси" right={<Badge tone={due>0?'amber':'green'}>{due>0? `Залишок ₴ ${fmtUA(due)}`: 'Оплачено'}</Badge>}>
      <div className="grid gap-2 md:grid-cols-4 text-sm">
        <div><div className="text-slate-500">Сума оренди</div><div className="font-semibold">₴ {fmtUA(total)}</div></div>
        <div><div className="text-slate-500">Передплата</div><div className="font-semibold">₴ {fmtUA(prepay)}</div></div>
        <div><div className="text-slate-500">Холд застави</div><div className="font-semibold">₴ {fmtUA(deposit)}</div></div>
        <div><div className="text-slate-500">До сплати</div><div className="font-semibold">₴ {fmtUA(due)}</div></div>
      </div>
    </Card>
  )
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

function ItemRow({it, onScan, onPick, onOpenDamage}){
  const missing = it.qty - it.picked_qty
  const over = it.picked_qty > it.qty
  const conflict = missing>0 && (it.available - (it.reserved||0)) < it.qty
  const hasPreDamage = (it.pre_damage?.length||0) > 0
  
  // Фото товару
  const photoUrl = getImageUrl(it.image) || `https://picsum.photos/seed/${it.inventory_id}/60/40`
  
  // Клік на фото - відкрити каталог з цим товаром
  const handlePhotoClick = () => {
    window.open(`/catalog?product=${it.inventory_id}`, '_blank')
  }
  
  return (
    <tr className={cls('border-t', missing>0 && 'bg-amber-50')}> 
      {/* QR код - перша колонка */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-2">
          {/* QR код для переобліку */}
          <div className="flex items-center justify-center p-1 bg-white border border-slate-200 rounded-lg">
            <QRCodeSVG 
              value={`${window.location.origin}/inventory/${it.sku || it.id}`}
              size={60}
              level="L"
              includeMargin={false}
            />
          </div>
          <div className="text-[9px] text-center text-slate-400">Скан для переобліку</div>
          
          {/* Серійні номери (якщо є) */}
          {it.serials && it.serials.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {it.serials.map(s => (
                <button key={s} onClick={()=>onScan(it.id, s)} className={cls('rounded-md border px-2 py-0.5 text-xs', it.scanned.includes(s) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white hover:bg-slate-50')}>{s}</button>
              ))}
            </div>
          )}
        </div>
      </td>
      
      {/* Фото - друга колонка */}
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
          <button title="Додати пошкодження" onClick={()=>onOpenDamage(it.id)} className="rounded-md border px-2 py-0.5 text-xs hover:bg-slate-50">📷 +</button>
          {hasPreDamage && <Badge tone='amber'>{it.pre_damage.length} пошкоджень</Badge>}
        </div>
        <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-2">
          <LocationBadge state={it.location?.state} zone={it.location?.zone} />
          {conflict && <Badge tone='red'>Конфлікт резерву</Badge>}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
        ₴ {(it.damage_cost || 0).toLocaleString('uk-UA')}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-700">
        ₴ {(it.deposit || 0).toLocaleString('uk-UA')}
      </td>
      <td className="px-3 py-2">{it.available}</td>
      <td className="px-3 py-2">{it.reserved||0}</td>
      <td className="px-3 py-2">{it.in_rent||0}</td>
      <td className="px-3 py-2">{it.in_restore||0}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button onClick={()=>onPick(it.id, Math.max(0, it.picked_qty-1))} className="h-7 w-7 rounded-lg border hover:bg-slate-50">-</button>
          <div className={cls('w-10 text-center font-semibold', over && 'text-rose-600')}>{it.picked_qty}</div>
          <button onClick={()=>onPick(it.id, it.picked_qty+1)} className="h-7 w-7 rounded-lg border hover:bg-slate-50">+</button>
        </div>
        <div className="text-xs text-slate-500">потрібно: {it.qty}</div>
      </td>
      
      {/* Пакування - остання колонка */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5 text-xs">
          <label className="flex items-center gap-1 cursor-pointer hover:bg-slate-50 rounded px-1">
            <input type="checkbox" checked={it.packaging?.cover || false} onChange={(e)=>onPick(it.id, 'packaging_cover', e.target.checked)} className="h-3 w-3" />
            <span>Чохол</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:bg-slate-50 rounded px-1">
            <input type="checkbox" checked={it.packaging?.box || false} onChange={(e)=>onPick(it.id, 'packaging_box', e.target.checked)} className="h-3 w-3" />
            <span>Коробка</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:bg-slate-50 rounded px-1">
            <input type="checkbox" checked={it.packaging?.stretch || false} onChange={(e)=>onPick(it.id, 'packaging_stretch', e.target.checked)} className="h-3 w-3" />
            <span>Стретч</span>
          </label>
        </div>
      </td>
    </tr>
  )
}

function ItemsTable({items, onScan, onPick, onOpenDamage}){
  return (
    <Card title="Позиції до видачі">
      <div className="overflow-hidden rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">QR / Скан</th>
              <th className="px-3 py-2">Фото</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Назва / локація</th>
              <th className="px-3 py-2">Збиток</th>
              <th className="px-3 py-2">Застава</th>
              <th className="px-3 py-2">В наявн.</th>
              <th className="px-3 py-2">Резерв</th>
              <th className="px-3 py-2">В оренді</th>
              <th className="px-3 py-2">В реставр.</th>
              <th className="px-3 py-2">Укомплект.</th>
              <th className="px-3 py-2">Пакування</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => <ItemRow key={it.id} it={it} onScan={onScan} onPick={onPick} onOpenDamage={onOpenDamage} />)}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Checklist({check, setCheck}){
  return (
    <Card title="Чекліст перед видачою" right={<Badge tone={check.photos_before && check.docs_printed ? 'green':'amber'}>{check.photos_before && check.docs_printed ? 'готово' : 'в процесі'}</Badge>}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={check.stretch} onChange={e=>setCheck({...check, stretch:e.target.checked})}/> Стрейчування</label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={check.labels} onChange={e=>setCheck({...check, labels:e.target.checked})}/> Маркування/стікери</label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={check.photos_before} onChange={e=>setCheck({...check, photos_before:e.target.checked})}/> Фото стану (до видачі)</label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={check.docs_printed} onChange={e=>setCheck({...check, docs_printed:e.target.checked})}/> Роздруковано документи</label>
      </div>
    </Card>
  )
}

function Documents({orderId, docs, setDocs}){
  const handleDownloadPicklist = async () => {
    try {
      window.open(`${BACKEND_URL}/api/pdf/pick-list/${orderId}`, '_blank')
      setDocs({...docs, waybill:true})
    } catch(e){
      alert('Помилка завантаження pick-list')
    }
  }
  
  const handleDownloadInvoice = async () => {
    try {
      window.open(`${BACKEND_URL}/api/pdf/invoice/${orderId}`, '_blank')
      setDocs({...docs, act:true})
    } catch(e){
      alert('Помилка завантаження рахунку')
    }
  }
  
  return (
    <Card title="Документи">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PillButton tone='blue' onClick={handleDownloadPicklist}>Накладна (PDF)</PillButton>
        <PillButton tone='blue' onClick={handleDownloadInvoice}>Рахунок (PDF)</PillButton>
        <Badge tone={docs.waybill?'green':'slate'}>накладна: {docs.waybill? 'готова':'—'}</Badge>
        <Badge tone={docs.act?'green':'slate'}>рахунок: {docs.act? 'готовий':'—'}</Badge>
      </div>
    </Card>
  )
}

function Notes({notes, setNotes}){
  return (
    <Card title="Коментарі">
      <textarea value={notes||''} onChange={e=>setNotes(e.target.value)} className="w-full rounded-xl border p-3 text-sm" rows={3} placeholder="Службова нотатка"/>
    </Card>
  )
}

function Timeline({events}){
  return (
    <Card title="Таймлайн">
      <ol className="space-y-2 text-sm max-h-60 overflow-auto">
        {events.map((e,i)=> (
          <li key={i} className="flex items-start gap-2">
            <div className={cls('mt-1 h-2 w-2 rounded-full flex-shrink-0', e.tone==='green'?'bg-emerald-500':e.tone==='red'?'bg-rose-500':'bg-blue-500')} />
            <div className="flex-1">
              <div className="font-medium">{e.title}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{e.when}</span>
                {e.manager && (
                  <>
                    <span>·</span>
                    <span className="text-blue-600 font-medium">{e.manager}</span>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/*********************** Main ************************/ 
export default function IssueCard(){
  const { id } = useParams()  // issue_card.id з route параметра
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [order, setOrder] = useState(null)
  const [issueCard, setIssueCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState({ stretch:false, labels:false, photos_before:false, docs_printed:false })
  const [documents, setDocuments] = useState({ waybill:false, act:false })
  const [events, setEvents] = useState([])
  
  // Item damage modal
  const [itemDamage, setItemDamage] = useState({ open:false, item_id:null, kind:'подряпина', severity:'low', note:'', photoName:'' })

  // Функція для друку накладної
  const printWarehouseSlip = async () => {
    // Завантажити переобліки для всіх товарів
    let recountsMap = {}
    try {
      const skus = items.map(it => it.sku).filter(Boolean)
      if (skus.length > 0) {
        const recountsRes = await axios.post(`${BACKEND_URL}/api/products/inventory/recounts/batch`, { skus })
        recountsRes.data.forEach(rc => {
          recountsMap[rc.sku] = rc
        })
      }
    } catch (err) {
      console.error('Error loading recounts:', err)
    }

    const itemsRows = items.map((item, idx) => {
      const pkg = item.packaging || {}
      const coverCheck = pkg.cover ? '☑' : '☐'
      const boxCheck = pkg.box ? '☑' : '☐'
      const stretchCheck = pkg.stretch ? '☑' : '☐'
      
      // Перевірити чи є переобік для цього товару
      const recount = recountsMap[item.sku]
      const hasDamage = recount && recount.status === 'damaged'
      const damageNote = hasDamage ? recount.notes || `${recount.damage_type || 'Пошкодження'} (${recount.severity || 'low'})` : ''
      
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.sku || '—'}</td>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${item.picked_qty || 0}</td>
        <td>${item.location?.zone || '—'} · ${item.location?.shelf || '—'}</td>
        <td style="font-size: 9px;">
          ${hasDamage ? '☐' : '☑'} ОК<br/>
          ${hasDamage ? '☑' : '☐'} Є попередні пошкодження<br/>
          ${hasDamage ? `<span style="color: #d97706; font-size: 8px;">${damageNote}</span>` : ''}
        </td>
        <td>
          ${coverCheck} чохол  ${boxCheck} коробка<br/>
          ${stretchCheck} стретч ☐ інше: __________<br/>
          Примітка: __________________
        </td>
      </tr>
      `
    }).join('')

    const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <title>Накладна на комплектацію - Замовлення #${order.order_id}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      color: #0f172a;
      margin: 20px;
    }
    h1 {
      font-size: 18px;
      margin: 0;
    }
    .row { display: flex; justify-content: space-between; align-items: flex-start; }
    .mt-4 { margin-top: 16px; }
    .mt-2 { margin-top: 8px; }
    .mt-1 { margin-top: 4px; }
    .box {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      margin-top: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 4px 6px;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      text-align: left;
    }
    .small { font-size: 9px; color: #6b7280; }
    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      font-size: 10px;
    }
    .sign-block {
      width: 32%;
    }
    .sign-line {
      border-bottom: 1px solid #cbd5e1;
      height: 16px;
      margin-top: 4px;
      margin-bottom: 2px;
    }
    .checkbox-line {
      margin-bottom: 2px;
    }
    @media print {
      body { margin: 10px; }
    }
  </style>
</head>
<body>
  <!-- Шапка -->
  <div class="row">
    <div>
      <div style="font-weight:600; font-size:14px;">Farfor Decor / Farfor Rent</div>
      <h1>НАКЛАДНА НА КОМПЛЕКТАЦІЮ / ВИДАЧУ</h1>
      <div class="small">Внутрішній чек-лист складу</div>
    </div>
    <div style="text-align:right; font-size:10px;">
      <div><strong>№ замовлення:</strong> ${order.order_id || '—'}</div>
      <div class="mt-1"><strong>Дата комплектації:</strong> ${new Date().toLocaleDateString('uk-UA')}</div>
      <div class="mt-1"><strong>Час видачі:</strong> ${order.rent_issue_date || '—'}</div>
      <div class="mt-1"><strong>Тип видачі:</strong> самовивіз / доставка</div>
    </div>
  </div>

  <!-- Дані замовлення -->
  <div class="box mt-4">
    <div class="row">
      <div style="width:50%;">
        <div><strong>Клієнт:</strong> ${order.firstname || ''} ${order.lastname || ''}</div>
        <div class="mt-1"><strong>Телефон:</strong> ${order.telephone || '—'}</div>
        <div class="mt-1"><strong>Івент / опис:</strong> _______________________</div>
        <div class="mt-1"><strong>Декоратор / агентство:</strong> ______________</div>
      </div>
      <div style="width:46%; text-align:right;">
        <div><strong>Менеджер:</strong> _______________________</div>
        <div class="mt-1"><strong>Реквізитор (збір):</strong> ______________</div>
        <div class="mt-1"><strong>Повернення до:</strong> ${order.rent_return_date || '—'}</div>
        <div class="mt-1"><strong>Спосіб повернення:</strong> самовивіз / доставка / НП</div>
      </div>
    </div>
  </div>

  <!-- Чек-лист перед видачею -->
  <div class="box mt-2">
    <div style="font-weight:600; margin-bottom:4px;">Чек-лист перед видачею</div>
    <div class="checkbox-line">☐ Все замовлення зібране повністю (${items.reduce((s,it)=>s+it.picked_qty,0)}/${items.reduce((s,it)=>s+it.qty,0)} позицій)</div>
    <div class="checkbox-line">☐ Усі позиції з належним пакуванням (чохли / коробки / стретч)</div>
    <div class="checkbox-line">☐ Внесені існуючі пошкодження у блок «Пошкодження при видачі»</div>
    <div class="checkbox-line">☐ Доданий додатковий захист для крихких / дорогих позицій</div>
    <div class="checkbox-line">☐ Фото комплектації зроблено (за потреби)</div>
  </div>

  <!-- Таблиця комплектації -->
  <div class="box mt-4">
    <div style="font-weight:600; margin-bottom:4px;">Основні позиції замовлення (${items.length} поз.)</div>
    <table>
      <thead>
        <tr>
          <th style="width:3%;">№</th>
          <th style="width:10%;">SKU / Код</th>
          <th style="width:25%;">Назва</th>
          <th style="width:7%;">К-ть<br/>в замовл.</th>
          <th style="width:7%;">Зібрано</th>
          <th style="width:14%;">Зона / полиця</th>
          <th style="width:14%;">Статус при видачі</th>
          <th style="width:20%;">Пакування / примітка</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  <!-- Додаткові матеріали -->
  <div class="box mt-2">
    <div style="font-weight:600; margin-bottom:4px;">Додаткові матеріали / пакування</div>
    <table>
      <thead>
        <tr>
          <th style="width:30%;">Категорія</th>
          <th style="width:40%;">Що видано</th>
          <th style="width:10%;">К-ть</th>
          <th style="width:20%;">Примітка</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Стретч</td><td></td><td></td><td></td></tr>
        <tr><td>Картон / гофра</td><td></td><td></td><td></td></tr>
        <tr><td>Чохли текстильні</td><td></td><td></td><td></td></tr>
        <tr><td>Інше</td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>

  <!-- Пошкодження при видачі -->
  <div class="box mt-4">
    <div style="font-weight:600; margin-bottom:4px;">Пошкодження, зафіксовані при видачі</div>
    <table>
      <thead>
        <tr>
          <th style="width:10%;">SKU / Код</th>
          <th style="width:25%;">Назва</th>
          <th style="width:40%;">Опис пошкодження</th>
          <th style="width:15%;">Фото / позначка</th>
          <th style="width:10%;">Хто зафіксував</th>
        </tr>
      </thead>
      <tbody>
        <tr><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="small mt-1">
      *Все, що записано тут, не рахується новою шкодою при поверненні, якщо стан не погіршився.
    </div>
  </div>

  <!-- Підписи -->
  <div class="sign-row">
    <div class="sign-block">
      <div><strong>Замовлення зібрав (реквізитор)</strong></div>
      <div class="sign-line"></div>
      <div class="small">ПІБ / підпис / дата, час</div>
    </div>
    <div class="sign-block">
      <div><strong>Перевірив (менеджер)</strong></div>
      <div class="sign-line"></div>
      <div class="small">ПІБ / підпис / дата, час</div>
    </div>
    <div class="sign-block">
      <div><strong>Отримав (клієнт / довірена особа)</strong></div>
      <div class="sign-line"></div>
      <div class="small">ПІБ / підпис / дата, час</div>
    </div>
  </div>

  <div class="small mt-2">
    Ця накладна використовується як чек-лист комплектації. Фінансові взаєморозрахунки ведуться в системі та окремих документах.
  </div>

  <script>
    window.onload = function() {
      window.print();
      // Закрити вікно після друку (опціонально)
      // window.onafterprint = function() { window.close(); }
    }
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    printWindow.document.write(html)
    printWindow.document.close()
  }

  // Функція для друку QR кодів
  const printQRCodes = () => {
    const qrCodesHTML = items.map((item, idx) => {
      // URL для переходу до переобліку товару
      const qrData = `${window.location.origin}/inventory/${item.sku || item.id}`
      
      return `
        <div style="page-break-inside: avoid; display: inline-block; width: 48%; margin: 4px; padding: 10px; border: 1px dashed #cbd5e1; text-align: center;">
          <div style="font-size: 10px; font-weight: 600; margin-bottom: 4px;">${item.name}</div>
          <div style="font-size: 9px; color: #64748b; margin-bottom: 6px;">SKU: ${item.sku || '—'}</div>
          <div style="display: flex; justify-content: center; margin-bottom: 6px;">
            <canvas id="qr-${idx}"></canvas>
          </div>
          <div style="font-size: 8px; color: #94a3b8;">Відскануйте для переобліку</div>
        </div>
      `
    }).join('')

    const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <title>QR коди для товарів - Замовлення #${order.order_id}</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 15px;
    }
    h2 {
      font-size: 16px;
      margin-bottom: 10px;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    @media print {
      body { margin: 10px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>QR коди для товарів</h2>
    <div style="font-size: 11px; color: #64748b;">
      Замовлення: #${order.order_id} | Клієнт: ${order.firstname || ''} ${order.lastname || ''} | Всього позицій: ${items.length}
    </div>
  </div>
  
  <div style="display: flex; flex-wrap: wrap;">
    ${qrCodesHTML}
  </div>

  <script>
    window.onload = function() {
      ${items.map((item, idx) => {
        const qrData = `${window.location.origin}/inventory/${item.sku || item.id}`
        return `
        QRCode.toCanvas(document.getElementById('qr-${idx}'), '${qrData}', {
          width: 100,
          margin: 1
        });
        `
      }).join('\n')}
      
      setTimeout(() => {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    printWindow.document.write(html)
    printWindow.document.close()
  }

  useEffect(()=>{
    loadOrder()
  },[id])

  const loadOrder = async ()=>{
    try {
      setLoading(true)
      
      // Завантажуємо issue_card
      console.log('[IssueCard] Завантаження issue card з id:', id)
      const issueRes = await axios.get(`${BACKEND_URL}/api/issue-cards/${id}`)
      const issueCardData = issueRes.data
      console.log('[IssueCard] Issue card завантажено:', issueCardData)
      
      setIssueCard(issueCardData)
      
      // Тепер завантажуємо decor_order за order_id
      const orderId = issueCardData.order_id
      console.log('[IssueCard] Завантаження decor order з id:', orderId)
      
      let res, orderData
      try {
        res = await axios.get(`${BACKEND_URL}/api/decor-orders/${orderId}`)
        orderData = res.data
        console.log('[Issue] Order loaded from decor_orders:', orderData)
      } catch (decorErr) {
        // Якщо не знайдено в decor_orders, спробуємо OpenCart
        console.log('[Issue] Not in decor_orders, trying OpenCart...')
        res = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`)
        orderData = res.data
        console.log('[Issue] Order loaded from OpenCart:', orderData)
      }
      
      // Transform order data to match expected format
      const transformedOrder = {
        order_id: orderData.id || orderData.order_id,
        order_status_id: orderData.order_status_id || 19,
        decor_status: orderData.status, // Додаємо DecorOrder status
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
        manager_comment: orderData.notes || orderData.manager_comment || ''
      }
      
      setOrder(transformedOrder)
      setNotes(issueCardData.preparation_notes || orderData.notes || orderData.manager_comment || '')
      
      // Transform items - використовуємо items з issue_card, якщо є і не пусті, інакше з order
      const itemsSource = (issueCardData.items && issueCardData.items.length > 0) 
        ? issueCardData.items 
        : (orderData.items || [])
      const transformedItems = itemsSource.map((p, idx) => {
        const qty = parseInt(p.quantity || p.qty) || 0
        const serials = p.serials || []
        
        return {
          id: p.id || p.order_product_id || p.inventory_id || idx,
          sku: p.article || p.sku || p.model || '',
          name: p.name || p.product_name || '',
          image: p.image || p.photo || '',  // Додано image та photo
          qty: qty,
          picked_qty: p.picked_qty || 0, // Завжди починаємо з 0 щоб комірники бачили прогрес
          available: parseInt(p.available_qty || p.available) || 0,
          reserved: parseInt(p.reserved_qty || p.reserved) || 0,
          in_rent: parseInt(p.in_rent_qty || p.in_rent) || 0,
          in_restore: parseInt(p.in_restore_qty || p.in_restore) || 0,
          damage_cost: parseFloat(p.damage_cost || p.deposit || 0),  // Збиток (EAN)
          deposit: parseFloat(p.deposit || p.damage_cost || 0),  // Застава
          serials: serials,
          scanned: p.scanned || [],
          pack: p.pack || '',
          packaging: p.packaging || { cover: false, box: false, stretch: false },  // Пакування
          location: { zone: p.location?.zone || '', state: p.location?.state || 'shelf' },
          pre_damage: p.pre_damage || []
        }
      })
      
      console.log('Transformed items:', transformedItems)
      setItems(transformedItems)
      
      // Завантажити lifecycle events з backend
      try {
        const lifecycleRes = await axios.get(`${BACKEND_URL}/api/orders/${orderId}/lifecycle`)
        const lifecycleEvents = lifecycleRes.data || []
        console.log('[IssueCard] Lifecycle events:', lifecycleEvents)
        
        // Трансформувати lifecycle events в формат таймлайну
        const timelineEvents = lifecycleEvents.map(evt => ({
          title: evt.notes || evt.stage || 'Подія',
          when: evt.created_at || nowISO(),
          tone: evt.stage === 'accepted' ? 'green' : evt.stage === 'completed' ? 'green' : 'blue',
          manager: evt.created_by || evt.manager || null
        }))
        
        // Додати подію створення картки якщо немає lifecycle events
        if (timelineEvents.length === 0) {
          timelineEvents.push({
            title: 'Картку видачі створено',
            when: transformedOrder.date_added || nowISO(),
            tone: 'blue'
          })
        }
        
        setEvents(timelineEvents)
      } catch (lifecycleErr) {
        console.error('[IssueCard] Error loading lifecycle:', lifecycleErr)
        // Fallback до простої події
        setEvents([
          {title:'Картку видачі створено', when: transformedOrder.date_added || nowISO(), tone:'blue'}
        ])
      }
      
    } catch(e){
      console.error('Error loading order:', e)
      toast({
        title: '❌ Помилка',
        description: 'Не вдалося завантажити замовлення',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const onPick = (id, field, value) => {
    // Якщо field це число, то це picked_qty (зворотна сумісність)
    if (typeof field === 'number') {
      setItems(items => items.map(it => it.id === id ? {...it, picked_qty: field} : it))
      return
    }
    
    // Обробка пакування
    if (field.startsWith('packaging_')) {
      const packType = field.replace('packaging_', '')
      setItems(items => items.map(it => {
        if (it.id !== id) return it
        const packaging = it.packaging || {}
        return {...it, packaging: {...packaging, [packType]: value}}
      }))
    }
  }
  
  const onScan = (id, serial)=> setItems(items => items.map(it => {
    if(it.id!==id) return it
    const scanned = it.scanned.includes(serial) ? it.scanned.filter(s=>s!==serial) : [...it.scanned, serial]
    return {...it, scanned}
  }))

  const onOpenDamage = (item_id)=> setItemDamage({ open:true, item_id, kind:'подряпина', severity:'low', note:'', photoName:'' })

  const allPicked = useMemo(()=> items.every(it => it.picked_qty>=it.qty), [items])
  const allSerialsOk = useMemo(()=> items.every(it => it.serials.length===0 || it.scanned.length>=it.qty), [items])
  const checklistOk = useMemo(()=> checklist.photos_before && checklist.docs_printed, [checklist])
  
  // Для "Готово до видачі" - потребує всі товари зібрані + серійники + checklist
  const canMarkReady = allPicked && allSerialsOk && checklistOk
  
  // Для "Видати" - просто перевіряємо чи статус ready_for_issue
  const canIssue = order && (order.order_status_id === 3)

  // Determine if order is in processing stage (OpenCart status 2 or 19=pending)
  const isProcessing = order ? (order.order_status_id === 2 || order.order_status_id === 19) : false
  const isReadyForIssue = order ? (order.order_status_id === 3) : false
  const isIssued = order ? (order.order_status_id === 5 || order.order_status_id === 24) : false // 24 = on_rent in OpenCart
  
  // Debug logging
  console.log('[Issue] Button states:', {
    order_status_id: order?.order_status_id,
    isProcessing,
    isReadyForIssue,
    isIssued,
    canMarkReady,
    canIssue
  })

  const saveProgress = async ()=>{
    try {
      // Просто зберегти прогрес комплектування без зміни статусу
      await axios.put(`${BACKEND_URL}/api/issue-cards/${id}`, {
        items: items.map(it => ({
          id: it.id,
          sku: it.sku,
          name: it.name,
          qty: it.qty,
          picked_qty: it.picked_qty,
          scanned: it.scanned,
          location_zone: it.location_zone,
          location_state: it.location_state
        })),
        checklist: checklist,
        manager_notes: notes
      })
      toast({ title: '✅ Успіх', description: 'Прогрес комплектування збережено' })
    } catch(e){
      console.error('Error saving progress:', e)
      toast({ title: '❌ Помилка', description: 'Не вдалося зберегти прогрес', variant: 'destructive' })
    }
  }

  const markReady = async ()=>{
    try {
      // Зберегти прогрес + змінити статус на ready
      await saveProgress()
      
      if (!issueCard) {
        toast({ title: '❌ Помилка', description: 'Issue card не знайдено', variant: 'destructive' })
        return
      }
      
      // Оновити статус issue card на 'ready' (це також оновить DecorOrder на 'ready_for_issue')
      await axios.put(`${BACKEND_URL}/api/issue-cards/${issueCard.id}`, { 
        status: 'ready',
        prepared_by: 'Warehouse Staff'
      })
      
      setOrder(o=>({...o, order_status_id: 3, decor_status: 'ready_for_issue'}))
      setEvents(e=>[{title:'Укомплектовано і готово до видачі', when: nowISO(), tone:'blue'}, ...e])
      toast({ title: '✅ Успіх', description: 'Замовлення готове до видачі' })
      
      // Повернутися на dashboard після короткої затримки
      console.log('[IssueCard] Navigating to dashboard in 1.5s...')
      setTimeout(() => {
        console.log('[IssueCard] Navigating now...')
        navigate('/manager')
      }, 1500)
    } catch(e){
      console.error('Error marking ready:', e)
      toast({ title: '❌ Помилка', description: 'Не вдалося оновити статус', variant: 'destructive' })
    }
  }
  
  const markIssued = async ()=>{
    try {
      // Підготувати дані для завершення видачі
      const completeData = {
        issued_by: 'Manager',
        issue_notes: notes || ''
      }
      
      // Викликати endpoint для завершення видачі
      await axios.post(`${BACKEND_URL}/api/issue-cards/${id}/complete`, completeData)
      
      setOrder(o=>({...o, order_status_id: 24}))
      setEvents(e=>[{title:'Видано клієнту', when: nowISO(), tone:'green'}, ...e])
      
      toast({ title: '✅ Успіх', description: 'Замовлення видано клієнту. Return Card створено.' })
      
      // Navigate back after short delay
      setTimeout(()=> navigate('/'), 2000)
      
    } catch(e){
      console.error('Error marking issued:', e)
      toast({ title: '❌ Помилка', description: e.response?.data?.detail || 'Не вдалося підтвердити видачу', variant: 'destructive' })
    }
  }

  if(loading) return <div className="flex items-center justify-center h-screen"><div className="text-xl">Завантаження...</div></div>
  if(!order) return <div className="flex items-center justify-center h-screen"><div className="text-xl">Замовлення не знайдено</div></div>

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <Header order={order} issueCard={issueCard} />

      {/* Top summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CustomerBlock order={order} />
        <FinanceSummary order={order} />
        <Timeline events={events} />
      </div>

      <ItemsTable items={items} onScan={onScan} onPick={onPick} onOpenDamage={onOpenDamage} />
      
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Checklist check={checklist} setCheck={setChecklist} />
        <Documents orderId={order?.order_id} docs={documents} setDocs={setDocuments} />
      </div>
      
      <Notes notes={notes} setNotes={setNotes} />

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-600">
          Статус: <b>{isIssued ? 'issued' : isReadyForIssue ? 'ready_for_issue' : 'processing'}</b> · 
          <span className="ml-2">Позицій скомплектовано: {items.filter(it=>it.picked_qty>=it.qty).length}/{items.length}</span> ·
          <span className="ml-2">Одиниць: {items.reduce((s,it)=>s+it.picked_qty,0)}/{items.reduce((s,it)=>s+it.qty,0)}</span> ·
          <span className="ml-2">Серій відскановано: {items.reduce((s,it)=>s+(it.scanned?.length||0),0)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Завжди показуємо "Зберегти прогрес" якщо не видано */}
          {!isIssued && (
            <PillButton tone='slate' onClick={saveProgress}>💾 Зберегти прогрес</PillButton>
          )}
          
          {/* "Готово до видачі" - тільки під час комплектування */}
          {(isProcessing) && (
            <PillButton tone='yellow' onClick={markReady}>✅ Готово до видачі</PillButton>
          )}
          
          {/* "Підтвердити видачу" - коли готове до видачі */}
          {(isReadyForIssue) && (
            <PillButton tone='green' onClick={markIssued}>🚚 Підтвердити видачу</PillButton>
          )}
          
          {/* Badge якщо вже видано */}
          {isIssued && (
            <Badge tone='green'>✅ Видано клієнту</Badge>
          )}
          
          <PillButton tone='blue' onClick={printWarehouseSlip}>🖨️ Друк накладної</PillButton>
          <PillButton tone='purple' onClick={printQRCodes}>📱 Друк QR кодів</PillButton>
          <PillButton tone='slate' onClick={()=>navigate('/')}>Назад</PillButton>
        </div>
      </div>

      {/* Per-item damage modal */}
      {itemDamage.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Пошкодження · {items.find(i=>i.id===itemDamage.item_id)?.name || '—'}</h3>
              <button onClick={()=>setItemDamage(s=>({...s, open:false}))} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-slate-500 mb-1">Тип</div>
                  <select className="w-full rounded-xl border px-3 py-2" value={itemDamage.kind} onChange={e=>setItemDamage(s=>({...s, kind:e.target.value}))}>
                    <option>подряпина</option>
                    <option>скол</option>
                    <option>пляма</option>
                    <option>вмʼятина</option>
                  </select>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Рівень</div>
                  <select className="w-full rounded-xl border px-3 py-2" value={itemDamage.severity} onChange={e=>setItemDamage(s=>({...s, severity:e.target.value}))}>
                    <option value="low">низький</option>
                    <option value="mid">середній</option>
                    <option value="high">високий</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-slate-500 mb-1">Нотатка</div>
                <input className="w-full rounded-xl border px-3 py-2" value={itemDamage.note} onChange={e=>setItemDamage(s=>({...s, note:e.target.value}))} placeholder="Опишіть пошкодження…" />
              </div>

              <div>
                <div className="text-slate-500 mb-1">Фото</div>
                <input type="file" accept="image/*" onChange={(e)=>{
                  const f = e.target.files?.[0]
                  setItemDamage(s=>({...s, photoName: f? f.name : ''}))
                }} className="w-full rounded-xl border px-3 py-2" />
                {itemDamage.photoName && (<div className="mt-1 text-xs text-slate-500">Обрано: {itemDamage.photoName}</div>)}
              </div>

              <div className="flex justify-end gap-2">
                <PillButton tone='slate' onClick={()=>setItemDamage(s=>({...s, open:false}))}>Скасувати</PillButton>
                <PillButton tone='green' onClick={()=>{
                  const item_id = itemDamage.item_id
                  if(!item_id){ alert('Немає позиції'); return }
                  const id = 'pd-'+Math.floor(Math.random()*90000+100)
                  setItems(items => items.map(it=> it.id===item_id ? {
                    ...it,
                    pre_damage: [...(it.pre_damage||[]), { 
                      id, 
                      kind:itemDamage.kind, 
                      severity:itemDamage.severity, 
                      note:itemDamage.note, 
                      at: nowISO(), 
                      photoName:itemDamage.photoName 
                    }]
                  } : it))
                  setItemDamage({ open:false, item_id:null, kind:'подряпина', severity:'low', note:'', photoName:'' })
                  
                  toast({ title: '✅ Успіх', description: 'Пошкодження зафіксовано' })
                }}>Зафіксувати</PillButton>
              </div>
            </div>

            <div className="mt-4">
              <Card title="Історія пошкоджень по позиції">
                <div className="max-h-40 overflow-auto text-sm">
                  {(() => {
                    const it = items.find(i=>i.id===itemDamage.item_id)
                    if(!it || (it.pre_damage?.length||0)===0) return <div className="text-slate-500">Поки немає записів</div>
                    return (
                      <ul className="space-y-1">
                        {it.pre_damage.map(d=> (
                          <li key={d.id} className="text-xs border-b pb-1">
                            <Badge tone='amber'>{d.kind}</Badge> · <Badge tone={d.severity==='high'?'red':d.severity==='mid'?'amber':'slate'}>{d.severity}</Badge> · {d.note || '—'}
                            <div className="text-slate-400 mt-0.5">{d.at?.slice(0,16)} {d.photoName? `· 📷 ${d.photoName}`:''}</div>
                          </li>
                        ))}
                      </ul>
                    )
                  })()}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Helper hints */}
      <div className="text-xs text-slate-500 text-center">
        Підсвітка: рядки жовтого кольору — ще неукомплектовані; серійні номери клікабельні для скан/анскан.
      </div>
    </div>
  )
}
