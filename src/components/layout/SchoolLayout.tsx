import React from 'react';
import { Outlet } from 'react-router-dom';
import SchoolNavbar from './SchoolNavbar';

const SchoolLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <SchoolNavbar />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default SchoolLayout; 