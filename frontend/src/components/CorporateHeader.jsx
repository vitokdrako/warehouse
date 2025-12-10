import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CorporateHeader({ cabinetName = 'Кабінет менеджера', showBackButton = false, onBackClick = null }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate('/manager');
    }
  };

  return (
    <header className="corp-header sticky top-0 z-30">
      <div className="mx-auto max-w-7xl flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-corp-primary grid place-content-center text-white font-bold text-sm">
            RH
          </div>
          <div>
            <h1 className="text-lg font-semibold text-corp-text-dark">Rental Hub</h1>
            <p className="text-xs text-corp-text-muted">{cabinetName}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-corp-bg-light rounded-corp border border-corp-border">
            <div className="h-8 w-8 rounded-full bg-corp-gold grid place-content-center text-white text-xs font-semibold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="text-sm">
              <div className="font-medium text-corp-text-dark">{user?.email || 'Користувач'}</div>
              <div className="text-xs text-corp-text-muted">
                {user?.role === 'admin' ? 'Адміністратор' : user?.role === 'manager' ? 'Менеджер' : 'Реквізитор'}
              </div>
            </div>
          </div>
          {showBackButton && (
            <button 
              className="corp-btn corp-btn-secondary"
              onClick={handleBack}
            >
              ← Назад до дашборду
            </button>
          )}
          <button 
            className="corp-btn corp-btn-secondary text-corp-error hover:bg-corp-error hover:text-white"
            onClick={handleLogout}
          >
            Вихід
          </button>
        </div>
      </div>
    </header>
  );
}
