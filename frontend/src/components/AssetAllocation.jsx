import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AssetAllocation() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Focus states
  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const [conflictDetails, setConflictDetails] = useState(null);

  // Form states
  const [allocForm, setAllocForm] = useState({ asset_id: '', user_id: '', department_id: '', expected_return_date: '' });
  const [returnForm, setReturnForm] = useState({ condition: 'Good', return_notes: '' });
  const [transferForm, setTransferForm] = useState({ asset_id: '', to_user_id: '', to_department_id: '', remarks: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocRes, assetsRes, usersRes, deptsRes, transfersRes] = await Promise.all([
        api.get('/allocations'),
        api.get('/assets'),
        api.get('/users'),
        api.get('/departments'),
        api.get('/transfers'),
      ]);
      setAllocations(allocRes.allocations || []);
      setAssets(assetsRes.assets || []);
      setUsers(usersRes.users || []);
      setDepartments(deptsRes.departments || []);
      setTransfers(transfersRes.transfers || []);
    } catch (err) {
      setError(err.message || 'Failed to load allocation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setConflictDetails(null);

    try {
      await api.post('/allocations', allocForm);
      setSuccess('Asset allocated successfully');
      setShowAllocModal(false);
      setAllocForm({ asset_id: '', user_id: '', department_id: '', expected_return_date: '' });
      loadData();
    } catch (err) {
      if (err.status === 409) {
        setConflictDetails({
          assetId: allocForm.asset_id,
          message: err.message || err.data?.message,
          currentlyHeldBy: err.data?.currentlyHeldBy || 'another employee'
        });
      } else {
        setError(err.message || 'Failed to allocate asset');
      }
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedAlloc) return;

    try {
      await api.post(`/allocations/${selectedAlloc.id}/return`, returnForm);
      setSuccess('Asset returned and checked in successfully');
      setShowReturnModal(false);
      setSelectedAlloc(null);
      setReturnForm({ condition: 'Good', return_notes: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to process return');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/transfers', transferForm);
      setSuccess('Transfer request submitted successfully');
      setShowTransferModal(false);
      setTransferForm({ asset_id: '', to_user_id: '', to_department_id: '', remarks: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to request transfer');
    }
  };

  const handleApproveTransfer = async (transferId) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/transfers/${transferId}/approve`);
      setSuccess('Transfer request approved and asset re-allocated');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to approve transfer');
    }
  };

  const handleRejectTransfer = async (transferId) => {
    setError('');
    setSuccess('');
    const remarks = prompt('Please enter rejection remarks:');
    if (remarks === null) return;
    try {
      await api.post(`/transfers/${transferId}/reject`, { remarks });
      setSuccess('Transfer request rejected');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to reject transfer');
    }
  };

  const handleInitiateConflictTransfer = () => {
    const asset = assets.find(a => String(a.id) === String(conflictDetails.assetId));
    setTransferForm({
      asset_id: conflictDetails.assetId,
      to_user_id: user.id,
      to_department_id: '',
      remarks: `Request transfer of ${asset ? asset.name : 'asset'} from ${conflictDetails.currentlyHeldBy}`
    });
    setConflictDetails(null);
    setShowAllocModal(false);
    setShowTransferModal(true);
  };

  const openReturnModal = (alloc) => {
    setSelectedAlloc(alloc);
    setShowReturnModal(true);
  };

  const isElevated = ['Admin', 'AssetManager'].includes(user?.role);

  return (
    <div>
      {/* Allocation Action buttons */}
      <div className="flex gap-3 mb-6 justify-start">
        {isElevated && (
          <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => setShowAllocModal(true)}>
            Allocate Asset
          </button>
        )}
        <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer transition-colors" onClick={() => setShowTransferModal(true)}>
          Request Transfer
        </button>
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

      {/* Section: Possessions (Employee) or Active Allocations (Managers) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left mb-8">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">{isElevated ? 'Active Asset Allocations' : 'My Possessed Assets'}</h3>
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm font-semibold py-4">Loading allocations...</div>
        ) : (
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Possessor Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Assigned Date</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Expected Return</th>
                  {isElevated && <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-slate-400 text-xs font-bold text-center">No active allocations found.</td></tr>
                ) : (
                  allocations.map(al => (
                    <tr key={al.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-emerald-600">{al.asset_tag}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{al.asset_name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{al.user_name || al.department_name || 'N/A'}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{new Date(al.allocation_date).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{al.expected_return_date ? new Date(al.expected_return_date).toLocaleDateString() : 'Continuous'}</td>
                      {isElevated && (
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          <button className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors" onClick={() => openReturnModal(al)}>
                            Check-in Return
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section: Transfer Requests */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Asset Transfer Requests</h3>
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm font-semibold py-4">Loading transfers...</div>
        ) : (
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">From User</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Transfer To</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Requested By</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Remarks</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Status</th>
                  {(isElevated || user?.role === 'DepartmentHead') && <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan="8" className="py-8 text-slate-400 text-xs font-bold text-center">No transfer requests logged.</td></tr>
                ) : (
                  transfers.map(tr => (
                    <tr key={tr.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-emerald-600">{tr.asset_tag}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{tr.asset_name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{tr.from_user_name || <span className="text-slate-400 font-bold">N/A</span>}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{tr.to_user_name || tr.to_department_name || 'N/A'}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{tr.requested_by_name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-500">{tr.remarks || 'None'}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                          tr.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' :
                          tr.status === 'Pending' ? 'bg-purple-50 text-purple-600 border-purple-200/50' : 'bg-red-50 text-red-600 border-red-200/50'
                        }`}>
                          {tr.status}
                        </span>
                      </td>
                      {(isElevated || user?.role === 'DepartmentHead') && (
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          {tr.status === 'Pending' ? (
                            <div className="flex gap-2">
                              <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-lg py-1 px-2.5 text-[10px] cursor-pointer transition-colors" onClick={() => handleApproveTransfer(tr.id)}>
                                Approve
                              </button>
                              <button className="bg-white hover:bg-slate-50 border border-slate-200 text-red-600 font-bold rounded-lg py-1 px-2.5 text-[10px] cursor-pointer transition-colors" onClick={() => handleRejectTransfer(tr.id)}>
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-bold">Closed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Allocate Asset Modal */}
      {showAllocModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Allocate Asset to Possession</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => { setShowAllocModal(false); setConflictDetails(null); }}>&times;</button>
            </div>
            <form onSubmit={handleAllocateSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                {conflictDetails && (
                  <div className="bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs font-bold text-left mb-3 flex flex-col gap-2">
                    <div><strong>Conflict:</strong> {conflictDetails.message}</div>
                    <button type="button" className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 font-bold rounded-lg py-1.5 px-3.5 text-xs cursor-pointer self-start transition-colors" onClick={handleInitiateConflictTransfer}>
                      Request Transfer from {conflictDetails.currentlyHeldBy}
                    </button>
                  </div>
                )}

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Select Asset</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={allocForm.asset_id}
                    onChange={(e) => setAllocForm({ ...allocForm, asset_id: e.target.value })}
                  >
                    <option value="">Select Asset</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag} - {a.status})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Allocate to User (Optional)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={allocForm.user_id}
                    onChange={(e) => setAllocForm({ ...allocForm, user_id: e.target.value, department_id: '' })}
                  >
                    <option value="">None (Select Department instead)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Allocate to Department (Optional)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={allocForm.department_id}
                    onChange={(e) => setAllocForm({ ...allocForm, department_id: e.target.value, user_id: '' })}
                  >
                    <option value="">None (Select User instead)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Expected Return Date (Optional)</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={allocForm.expected_return_date}
                    onChange={(e) => setAllocForm({ ...allocForm, expected_return_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => { setShowAllocModal(false); setConflictDetails(null); }}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Allocate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return check-in Modal */}
      {showReturnModal && selectedAlloc && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Check-in Return: {selectedAlloc.asset_tag}</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowReturnModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Asset Return Condition</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={returnForm.condition}
                    onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Return / Condition Notes</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent h-[100px]"
                    value={returnForm.return_notes}
                    onChange={(e) => setReturnForm({ ...returnForm, return_notes: e.target.value })}
                    placeholder="Enter details about physical condition at check-in..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowReturnModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Process Check-In</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Request Asset Transfer</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowTransferModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTransferSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Select Allocated Asset</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={transferForm.asset_id}
                    onChange={(e) => setTransferForm({ ...transferForm, asset_id: e.target.value })}
                  >
                    <option value="">Select Asset</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag} - {a.status})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Transfer Target User (Optional)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={transferForm.to_user_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_user_id: e.target.value, to_department_id: '' })}
                  >
                    <option value="">None (Select Department instead)</option>
                    {users.filter(u => u.id !== user.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Transfer Target Department (Optional)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={transferForm.to_department_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_department_id: e.target.value, to_user_id: '' })}
                  >
                    <option value="">None (Select User instead)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Justification Remarks</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent h-[100px]"
                    required
                    value={transferForm.remarks}
                    onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                    placeholder="Enter reason for requesting this transfer..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Request Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}