import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, LogOutIcon, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <GraduationCap className="h-8 w-8 text-primary" />
              <span className="ml-2 text-lg font-semibold text-gray-900">School Scheduler</span>
            </Link>
          </div>
          
          <div className="flex items-center md:hidden">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleMenu}
              className="p-1"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-4">
                <Link to="/school-select">
                  <Button variant="default" className="text-sm">
                    Select School
                  </Button>
                </Link>
                
                <div className="flex items-center pl-4 border-l border-gray-200">
                  <div className="text-sm text-gray-700 mr-3">
                    <div className="font-medium">{user.name}</div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={logout}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <LogOutIcon className="h-4 w-4 mr-1" />
                    <span>Logout</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {isMenuOpen && user && (
          <div className="md:hidden pb-3 border-t border-gray-200 mt-1">
            <nav className="flex flex-col space-y-2 pt-2">
              <Link to="/school-select" onClick={() => setIsMenuOpen(false)}>
                <Button variant="default" className="text-sm w-full justify-start">
                  Select School
                </Button>
              </Link>
            </nav>
            
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-700">
                <div className="font-medium">{user.name}</div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOutIcon className="h-4 w-4 mr-1" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
