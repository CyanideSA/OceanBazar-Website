import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Settings, User, LogOut, CreditCard, Bell, Heart } from 'lucide-react';
import { profileAPI } from '../api/service';
import { useTheme } from '../context/ThemeContext';
import { useCustomerInbox } from '../context/CustomerInboxContext';
import { STOREFRONT_PROFILE_UPDATED } from '@/utils/storefrontUserSync';

const AccountLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [profile, setProfile] = useState(null);
  const { unreadCount, refreshUnread } = useCustomerInbox();

  useEffect(() => {
    refreshUnread();
  }, [location.pathname, refreshUnread]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.get();
        if (!cancelled) setProfile(res.data);
      } catch (_) {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    const onSync = (e) => {
      if (e?.detail && typeof e.detail === 'object') {
        setProfile((p) => ({ ...(p || {}), ...e.detail }));
      }
    };
    window.addEventListener(STOREFRONT_PROFILE_UPDATED, onSync);
    return () => window.removeEventListener(STOREFRONT_PROFILE_UPDATED, onSync);
  }, []);

  const menuItems = [
    { path: '/account/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/wishlist', label: 'Wishlist', icon: Heart },
    { path: '/account/orders', label: 'Orders', icon: Package },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/account/payments', label: 'Payment methods', icon: CreditCard },
    { path: '/account/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('oceanBazarToken');
    localStorage.removeItem('oceanBazarUser');
    navigate('/');
    window.location.reload();
  };

  const displayName = profile?.name || 'My Account';
  const typeLabel =
    profile?.userType === 'wholesale' ? 'Wholesale Customer' : 'Retail Customer';

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gradient-to-br from-white via-[#F5F9FC] to-[#E4F0F9]'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className={`lg:col-span-1 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-[#E4F0F9]'} h-fit`}>
            <div className="flex items-center gap-3 mb-6 pb-6 border-b">
              {profile?.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border border-[#E4F0F9]"
                />
              ) : (
                <div className={`w-12 h-12 rounded-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-[#E4F0F9]'} flex items-center justify-center`}>
                  <User className={`w-6 h-6 ${theme === 'dark' ? 'text-gray-300' : 'text-[#5BA3D0]'}`} />
                </div>
              )}
              <div>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{displayName}</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{typeLabel}</p>
              </div>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-[#5BA3D0] to-[#7BB8DC] text-white'
                        : theme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-[#E4F0F9]'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="font-medium flex-1 min-w-0">{item.label}</span>
                    {item.path === '/notifications' && unreadCount > 0 ? (
                      <span
                        className={`shrink-0 text-xs font-semibold min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-center ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : theme === 'dark'
                            ? 'bg-red-500/90 text-white'
                            : 'bg-[#5BA3D0] text-white'
                        }`}
                        aria-label={`${unreadCount} unread notifications`}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 pt-6 border-t space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-[#E4F0F9]'
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AccountLayout;
