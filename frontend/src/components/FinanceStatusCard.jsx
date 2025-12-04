/* eslint-disable */
import React, { useState, useEffect } from 'react'
import axios from 'axios'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

const cls = (...a) => a.filter(Boolean).join(' ')
const fmtUA = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })

/******************** Badge ********************/
function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

/******************** FinanceStatusCard ********************/
export default function FinanceStatusCard({ orderId }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return

    // Завантажити транзакції для замовлення
    axios
      .get(`${BACKEND_URL}/api/finance/transactions?order_id=${orderId}`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : []
        setTransactions(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load transactions:', err)
        setLoading(false)
      })
  }, [orderId])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">⏳ Завантаження фінансової інформації...</div>
      </div>
    )
  }

  // Розрахунок фінансового статусу
  const depositTransactions = transactions.filter((t) => t.type?.includes('deposit'))
  const rentTransactions = transactions.filter((t) => t.type?.includes('rent') || t.type === 'payment')

  // Застава
  const depositExpected = depositTransactions.find((t) => t.type === 'deposit_expected')
  const depositReceived = depositTransactions.find((t) => t.type === 'deposit_hold' && t.status === 'completed')
  const depositStatus = depositReceived ? 'received' : depositExpected ? 'pending' : 'not_required'

  // Оплата оренди
  const rentAccrual = rentTransactions.find((t) => t.type === 'rent_accrual')
  const rentPaid = rentTransactions.find((t) => t.type === 'payment' && t.status === 'completed')
  const rentStatus = rentPaid ? 'paid' : rentAccrual ? 'pending' : 'not_required'

  // Суми
  const depositAmount = depositExpected?.amount || 0
  const rentAmount = rentAccrual?.amount || 0
  const totalPaid = transactions
    .filter((t) => t.status === 'completed' && (t.type === 'payment' || t.type === 'deposit_hold'))
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">💰 Фінансовий статус</h3>
        {totalPaid > 0 && <Badge tone="green">Оплачено ₴ {fmtUA(totalPaid)}</Badge>}
      </div>

      <div className="space-y-3">
        {/* Застава */}
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div>
            <div className="text-sm font-medium text-slate-700">Застава</div>
            <div className="text-xs text-slate-500">
              {depositStatus === 'received' && '✅ Залишено в касі'}
              {depositStatus === 'pending' && '⏳ Очікується'}
              {depositStatus === 'not_required' && '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">₴ {fmtUA(depositAmount)}</div>
            {depositStatus === 'received' && <Badge tone="green">Залишено</Badge>}
            {depositStatus === 'pending' && <Badge tone="amber">Очікується</Badge>}
          </div>
        </div>

        {/* Оплата оренди */}
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div>
            <div className="text-sm font-medium text-slate-700">Рахунок за оренду</div>
            <div className="text-xs text-slate-500">
              {rentStatus === 'paid' && '✅ Оплачено'}
              {rentStatus === 'pending' && '⏳ Очікується оплата'}
              {rentStatus === 'not_required' && '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">₴ {fmtUA(rentAmount)}</div>
            {rentStatus === 'paid' && <Badge tone="green">Оплачено</Badge>}
            {rentStatus === 'pending' && <Badge tone="red">Не оплачено</Badge>}
          </div>
        </div>

        {/* Історія транзакцій */}
        {transactions.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
              📋 Історія транзакцій ({transactions.length})
            </summary>
            <div className="mt-2 space-y-1">
              {transactions.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between border-l-2 border-slate-200 pl-2 py-1 text-xs">
                  <div>
                    <span className="font-medium text-slate-700">{getTransactionLabel(t.type)}</span>
                    <span className={cls('ml-2 rounded px-1.5 py-0.5', t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                      {t.status === 'completed' ? '✓' : '⏳'}
                    </span>
                  </div>
                  <div className="font-mono text-slate-600">
                    ₴ {fmtUA(t.amount)} {t.currency}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Загальний статус */}
        <div className="mt-4 border-t border-slate-200 pt-3">
          {depositStatus === 'received' && rentStatus === 'paid' ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-2xl">✅</span>
              <span className="font-medium text-green-700">Всі фінансові питання вирішені</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-2xl">⚠️</span>
              <span className="font-medium text-amber-700">
                {depositStatus === 'pending' && rentStatus === 'pending' && 'Очікується застава та оплата'}
                {depositStatus === 'received' && rentStatus === 'pending' && 'Очікується оплата рахунку'}
                {depositStatus === 'pending' && rentStatus === 'paid' && 'Очікується застава'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper для перекладу типів транзакцій
function getTransactionLabel(type) {
  const labels = {
    deposit_expected: 'Застава очікується',
    deposit_hold: 'Застава отримана',
    deposit_release: 'Застава повернута',
    deposit_writeoff: 'Списано з застави',
    rent_accrual: 'Оренда нараховано',
    payment: 'Оплата рахунку',
    refund: 'Повернення коштів',
  }
  return labels[type] || type
}
