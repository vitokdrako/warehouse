
/**
 * DamageModal - Universal component for recording product damage
 * 
 * ЛОГІКА:
 * - stage='pre_issue': Спрощена форма - тільки опис + фото, БЕЗ нарахування
 * - stage='return': Повна форма з категоріями, типами та нарахуванням
 * - stage='audit': Повна форма для аудиту
 */
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { DAMAGE_RULES, TOTAL_LOSS_OPTION, defaultFeeFor } from '../utils/damageRules'
import MobilePhotoCapture from './MobilePhotoCapture'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

function Badge({tone, children}){
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tones[tone]||tones.slate}`}>{children}</span>
}

function PillButton({tone, onClick, children, disabled}){
  const tones={
    slate:'bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-400',
    green:'bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-400',
    blue:'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400',
  }
  return <button onClick={onClick} disabled={disabled} className={`rounded-full px-4 py-2 text-sm ${tones[tone]||tones.slate}`}>{children}</button>
}

function Card({title, children}){
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      {children}
    </div>
  )
}

// Отримати ім'я користувача з localStorage
function getCurrentUserName() {
  try {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      return user.name || user.email || 'Невідомий'
    }
  } catch (e) {
    console.warn('Could not get user name:', e)
  }
  return 'Невідомий'
}

export default function DamageModal({
  isOpen,
  onClose,
  item,  // { id, sku, name, inventory_id, pre_damage: [] }
  order, // { order_id, order_number }
  stage, // 'pre_issue', 'return', 'audit'
  onSave, // Callback after saving
  existingHistory = [] // Optional: existing damage history to display
}) {
  const [formData, setFormData] = useState({
    category: 'Меблі',
    kindCode: '',
    severity: 'low',
    note: '',
    fee: 0,
    qty: 1,
    photoName: ''
  })
  
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [preIssueDamages, setPreIssueDamages] = useState([])
  const [loadingDamages, setLoadingDamages] = useState(false)
  
  // Для pre_issue - спрощена форма
  const isPreIssue = stage === 'pre_issue'
  
  // Завантаження існуючих pre_issue пошкоджень при відкритті
  useEffect(() => {
    if (isOpen && order?.order_id) {
      loadPreIssueDamages()
    }
  }, [isOpen, order?.order_id])
  
  const loadPreIssueDamages = async () => {
    if (!order?.order_id) return
    
    setLoadingDamages(true)
    try {
      const res = await axios.get(`${BACKEND_URL}/api/product-damage-history/order/${order.order_id}/pre-issue`)
      const damages = res.data.pre_issue_damages || []
      // Фільтруємо тільки для поточного товару якщо item вказано
      if (item?.inventory_id || item?.id) {
        const productId = item.inventory_id || item.id
        setPreIssueDamages(damages.filter(d => d.product_id == productId))
      } else {
        setPreIssueDamages(damages)
      }
    } catch (err) {
      console.warn('Could not load pre-issue damages:', err)
      setPreIssueDamages([])
    } finally {
      setLoadingDamages(false)
    }
  }
  
  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setFormData({
        category: 'Меблі',
        kindCode: isPreIssue ? 'pre_existing' : '',
        severity: 'low',
        note: '',
        fee: 0,
        qty: 1,
        photoName: ''
      })
      setPhotos([])
    }
  }, [isOpen, isPreIssue])
  
  if (!isOpen || !item) return null
  
  const categories = Object.keys(DAMAGE_RULES)
  const selectedCat = DAMAGE_RULES[formData.category] || {groups:[]}
  // Додаємо "Повна втрата" на початок списку типів
  const kinds = [TOTAL_LOSS_OPTION, ...selectedCat.groups]
  const selectedKind = kinds.find(k=>k.code===formData.kindCode)
  
  // Ціна купівлі товару (для повної втрати)
  const itemPurchasePrice = item?.damage_cost || item?.price || item?.full_price || 0
  
  // Обробка вибору типу пошкодження
  const handleKindChange = (code) => {
    const k = kinds.find(x=>x.code===code)
    let fee = defaultFeeFor(k)
    
    // Якщо "Повна втрата" - автоматично ставимо ціну купівлі
    if (code === 'TOTAL_LOSS' && itemPurchasePrice > 0) {
      fee = itemPurchasePrice
    }
    
    setFormData(prev=>({...prev, kindCode: code, fee: fee, severity: code === 'TOTAL_LOSS' ? 'critical' : prev.severity}))
  }
  
  const stageLabels = {
    'pre_issue': '📦 ДО видачі (фіксація)',
    'return': '📥 При поверненні',
    'audit': '📋 При аудиті'
  }
  
  const handleSave = async () => {
    // Для pre_issue обов'язковий тільки опис
    if (!isPreIssue && !formData.kindCode) {
      alert('Оберіть тип пошкодження')
      return
    }
    
    if (isPreIssue && !formData.note.trim()) {
      alert('Опишіть пошкодження')
      return
    }
    
    setSaving(true)
    
    // Для pre_issue - fee завжди 0
    const totalFee = isPreIssue ? 0 : formData.fee * formData.qty
    const userName = getCurrentUserName()
    
    try {
      // Завантажуємо фото на сервер, якщо є
      let uploadedPhotoUrl = ''
      if (photos.length > 0) {
        try {
          const formDataUpload = new FormData()
          formDataUpload.append('file', photos[0])
          // Передаємо order_number та sku для формування імені файлу
          if (order?.order_number) {
            formDataUpload.append('order_number', order.order_number)
          }
          if (item?.sku) {
            formDataUpload.append('sku', item.sku)
          }
          
          const uploadResponse = await axios.post(
            `${BACKEND_URL}/api/product-damage-history/upload-photo`,
            formDataUpload,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          )
          
          if (uploadResponse.data.success) {
            uploadedPhotoUrl = uploadResponse.data.url
            console.log(`[DamageModal] Photo uploaded: ${uploadedPhotoUrl}`)
          }
        } catch (uploadErr) {
          console.warn('[DamageModal] Photo upload failed:', uploadErr)
          // Продовжуємо без фото
        }
      }
      
      const damageRecord = {
        id: 'pd-' + Math.floor(Math.random()*90000+100),
        kind: isPreIssue ? 'pre_existing' : formData.kindCode,
        category: formData.category,
        severity: formData.severity,
        note: formData.note,
        fee: totalFee,
        fee_per_item: isPreIssue ? 0 : formData.fee,
        qty: formData.qty,
        at: new Date().toISOString(),
        photoName: uploadedPhotoUrl || formData.photoName,
        created_by: userName
      }
      
      // Визначаємо чи це повна втрата
      const isTotalLoss = formData.kindCode === 'TOTAL_LOSS'
      
      // Save to damage history API
      const response = await axios.post(`${BACKEND_URL}/api/product-damage-history/`, {
        product_id: item.inventory_id || item.id,
        sku: item.sku,
        product_name: item.name,
        category: formData.category,
        order_id: order?.order_id,
        order_number: order?.order_number,
        stage: stage,
        damage_type: isPreIssue ? 'Існуюча шкода' : (selectedKind?.label || formData.kindCode),
        damage_code: isPreIssue ? 'pre_existing' : formData.kindCode,
        severity: formData.severity,
        fee: totalFee,
        fee_per_item: isPreIssue ? 0 : formData.fee,
        qty: formData.qty,
        photo_url: uploadedPhotoUrl || formData.photoName,
        note: formData.note,
        created_by: userName,
        // Для повної втрати - обробити як втрату
        is_total_loss: isTotalLoss,
        processing_type: isPreIssue ? 'none' : 'none'
      })
      
      console.log(`[DamageModal] Saved damage record for ${item.sku} at stage ${stage}`, response.data)
      
      // Якщо повна втрата - зменшити кількість товару
      if (isTotalLoss) {
        try {
          await axios.post(`${BACKEND_URL}/api/partial-returns/process-loss`, {
            product_id: item.inventory_id || item.id,
            sku: item.sku,
            name: item.name,
            qty: formData.qty,
            loss_amount: totalFee,
            order_id: order?.order_id,
            order_number: order?.order_number
          })
          console.log(`[DamageModal] Processed total loss: ${item.sku} x${formData.qty}`)
        } catch (lossErr) {
          console.warn('[DamageModal] Failed to process loss:', lossErr)
        }
      }
      
      // Call parent callback
      if (onSave) {
        onSave(damageRecord)
      }
      
      onClose()
      
      // Success notification
      if (window.toast) {
        window.toast({ 
          title: isPreIssue ? '📝 Зафіксовано' : '✅ Успіх', 
          description: isPreIssue 
            ? `Існуючу шкоду зафіксовано (не нараховується клієнту). Виявив: ${userName}`
            : response.data?.charged_to_client 
              ? `Шкоду зафіксовано та нараховано клієнту: ₴${totalFee}`
              : 'Шкоду зафіксовано (вже була при видачі - не нараховується)'
        })
      }
      
    } catch (error) {
      console.error('[DamageModal] Error saving:', error)
      alert('❌ Помилка збереження пошкодження')
    } finally {
      setSaving(false)
    }
  }
  
  // ========================================
  // СПРОЩЕНА ФОРМА ДЛЯ PRE_ISSUE
  // ========================================
  if (isPreIssue) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-blue-800">
                📦 Фіксація шкоди ДО видачі
              </h3>
              <p className="text-xs text-blue-600 mt-1">
                {item.sku} · {item.name}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-500 hover:text-slate-700 text-xl"
            >
              ✕
            </button>
          </div>
          
          {/* Інформаційний банер */}
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="text-lg">ℹ️</span>
              <div className="text-xs text-blue-700">
                <strong>Тільки фіксація!</strong> Ця шкода НЕ буде нарахована клієнту.
                <br />Вкажіть опис та додайте фото для документації.
              </div>
            </div>
          </div>
          
          {/* Перегляд вже зафіксованих пошкоджень */}
          {preIssueDamages.length > 0 && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-600">📋</span>
                <span className="text-sm font-semibold text-amber-800">
                  Вже зафіксовано ({preIssueDamages.length})
                </span>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {preIssueDamages.map((d, idx) => (
                  <div key={d.id || idx} className="text-xs bg-white rounded-lg p-2 border border-amber-100">
                    <div className="flex items-start gap-2">
                      {d.photo_url && (
                        <img 
                          src={d.photo_url} 
                          alt="Фото" 
                          className="w-12 h-12 object-cover rounded cursor-pointer"
                          onClick={() => window.open(d.photo_url, '_blank')}
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-amber-900">{d.damage_type || 'Пошкодження'}</div>
                        {d.note && <div className="text-slate-600 mt-0.5">{d.note}</div>}
                        <div className="text-slate-400 mt-1 flex items-center gap-2">
                          <span>👤 {d.created_by || 'Невідомо'}</span>
                          <span>•</span>
                          <span>{d.created_at}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {loadingDamages && (
            <div className="mb-4 text-center text-sm text-slate-500">
              Завантаження...
            </div>
          )}

          <div className="grid gap-3 text-sm">
            {/* Опис - обов'язковий */}
            <div>
              <div className="text-slate-500 mb-1">Опис пошкодження *</div>
              <textarea 
                className="w-full rounded-xl border px-3 py-2 min-h-[80px]" 
                value={formData.note} 
                onChange={e=>setFormData(prev=>({...prev, note:e.target.value}))} 
                placeholder="Опишіть існуюче пошкодження: що, де, наскільки помітно..."
                autoFocus
              />
            </div>
            
            {/* Фото */}
            <div>
              <MobilePhotoCapture
                onPhotosCapture={(capturedPhotos) => {
                  setPhotos(capturedPhotos)
                  setFormData(prev => ({
                    ...prev, 
                    photoName: capturedPhotos.length > 0 ? capturedPhotos[0].name : ''
                  }))
                }}
                maxPhotos={3}
                label="Фото пошкодження"
                allowMultiple={true}
                compact={true}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-2">
              <PillButton tone='slate' onClick={onClose}>
                Скасувати
              </PillButton>
              <PillButton tone='blue' onClick={handleSave} disabled={saving || !formData.note.trim()}>
                {saving ? '⏳ Збереження...' : '📝 Зафіксувати шкоду'}
              </PillButton>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // ========================================
  // ПОВНА ФОРМА ДЛЯ RETURN / AUDIT
  // ========================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl max-h-[90vh] overflow-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {stageLabels[stage] || stage} · {item.sku} · {item.name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-slate-700 text-xl"
          >
            ✕
          </button>
        </div>
        
        {/* Шкода зафіксована при видачі - для порівняння */}
        {stage === 'return' && preIssueDamages.length > 0 && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600">📦</span>
              <span className="text-sm font-semibold text-blue-800">
                Шкода з етапу видачі ({preIssueDamages.length}) — не нараховується повторно
              </span>
            </div>
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {preIssueDamages.map((d, idx) => (
                <div key={d.id || idx} className="text-xs bg-white/70 rounded px-2 py-1 border border-blue-100">
                  <span className="font-medium">{d.damage_type}</span>
                  {d.note && <span className="text-slate-500"> — {d.note}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 text-sm">
          {/* Category & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-slate-500 mb-1">Категорія</div>
              <select 
                className="w-full rounded-xl border px-3 py-2" 
                value={formData.category} 
                onChange={e=>setFormData(prev=>({...prev, category:e.target.value, kindCode:'', fee:0}))}
              >
                {categories.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Тип</div>
              <select 
                className={`w-full rounded-xl border px-3 py-2 ${formData.kindCode === 'TOTAL_LOSS' ? 'border-red-400 bg-red-50' : ''}`}
                value={formData.kindCode} 
                onChange={e => handleKindChange(e.target.value)}
              >
                <option value="">— оберіть —</option>
                {kinds.map(k => (
                  <option 
                    key={k.code} 
                    value={k.code}
                    className={k.isTotalLoss ? 'font-bold text-red-600' : ''}
                  >
                    {k.label}
                  </option>
                ))}
              </select>
              {formData.kindCode === 'TOTAL_LOSS' && (
                <div className="mt-1 text-xs text-red-600 font-medium">
                  ⚠️ Товар буде списано з залишків!
                </div>
              )}
            </div>
          </div>
          
          {/* Severity, Quantity & Fee */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-slate-500 mb-1">Рівень</div>
              <select 
                className="w-full rounded-xl border px-3 py-2" 
                value={formData.severity} 
                onChange={e=>setFormData(prev=>({...prev, severity:e.target.value}))}
              >
                <option value="low">низький</option>
                <option value="medium">середній</option>
                <option value="high">високий</option>
                <option value="critical">критичний</option>
              </select>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Кількість</div>
              <input 
                className="w-full rounded-xl border px-3 py-2" 
                type="number" 
                min="1"
                value={formData.qty} 
                onChange={e=>setFormData(prev=>({...prev, qty: Math.max(1, Number(e.target.value)||1)}))} 
              />
              {item?.quantity > 1 && (
                <div className="mt-1 text-xs text-slate-400">
                  Макс: {item.quantity} шт
                </div>
              )}
            </div>
            <div>
              <div className="text-slate-500 mb-1">Ціна за 1 шт (грн)</div>
              <div className="flex gap-2">
                <input 
                  className="w-full rounded-xl border px-3 py-2" 
                  type="number" 
                  value={formData.fee} 
                  onChange={e=>setFormData(prev=>({...prev, fee:Number(e.target.value)||0}))} 
                />
                <button 
                  className="rounded-lg border px-2 hover:bg-slate-50 text-xs" 
                  onClick={()=> setFormData(prev=>({...prev, fee: defaultFeeFor(selectedKind)}))}
                  title="Авто-розрахунок"
                >
                  Авто
                </button>
              </div>
              {selectedKind && (selectedKind.percent ? (
                <div className="mt-1 text-xs text-amber-700">
                  Правило: {Math.round(selectedKind.percent*100)}% від повного збитку
                </div>
              ) : selectedKind.max==='full' ? (
                <div className="mt-1 text-xs text-amber-700">Можливе повне відшкодування</div>
              ) : selectedKind.range ? (
                <div className="mt-1 text-xs text-slate-500">
                  Діапазон: ₴ {selectedKind.range[0]} — ₴ {selectedKind.range[1]}
                </div>
              ) : selectedKind.min ? (
                <div className="mt-1 text-xs text-slate-500">Мінімум: ₴ {selectedKind.min}</div>
              ) : null)}
            </div>
          </div>
          
          {/* Загальна сума (авторозрахунок) */}
          {formData.qty > 1 && formData.fee > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 text-sm">💰 Загальна сума:</span>
                <span className="text-amber-900 font-bold text-lg">
                  ₴ {(formData.fee * formData.qty).toLocaleString('uk-UA')}
                </span>
              </div>
              <div className="text-xs text-amber-600 mt-1">
                {formData.qty} шт × ₴{formData.fee} = ₴{formData.fee * formData.qty}
              </div>
            </div>
          )}

          {/* Mobile Photo Capture */}
          <div className="mb-4">
            <MobilePhotoCapture
              onPhotosCapture={(capturedPhotos) => {
                setPhotos(capturedPhotos)
                setFormData(prev => ({
                  ...prev, 
                  photoName: capturedPhotos.length > 0 ? capturedPhotos[0].name : ''
                }))
              }}
              maxPhotos={3}
              label="Фото пошкодження"
              allowMultiple={true}
              compact={false}
            />
          </div>

          {/* Note */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <div className="text-slate-500 mb-1">Нотатка</div>
              <input 
                className="w-full rounded-xl border px-3 py-2" 
                value={formData.note} 
                onChange={e=>setFormData(prev=>({...prev, note:e.target.value}))} 
                placeholder="Опишіть проблему…" 
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-2">
            <PillButton tone='slate' onClick={onClose}>
              Скасувати
            </PillButton>
            <PillButton tone='green' onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Збереження...' : 'Зафіксувати'}
            </PillButton>
          </div>
        </div>

        {/* History Section */}
        {((item.pre_damage?.length > 0) || (existingHistory?.length > 0)) && (
          <div className="mt-4">
            <Card title="Історія пошкоджень по позиції">
              <div className="max-h-40 overflow-auto text-sm">
                {((item.pre_damage || existingHistory || []).length > 0) ? (
                  <ul className="space-y-1">
                    {(item.pre_damage || existingHistory || []).map(d=> (
                      <li key={d.id} className="text-xs border-b pb-1">
                        <Badge tone={d.stage === 'pre_issue' ? 'blue' : 'amber'}>{d.category}</Badge> · 
                        <Badge tone={d.severity==='high'?'red':d.severity==='medium'?'amber':'slate'}>
                          {d.severity}
                        </Badge> · 
                        {d.fee > 0 ? `₴${d.fee}` : 'Без нарахування'} · {d.note || '—'}
                        <div className="text-slate-400 mt-0.5">
                          {d.at?.slice(0,16)} {d.photoName? `· 📷 ${d.photoName}`:''} 
                          {d.created_by && ` · 👤 ${d.created_by}`}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-500">Поки немає записів</div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
