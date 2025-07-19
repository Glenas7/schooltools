import React from 'react';
import { Outlet } from 'react-router-dom';
import SchoolNavbar from './SchoolNavbar';

const SchoolLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <SchoolNavbar />
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default SchoolLayout; 