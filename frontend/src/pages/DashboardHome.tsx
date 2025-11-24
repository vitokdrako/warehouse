import React from 'react';
import { useNavigate } from 'react-router-dom';

interface CabinetCard {
  id: string;
  title: string;
  icon: string;
  description: string;
  route: string;
  color: string;
  roles?: string[];
}

export default function DashboardHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const cabinets: CabinetCard[] = [
    {
      id: 'finance',
      title: 'Фінанси',
      icon: '💰',
      description: 'Платежі, рахунки, застави',
      route: '/finance',
      color: 'from-amber-500 to-orange-500',
      roles: ['admin', 'manager']
    },
    {
      id: 'catalog',
      title: 'Каталог',
      icon: '📚',
      description: 'Товари, категорії, ціни',
      route: '/extended-catalog',
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'calendar',
      title: 'Календар',
      icon: '📅',
      description: 'Події, картки видачі/повернення',
      route: '/calendar',
      color: 'from-cyan-500 to-blue-500'
    },
    {
      id: 'damages',
      title: 'Шкоди PRO',
      icon: '⚠️',
      description: 'Кейси пошкоджень, реставрація',
      route: '/damages',
      color: 'from-red-500 to-pink-500'
    },
    {
      id: 'tasks',
      title: 'Завдання PRO',
      icon: '📋',
      description: 'Kanban дошка, мийка, збір',
      route: '/tasks',
      color: 'from-purple-500 to-violet-500'
    },
    {
      id: 'reaudit',
      title: 'Переоблік PRO',
      icon: '🔍',
      description: 'Каталог декору, історія оренд',
      route: '/reaudit',
      color: 'from-teal-500 to-emerald-500'
    },
    {
      id: 'packing',
      title: 'Комплектація',
      icon: '📦',
      description: 'Збір товарів для видачі',
      route: '/packing',
      color: 'from-green-500 to-lime-500'
    },
    {
      id: 'manager',
      title: 'Менеджер',
      icon: '👔',
      description: 'Замовлення, клієнти, звіти',
      route: '/manager',
      color: 'from-slate-600 to-slate-700',
      roles: ['admin', 'manager']
    },
    {
      id: 'admin',
      title: 'Адмін-панель',
      icon: '⚙️',
      description: 'Користувачі, категорії, налаштування',
      route: '/admin',
      color: 'from-purple-600 to-pink-600',
      roles: ['admin']
    }
  ];

  const filteredCabinets = cabinets.filter(cabinet => {
    if (!cabinet.roles) return true;
    return cabinet.roles.includes(user.role);
  });

  const handleCabinetClick = (route: string) => {
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Rental Hub — Кабінет менеджера
          </h1>
          <p className="text-slate-600">
            Оберіть розділ для роботи
          </p>
        </div>

        {/* Cabinet Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCabinets.map((cabinet) => (
            <button
              key={cabinet.id}
              onClick={() => handleCabinetClick(cabinet.route)}
              className="group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${cabinet.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              {/* Card Content */}
              <div className="relative p-6">
                {/* Icon */}
                <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                  {cabinet.icon}
                </div>
                
                {/* Title */}
                <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-slate-900">
                  {cabinet.title}
                </h3>
                
                {/* Description */}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {cabinet.description}
                </p>
                
                {/* Arrow indicator */}
                <div className="mt-4 flex items-center text-slate-400 group-hover:text-slate-600 transition-colors">
                  <span className="text-sm font-medium">Відкрити</span>
                  <svg 
                    className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              {/* Bottom colored border */}
              <div className={`h-1 bg-gradient-to-r ${cabinet.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
            </button>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>© Rental Hub • manager cabinet</p>
        </div>
      </div>
    </div>
  );
}
