import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

// Legal Footer
import LegalFooter from './components/LegalFooter';

// Import pages
import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';
import Dashboard from './pages/Dashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerCabinet from './pages/ManagerCabinet';  // ✅ Новий кабінет менеджера
import ReauditCabinetFull from './pages/ReauditCabinetFull';
import DamageHubApp from './pages/DamageHubApp';
// Legacy: import DamageCabinet from './pages/DamageCabinet';
import TasksCabinet from './pages/TasksCabinet';
import PackingCabinet from './pages/PackingCabinet';
import AdminPanel from './pages/AdminPanel';
import ExtendedCatalog from './pages/ExtendedCatalog';
import UniversalOpsCalendar from './pages/UniversalOpsCalendar';
import CatalogBoard from './pages/CatalogBoard';
// Legacy: import FinanceHub from './pages/FinanceHub';  // Перенесено в ManagerCabinet як вкладку "Каса"
// New unified workspace components
import NewOrderCleanWorkspace from './pages/NewOrderCleanWorkspace';
import NewOrderViewWorkspace from './pages/NewOrderViewWorkspace';
import IssueCardWorkspace from './pages/IssueCardWorkspace';
import ReturnOrderWorkspace from './pages/ReturnOrderWorkspace';
import ReturnVersionWorkspace from './pages/ReturnVersionWorkspace';  // ✅ Версії повернення
import PartialReturnVersionWorkspace from './pages/PartialReturnVersionWorkspace';  // ✅ НОВА версіонована система
import ReturnSettlementPage from './pages/ReturnSettlementPage';  // ✅ Сторінка розрахунку повернення
import KasaPage from './pages/KasaPage';  // ✅ Каса
import ArchivedOrderWorkspace from './pages/ArchivedOrderWorkspace';
import OrderWorkspaceDemo from './pages/OrderWorkspaceDemo';
// Other pages
import InventoryRecount from './pages/InventoryRecount';
import OrdersArchive from './pages/OrdersArchive';
import OrderEstimatePage from './pages/OrderEstimatePage';
import SyncPanel from './pages/SyncPanel';
import DocumentTemplatesAdmin from './pages/DocumentTemplatesAdmin';
import UnifiedCalendar from './pages/UnifiedCalendarNew';

// Декодування JWT без бібліотеки
function parseJwt(token: string) {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch { return null; }
}

// Protected Route — перевіряє наявність І валідність токена
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Перевірка чи токен не протух
  const payload = parseJwt(token);
  if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
    // Токен протух — чистимо і на логін
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  // Автоматичний logout: о 7:00 ранку + перевірка протухання токена
  useEffect(() => {
    const checkSession = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // 1. Перевірка протухання JWT
      const payload = parseJwt(token);
      if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      
      // 2. Щоденний logout о 7:00
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      if (hours === 7 && minutes < 5) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    };
    
    checkSession(); // перевірити одразу
    const interval = setInterval(checkSession, 60 * 1000); // кожну хвилину
    return () => clearInterval(interval);
  }, []);
  
  const handleBackToDashboard = () => {
    window.location.href = '/dashboard';
  };
  
  const handleNavigateToTasks = (itemId?: string, orderNumber?: string) => {
    window.location.href = `/tasks${itemId ? `?itemId=${itemId}` : ''}`;
  };
  
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={<Navigate to="/manager" replace />}
          />
          
          <Route 
            path="/manager" 
            element={
              <ProtectedRoute>
                <ManagerDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* ✅ Новий кабінет менеджера - Менеджерська */}
          <Route 
            path="/manager-cabinet" 
            element={
              <ProtectedRoute>
                <ManagerCabinet />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/orders-archive" 
            element={
              <ProtectedRoute>
                <OrdersArchive />
              </ProtectedRoute>
            } 
          />
          
          {/* Повна сторінка кошторису ордеру */}
          <Route 
            path="/order/:id/estimate" 
            element={
              <ProtectedRoute>
                <OrderEstimatePage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/archived-order/:id" 
            element={
              <ProtectedRoute>
                <ArchivedOrderWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/reaudit" 
            element={
              <ProtectedRoute>
                <ReauditCabinetFull 
                  onBackToDashboard={handleBackToDashboard}
                  onNavigateToTasks={handleNavigateToTasks}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/damages" 
            element={
              <ProtectedRoute>
                <DamageHubApp />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/tasks" 
            element={
              <ProtectedRoute>
                <TasksCabinet 
                  onBackToDashboard={handleBackToDashboard}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/packing" 
            element={
              <ProtectedRoute>
                <PackingCabinet 
                  onBackToDashboard={handleBackToDashboard}
                  onNavigateToTasks={handleNavigateToTasks}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/extended-catalog" 
            element={
              <ProtectedRoute>
                <ExtendedCatalog onBackToDashboard={handleBackToDashboard} />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/calendar" 
            element={
              <ProtectedRoute>
                <UnifiedCalendar />
              </ProtectedRoute>
            } 
          />
          
          {/* Legacy calendar - залишаємо для сумісності */}
          <Route 
            path="/calendar-old" 
            element={
              <ProtectedRoute>
                <UniversalOpsCalendar />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/catalog" 
            element={
              <ProtectedRoute>
                <CatalogBoard />
              </ProtectedRoute>
            } 
          />
          
          {/* /finance та /analytics прибрані — фінанси тепер у вкладці "Каса" менеджерського кабінету */}
          <Route path="/finance" element={<Navigate to="/manager-cabinet" replace />} />
          <Route path="/analytics" element={<Navigate to="/manager-cabinet" replace />} />
          
          <Route 
            path="/sync" 
            element={
              <ProtectedRoute>
                <SyncPanel />
              </ProtectedRoute>
            } 
          />
          {/* Laundry Cabinet removed - functionality moved to Damage Cabinet tabs */}
          
          <Route 
            path="/orders/new" 
            element={
              <ProtectedRoute>
                <NewOrderCleanWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/order/:id/view" 
            element={
              <ProtectedRoute>
                <NewOrderViewWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/inventory/:sku" 
            element={
              <ProtectedRoute>
                <InventoryRecount />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/order/:id" 
            element={
              <ProtectedRoute>
                <NewOrderCleanWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/orders/issue" 
            element={
              <ProtectedRoute>
                <IssueCardWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/issue/:id" 
            element={
              <ProtectedRoute>
                <IssueCardWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/issue-workspace/:id" 
            element={
              <ProtectedRoute>
                <IssueCardWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/orders/return" 
            element={
              <ProtectedRoute>
                <ReturnOrderWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/return/:id" 
            element={
              <ProtectedRoute>
                <ReturnOrderWorkspace />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/return-workspace/:id" 
            element={
              <ProtectedRoute>
                <ReturnOrderWorkspace />
              </ProtectedRoute>
            } 
          />
          
          {/* ✅ Return Version Workspace - Версії часткового повернення */}
          <Route 
            path="/return-version/:id" 
            element={
              <ProtectedRoute>
                <ReturnVersionWorkspace />
              </ProtectedRoute>
            } 
          />
          
          {/* ✅ НОВА версіонована система часткових повернень */}
          <Route 
            path="/partial-return/:versionId" 
            element={
              <ProtectedRoute>
                <PartialReturnVersionWorkspace />
              </ProtectedRoute>
            } 
          />

          {/* ✅ Сторінка розрахунку повернення */}
          <Route 
            path="/order/:id/return-settlement" 
            element={
              <ProtectedRoute>
                <ReturnSettlementPage />
              </ProtectedRoute>
            } 
          />
          
          {/* ✅ Каса */}
          <Route 
            path="/kasa" 
            element={
              <ProtectedRoute>
                <KasaPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Admin Panel */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
          
          {/* Document Templates Admin */}
          <Route 
            path="/admin/templates" 
            element={
              <ProtectedRoute>
                <DocumentTemplatesAdmin />
              </ProtectedRoute>
            } 
          />
          
          {/* Order Workspace Demo */}
          <Route 
            path="/workspace-demo" 
            element={
              <ProtectedRoute>
                <OrderWorkspaceDemo />
              </ProtectedRoute>
            } 
          />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </div>
        {/* Legal Footer - показується на всіх сторінках */}
        <LegalFooter />
      </div>
    </Router>
  );
}

export default App;
