import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function ActivityLogs() {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('notifications');
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const isElevated = ['Admin', 'AssetManager'].includes(user?.role);

      const [notifRes, auditRes] = await Promise.all([
        api.get('/logs/notifications'),
        isElevated ? api.get('/logs/audit') : Promise.resolve({ logs: [] })
      ]);

      setNotifications(notifRes.notifications || []);
      setAuditLogs(auditRes.logs || []);
    } catch (err) {
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/logs/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (err) {
      setError(err.message || 'Failed to mark notification as read');
    }
  };

  const isElevated = ['Admin', 'AssetManager'].includes(user?.role);

  return (
    <div>
      {/* Sub tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 text-left">
        <button
          className={`py-3 px-5 text-sm font-bold text-slate-400 border-b-2 border-transparent transition-all cursor-pointer hover:text-slate-900 hover:border-slate-300 ${
            activeSubTab === 'notifications' ? 'text-accent border-b-accent hover:text-accent hover:border-b-accent' : ''
          }`}
          onClick={() => setActiveSubTab('notifications')}
        >
          My Notifications
        </button>
        {isElevated && (
          <button
            className={`py-3 px-5 text-sm font-bold text-slate-400 border-b-2 border-transparent transition-all cursor-pointer hover:text-slate-900 hover:border-slate-300 ${
              activeSubTab === 'audit' ? 'text-accent border-b-accent hover:text-accent hover:border-b-accent' : ''
            }`}
            onClick={() => setActiveSubTab('audit')}
          >
            System Activity Log
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs font-bold text-left mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm font-semibold text-left">Loading logs feed...</div>
      ) : (
        <>
          {/* Tab 1: Notifications */}
          {activeSubTab === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Inbox Notifications</h3>
                <span className="text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase bg-blue-50 text-blue-600 border border-blue-200/50">
                  {notifications.filter(n => !n.is_read).length} Unread
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {notifications.length === 0 ? (
                  <div className="text-slate-400 text-xs font-bold text-center py-8">No notifications received.</div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`bg-white border rounded-2xl p-4 flex justify-between items-center gap-4 transition-shadow hover:shadow-sm ${
                        !notif.is_read ? 'border-l-4 border-l-primary border-slate-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="text-left">
                        <div className={`text-sm font-bold ${!notif.is_read ? 'text-slate-900' : 'text-slate-500'}`}>
                          {notif.title}
                        </div>
                        <div className="text-slate-500 text-xs leading-snug mt-1">{notif.message}</div>
                        <div className="text-slate-400 text-[10px] font-bold mt-2">
                          {new Date(notif.created_at).toLocaleString()}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <button
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors"
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: System Activity Log (Admin / Manager only) */}
          {activeSubTab === 'audit' && isElevated && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">System Action Audits</h3>
              </div>
              <div className="w-full overflow-x-auto mt-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">User Name</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Email</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">System Role</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Executed Action</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Action Details</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan="6" className="py-8 text-slate-400 text-xs font-bold text-center">No audit logs recorded.</td></tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id}>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{log.user_name || 'System'}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{log.user_email || 'N/A'}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                            <span className="text-[9px] font-bold rounded-lg px-2 py-0.5 uppercase border bg-blue-50 text-blue-600 border-blue-200/50">
                              {log.user_role || 'System'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-amber-600">{log.action}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{log.details}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}