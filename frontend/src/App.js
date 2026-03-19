import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import { useToast, Toasts } from './hooks/useToast';

export default function App() {
  const { toasts, success, error } = useToast();
  const toast = { success, error };
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/"          element={<Dashboard toast={toast} />} />
            <Route path="/inventory" element={<Inventory toast={toast} />} />
          </Routes>
        </main>
        <Toasts list={toasts} />
      </div>
    </BrowserRouter>
  );
}
