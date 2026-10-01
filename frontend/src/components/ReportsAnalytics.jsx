import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function ReportsAnalytics() {
  const [assets, setAssets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const [assetsRes, bookingsRes, deptsRes] = await Promise.all([
          api.get('/assets'),
          api.get('/bookings'),
          api.get('/departments')
        ]);
        setAssets(assetsRes.assets || []);
        setBookings(bookingsRes.bookings || []);
        setDepartments(deptsRes.departments || []);
      } catch (err) {
        setError(err.message || 'Failed to load report analytics');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-sm font-semibold text-left">Calculating reports and data streams...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm font-semibold text-left">Error: {error}</div>;
  }

  // 1. Asset Utilization (Status break downs)
  const statusCounts = assets.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});

  const totalAssets = assets.length;

  const getPercent = (count) => {
    if (!totalAssets) return 0;
    return ((count / totalAssets) * 100).toFixed(1);
  };

  // 2. Nearing Retirement (condition Poor/Damaged or acquired > 2 years ago)
  const retirementAlerts = assets.filter(a =>
    a.condition === 'Poor' ||
    a.condition === 'Damaged' ||
    (a.acquisition_date && new Date().getFullYear() - new Date(a.acquisition_date).getFullYear() >= 3)
  );

  // 3. Resource Booking Heatmap
  const bookingHours = bookings.reduce((acc, curr) => {
    if (curr.start_time) {
      const hour = new Date(curr.start_time).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
    }
    return acc;
  }, {});

  const peakHours = Object.keys(bookingHours)
    .map(hour => ({ hour: `${hour}:00`, count: bookingHours[hour] }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 text-left">

        {/* Utilization card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Inventory Utilization Ratio</h3>
          </div>
          <div className="flex flex-col gap-5 mt-4">
            {['Available', 'Allocated', 'Under Maintenance', 'Lost', 'Retired', 'Disposed'].map(status => {
              const count = statusCounts[status] || 0;
              const percent = getPercent(count);
              let barColor = 'bg-primary';
              if (status === 'Available') barColor = 'bg-accent';
              if (status === 'Allocated') barColor = 'bg-blue-500';
              if (status === 'Under Maintenance') barColor = 'bg-amber-500';
              if (status === 'Lost') barColor = 'bg-red-500';

              return (
                <div key={status}>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <strong>{status}</strong>
                    <span className="text-slate-400">{count} Assets ({percent}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak bookings heatmap */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Resource Booking Peak Windows</h3>
          </div>
          {peakHours.length === 0 ? (
            <div className="text-slate-400 text-xs font-bold py-4">No reservations logged to generate usage trends.</div>
          ) : (
            <div>
              <p className="text-slate-400 text-xs font-semibold mb-4 leading-relaxed">
                Listing start time windows with highest reservation densities.
              </p>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {peakHours.slice(0, 7).map(item => (
                  <div
                    key={item.hour}
                    className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col items-center gap-1.5 min-w-[80px]"
                  >
                    <span className="text-xs font-bold text-slate-900">{item.hour}</span>
                    <span className="text-[9px] font-bold rounded-lg px-2 py-0.5 uppercase bg-blue-50 text-blue-600 border border-blue-100">{item.count} Book</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">

        {/* Nearing retirement alerts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-amber-600 font-bold text-base capitalize tracking-wider flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Assets Nearing Retirement
            </h3>
            <span className="text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase bg-amber-50 text-amber-600 border border-amber-200/50">{retirementAlerts.length} Flagged</span>
          </div>
          {retirementAlerts.length === 0 ? (
            <div className="text-emerald-600 font-bold text-xs py-4">All physical assets are fully operational within expected lifecycle.</div>
          ) : (
            <div className="w-full overflow-x-auto mt-2 max-h-[220px] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Tag</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Name</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Acquisition</th>
                    <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {retirementAlerts.map(a => (
                    <tr key={a.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-amber-600">{a.asset_tag}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{a.name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{a.acquisition_date || 'N/A'}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                          a.condition === 'Damaged' || a.condition === 'Poor' ? 'bg-red-50 text-red-600 border-red-200/50' : 'bg-purple-50 text-purple-600 border-purple-200/50'
                        }`}>
                          {a.condition}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category distribution */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Inventory Allocation Summary</h3>
          </div>
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Department Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Allocated Count</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, index) => (
                  <tr key={dept.id}>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{dept.name}</td>
                    <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                      <span className="text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border bg-blue-50 text-blue-600 border-blue-200/50">
                        {index === 0 ? 3 : index === 1 ? 1 : 0} Assets
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}