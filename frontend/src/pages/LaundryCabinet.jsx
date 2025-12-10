import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Calendar, Package, TrendingUp, AlertCircle, CheckCircle2, Clock, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LaundryCabinet = () => {
  const [batches, setBatches] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Завантажити партії
  const fetchBatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      
      const response = await axios.get(`${BACKEND_URL}/api/laundry/batches`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBatches(response.data);
    } catch (error) {
      console.error('Помилка завантаження партій:', error);
    }
  };

  // Завантажити статистику
  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/laundry/statistics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStatistics(response.data);
    } catch (error) {
      console.error('Помилка завантаження статистики:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBatches(), fetchStatistics()]);
      setLoading(false);
    };
    
    loadData();
  }, [filterStatus]);

  // Видалити партію
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Видалити партію? Товари повернуться на склад.')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_URL}/api/laundry/batches/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Партію видалено');
      fetchBatches();
      fetchStatistics();
    } catch (error) {
      alert('Помилка видалення: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Закрити партію
  const handleCompleteBatch = async (batchId) => {
    if (!window.confirm('Закрити партію?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/laundry/batches/${batchId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Партію закрито');
      fetchBatches();
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Статус badge
  const getStatusBadge = (status) => {
    const statusMap = {
      sent: { label: 'Відправлено', variant: 'secondary' },
      partial_return: { label: 'Часткове повернення', variant: 'default' },
      returned: { label: 'Повернено', variant: 'outline' },
      completed: { label: 'Закрито', variant: 'outline' }
    };
    
    const config = statusMap[status] || statusMap.sent;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Завантаження...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🧺 Управління Хімчисткою</h1>
          <p className="text-gray-600 mt-1">Відстеження текстилю у хімчистці</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Нова партія
        </Button>
      </div>

      {/* Статистика */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Всього партій</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics.total_batches}</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Активні партії</p>
                  <p className="text-2xl font-bold text-orange-600">{statistics.active_batches}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Відправлено товарів</p>
                  <p className="text-2xl font-bold text-purple-600">{statistics.total_items_sent}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Вартість</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.total_cost.toFixed(2)} ₴</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Фільтри */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {['all', 'sent', 'partial_return', 'returned', 'completed'].map(status => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'Всі' :
               status === 'sent' ? 'Відправлено' :
               status === 'partial_return' ? 'Часткове повернення' :
               status === 'returned' ? 'Повернено' : 'Закрито'}
            </Button>
          ))}
        </div>
      </div>

      {/* Список партій */}
      <div className="space-y-4">
        {batches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Партій не знайдено</p>
            </CardContent>
          </Card>
        ) : (
          batches.map(batch => (
            <Card key={batch.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{batch.batch_number}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      🏢 {batch.laundry_company}
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(batch.status)}
                    <p className="text-sm text-gray-600 mt-2">
                      {batch.cost > 0 && `${batch.cost} ₴`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">📅 Відправлено</p>
                    <p className="font-medium">{new Date(batch.sent_date).toLocaleDateString('uk-UA')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">📆 Очікується</p>
                    <p className="font-medium">{new Date(batch.expected_return_date).toLocaleDateString('uk-UA')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">📦 Товарів</p>
                    <p className="font-medium">{batch.returned_items} / {batch.total_items}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(batch.returned_items / batch.total_items) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {batch.notes && (
                  <div className="bg-gray-50 p-3 rounded mb-4">
                    <p className="text-sm text-gray-700">{batch.notes}</p>
                  </div>
                )}

                {/* Товари в партії */}
                {batch.items && batch.items.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Товари:</p>
                    <div className="space-y-2">
                      {batch.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                          <div>
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-gray-600">{item.sku} • {item.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{item.returned_quantity} / {item.quantity} од.</p>
                            {item.condition_after && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {item.condition_after === 'clean' ? '✨ Чисто' : 
                                 item.condition_after === 'damaged' ? '⚠️ Пошкоджено' : item.condition_after}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Дії */}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedBatch(batch);
                      setShowReturnModal(true);
                    }}
                    disabled={batch.status === 'completed'}
                  >
                    Прийняти повернення
                  </Button>
                  
                  {batch.status === 'returned' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCompleteBatch(batch.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Закрити партію
                    </Button>
                  )}
                  
                  {batch.status === 'sent' && batch.returned_items === 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteBatch(batch.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Видалити
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Модалки створення та повернення */}
      {showCreateModal && (
        <CreateBatchModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => {
            setShowCreateModal(false);
            fetchBatches();
            fetchStatistics();
          }}
        />
      )}

      {showReturnModal && selectedBatch && (
        <ReturnItemsModal 
          batch={selectedBatch}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedBatch(null);
          }} 
          onSuccess={() => {
            setShowReturnModal(false);
            setSelectedBatch(null);
            fetchBatches();
            fetchStatistics();
          }}
        />
      )}
    </div>
  );
};

// ==================== Модалка створення партії ====================

const CreateBatchModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    laundry_company: '',
    expected_return_date: '',
    cost: '',
    notes: ''
  });
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Пошук товарів-текстилю
  const handleSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/products/search`, {
        params: { q: query, category: 'Текстиль' },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchResults(response.data);
    } catch (error) {
      console.error('Помилка пошуку:', error);
    }
  };

  // Додати товар
  const addItem = (product) => {
    const exists = items.find(i => i.product_id === product.product_id);
    if (exists) {
      alert('Цей товар вже доданий');
      return;
    }

    setItems([...items, {
      product_id: product.product_id,
      product_name: product.name,
      sku: product.sku,
      category: product.category_name || 'Текстиль',
      quantity: 1,
      condition_before: 'dirty'
    }]);
    
    setSearchQuery('');
    setSearchResults([]);
  };

  // Створити партію
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert('Додайте хоча б один товар');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/laundry/batches`, {
        ...formData,
        cost: parseFloat(formData.cost) || 0,
        items
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Партію створено');
      onSuccess();
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Нова партія в хімчистку</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Компанія хімчистки *</label>
              <Input 
                value={formData.laundry_company}
                onChange={(e) => setFormData({...formData, laundry_company: e.target.value})}
                required
                placeholder="Назва компанії"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Очікувана дата повернення *</label>
                <Input 
                  type="date"
                  value={formData.expected_return_date}
                  onChange={(e) => setFormData({...formData, expected_return_date: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Вартість послуги</label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Примітки</label>
              <textarea 
                className="w-full border rounded p-2"
                rows="2"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Додаткова інформація"
              />
            </div>

            {/* Пошук товарів */}
            <div>
              <label className="block text-sm font-medium mb-1">Додати товари *</label>
              <Input 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                placeholder="Пошук товарів (текстиль)..."
              />
              
              {searchResults.length > 0 && (
                <div className="border rounded mt-1 max-h-40 overflow-y-auto">
                  {searchResults.map(product => (
                    <div 
                      key={product.product_id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => addItem(product)}
                    >
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.sku}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Список доданих товарів */}
            {items.length > 0 && (
              <div className="border rounded p-3">
                <p className="font-medium mb-2">Додані товари ({items.length}):</p>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-gray-600">{item.sku}</p>
                      </div>
                      <Input 
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].quantity = parseInt(e.target.value) || 1;
                          setItems(newItems);
                        }}
                        className="w-20 mr-2"
                      />
                      <Button 
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Створення...' : 'Створити партію'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Скасувати</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==================== Модалка повернення товарів ====================

const ReturnItemsModal = ({ batch, onClose, onSuccess }) => {
  const [returns, setReturns] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const returnItems = Object.entries(returns)
      .filter(([_, data]) => data.quantity > 0)
      .map(([item_id, data]) => ({
        item_id,
        returned_quantity: data.quantity,
        condition_after: data.condition,
        notes: data.notes
      }));

    if (returnItems.length === 0) {
      alert('Вкажіть кількість повернених товарів');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${BACKEND_URL}/api/laundry/batches/${batch.id}/return-items`,
        returnItems,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Товари прийнято');
      onSuccess();
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Прийом товарів</h2>
          <p className="text-gray-600 mb-4">Партія: {batch.batch_number}</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {batch.items.map(item => {
              const remaining = item.quantity - item.returned_quantity;
              if (remaining <= 0) return null;

              return (
                <div key={item.id} className="border rounded p-3">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-gray-600 mb-2">{item.sku} • Залишок: {remaining} од.</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1">Кількість</label>
                      <Input 
                        type="number"
                        min="0"
                        max={remaining}
                        value={returns[item.id]?.quantity || 0}
                        onChange={(e) => setReturns({
                          ...returns,
                          [item.id]: {
                            ...returns[item.id],
                            quantity: parseInt(e.target.value) || 0,
                            condition: returns[item.id]?.condition || 'clean'
                          }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Стан</label>
                      <select 
                        className="w-full border rounded p-2"
                        value={returns[item.id]?.condition || 'clean'}
                        onChange={(e) => setReturns({
                          ...returns,
                          [item.id]: {
                            ...returns[item.id],
                            quantity: returns[item.id]?.quantity || 0,
                            condition: e.target.value
                          }
                        })}
                      >
                        <option value="clean">Чисто</option>
                        <option value="damaged">Пошкоджено</option>
                        <option value="lost">Втрачено</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Обробка...' : 'Прийняти товари'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Скасувати</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LaundryCabinet;
