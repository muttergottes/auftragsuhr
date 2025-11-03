import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// Simple icons without external dependencies
const HomeIcon = () => <span></span>;
const ChartBarIcon = () => <span></span>;
const DocumentTextIcon = () => <span></span>;
const UsersIcon = () => <span></span>;
const CogIcon = () => <span></span>;
const LogoutIcon = () => <span></span>;

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Live-Board', href: '/live-board', icon: ChartBarIcon },
    { name: 'Aufträge', href: '/work-orders', icon: DocumentTextIcon },
  ];

  const adminNavigation = [
    { name: 'Benutzer', href: '/users', icon: UsersIcon },
    { name: 'Statistiken', href: '/statistics', icon: ChartBarIcon },
    { name: 'Einstellungen', href: '/settings', icon: CogIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900 mr-8">
                Auftragsuhr
              </h1>
              
              {/* Navigation Links - Only for Admin/Dispatcher */}
              <nav className="hidden md:flex space-x-4">
                {(user?.role === 'admin' || user?.role === 'dispatcher') && (
                  <>
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.name}
                      </Link>
                    ))}
                    
                    {/* Admin Navigation */}
                    {adminNavigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.name}
                      </Link>
                    ))}
                  </>
                )}
                
                {/* Employee only sees Kiosk link */}
                {user?.role === 'employee' && (
                  <Link
                    to="/kiosk"
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  >
                    <span className="w-4 h-4 mr-2"></span>
                    Kiosk-Modus
                  </Link>
                )}
              </nav>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Hallo, {user?.first_name || 'Benutzer'}!
              </span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                {user?.role === 'admin' ? 'Administrator' : 
                 user?.role === 'dispatcher' ? 'Disponent' : 'Mitarbeiter'}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
              >
                <LogoutIcon className="w-4 h-4 mr-2" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b">
        <div className="px-4 py-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            >
              <item.icon className="w-4 h-4 mr-2" />
              {item.name}
            </Link>
          ))}
          
          {/* Admin Navigation for Mobile */}
          {(user?.role === 'admin' || user?.role === 'dispatcher') && (
            <>
              {adminNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;