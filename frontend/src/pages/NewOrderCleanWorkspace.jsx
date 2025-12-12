/* eslint-disable */
/**
 * New Order Clean - Створення нового замовлення (DRAFT)
 * Використовує уніфіковану систему Order Workspace
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/use-toast'
import axios from 'axios'

import {
  OrderWorkspaceLayout,
  LeftRailClient,
  LeftRailFinance,
  LeftRailTimeline,
} from '../components/order-workspace'

import {
  ZoneClientForm,
  ZonePlanDates,
  ZoneItemsEditor,
  ZoneCommercialSummary,
  ZoneDeliverySetup,
  ZoneDepositSetup,
  ZoneNotes,
} from '../components/order-workspace/zones'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''

export default function NewOrderClean() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // === СТАН ФОРМИ ===
  // Клієнт
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientType, setClientType] = useState('retail')
  const [discount, setDiscount] = useState(0)
  const [manager, setManager] = useState('Вікторія')
  
  // Дати
  const [issueDate, setIssueDate] = useState('')
  const [issueTime, setIssueTime] = useState('11:30–12:00')
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('до 17:00')
  const [rentalDays, setRentalDays] = useState(1)
  
  // Позиції
  const [items, setItems] = useState([{ sku: '', name: '', qty: 1, price: 0 }])
  const [inventory, setInventory] = useState([])
  const [loadingInventory, setLoadingInventory] = useState(false)
  
  // Доставка
  const [deliveryType, setDeliveryType] = useState('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  
  // Застава
  const [depositAmount, setDepositAmount] = useState(0)
  const [depositMethod, setDepositMethod] = useState('Картка (холд)')
  const [depositRelease, setDepositRelease] = useState('Після приймання')
  const [depositNote, setDepositNote] = useState('')
  
  // Нотатки
  const [notes, setNotes] = useState('')
  
  // Стан збереження
  const [saving, setSaving] = useState(false)
  
  // Таймлайн подій
  const [events] = useState([
    { text: 'Створено чернетку', at: new Date().toLocaleString('uk-UA'), tone: 'blue', user: 'Система' }
  ])
  
  // === ЗАВАНТАЖЕННЯ ІНВЕНТАРЮ ===
  useEffect(() => {
    loadInventory()
  }, [])
  
  const loadInventory = async () => {
    try {
      setLoadingInventory(true)
      const response = await axios.get(`${BACKEND_URL}/api/inventory`)
      setInventory(response.data)
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setLoadingInventory(false)
    }
  }
  
  // === РОЗРАХУНКИ ===
  const calculations = useMemo(() => {
    const days = rentalDays || 1
    
    const totalRent = items.reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.qty || 1) * days)
    }, 0)
    
    const discountAmount = (totalRent * discount) / 100
    const rentAfterDiscount = totalRent - discountAmount
    
    // Оціночна застава = 1.5x від оренди
    const estimatedDeposit = totalRent * 1.5
    
    return {
      totalRent,
      discountAmount,
      rentAfterDiscount,
      estimatedDeposit,
      itemsCount: items.filter(i => i.name).length
    }
  }, [items, rentalDays, discount])
  
  // Оновлення застави при зміні розрахунків
  useEffect(() => {
    if (depositAmount === 0 && calculations.estimatedDeposit > 0) {
      setDepositAmount(Math.round(calculations.estimatedDeposit))
    }
  }, [calculations.estimatedDeposit])
  
  // === ОБРОБНИКИ ===
  const handleAddItem = () => {
    setItems([...items, { sku: '', name: '', qty: 1, price: 0 }])
  }
  
  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }
  
  const handleUpdateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }
  
  const handleDatesUpdate = (dates) => {
    setIssueDate(dates.issueDate)
    setReturnDate(dates.returnDate)
    setIssueTime(dates.issueTime)
    setReturnTime(dates.returnTime)
    setRentalDays(dates.rentalDays)
  }
  
  const handleDeliveryUpdate = (delivery) => {
    setDeliveryType(delivery.deliveryType)
    setDeliveryAddress(delivery.address)
    setDeliveryInstructions(delivery.instructions)
  }
  
  const handleDepositUpdate = (deposit) => {
    setDepositAmount(deposit.amount)
    setDepositMethod(deposit.method)
    setDepositRelease(deposit.releaseCondition)
    setDepositNote(deposit.note)
  }
  
  // === СТВОРЕННЯ ЗАМОВЛЕННЯ ===
  const handleCreateOrder = async () => {
    // Валідація
    if (!clientName || !clientPhone) {
      toast({
        title: '❌ Помилка',
        description: 'Заповніть ім\'я та телефон клієнта',
        variant: 'destructive',
      })
      return
    }
    
    if (!issueDate || !returnDate) {
      toast({
        title: '❌ Помилка',
        description: 'Виберіть дати видачі та повернення',
        variant: 'destructive',
      })
      return
    }
    
    const validItems = items.filter(i => i.name && i.price > 0)
    if (validItems.length === 0) {
      toast({
        title: '❌ Помилка',
        description: 'Додайте хоча б одну позицію',
        variant: 'destructive',
      })
      return
    }
    
    setSaving(true)
    
    try {
      const days = rentalDays || 1
      
      const orderData = {
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || undefined,
        issue_date: issueDate,
        return_date: returnDate,
        manager_comment: notes || undefined,
        discount_percent: discount || 0,
        items: validItems.map(i => {
          const totalRental = (i.price || 0) * (i.qty || 1) * days
          const depositPerItem = (i.price || 0) * 2
          const totalDeposit = depositPerItem * (i.qty || 1)
          
          return {
            inventory_id: i.sku || `TEMP-${Date.now()}`,
            name: i.name,
            article: i.sku || 'CUSTOM',
            quantity: i.qty || 1,
            price_per_day: i.price || 0,
            deposit: depositPerItem,
            total_rental: totalRental,
            total_deposit: totalDeposit
          }
        })
      }
      
      const response = await axios.post(`${BACKEND_URL}/api/orders`, orderData)
      
      toast({
        title: '✅ Успіх',
        description: `Замовлення #${response.data.order_number} створено`,
      })
      
      setTimeout(() => navigate('/'), 1000)
    } catch (error) {
      console.error('Error creating order:', error)
      const errorMsg = error.response?.data?.detail || 'Не вдалося створити замовлення'
      toast({
        title: '❌ Помилка',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }
  
  // === РЕНДЕР ===
  return (
    <OrderWorkspaceLayout
      orderId="new"
      orderNumber="НОВЕ"
      status="DRAFT"
      issueDate={issueDate}
      returnDate={returnDate}
      headerTitle="Нове замовлення"
      backUrl="/manager"
      loading={false}
      
      // Left Rail
      leftRail={
        <>
          <LeftRailClient
            name={clientName || 'Новий клієнт'}
            phone={clientPhone}
            email={clientEmail}
            tier="new"
          />
          <LeftRailFinance
            rentAmount={calculations.rentAfterDiscount}
            depositAmount={depositAmount || calculations.estimatedDeposit}
            discount={discount}
            isPaid={false}
          />
          <LeftRailTimeline events={events} />
          
          {/* Додаткова панель: Доставка */}
          <ZoneDeliverySetup
            deliveryType={deliveryType}
            address={deliveryAddress}
            instructions={deliveryInstructions}
            onUpdate={handleDeliveryUpdate}
          />
          
          {/* Додаткова панель: Застава */}
          <ZoneDepositSetup
            amount={depositAmount}
            method={depositMethod}
            releaseCondition={depositRelease}
            note={depositNote}
            estimatedAmount={Math.round(calculations.estimatedDeposit)}
            onUpdate={handleDepositUpdate}
          />
        </>
      }
      
      // Footer
      onPrimaryAction={handleCreateOrder}
      primaryLabel="Створити замовлення"
      primaryDisabled={saving || !clientName || !clientPhone || !issueDate || !returnDate}
      primaryDisabledReason={!clientName ? 'Вкажіть клієнта' : !issueDate ? 'Вкажіть дати' : ''}
      onSave={() => toast({ title: 'Чернетка збережена' })}
      saving={saving}
      footerActions={[
        { label: '📄 Попередній перегляд', onClick: () => {} }
      ]}
    >
      {/* === WORKSPACE ZONES === */}
      
      {/* Клієнт */}
      <ZoneClientForm
        clientName={clientName}
        clientPhone={clientPhone}
        clientEmail={clientEmail}
        clientType={clientType}
        manager={manager}
        discount={discount}
        onUpdate={(data) => {
          setClientName(data.name)
          setClientPhone(data.phone)
          setClientEmail(data.email)
          setClientType(data.type)
          setManager(data.manager)
          setDiscount(data.discount)
        }}
      />
      
      {/* Дати */}
      <ZonePlanDates
        issueDate={issueDate}
        returnDate={returnDate}
        issueTime={issueTime}
        returnTime={returnTime}
        rentalDays={rentalDays}
        onUpdate={handleDatesUpdate}
      />
      
      {/* Позиції */}
      <ZoneItemsEditor
        items={items}
        inventory={inventory}
        rentalDays={rentalDays}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onUpdateItem={handleUpdateItem}
        loadingInventory={loadingInventory}
      />
      
      {/* Комерційна зведена */}
      <ZoneCommercialSummary
        rentAmount={calculations.totalRent}
        depositAmount={depositAmount || calculations.estimatedDeposit}
        discountPercent={discount}
        rentalDays={rentalDays}
        itemsCount={calculations.itemsCount}
      />
      
      {/* Нотатки */}
      <ZoneNotes
        notes={notes}
        onUpdateNotes={setNotes}
        title="📝 Коментар до замовлення"
        hint="Текст для складу / менеджера"
      />
    </OrderWorkspaceLayout>
  )
}
