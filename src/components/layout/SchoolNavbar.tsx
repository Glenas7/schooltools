import React from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { GraduationCap, Calendar, Users, BookOpen, MapPin, Settings, LogOut, Building2, ChevronDown } from 'lucide-react';

const SchoolNavbar = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { logout, user } = useAuth();
  const { currentSchool, userRole, isSchoolAdmin } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, navigate to home page as the local state has been cleared
      navigate('/');
    }
  };

  const handleSwitchSchool = () => {
    navigate('/school-select');
  };

  const navigation = [
    { name: 'Schedule', href: `/school/${schoolId}/schedule`, icon: Calendar },
    { name: 'Teachers', href: `/school/${schoolId}/teachers`, icon: Users, adminOnly: true },
    { name: 'Subjects', href: `/school/${schoolId}/subjects`, icon: BookOpen, adminOnly: true },
    { name: 'Locations', href: `/school/${schoolId}/locations`, icon: MapPin, adminOnly: true },
    { name: 'Settings', href: `/school/${schoolId}/settings`, icon: Settings, adminOnly: true },
  ];

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:h-16">
          {/* Left side: Logo + School Info */}
          <div className="flex items-center justify-between py-3 sm:py-0">
            <div className="flex items-center space-x-6">
              {/* Logo */}
              <Link to="/" className="flex items-center">
                <GraduationCap className="h-8 w-8 text-primary" />
                <span className="ml-2 text-xl font-bold text-gray-900">School Scheduler</span>
              </Link>

              {/* Current School - Same row on desktop */}
              {currentSchool && (
                <div className="hidden sm:flex items-center">
                  <Building2 className="h-5 w-5 text-muted-foreground mr-2" />
                  <span className="text-lg font-semibold text-gray-900">{currentSchool.name}</span>
                  {userRole === 'superadmin' && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                      Super Admin
                    </span>
                  )}
                  {userRole === 'admin' && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* User Menu - Mobile Only */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <span className="truncate max-w-[100px]">{user?.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleSwitchSchool}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Switch School
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Current School - Second row on mobile only */}
          {currentSchool && (
            <div className="flex sm:hidden items-center py-2">
              <Building2 className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="text-lg font-semibold text-gray-900">{currentSchool.name}</span>
              {userRole === 'superadmin' && (
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                  Super Admin
                </span>
              )}
              {userRole === 'admin' && (
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  Admin
                </span>
              )}
            </div>
          )}

          {/* Right side: Navigation Links and Desktop User Menu */}
          <div className="flex items-center justify-between py-3 sm:py-0 sm:space-x-4">
            {/* Navigation Links */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {navigation.map((item) => {
                // Hide admin-only items from non-admins (teachers)
                if (item.adminOnly && !isSchoolAdmin) {
                  return null;
                }

                // Check if this is the active page
                const isActive = location.pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* User Menu - Desktop Only */}
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <span>{user?.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleSwitchSchool}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Switch School
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default SchoolNavbar; 