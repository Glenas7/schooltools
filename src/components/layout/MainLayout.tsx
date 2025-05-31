import React from 'react';
import Navbar from './Navbar';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const MainLayout = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Don't show navbar on auth-related pages or landing page (which has its own header)
  const isAuthPage = ['/login', '/forgot-password', '/reset-password', '/'].includes(location.pathname);

  // If not authenticated or on an auth page, just render the content
  if (!isAuthenticated || isAuthPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-4 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
