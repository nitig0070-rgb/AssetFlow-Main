import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AssetAudit() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [scopedAssets, setScopedAssets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [discrepancyReport, setDiscrepancyReport] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Form states
  const [cycleForm, setCycleForm] = useState({ name: '', scope_department_id: '', scope_location: '', start_date: '', end_date: '' });
  const [verifyForm, setVerifyForm] = useState({ verification_status: 'Verified', notes: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cyclesRes, deptsRes] = await Promise.all([
        api.get('/audits/cycles'),
        api.get('/departments')
      ]);
      setCycles(cyclesRes.cycles || []);
      setDepartments(deptsRes.departments || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadCycleAssetsAndReport = async (cycleId) => {
    if (!cycleId) {
      setScopedAssets([]);
      setDiscrepancyReport(null);
      return;
    }
    try {
      const [assetsRes, reportRes] = await Promise.all([
        api.get(`/audits/cycles/${cycleId}/assets`),
        api.get(`/audits/cycles/${cycleId}/report`)
      ]);
      setScopedAssets(assetsRes.assets || []);
      setDiscrepancyReport(reportRes);
    } catch (err) {
      setError(err.message || 'Failed to load cycle assets');
    }
  };

  useEffect(() => {
    loadCycleAssetsAndReport(selectedCycleId);
  }, [selectedCycleId]);

  const handleCreateCycleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/audits/cycles', cycleForm);
      setSuccess(`Audit cycle created successfully with ${res.assetsScopedCount} assets in scope.`);
      setShowCreateModal(false);
      setCycleForm({ name: '', scope_department_id: '', scope_location: '', start_date: '', end_date: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create audit cycle');
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedAsset) return;

    try {
      await api.put(`/audits/cycles/${selectedCycleId}/assets/${selectedAsset.asset_id}`, verifyForm);
      setSuccess(`Asset ${selectedAsset.asset_tag} verified as ${verifyForm.verification_status}`);
      setShowVerifyModal(false);
      setSelectedAsset(null);
      setVerifyForm({ verification_status: 'Verified', notes: '' });
      loadCycleAssetsAndReport(selectedCycleId);
    } catch (err) {
      setError(err.message || 'Failed to update verification status');
    }
  };

  const handleCloseCycle = async () => {
    if (!window.confirm('Closing the audit cycle will lock all verification records and update missing items to LOST in main inventory. Proceed?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/audits/cycles/${selectedCycleId}/close`, {});
      setSuccess(`Audit cycle closed successfully. Locked ${res.missingCount} Lost and ${res.damagedCount} Damaged updates.`);
      loadData();
      loadCycleAssetsAndReport(selectedCycleId);
    } catch (err) {
      setError(err.message || 'Failed to close audit cycle');
    }
  };

  const isManager = ['Admin', 'AssetManager'].includes(user?.role);
  const selectedCycle = cycles.find(c => String(c.id) === String(selectedCycleId));

  return (
    <div>
      {/* Create Cycle triggering */}
      <div className="flex gap-4 mb-6 justify-start flex-wrap items-center">
        {isManager && (
          <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => setShowCreateModal(true)}>
            + Start Audit Cycle
          </button>
        )}
        <div className="w-[260px]">
          <select
            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:border-accent"
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
          >
            <option value="">Select Audit Cycle</option>
            {cycles.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs font-bold text-left mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-xl p-3.5 text-xs font-bold text-left mb-6">
          {success}
        </div>
      )}

      {selectedCycleId ? (
        <>
          {/* Active Cycle Control info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left mb-8">
            <div className="flex justify-between flex-wrap gap-4 items-center">
              <div>
                <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">{selectedCycle?.name} Details</h3>
                <div className="text-slate-400 text-xs font-bold mt-1">
                  Scope: {selectedCycle?.scope_location ? `Location: ${selectedCycle.scope_location}` : ''}
                  {selectedCycle?.scope_department_id ? ` Department: ${selectedCycle.department_name}` : ''}
                  {!selectedCycle?.scope_location && !selectedCycle?.scope_department_id ? 'All Assets' : ''}
                  {' | '} Range: {selectedCycle?.start_date} to {selectedCycle?.end_date}
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                  selectedCycle?.status === 'Completed' ? 'bg-slate-100 text-slate-500 border-slate-200/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                }`}>
                  {selectedCycle?.status}
                </span>
                {isManager && selectedCycle?.status === 'Active' && (
                  <button className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={handleCloseCycle}>
                    Close & Lock Cycle
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Verification sheets & discrepancy reports in a grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
            {/* Scoped assets table list */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 lg:col-span-2">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Cycle Asset Checksheet</h3>
              </div>
              <div className="w-full overflow-x-auto mt-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Tag</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Name</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Expected Location</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Verification Status</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Notes</th>
                      {selectedCycle?.status === 'Active' && <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {scopedAssets.length === 0 ? (
                      <tr><td colSpan="6" className="py-8 text-slate-400 text-xs font-bold text-center">No scoped assets in this cycle.</td></tr>
                    ) : (
                      scopedAssets.map(item => (
                        <tr key={item.id}>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-emerald-600">{item.asset_tag}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{item.asset_name}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{item.location || <span className="text-slate-400 font-bold">N/A</span>}</td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                            <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                              item.verification_status === 'Verified' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' :
                              item.verification_status === 'Missing' ? 'bg-red-50 text-red-600 border-red-200/50' :
                              item.verification_status === 'Damaged' ? 'bg-amber-50 text-amber-600 border-amber-200/50' : 'bg-slate-100 text-slate-500 border-slate-200/50'
                            }`}>
                              {item.verification_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-500">{item.notes || 'N/A'}</td>
                          {selectedCycle?.status === 'Active' && (
                            <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                              <button
                                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedAsset(item);
                                  setVerifyForm({ verification_status: item.verification_status === 'Pending' ? 'Verified' : item.verification_status, notes: item.notes || '' });
                                  setShowVerifyModal(true);
                                }}
                              >
                                Verify
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discrepancy sheet */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="m-0 text-red-600 font-bold text-base capitalize tracking-wider">Discrepancy Report</h3>
              </div>
              {discrepancyReport?.discrepancies?.length === 0 ? (
                <div className="text-emerald-600 font-bold text-xs py-4">Perfect Match! No missing or damaged items flagged.</div>
              ) : (
                <div className="w-full overflow-x-auto mt-2">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Asset Tag</th>
                        <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Name</th>
                        <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discrepancyReport?.discrepancies?.map(disc => (
                        <tr key={disc.id} className="text-xs">
                          <td className="py-2 border-b border-slate-100 text-emerald-600 font-bold">{disc.asset_tag}</td>
                          <td className="py-2 border-b border-slate-100 text-slate-800">{disc.asset_name}</td>
                          <td className="py-2 border-b border-slate-100">
                            <span className={`text-[9px] font-bold rounded-lg px-2 py-0.5 uppercase border ${disc.verification_status === 'Missing' ? 'bg-red-50 text-red-600 border-red-200/50' : 'bg-amber-50 text-amber-600 border-amber-200/50'}`}>
                              {disc.verification_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-sm font-semibold">
          Please select an active or past audit cycle from the dropdown above to view scope details.
        </div>
      )}

      {/* Start Cycle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Create Verification Audit Cycle</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateCycleSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Audit Name *</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={cycleForm.name}
                    onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                    placeholder="e.g. Q3 Electronics Audit"
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Scope by Department (Optional)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={cycleForm.scope_department_id}
                    onChange={(e) => setCycleForm({ ...cycleForm, scope_department_id: e.target.value })}
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Scope by Storage/Location (Optional)</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={cycleForm.scope_location}
                    onChange={(e) => setCycleForm({ ...cycleForm, scope_location: e.target.value })}
                    placeholder="e.g. HQ 2nd Floor"
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={cycleForm.start_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">End Date *</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={cycleForm.end_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Initialize Cycle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Asset Modal */}
      {showVerifyModal && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Verify Asset: {selectedAsset.asset_tag}</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowVerifyModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleVerifySubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Verification Result</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={verifyForm.verification_status}
                    onChange={(e) => setVerifyForm({ ...verifyForm, verification_status: e.target.value })}
                  >
                    <option value="Verified">Verified (In possession & matching records)</option>
                    <option value="Missing">Missing (Not found in location)</option>
                    <option value="Damaged">Damaged (Defect detected)</option>
                  </select>
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Auditor Verification Notes</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent h-[100px]"
                    value={verifyForm.notes}
                    onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
                    placeholder="Enter observation notes, serial validation, etc."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowVerifyModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Update Check</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}