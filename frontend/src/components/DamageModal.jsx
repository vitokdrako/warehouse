 
/**
 * DamageModal - Universal component for recording product damage
 * Can be used in: IssueCard, ReturnOrderClean, InventoryRecount
 */
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { DAMAGE_RULES, defaultFeeFor } from '../utils/damageRules'
import MobilePhotoCapture from './MobilePhotoCapture'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

function Badge({tone, children}){
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tones[tone]||tones.slate}`}>{children}</span>
}

function PillButton({tone, onClick, children}){
  const tones={
    slate:'bg-slate-800 hover:bg-slate-900 text-white',
    green:'bg-emerald-600 hover:bg-emerald-700 text-white',
  }
  return <button onClick={onClick} className={`rounded-full px-4 py-2 text-sm ${tones[tone]||tones.slate}`}>{children}</button>
}

function Card({title, children}){
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      {children}
    </div>
  )
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
    qty: 1,  // Кількість пошкоджених одиниць
    photoName: ''
  })
  
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setFormData({
        category: 'Меблі',
        kindCode: '',
        severity: 'low',
        note: '',
        fee: 0,
        qty: 1,
        photoName: ''
      })
      setPhotos([])
    }
  }, [isOpen])
  
  if (!isOpen || !item) return null
  
  const categories = Object.keys(DAMAGE_RULES)
  const selectedCat = DAMAGE_RULES[formData.category] || {groups:[]}
  const kinds = selectedCat.groups
  const selectedKind = kinds.find(k=>k.code===formData.kindCode)
  
  const stageLabels = {
    'pre_issue': 'ДО видачі',
    'return': 'При поверненні',
    'audit': 'При аудиті'
  }
  
  const handleSave = async () => {
    if (!formData.kindCode) {
      alert('Оберіть тип пошкодження')
      return
    }
    
    setSaving(true)
    
    // Розрахунок загальної суми: ціна за одиницю × кількість
    const totalFee = formData.fee * formData.qty
    
    try {
      const damageRecord = {
        id: 'pd-' + Math.floor(Math.random()*90000+100),
        kind: formData.kindCode,
        category: formData.category,
        severity: formData.severity,
        note: formData.note,
        fee: totalFee,  // Загальна сума
        fee_per_item: formData.fee,  // Ціна за одиницю
        qty: formData.qty,  // Кількість пошкоджених
        at: new Date().toISOString(),
        photoName: formData.photoName
      }
      
      // Save to damage history API
      await axios.post(`${BACKEND_URL}/api/product-damage-history/`, {
        product_id: item.inventory_id || item.id,
        sku: item.sku,
        product_name: item.name,
        category: formData.category,
        order_id: order?.order_id,
        order_number: order?.order_number,
        stage: stage,
        damage_type: selectedKind?.label || formData.kindCode,
        damage_code: formData.kindCode,
        severity: formData.severity,
        fee: totalFee,  // Загальна сума (ціна × кількість)
        fee_per_item: formData.fee,  // Ціна за одиницю
        qty: formData.qty,  // Кількість пошкоджених одиниць
        photo_url: formData.photoName,
        note: formData.note,
        created_by: 'manager' // TODO: get from auth context
      })
      
      console.log(`[DamageModal] Saved damage record for ${item.sku} at stage ${stage}`)
      
      // Call parent callback
      if (onSave) {
        onSave(damageRecord)
      }
      
      onClose()
      
      // Success notification
      if (window.toast) {
        window.toast({ 
          title: '✅ Успіх', 
          description: 'Пошкодження зафіксовано та збережено в історію' 
        })
      }
      
    } catch (error) {
      console.error('[DamageModal] Error saving:', error)
      alert('❌ Помилка збереження пошкодження')
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl max-h-[90vh] overflow-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            Пошкодження {stageLabels[stage] || stage} · {item.sku} · {item.name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-slate-700 text-xl"
          >
            ✕
          </button>
        </div>

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
                className="w-full rounded-xl border px-3 py-2" 
                value={formData.kindCode} 
                onChange={e=>{
                  const code=e.target.value
                  const k = kinds.find(x=>x.code===code)
                  setFormData(prev=>({...prev, kindCode:code, fee: defaultFeeFor(k)}))
                }}
              >
                <option value="">— оберіть —</option>
                {kinds.map(k=> <option key={k.code} value={k.code}>{k.label}</option>)}
              </select>
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
            <PillButton tone='green' onClick={handleSave}>
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
                        <Badge tone='amber'>{d.category}</Badge> · 
                        <Badge tone={d.severity==='high'?'red':d.severity==='medium'?'amber':'slate'}>
                          {d.severity}
                        </Badge> · 
                        ₴{d.fee} · {d.note || '—'}
                        <div className="text-slate-400 mt-0.5">
                          {d.at?.slice(0,16)} {d.photoName? `· 📷 ${d.photoName}`:''}
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
