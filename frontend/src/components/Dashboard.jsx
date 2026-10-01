import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ onTabChange }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Session Timer (seconds since component loaded)
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const [dashRes, allocRes, assetsRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/allocations'),
          api.get('/assets')
        ]);
        setData(dashRes);
        setAllocations(allocRes.allocations || []);
        setAssets(assetsRes.assets || []);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  // Session timer incrementer
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSecs) => {
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  if (loading) {
    return <div className="text-slate-400 text-sm font-semibold text-left">Loading dashboard analytics...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm font-semibold text-left">Error: {error}</div>;
  }

  const kpis = data?.kpis || {};
  const overdueReturns = data?.overdueReturns || [];
  const upcomingReturns = data?.upcomingReturns || [];

  // Live progress metrics
  const totalAssetsCount = assets.length || 24;
  const allocatedAssetsCount = assets.filter(a => a.status === 'Allocated').length || 12;
  const availableAssetsCount = assets.filter(a => a.status === 'Available').length || 10;
  
  const allocationPercent = totalAssetsCount > 0 ? Math.round((allocatedAssetsCount / totalAssetsCount) * 100) : 0;
  
  // Circumference for SVG gauge radius 50 is 314
  const circ = 314;
  const strokeOffset = circ - (allocationPercent / 100) * circ;

  // Retrieve the soonest return reminder (overdue or upcoming)
  const nextReturnReminder = overdueReturns.length > 0 ? overdueReturns[0] 
                            : upcomingReturns.length > 0 ? upcomingReturns[0] 
                            : null;

  return (
    <div>
      {/* Welcome Header Controls */}
      <div className="flex justify-between items-center mb-8 text-left">
        <div>
          <h1 className="m-0 text-slate-900 font-semibold text-4xl tracking-tight">Dashboard</h1>
          <p className="mt-1 text-slate-400 text-sm font-medium">Plan, prioritize, and manage your assets with ease.</p>
        </div>
        <div className="flex gap-3">
          {['Admin', 'AssetManager'].includes(user?.role) && (
            <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => onTabChange('directory')}>
              + Add Asset
            </button>
          )}
          <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer transition-colors" onClick={() => onTabChange('setup')}>
            Configure Setup
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 text-left">
        {/* Card 1: Total Assets */}
        <div className="bg-primary text-white border-0 hover:bg-primary-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all" onClick={() => onTabChange('directory')}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Total Assets</span>
            <div className="text-black rounded-full bg-white p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </div>
          </div>
          <div className="text-4xl font-medium my-2 text-white">{totalAssetsCount}</div>
          <span className="text-[10px] font-bold rounded px-2 py-0.5 self-start bg-white/10 text-white">5 Increased from last month</span>
        </div>

        {/* Card 2: Available Assets */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all" onClick={() => onTabChange('directory')}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Available Assets</span>
            <div className="text-slate-700 rounded-full border border-gray-800 p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </div>
          </div>
          <div className="text-4xl font-medium my-2 text-slate-900">{availableAssetsCount}</div>
          <span className="text-[10px] font-bold rounded px-2 py-0.5 self-start bg-emerald-50 text-emerald-600">6 Increased from last month</span>
        </div>

        {/* Card 3: Allocated Assets */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all" onClick={() => onTabChange('allocation')}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Allocated Assets</span>
            <div className="text-slate-700 rounded-full border border-gray-800 p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </div>
          </div>
          <div className="text-4xl font-medium my-2 text-slate-900">{allocatedAssetsCount}</div>
          <span className="text-[10px] font-bold rounded px-2 py-0.5 self-start bg-emerald-50 text-emerald-600">2 Increased from last month</span>
        </div>

        {/* Card 4: Pending Transfers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all" onClick={() => onTabChange('allocation')}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Pending Transfers</span>
            <div className="text-slate-700 rounded-full border border-gray-800 p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </div>
          </div>
          <div className="text-4xl font-medium my-2 text-slate-900">{kpis.pendingTransfers || 0}</div>
          <span className="text-[10px] font-bold rounded px-2 py-0.5 self-start bg-slate-100 text-slate-500">On Discuss</span>
        </div>
      </div>

      {/* Grid Row 1: Analytics, Reminders & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 text-left">
        
        {/* Project Analytics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Assets Analytics</h3>
          </div>
          <div className="flex justify-between items-end h-[180px] pt-4">
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full rounded-t-2xl transition-all duration-300 relative" style={{ height: '40%', backgroundImage: 'repeatinglinear-gradient(45deg,#10b981,#10b981_4px,#059669_4px,#059669_8px)' }}></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">S</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full bg-accent rounded-t-2xl transition-all duration-300 relative" style={{ height: '70%' }}></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">M</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-full group">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full bg-accent rounded-t-2xl transition-all duration-300 relative" style={{ height: `${allocationPercent}%` }}>
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow opacity-0 pointer-events-none transition-opacity group-hover:opacity-100">{allocationPercent}%</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">T</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full bg-primary rounded-t-2xl transition-all duration-300 relative" style={{ height: '85%' }}></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">W</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full rounded-t-2xl transition-all duration-300 relative" style={{ height: '45%', backgroundImage: 'repeating-linear-gradient(45deg,#10b981,#10b981_4px,#059669_4px,#059669_8px)' }}></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">T</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full rounded-t-2xl transition-all duration-300 relative" style={{ height: '35%', backgroundImage: 'repeating-linear-gradient(45deg,#10b981,#10b981_4px,#059669_4px,#059669_8px)' }}></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">F</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="h-[140px] w-10 bg-slate-100 rounded-2xl relative overflow-hidden flex items-end">
                <div className="w-full rounded-t-2xl transition-all duration-300 relative" style={{ height: '50%', backgroundImage: 'repeating-linear-gradient(45deg,#10b981,#10b981_4px,#059669_4px,#059669_8px)' }}></div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">S</span>
            </div>
          </div>
        </div>

        {/* Reminders Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Return Reminders</h3>
          </div>
          <div className="flex flex-col gap-4 h-[180px] justify-between">
            {nextReturnReminder ? (
              <div>
                <h4 className="margin-0 mb-2 text-md font-extrabold text-primary">
                  Return: {nextReturnReminder.asset_name}
                </h4>
                <div className="text-slate-400 text-xs font-bold">
                  Borrower: {nextReturnReminder.user_name || nextReturnReminder.department_name}
                </div>
                <div className="text-red-500 text-xs font-extrabold mt-1">
                  Due: {new Date(nextReturnReminder.expected_return_date).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="margin-0 mb-2 text-md font-extrabold text-primary">
                  All clear!
                </h4>
                <span className="text-slate-400 text-xs font-bold">
                  No pending asset return deadlines.
                </span>
              </div>
            )}
            <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-xl py-3 px-5 text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => onTabChange('allocation')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/></svg>
              Process Return
            </button>
          </div>
        </div>

        {/* Registered Assets List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Registered Assets</h3>
            <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-2 text-[10px] cursor-pointer transition-colors" onClick={() => onTabChange('directory')}>+ New</button>
          </div>
          <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto">
            {assets.slice(0, 4).map(asset => {
              let dotColor = '#3b82f6'; // allocated
              if (asset.status === 'Available') dotColor = '#10b981';
              if (asset.status === 'Under Maintenance') dotColor = '#f59e0b';
              if (['Lost', 'Retired', 'Disposed'].includes(asset.status)) dotColor = '#94a3b8';

              return (
                <div key={asset.id} className="flex items-center gap-3">
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <div className="flex flex-col text-left flex-grow">
                    <span className="text-xs font-bold text-slate-900">{asset.name}</span>
                    <span className="text-[10px] text-slate-400">Tag: {asset.asset_tag} | {asset.status}</span>
                  </div>
                </div>
              );
            })}
            {assets.length === 0 && (
              <span className="text-slate-400 text-xs font-bold">No assets registered.</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid Row 2: Collaboration, Progress & Time Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        
        {/* Active Possessions list */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Active Possessions</h3>
            <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-2 text-[10px] cursor-pointer transition-colors" onClick={() => onTabChange('allocation')}>+ Assign</button>
          </div>
          <div className="flex flex-col gap-4 max-h-[180px] overflow-y-auto">
            {allocations.slice(0, 4).map(al => (
              <div key={al.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                    <img 
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${al.user_name || al.department_name}`} 
                      alt="avatar" 
                      className="w-full height-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-900">{al.user_name || al.department_name}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Holding: <strong>{al.asset_name}</strong></span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                  al.returned_date 
                    ? 'bg-slate-100 text-slate-500 border-slate-200/50' 
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                }`}>
                  {al.returned_date ? 'Returned' : 'Possessed'}
                </span>
              </div>
            ))}
            {allocations.length === 0 && (
              <span className="text-slate-400 text-xs font-bold py-4">No active possessions logged.</span>
            )}
          </div>
        </div>

        {/* Asset Utilization Gauge */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Asset Utilization</h3>
          </div>
          <div className="relative w-[220px] h-[120px] mx-auto flex items-center justify-center overflow-hidden">
            <svg className="w-[220px] h-[220px] absolute -bottom-10 transform -rotate-180">
              <circle className="fill-none stroke-slate-100 stroke-[12]" cx="110" cy="110" r="50" style={{ strokeDasharray: '157, 314' }} />
              <path
                className="fill-none stroke-accent stroke-[12] stroke-linecap-round"
                d="M 60,110 A 50,50 0 0,1 160,110"
                strokeDasharray="314"
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className="absolute bottom-1 flex flex-col items-center">
              <span className="text-2xl font-extrabold text-slate-900">{allocationPercent}%</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Assets Utilised</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 border-t border-slate-100 pt-4 mt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-accent" />Allocated</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-primary" />Available</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-300" />Other</div>
          </div>
        </div>

        {/* Active Session Uptime Tracker */}
        <div className="bg-primary rounded-2xl p-6 text-white flex flex-col justify-between h-full box-border text-center relative overflow-hidden">
          <div className="absolute w-[100px] h-[100px] bg-accent filter blur-[50px] -bottom-8 -right-8 opacity-30"></div>
          <div className="m-0 text-white/70 font-bold text-base capitalize tracking-wider">Session Uptime</div>
          <div className="text-4xl font-extrabold font-mono tracking-tight my-4 relative z-1">
            {formatTimer(sessionSeconds)}
          </div>
          <div className="flex align-middle justify-center gap-3 relative z-1">
            <button
              className="bg-white/10 hover:bg-white/20 border-none rounded-xl w-10.5 h-10.5 flex items-center justify-center cursor-pointer text-white transition-colors"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              title={isTimerRunning ? 'Pause' : 'Resume'}
            >
              {isTimerRunning ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="4"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <button
              className="bg-red-500/25 hover:bg-red-500/40 text-red-200 border-none rounded-xl w-10.5 h-10.5 flex items-center justify-center cursor-pointer transition-colors"
              onClick={() => {
                setSessionSeconds(0);
                setIsTimerRunning(false);
              }}
              title="Reset"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
            </button>
          </div>
        </div>

      </div>

      {/* Critical Overdue Returns Banner Alert */}
      {overdueReturns.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 bg-red-50/10 mt-8 text-left">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-red-600 font-bold text-base capitalize tracking-wider flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Critical Overdue Returns Alert
            </h3>
            <span className="text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase bg-red-100 text-red-600 border border-red-200">{overdueReturns.length} Assets Overdue</span>
          </div>
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Held By</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Expected Return</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueReturns.map(item => (
                  <tr key={item.id}>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-red-600">{item.asset_tag}</td>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-medium text-slate-600">{item.asset_name}</td>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-medium text-slate-600">{item.user_name || item.department_name || 'N/A'}</td>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-medium text-slate-600">{new Date(item.expected_return_date).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-medium text-slate-600">
                      <span className="text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase bg-red-100 text-red-600 border border-red-200">Overdue</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
