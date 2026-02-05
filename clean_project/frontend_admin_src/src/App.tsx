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
import FinanceHub from './pages/FinanceHub';
// New unified workspace components
import NewOrderCleanWorkspace from './pages/NewOrderCleanWorkspace';
import NewOrderViewWorkspace from './pages/NewOrderViewWorkspace';
import IssueCardWorkspace from './pages/IssueCardWorkspace';
import ReturnOrderWorkspace from './pages/ReturnOrderWorkspace';
import ReturnVersionWorkspace from './pages/ReturnVersionWorkspace';  // ✅ Версії повернення
import PartialReturnVersionWorkspace from './pages/PartialReturnVersionWorkspace';  // ✅ НОВА версіонована система
import ArchivedOrderWorkspace from './pages/ArchivedOrderWorkspace';
import OrderWorkspaceDemo from './pages/OrderWorkspaceDemo';
// Other pages
import InventoryRecount from './pages/InventoryRecount';
import OrdersArchive from './pages/OrdersArchive';
import SyncPanel from './pages/SyncPanel';
import DocumentTemplatesAdmin from './pages/DocumentTemplatesAdmin';
import UnifiedCalendar from './pages/UnifiedCalendarNew';

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  // Note: navigate is not used here - remove if unneeded
  // const navigate = useNavigate();
  
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
          
          <Route 
            path="/finance" 
            element={
              <ProtectedRoute>
                <FinanceHub />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute>
                <FinanceHub />
              </ProtectedRoute>
            } 
          />
          
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
