import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import '../AssetFlow.css';

export default function MainLayout({ children, activeTab, onTabChange }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time digital clock refresh
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (!user) return;

    async function loadNotifications() {
      try {
        const data = await api.get('/logs/notifications');
        if (data && data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/logs/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const role = user?.role || 'Employee';

  // Grouped Menu Structure
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
      )
    },
    {
      id: 'directory',
      label: ['Admin', 'AssetManager', 'DepartmentHead'].includes(role) ? 'Asset Inventory' : 'Browse Assets',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      )
    },
    {
      id: 'allocation',
      label: ['Admin', 'AssetManager', 'DepartmentHead'].includes(role) ? 'Allocations' : 'My Possessions',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/></svg>
      )
    },
    {
      id: 'booking',
      label: 'Resource Bookings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      )
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      )
    },
    {
      id: 'audit',
      label: ['Admin', 'AssetManager'].includes(role) ? 'Asset Audits' : 'Audit Checksheets',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      )
    }
  ];

  if (['Admin', 'AssetManager', 'DepartmentHead'].includes(role)) {
    menuItems.push(
      {
        id: 'reports',
        label: 'Reports & Analytics',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        )
      }
    );
  }

  menuItems.push(
    {
      id: 'logs',
      label: 'Logs & Alerts',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M3 20v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8"/><path d="M3 10V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/></svg>
      )
    }
  );

  const generalItems = [];
  if (role === 'Admin') {
    generalItems.push({
      id: 'setup',
      label: 'Settings / Setup',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      )
    });
  }

  generalItems.push(
    {
      id: 'help_link',
      label: 'Help / Support',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      )
    }
  );

  const activeItem = [...menuItems, ...generalItems].find(item => item.id === activeTab);
  const pageTitle = activeItem ? activeItem.label : 'AssetFlow';

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans">
      {/* Sidebar Drawer Panel */}
      <aside className={`fixed transition-all duration-300 relative z-10 p-2 h-screen ${
        isCollapsed ? 'w-[76px]' : 'w-[260px]'
      }`}>
        <div className="bg-panel h-full rounded-2xl overflow-y-auto px-2">

        
        <div className="flex items-center justify-center gap-3 px-6 py-6 border-b border-slate-200">
          <div className="text-slate-950 font-extrabold text-xl tracking-tight flex items-center gap-3 cursor-pointer select-none" onClick={() => setIsCollapsed(!isCollapsed)}>
            {/* Logo Icon */}
            <svg className="text-accent flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {!isCollapsed && <span>AssetFlow</span>}
          </div>
        </div>

        {/* MENU Group */}
        <div className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-5 pb-2 text-left ${isCollapsed ? 'hidden' : ''}`}>Menu</div>
        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          {menuItems.map(item => (
            <li key={item.id}>
              <span
                className={`flex items-center gap-3.5 py-3 px-7 text-slate-500 font-bold text-sm border-l-4 border-transparent cursor-pointer rounded-xl transition-all hover:text-slate-900 hover:bg-slate-300/50 ${
                  activeTab === item.id ? 'text-white bg-accent ' : ''
                } ${isCollapsed ? 'justify-center px-0 border-l-0 border-r-4 border-transparent active:border-r-accent' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className={activeTab === item.id ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </span>
            </li>
          ))}
        </ul>

        {/* GENERAL Group */}
        <div className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest px-7 pt-5 pb-2 text-left ${isCollapsed ? 'hidden' : ''}`}>General</div>
        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          {generalItems.map(item => (
            <li key={item.id}>
              <span
                className={`flex items-center gap-3.5 py-3 px-7 text-slate-500 font-bold text-sm border-l-4 border-transparent cursor-pointer rounded-xl transition-all hover:text-slate-900 hover:bg-slate-300/50 ${
                  activeTab === item.id ? 'text-white bg-accent ' : ''
                } ${isCollapsed ? 'justify-center px-0 border-l-0 border-r-4 border-transparent active:border-r-accent' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className={activeTab === item.id ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </span>
            </li>
          ))}
          {/* Logout button */}
          <li>
            <span 
              className={`flex items-center gap-3.5 py-3 px-7 text-slate-500 font-bold text-sm border-l-4 border-transparent cursor-pointer transition-all hover:text-red-600 hover:bg-red-50/50 ${
                isCollapsed ? 'justify-center px-0 border-l-0' : ''
              }`} 
              onClick={logout}
            >
              <svg className="text-slate-400 hover:text-red-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              {!isCollapsed && <span>Logout</span>}
            </span>
          </li>
        </ul>

        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="py-2 pr-2">
          <div className="h-20 bg-panel flex items-center justify-between px-8 rounded-2xl box-border ">
            {/* Donezo Search Bar */}
              <div className="relative w-[260px]">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Search task"
                  className="w-full bg-white border border-gray-100 rounded-full py-3 pl-10 pr-12 text-slate-900 text-sm font-medium transition-all focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent/20"
                  onClick={() => onTabChange('directory')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 bg-gray-200">⌘ F</span>
              </div>
            {/* <div className="flex items-center">
              <h2 className="m-0 text-slate-900 font-extrabold text-xl tracking-tight">{pageTitle}</h2>
            </div> */}

            <div className="flex items-center gap-4">
              {/* Real-time Clock */}
              {/* <div className="text-sm text-slate-400 font-bold border-r border-slate-200 pr-4 font-mono">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div> */}

              

              {/* Email icon button */}
              <button className="bg-white border border-slate-200 text-slate-700 w-10.5 h-10.5 rounded-full flex items-center justify-center transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer" onClick={() => onTabChange('logs')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </button>

              {/* Notification Bell Dropdown */}
              <div className="relative">
                <button
                  className="bg-white border border-slate-200 text-slate-700 w-10.5 h-10.5 rounded-full flex items-center justify-center transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer relative"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />}
                </button>

                {showNotifications && (
                  <div className="absolute top-full right-0 w-[330px] bg-white border border-slate-200 rounded-2xl shadow-lg z-[100] mt-2 overflow-hidden">
                    <div className="p-3.5 px-4.5 border-b border-slate-200 font-bold flex justify-between items-center text-sm">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-red-100 text-red-500 text-xs px-2.5 py-0.5 rounded-full font-bold">{unreadCount} New</span>
                      )}
                    </div>
                    <div className="max-h-[260px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm">No notifications yet</div>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            className={`p-3.5 px-4.5 border-b border-slate-200 text-xs transition-colors hover:bg-slate-50 cursor-pointer flex flex-col gap-1 text-left ${
                              !notif.is_read ? 'bg-accent-light/10' : ''
                            }`}
                            onClick={() => {
                              if (!notif.is_read) handleMarkAsRead(notif.id);
                            }}
                          >
                            <div className="font-bold text-slate-900">{notif.title}</div>
                            <div className="text-slate-500 leading-snug">{notif.message}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              {new Date(notif.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile badge */}
              <div className="flex items-center gap-3 select-none">
                <div className="w-10 h-10 bg-accent-light text-accent rounded-full flex items-center justify-center font-extrabold text-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-bold text-xs text-slate-900">{user?.name}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{user?.email}</span>
                </div>
              </div>
            </div>

          </div>
        </header>

        {/* Dynamic Inner Workspace View */}
        <section className="p-9 overflow-y-auto flex-grow box-border bg-panel rounded-2xl">{children}</section>
      </main>
    </div>
  );
}
