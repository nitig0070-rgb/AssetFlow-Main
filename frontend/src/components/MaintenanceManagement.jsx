import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function MaintenanceManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]); // to select technician
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Selected state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [assignTechId, setAssignTechId] = useState({});

  // Forms state
  const [raiseForm, setRaiseForm] = useState({ asset_id: '', description: '', priority: 'Medium', photo_url: '' });
  const [resolveForm, setResolveForm] = useState({ resolution_notes: '', condition: 'Good' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [maintRes, assetsRes, usersRes] = await Promise.all([
        api.get('/maintenance'),
        api.get('/assets'),
        api.get('/users'),
      ]);
      setRequests(maintRes.requests || []);
      setAssets(assetsRes.assets || []);
      setUsers(usersRes.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load maintenance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRaiseSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!raiseForm.asset_id || !raiseForm.description) {
      setError('Asset and problem description are required');
      return;
    }

    try {
      await api.post('/maintenance', raiseForm);
      setSuccess('Maintenance request successfully raised');
      setShowRaiseModal(false);
      setRaiseForm({ asset_id: '', description: '', priority: 'Medium', photo_url: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to raise request');
    }
  };

  const handleStatusChange = async (requestId, status, additionalPayload = {}) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/maintenance/${requestId}/status`, { status, ...additionalPayload });
      setSuccess(`Maintenance request successfully updated to ${status}`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update request status');
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedRequest) return;

    try {
      await api.put(`/maintenance/${selectedRequest.id}/status`, {
        status: 'Resolved',
        ...resolveForm
      });
      setSuccess('Maintenance request successfully marked as Resolved. Asset is now Available.');
      setShowResolveModal(false);
      setSelectedRequest(null);
      setResolveForm({ resolution_notes: '', condition: 'Good' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to resolve request');
    }
  };

  const isManager = ['Admin', 'AssetManager'].includes(user?.role);

  return (
    <div>
      {/* Raise button */}
      <div className="flex gap-3 mb-6 justify-start">
        <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => setShowRaiseModal(true)}>
          + Raise Maintenance Request
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

      {/* Requests table listing */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Maintenance Flow Logs</h3>
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm font-semibold py-4">Loading maintenance flow...</div>
        ) : (
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Request ID</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Requester</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Problem Details</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Priority</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Assigned Tech</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Work Status</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions Workflow</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="9" className="py-8 text-slate-400 text-xs font-bold text-center">No maintenance logs matching access rights.</td></tr>
                ) : (
                  requests.map(req => {
                    const isAssignedTech = req.assigned_technician_id === user.id;
                    const canResolve = isAssignedTech || isManager;
                    return (
                      <tr key={req.id}>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-slate-500">MR-{String(req.id).padStart(4, '0')}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{req.asset_name}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-emerald-600">{req.asset_tag}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{req.requester_name}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{req.description}</td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                            req.priority === 'Critical' ? 'bg-red-50 text-red-600 border-red-200/50' :
                            req.priority === 'High' ? 'bg-purple-50 text-purple-600 border-purple-200/50' : 'bg-blue-50 text-blue-600 border-blue-200/50'
                          }`}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          {req.technician_name ? (
                            req.technician_name
                          ) : isManager && req.status === 'Approved' ? (
                            <div className="flex gap-2">
                              <select
                                className="bg-white border border-slate-200 text-slate-900 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-accent w-[130px]"
                                value={assignTechId[req.id] || ''}
                                onChange={(e) => setAssignTechId({ ...assignTechId, [req.id]: e.target.value })}
                              >
                                <option value="">Select Tech</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                              <button
                                className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-lg py-1 px-2 text-[10px] cursor-pointer transition-colors"
                                onClick={() => handleStatusChange(req.id, 'Technician Assigned', { assigned_technician_id: assignTechId[req.id] })}
                              >
                                Assign
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-bold italic text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                            req.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' :
                            req.status === 'Pending' ? 'bg-purple-50 text-purple-600 border-purple-200/50' : 'bg-blue-50 text-blue-600 border-blue-200/50'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                          <div className="flex gap-2 flex-wrap">
                            {isManager && req.status === 'Pending' && (
                              <>
                                <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-lg py-1 px-2 text-[10px] cursor-pointer transition-colors" onClick={() => handleStatusChange(req.id, 'Approved')}>
                                  Approve
                                </button>
                                <button className="bg-white hover:bg-slate-50 border border-slate-200 text-red-600 font-bold rounded-lg py-1 px-2 text-[10px] cursor-pointer transition-colors" onClick={() => handleStatusChange(req.id, 'Rejected')}>
                                  Reject
                                </button>
                              </>
                            )}

                            {req.status === 'Technician Assigned' && canResolve && (
                              <button className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 font-bold rounded-lg py-1 px-2.5 text-[10px] cursor-pointer transition-colors" onClick={() => handleStatusChange(req.id, 'In Progress')}>
                                Start Repair
                              </button>
                            )}

                            {req.status === 'In Progress' && canResolve && (
                              <button
                                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 font-bold rounded-lg py-1 px-2.5 text-[10px] cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setShowResolveModal(true);
                                }}
                              >
                                Mark Resolved
                              </button>
                            )}

                            {['Resolved', 'Rejected'].includes(req.status) && (
                              <span className="text-slate-400 text-xs font-bold">Completed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raise Request Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Raise Maintenance Request</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowRaiseModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRaiseSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Select Asset</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={raiseForm.asset_id}
                    onChange={(e) => setRaiseForm({ ...raiseForm, asset_id: e.target.value })}
                  >
                    <option value="">Select Asset</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag} - {a.status})</option>
                    ))}
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Priority Level</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={raiseForm.priority}
                    onChange={(e) => setRaiseForm({ ...raiseForm, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Issue Description</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent h-[100px]"
                    required
                    value={raiseForm.description}
                    onChange={(e) => setRaiseForm({ ...raiseForm, description: e.target.value })}
                    placeholder="Provide details about the defect, squeaking, sticky keys, error messages, etc."
                  />
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Photo URL (Optional)</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={raiseForm.photo_url}
                    onChange={(e) => setRaiseForm({ ...raiseForm, photo_url: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowRaiseModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Request Modal */}
      {showResolveModal && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Resolve Maintenance: MR-{String(selectedRequest.id).padStart(4, '0')}</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowResolveModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleResolveSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Post-Repair Asset Condition</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={resolveForm.condition}
                    onChange={(e) => setResolveForm({ ...resolveForm, condition: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>

                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Resolution Action Log Notes</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent h-[100px]"
                    required
                    value={resolveForm.resolution_notes}
                    onChange={(e) => setResolveForm({ ...resolveForm, resolution_notes: e.target.value })}
                    placeholder="Describe what repair actions were taken to fix the issue..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowResolveModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Complete Resolution</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}