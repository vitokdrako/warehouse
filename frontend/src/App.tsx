import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

// Import pages
import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';
import Dashboard from './pages/Dashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ReauditCabinetFull from './pages/ReauditCabinetFull';
import DamageCabinet from './pages/DamageCabinet';
import TasksCabinet from './pages/TasksCabinet';
import PackingCabinet from './pages/PackingCabinet';
import AdminPanel from './pages/AdminPanel';
import ExtendedCatalog from './pages/ExtendedCatalog';
import CalendarBoardNew from './pages/CalendarBoardNew';
import CatalogBoard from './pages/CatalogBoard';
import FinanceCabinet from './pages/FinanceCabinet';
import NewOrderClean from './pages/NewOrderClean';
import NewOrderView from './pages/NewOrderView';
import IssueOrderClean from './pages/IssueOrderClean';
import IssueCard from './pages/IssueCard';
import ReturnOrderClean from './pages/ReturnOrderClean';
import InventoryRecount from './pages/InventoryRecount';
import OrdersArchive from './pages/OrdersArchive';
import SyncPanel from './pages/SyncPanel';
// LaundryCabinet removed - functionality moved to Damage Cabinet tabs

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const navigate = useNavigate;
  
  const handleBackToDashboard = () => {
    window.location.href = '/dashboard';
  };
  
  const handleNavigateToTasks = (itemId?: string, orderNumber?: string) => {
    window.location.href = `/tasks${itemId ? `?itemId=${itemId}` : ''}`;
  };
  
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
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
          
          <Route 
            path="/orders-archive" 
            element={
              <ProtectedRoute>
                <OrdersArchive />
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
                <DamageCabinet />
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
                <CalendarBoardNew />
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
                <FinanceCabinet />
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
                <NewOrderClean />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/order/:id/view" 
            element={
              <ProtectedRoute>
                <NewOrderView />
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
                <NewOrderClean />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/orders/issue" 
            element={
              <ProtectedRoute>
                <IssueOrderClean />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/issue/:id" 
            element={
              <ProtectedRoute>
                <IssueCard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/orders/return" 
            element={
              <ProtectedRoute>
                <ReturnOrderClean />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/return/:id" 
            element={
              <ProtectedRoute>
                <ReturnOrderClean />
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
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
