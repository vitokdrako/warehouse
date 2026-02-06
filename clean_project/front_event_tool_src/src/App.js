import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BoardProvider, useBoard } from './context/BoardContext';
import DateRangePicker from './components/DateRangePicker';
import ProductCard from './components/ProductCard';
import BoardItemCard from './components/BoardItemCard';
import { MoodboardPage } from './moodboard';
import ProductFilters from './components/ProductFilters';
import CreateBoardModal from './components/CreateBoardModal';
import OrderCheckoutModal from './components/OrderCheckoutModal';
import UserProfile from './components/UserProfile';
import './App.css';
import api from './api/axios';

// Create a client
const queryClient = new QueryClient();

// Auth Components
const LoginPage = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstname: '',
    lastname: '',
    telephone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        window.location.href = '/';
      } else {
        await register(formData);
        alert('Реєстрація успішна! Тепер увійдіть.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Помилка входу/реєстрації');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: '#f3f3f3'}}>
      <div className="bg-white shadow-sm p-10 w-full max-w-md" style={{borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'}}>
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.svg" 
              alt="FarforDecor Logo" 
              style={{
                height: '60px',
                width: 'auto'
              }}
            />
          </div>
          {/* Company Name */}
          <h1 className="text-2xl font-bold mb-1" style={{color: '#333', letterSpacing: '0.05em'}}>
            FarforDecorOrenda
          </h1>
          <p className="text-xs" style={{color: '#999', marginTop: '8px', textTransform: 'uppercase'}}>Event Planning Platform</p>
        </div>

        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 fd-btn transition-all ${
              isLogin
                ? 'fd-btn-black'
                : 'fd-btn-secondary'
            }`}
            style={{padding: '9px 12px'}}
          >
            Вхід
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 fd-btn transition-all ${
              !isLogin
                ? 'fd-btn-black'
                : 'fd-btn-secondary'
            }`}
            style={{padding: '9px 12px'}}
          >
            Реєстрація
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Ім'я"
                value={formData.firstname}
                onChange={(e) =>
                  setFormData({ ...formData, firstname: e.target.value })
                }
                className="w-full fd-input"
                required={!isLogin}
              />
              <input
                type="text"
                placeholder="Прізвище"
                value={formData.lastname}
                onChange={(e) =>
                  setFormData({ ...formData, lastname: e.target.value })
                }
                className="w-full fd-input"
                required={!isLogin}
              />
              <input
                type="tel"
                placeholder="Телефон"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: e.target.value })
                }
                className="w-full fd-input"
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            required
            minLength={6}
          />

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full fd-btn fd-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
            style={{padding: '12px'}}
          >
            {loading ? 'Завантаження...' : isLogin ? 'Увійти' : 'Зареєструватися'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main Event Planner Page
const EventPlannerPage = () => {
  const { user, logout } = useAuth();
  const { activeBoard, setActiveBoard, isSidePanelOpen, toggleSidePanel } = useBoard();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colors, setColors] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [boards, setBoards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Завантажувати товари при зміні фільтрів АБО дат борду
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, searchTerm ? 300 : 0);
    
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedSubcategory, selectedColor, searchTerm, activeBoard?.rental_start_date, activeBoard?.rental_end_date]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Завантажити категорії (з кольорами та матеріалами) та борди паралельно
      const [categoriesData, boardsData] = await Promise.all([
        api.get('/event/categories').then(r => r.data),
        api.get('/event/boards').then(r => r.data),
      ]);
      
      // Нова структура: {categories: [...], colors: [...], materials: [...]}
      setCategories(categoriesData.categories || []);
      setColors(categoriesData.colors || []);
      setMaterials(categoriesData.materials || []);
      setBoards(boardsData);
      
      if (boardsData.length > 0) {
        setActiveBoard(boardsData[0]);
      }
      
      // Завантажити товари окремо
      await loadProducts();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      // Будуємо URL з фільтрами
      const params = new URLSearchParams();
      params.append('limit', '500');
      
      if (selectedCategory) {
        params.append('category_name', selectedCategory);
      }
      if (selectedSubcategory) {
        params.append('subcategory_name', selectedSubcategory);
      }
      if (selectedColor) {
        params.append('color', selectedColor);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Передаємо дати для перевірки доступності (як в RentalHub)
      if (activeBoard?.rental_start_date && activeBoard?.rental_end_date) {
        params.append('date_from', activeBoard.rental_start_date);
        params.append('date_to', activeBoard.rental_end_date);
      }
      
      const productsData = await api.get(`/event/products?${params.toString()}`).then(r => r.data);
      setProducts(productsData);
      setHasMore(productsData.length >= 500);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadMoreProducts = async () => {
    try {
      setLoadingMore(true);
      const currentCount = products.length;
      
      // Будуємо URL з фільтрами
      const params = new URLSearchParams();
      params.append('skip', currentCount.toString());
      params.append('limit', '200');
      
      if (selectedCategory) {
        params.append('category_name', selectedCategory);
      }
      if (selectedSubcategory) {
        params.append('subcategory_name', selectedSubcategory);
      }
      if (selectedColor) {
        params.append('color', selectedColor);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Передаємо дати для перевірки доступності
      if (activeBoard?.rental_start_date && activeBoard?.rental_end_date) {
        params.append('date_from', activeBoard.rental_start_date);
        params.append('date_to', activeBoard.rental_end_date);
      }
      
      const moreProducts = await api.get(`/event/products?${params.toString()}`).then(r => r.data);
      
      if (moreProducts.length === 0) {
        setHasMore(false);
      } else {
        setProducts([...products, ...moreProducts]);
      }
    } catch (error) {
      console.error('Failed to load more products:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreateBoard = async (boardData) => {
    try {
      const newBoard = await api.post('/event/boards', boardData).then(r => r.data);
      setBoards([newBoard, ...boards]);
      setActiveBoard(newBoard);
      setShowNewBoardModal(false);
    } catch (error) {
      console.error('Failed to create board:', error);
      alert('Помилка створення мудборду');
    }
  };

  const handleUpdateBoardDates = async (boardId, startDate, endDate) => {
    if (!startDate || !endDate) return;

    try {
      const updatedBoard = await api.patch(`/event/boards/${boardId}`, {
        rental_start_date: startDate,
        rental_end_date: endDate,
      }).then(r => r.data);
      
      setActiveBoard(updatedBoard);
      setBoards(boards.map(b => b.id === boardId ? updatedBoard : b));
    } catch (error) {
      console.error('Failed to update dates:', error);
      alert('Помилка оновлення дат');
    }
  };

  const handleSaveCanvas = async (canvasLayout) => {
    if (!activeBoard) return;

    try {
      const updatedBoard = await api.patch(`/event/boards/${activeBoard.id}`, {
        canvas_layout: canvasLayout,
      }).then(r => r.data);
      
      setActiveBoard(updatedBoard);
      setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
      setShowCanvas(false);
      alert('✅ Візуальний мудборд збережено!');
    } catch (error) {
      console.error('Failed to save canvas:', error);
      alert('Помилка збереження мудборду');
    }
  };

  const handleAddToBoard = async (product) => {
    if (!activeBoard) {
      alert('Спочатку створіть мудборд!');
      return;
    }

    try {
      await api.post(`/event/boards/${activeBoard.id}/items`, {
        product_id: product.product_id,
        quantity: 1,
      });
      
      // Reload active board
      const updatedBoard = await api.get(`/event/boards/${activeBoard.id}`).then(r => r.data);
      setActiveBoard(updatedBoard);
      
      // Update boards list
      setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Помилка додавання товару');
    }
  };

  const handleUpdateItem = async (itemId, updateData) => {
    if (!activeBoard) return;

    try {
      await api.patch(`/event/boards/${activeBoard.id}/items/${itemId}`, updateData);
      
      // Reload active board
      const updatedBoard = await api.get(`/event/boards/${activeBoard.id}`).then(r => r.data);
      setActiveBoard(updatedBoard);
      setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
    } catch (error) {
      console.error('Failed to update item:', error);
      throw error;
    }
  };

  const handleRemoveFromBoard = async (itemId) => {
    if (!activeBoard) return;

    try {
      await api.delete(`/event/boards/${activeBoard.id}/items/${itemId}`);
      
      // Reload active board
      const updatedBoard = await api.get(`/event/boards/${activeBoard.id}`).then(r => r.data);
      setActiveBoard(updatedBoard);
      setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  // Всі категорії - тепер приходять напряму з API з кількістю товарів
  const allCategories = categories;

  // Отримати підкатегорії для вибраної категорії (з API даних)
  const availableSubcategories = React.useMemo(() => {
    if (!selectedCategory) return [];
    const category = categories.find(c => c.name === selectedCategory);
    return category?.subcategories || [];
  }, [categories, selectedCategory]);

  // Кольори тепер приходять з API
  const availableColors = colors;

  // Reset subcategory when category changes
  useEffect(() => {
    setSelectedSubcategory(null);
  }, [selectedCategory]);

  // Фільтрація тепер на сервері, просто показуємо всі завантажені товари
  const filteredProducts = products;

  const calculateBoardTotal = () => {
    if (!activeBoard || !activeBoard.items) return 0;
    
    return activeBoard.items.reduce((total, item) => {
      const price = item.product?.rental_price || 0;
      const days = activeBoard.rental_days || 1;
      return total + (price * item.quantity * days);
    }, 0);
  };

  // Відправка замовлення
  const handleSubmitOrder = async (orderData) => {
    if (!activeBoard) {
      throw new Error('Мудборд не вибрано');
    }
    
    try {
      const response = await api.post(`/event/boards/${activeBoard.id}/convert-to-order`, orderData);
      const result = response.data;
      
      // Показати успішне повідомлення
      alert(`Замовлення ${result.order_number} успішно створено!\n\nМенеджер зв'яжеться з вами найближчим часом.`);
      
      // Оновити борд (він тепер converted)
      setActiveBoard({ ...activeBoard, status: 'converted', converted_to_order_id: result.order_id });
      setBoards(boards.map(b => 
        b.id === activeBoard.id 
          ? { ...b, status: 'converted', converted_to_order_id: result.order_id }
          : b
      ));
      
      setShowCheckoutModal(false);
      
      return result;
    } catch (error) {
      console.error('Order submission error:', error);
      throw new Error(error.response?.data?.detail || 'Помилка створення замовлення');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-600">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fd-header sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <img 
              src="/logo.svg" 
              alt="FarforDecor Logo" 
              className="fd-logo"
              style={{
                height: '40px',
                width: 'auto'
              }}
            />
            {/* Company Name - hidden on mobile */}
            <h1 className="text-xl font-bold hidden sm:block" style={{color: '#333', letterSpacing: '0.03em'}}>
              FarforDecorOrenda
            </h1>
            <div className="w-px h-5 hidden md:block" style={{background: '#e6e6e6'}}></div>
            <span className="text-xs hidden md:block" style={{color: '#999', textTransform: 'uppercase'}}>Event Planning Platform</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile: Cart badge */}
            <button
              onClick={toggleSidePanel}
              className="fd-btn fd-btn-secondary sm:hidden relative"
              style={{padding: '8px 12px'}}
            >
              <span>🛒</span>
              {activeBoard?.items?.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#333',
                  color: '#fff',
                  fontSize: '10px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {activeBoard.items.length}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="fd-btn fd-btn-secondary"
            >
              <span className="hidden sm:inline">Мої мудборди</span>
              <span className="sm:hidden">📋</span>
            </button>
            <span className="text-sm hidden md:block" style={{color: '#555'}}>
              {user?.firstname} {user?.lastname}
            </span>
            <button
              onClick={logout}
              className="fd-btn fd-btn-secondary"
            >
              <span className="hidden sm:inline">Вийти</span>
              <span className="sm:hidden">↪</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]" style={{background: '#f3f3f3'}}>
        {/* Catalog Section */}
        <div className={`flex-1 overflow-auto transition-all duration-300 ${isSidePanelOpen ? 'mr-96' : ''}`}>
          <div className="p-8">
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div style={{maxWidth: '600px'}}>
                <input
                  type="text"
                  placeholder="Розумний пошук: назва, артикул, категорія, колір, матеріал..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '1px solid #e5ecf3',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'Montserrat, Arial, sans-serif',
                    color: '#838182',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
              
              <ProductFilters
                categories={allCategories}
                subcategories={availableSubcategories}
                colors={availableColors}
                selectedCategory={selectedCategory}
                selectedSubcategory={selectedSubcategory}
                selectedColor={selectedColor}
                onCategoryChange={setSelectedCategory}
                onSubcategoryChange={setSelectedSubcategory}
                onColorChange={setSelectedColor}
              />
            </div>

            {/* Products Count */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm" style={{color: '#666'}}>
                Знайдено товарів: <span style={{fontWeight: 'bold', color: '#333'}}>{filteredProducts.length}</span>
                {(selectedCategory || selectedSubcategory || selectedColor || searchTerm) && (
                  <span style={{color: '#999'}}> (з {products.length} всього)</span>
                )}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  onAddToBoard={handleAddToBoard}
                  boardDates={{
                    startDate: activeBoard?.rental_start_date,
                    endDate: activeBoard?.rental_end_date,
                  }}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && filteredProducts.length > 0 && !searchTerm && !selectedCategory && !selectedSubcategory && !selectedColor && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMoreProducts}
                  disabled={loadingMore}
                  className="fd-btn fd-btn-black disabled:opacity-50"
                  style={{minWidth: '200px'}}
                >
                  {loadingMore ? 'Завантаження...' : 'Завантажити більше'}
                </button>
              </div>
            )}

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Товари не знайдено
              </div>
            )}
          </div>
        </div>

        {/* Side Panel - Event Board */}
        {isSidePanelOpen && (
          <div className="w-96 fd-side-panel flex flex-col fixed right-0 h-[calc(100vh-73px)]">
            {/* Compact Panel Header - Оптимізовано */}
            <div className="fd-side-header flex items-center justify-between" style={{padding: '14px 18px 10px', marginBottom: '0', borderBottom: '1px solid #f0f0f0'}}>
              <h2 className="fd-side-title" style={{fontSize: '13px'}}>МІЙ ІВЕНТ</h2>
              <button
                onClick={toggleSidePanel}
                className="fd-btn"
                style={{fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', background: 'none', border: 'none', padding: 0}}
              >
                згорнути
              </button>
            </div>

            {/* Compact Board Selector - Оптимізовано */}
            <div style={{padding: '12px 18px 12px', background: '#fafafa'}}>
              <select
                value={activeBoard?.id || ''}
                onChange={(e) => {
                  const board = boards.find(b => b.id === e.target.value);
                  setActiveBoard(board);
                }}
                className="w-full fd-select mb-2"
                style={{fontSize: '12px', padding: '8px 12px'}}
              >
                <option value="">Виберіть мудборд</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.board_name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewBoardModal(true)}
                className="w-full fd-btn fd-btn-primary"
                style={{padding: '8px 12px', fontSize: '11px'}}
              >
                + створити івент
              </button>
            </div>

            {/* Board Content */}
            {activeBoard ? (
              <>
                {/* Compact Board Info - Оптимізовано */}
                <div style={{padding: '12px 18px', borderBottom: '1px solid #f0f0f0'}}>
                  {/* Cover Image - Менше */}
                  {activeBoard.cover_image && (
                    <div style={{
                      width: '100%',
                      height: '80px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '10px',
                      background: '#f5f5f5'
                    }}>
                      <img 
                        src={activeBoard.cover_image} 
                        alt={activeBoard.board_name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <h3 className="font-bold mb-1" style={{fontSize: '13px', color: '#333', lineHeight: '1.3'}}>{activeBoard.board_name}</h3>
                  <p className="fd-label mb-2" style={{fontSize: '10px'}}>
                    {activeBoard.event_date || 'Дата не вказана'}
                  </p>
                  
                  {/* Компактний DateRangePicker */}
                  <DateRangePicker
                    startDate={activeBoard.rental_start_date}
                    endDate={activeBoard.rental_end_date}
                    onStartDateChange={(date) => handleUpdateBoardDates(activeBoard.id, date, activeBoard.rental_end_date)}
                    onEndDateChange={(date) => handleUpdateBoardDates(activeBoard.id, activeBoard.rental_start_date, date)}
                  />
                  
                  {activeBoard.rental_days && (
                    <p className="text-center mt-1" style={{fontSize: '10px', color: '#999'}}>
                      {activeBoard.rental_days} днів оренди
                    </p>
                  )}
                </div>

                {/* Items List - Більше місця для товарів */}
                <div className="flex-1 overflow-auto" style={{padding: '12px 12px'}}>
                  {activeBoard.items && activeBoard.items.length > 0 ? (
                    <div className="space-y-2">
                      {activeBoard.items.map((item) => (
                        <BoardItemCard
                          key={item.id}
                          item={item}
                          boardDates={{
                            startDate: activeBoard.rental_start_date,
                            endDate: activeBoard.rental_end_date,
                          }}
                          rentalDays={activeBoard.rental_days}
                          onUpdate={handleUpdateItem}
                          onRemove={handleRemoveFromBoard}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p style={{fontSize: '14px', fontWeight: '600', marginBottom: '6px'}}>Мудборд порожній</p>
                      <p style={{fontSize: '12px'}}>Додайте товари з каталогу</p>
                    </div>
                  )}
                </div>

                {/* Compact Summary - Оптимізовано */}
                <div style={{padding: '14px 18px', borderTop: '1px solid #f0f0f0', background: '#fafafa'}}>
                  {/* Інфо в один рядок */}
                  <div className="flex justify-between items-center mb-3" style={{fontSize: '11px'}}>
                    <span style={{color: '#666'}}>
                      Позицій: <strong style={{color: '#333'}}>{activeBoard.items?.length || 0}</strong>
                    </span>
                    <span style={{color: '#666'}}>
                      Разом: <strong style={{color: '#333', fontSize: '13px'}}>₴{calculateBoardTotal().toFixed(2)}</strong>
                    </span>
                  </div>
                  
                  {/* Кнопки */}
                  <button 
                    onClick={() => setShowCanvas(true)}
                    className="w-full fd-btn fd-btn-primary mb-2"
                    disabled={!activeBoard.items || activeBoard.items.length === 0}
                    style={{padding: '9px 12px', fontSize: '11px'}}
                  >
                    Візуальний мудборд
                  </button>
                  <button 
                    className="w-full fd-btn fd-btn-black" 
                    style={{padding: '9px 12px', fontSize: '11px'}}
                    onClick={() => setShowCheckoutModal(true)}
                    disabled={!activeBoard.items || activeBoard.items.length === 0 || activeBoard.status === 'converted'}
                  >
                    {activeBoard.status === 'converted' ? 'Замовлення оформлено' : 'Оформити замовлення'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="fd-empty" style={{textAlign: 'center'}}>
                  <div style={{fontSize: '16px', fontWeight: '600', color: '#999', marginBottom: '12px'}}>
                    Створіть перший мудборд
                  </div>
                  <div className="fd-empty-text" style={{fontSize: '13px', color: '#999', lineHeight: '1.6'}}>
                    Додавайте позиції з каталогу ліворуч,<br/>щоб зібрати підбірку для клієнта
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toggle button when panel is closed */}
        {!isSidePanelOpen && (
          <button
            onClick={toggleSidePanel}
            className="fixed right-0 top-1/2 transform -translate-y-1/2 fd-btn-black px-3 py-10 z-20"
            style={{boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '4px 0 0 4px'}}
          >
            <span className="transform rotate-90 inline-block fd-uppercase">Мудборд</span>
          </button>
        )}
      </div>
      
      {/* Order Checkout Modal */}
      {activeBoard && (
        <OrderCheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          board={activeBoard}
          items={activeBoard.items || []}
          totalPrice={calculateBoardTotal()}
          depositAmount={calculateBoardTotal() * 0.3}
          rentalDays={activeBoard.rental_days || 1}
          onSubmit={handleSubmitOrder}
        />
      )}

      {/* New Board Modal */}
      {showNewBoardModal && (
        <CreateBoardModal
          onClose={() => setShowNewBoardModal(false)}
          onCreateBoard={handleCreateBoard}
        />
      )}

      {/* Moodboard Canvas - Новий модуль */}
      {showCanvas && activeBoard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: '#fff'
        }}>
          <MoodboardPage
            board={activeBoard}
            boardItems={activeBoard.items || []}
            onSave={async (scene) => {
              try {
                await handleSaveCanvas(scene);
                alert('Мудборд збережено!');
              } catch (error) {
                alert('Помилка збереження');
              }
            }}
            onBack={() => setShowCanvas(false)}
            onOpenCatalog={() => setShowCanvas(false)}
          />
        </div>
      )}
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-600">Завантаження...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Main App
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BoardProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <EventPlannerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </BoardProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
