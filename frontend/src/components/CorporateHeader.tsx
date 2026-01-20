import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CorporateHeaderProps {
  cabinetName?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export default function CorporateHeader({ 
  cabinetName = 'Кабінет менеджера', 
  showBackButton = false, 
  onBackClick
}: CorporateHeaderProps) {
  const [user, setUser] = useState<any>(null);
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
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => navigate('/manager')}
            className="h-10 w-10 rounded-full bg-corp-primary grid place-content-center text-white font-bold text-sm flex-shrink-0 hover:bg-corp-primary/90 hover:scale-105 transition-all cursor-pointer"
            title="На головну"
          >
            RH
          </button>
          <button 
            onClick={() => navigate('/manager')}
            className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
          >
            <h1 className="text-lg font-semibold text-corp-text-dark truncate">Rental Hub</h1>
            <p className="text-xs text-corp-text-muted truncate">{cabinetName}</p>
          </button>
          {/* Mobile logout button */}
          <button 
            className="sm:hidden corp-btn corp-btn-secondary text-corp-error hover:bg-corp-error hover:text-white px-3 py-1.5 text-sm flex-shrink-0"
            onClick={handleLogout}
          >
            ⏻
          </button>
        </div>
        <div className="hidden sm:flex ml-auto items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-corp-bg-light rounded-corp border border-corp-border">
            <div className="h-8 w-8 rounded-full bg-corp-gold grid place-content-center text-white text-xs font-semibold flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="text-sm min-w-0">
              <div className="font-medium text-corp-text-dark truncate max-w-[150px]">{user?.email || 'Користувач'}</div>
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
              ← Назад
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
