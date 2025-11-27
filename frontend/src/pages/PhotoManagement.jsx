/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getImageUrl } from '../utils/imageHelper';
import ImageUpload from '../components/ImageUpload';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function PhotoManagement() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [filter, setFilter] = useState('all'); // all, with_photo, without_photo
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [filter, searchQuery]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/extended-catalog/all-products`, {
        params: {
          offset: 0,
          limit: 100,
          search: searchQuery || undefined
        }
      });

      let productsList = response.data.products || [];

      // Apply filter
      if (filter === 'without_photo') {
        productsList = productsList.filter(p => !p.image_url);
      } else if (filter === 'with_photo') {
        productsList = productsList.filter(p => p.image_url);
      }

      setProducts(productsList);
      setHasMore(productsList.length >= 100);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (sku, newImageUrl) => {
    // Update product in list
    setProducts(products.map(p => 
      p.sku === sku ? { ...p, image_url: newImageUrl } : p
    ));
    
    // Update selected product if it's open
    if (selectedProduct?.sku === sku) {
      setSelectedProduct({ ...selectedProduct, image_url: newImageUrl });
    }
  };

  const ProductCard = ({ product }) => (
    <div 
      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition cursor-pointer"
      onClick={() => setSelectedProduct(product)}
    >
      <div className="flex gap-4">
        <div className="w-24 h-24 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
          {product.image_url ? (
            <img 
              src={getImageUrl(product.image_url)}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="12" fill="%2394a3b8"%3ENo Image%3C/text%3E%3C/svg%3E';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              Немає фото
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 truncate">{product.name}</h3>
          <p className="text-sm text-slate-500 mt-1">SKU: {product.sku}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
              Є: {product.quantity || 0} шт
            </span>
            {!product.image_url && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                ⚠️ Без фото
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProduct(product);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          📸 Фото
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">📸 Кабінет переобліку</h1>
              <p className="text-slate-600">Керування фотографіями товарів</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              ← Назад
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Пошук по назві або SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Всі товари
            </button>
            <button
              onClick={() => setFilter('without_photo')}
              className={`px-4 py-2 rounded-lg text-sm ${
                filter === 'without_photo'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ⚠️ Без фото
            </button>
            <button
              onClick={() => setFilter('with_photo')}
              className={`px-4 py-2 rounded-lg text-sm ${
                filter === 'with_photo'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ✓ З фото
            </button>
          </div>
        </div>

        {/* Products List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Завантаження товарів...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500">Товари не знайдені</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(product => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedProduct(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">SKU: {selectedProduct.sku}</p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <ImageUpload
                sku={selectedProduct.sku}
                currentImageUrl={selectedProduct.image_url}
                onUploadSuccess={(newImageUrl) => {
                  handleUploadSuccess(selectedProduct.sku, newImageUrl);
                }}
              />

              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Категорія:</span>
                    <p className="font-medium">{selectedProduct.category_name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">В наявності:</span>
                    <p className="font-medium">{selectedProduct.quantity || 0} шт</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ціна оренди:</span>
                    <p className="font-medium">{selectedProduct.rental_price || 0} ₴</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Локація:</span>
                    <p className="font-medium">
                      {selectedProduct.zone || '—'} / {selectedProduct.aisle || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
