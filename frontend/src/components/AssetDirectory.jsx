import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AssetDirectory() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering states
  const [filters, setFilters] = useState({ search: '', category_id: '', status: '', is_bookable: '' });

  // Modals state
  const [showRegModal, setShowRegModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetHistory, setAssetHistory] = useState({ allocations: [], maintenance: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states for new registration
  const [regForm, setRegForm] = useState({
    name: '',
    category_id: '',
    serial_number: '',
    acquisition_date: '',
    acquisition_cost: '',
    condition: 'Good',
    location: '',
    photo_url: '',
    documents_url: '',
    is_bookable: false
  });

  const isElevated = ['Admin', 'AssetManager'].includes(user?.role);

  // Load assets & categories
  const loadAssets = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.category_id) queryParams.append('category_id', filters.category_id);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.is_bookable) queryParams.append('is_bookable', filters.is_bookable);

      const [assetsData, catsData] = await Promise.all([
        api.get(`/assets?${queryParams.toString()}`),
        api.get('/categories')
      ]);

      setAssets(assetsData.assets || []);
      setCategories(catsData.categories || []);
    } catch (err) {
      setError(err.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [filters]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!regForm.name || !regForm.category_id) {
      setError('Asset name and category are required.');
      return;
    }

    try {
      const payload = {
        ...regForm,
        acquisition_cost: parseFloat(regForm.acquisition_cost) || 0.0,
        is_bookable: regForm.is_bookable ? 1 : 0
      };

      await api.post('/assets', payload);
      setSuccess('Asset registered successfully');
      setShowRegModal(false);

      // Reset form
      setRegForm({
        name: '',
        category_id: '',
        serial_number: '',
        acquisition_date: '',
        acquisition_cost: '',
        condition: 'Good',
        location: '',
        photo_url: '',
        documents_url: '',
        is_bookable: false
      });

      loadAssets();
    } catch (err) {
      setError(err.message || 'Failed to register asset');
    }
  };

  const handleViewAssetDetails = async (asset) => {
    setSelectedAsset(asset);
    setLoadingHistory(true);
    setAssetHistory({ allocations: [], maintenance: [] });
    try {
      const [allocRes, maintRes] = await Promise.all([
        api.get(`/allocations/history/${asset.id}`),
        api.get(`/maintenance?asset_id=${asset.id}`)
      ]);
      setAssetHistory({
        allocations: allocRes.history || [],
        maintenance: maintRes.requests || []
      });
    } catch (err) {
      console.error('Failed to load asset histories:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusBadge = (status) => {
    const classMap = {
      'Available': 'bg-emerald-50 text-emerald-600 border-emerald-200/50',
      'Allocated': 'bg-blue-50 text-blue-600 border-blue-200/50',
      'Reserved': 'bg-purple-50 text-purple-600 border-purple-200/50',
      'Under Maintenance': 'bg-amber-50 text-amber-600 border-amber-200/50',
      'Lost': 'bg-red-50 text-red-600 border-red-200/50',
      'Retired': 'bg-slate-100 text-slate-500 border-slate-200/50',
      'Disposed': 'bg-slate-200 text-slate-700 border-slate-300/50'
    };
    return (
      <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${classMap[status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 text-left">
        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex-grow min-w-[200px]">
            <input
              type="text"
              placeholder="Search by tag, name, serial or location..."
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3.5 text-sm transition-all focus:outline-none focus:border-accent"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="w-[180px]">
            <select
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3.5 text-sm transition-all focus:outline-none focus:border-accent"
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-[180px]">
            <select
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3.5 text-sm transition-all focus:outline-none focus:border-accent"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Lifecycles</option>
              <option value="Available">Available</option>
              <option value="Allocated">Allocated</option>
              <option value="Reserved">Reserved</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Lost">Lost</option>
              <option value="Retired">Retired</option>
              <option value="Disposed">Disposed</option>
            </select>
          </div>
          <div className="w-[180px]">
            <select
              className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3.5 text-sm transition-all focus:outline-none focus:border-accent"
              value={filters.is_bookable}
              onChange={(e) => setFilters({ ...filters, is_bookable: e.target.value })}
            >
              <option value="">All Bookability</option>
              <option value="true">Shared/Bookable</option>
              <option value="false">Unbookable/Static</option>
            </select>
          </div>
          {isElevated && (
            <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-3 px-6 text-sm flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={() => setShowRegModal(true)}>+ Register Asset</button>
          )}
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

      {/* Main Asset Directory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="m-0 text-slate-900 font-bold text-base capitalize tracking-wider">Asset Directory Listing</h3>
          <span className="text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase bg-emerald-50 text-emerald-600 border border-emerald-200/50">{assets.length} items found</span>
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm font-semibold py-4">Filtering assets inventory...</div>
        ) : (
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Tag</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Asset Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Category</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Serial Number</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Location</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Bookable</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Condition</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Lifecycle Status</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan="9" className="py-8 text-slate-400 text-xs font-bold text-center">No assets matched the filters.</td></tr>
                ) : (
                  assets.map(asset => (
                    <tr key={asset.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-semibold text-emerald-600 cursor-pointer" onClick={() => handleViewAssetDetails(asset)}>
                        {asset.asset_tag}
                      </td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{asset.name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{asset.category_name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{asset.serial_number || <span className="text-slate-400 font-bold">N/A</span>}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{asset.location || <span className="text-slate-400 font-bold">N/A</span>}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <span className={`text-[10px] font-bold rounded-lg px-2 py-0.5 uppercase border ${
                          asset.is_bookable === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-slate-100 text-slate-500 border-slate-200/50'
                        }`}>
                          {asset.is_bookable === 1 ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{asset.condition}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">{getStatusBadge(asset.status)}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors" onClick={() => handleViewAssetDetails(asset)}>
                          History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Asset History / Details Drawer Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Asset details: {selectedAsset.asset_tag} ({selectedAsset.name})</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setSelectedAsset(null)}>&times;</button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><strong>Category:</strong> {selectedAsset.category_name}</div>
                <div><strong>Serial Number:</strong> {selectedAsset.serial_number || 'N/A'}</div>
                <div><strong>Acquisition Cost:</strong> ${selectedAsset.acquisition_cost}</div>
                <div><strong>Acquisition Date:</strong> {selectedAsset.acquisition_date}</div>
                <div><strong>Condition:</strong> {selectedAsset.condition}</div>
                <div><strong>Location:</strong> {selectedAsset.location || 'N/A'}</div>
              </div>

              {loadingHistory ? (
                <div className="text-slate-400 text-xs font-semibold py-4">Loading asset history...</div>
              ) : (
                <>
                  <h4 className="border-b border-slate-200 pb-1 font-bold text-xs uppercase tracking-wide text-slate-500">Allocation History</h4>
                  {assetHistory.allocations.length === 0 ? (
                    <p className="text-slate-400 text-xs font-semibold py-2">No allocation history recorded for this asset.</p>
                  ) : (
                    <table className="w-full border-collapse mb-4">
                      <thead>
                        <tr>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Assigned To</th>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Allocation Date</th>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Return Date</th>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetHistory.allocations.map(al => (
                          <tr key={al.id} className="text-xs">
                            <td className="py-2 border-b border-slate-100 text-slate-900 font-bold">{al.user_name || al.department_name || 'N/A'}</td>
                            <td className="py-2 border-b border-slate-100 text-slate-600">{new Date(al.allocation_date).toLocaleDateString()}</td>
                            <td className="py-2 border-b border-slate-100 text-slate-600">{al.returned_date ? new Date(al.returned_date).toLocaleDateString() : <span className="text-emerald-600 font-bold">Active Possession</span>}</td>
                            <td className="py-2 border-b border-slate-100 text-slate-500">{al.return_notes || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <h4 className="border-b border-slate-200 pb-1 font-bold text-xs uppercase tracking-wide text-slate-500">Maintenance History</h4>
                  {assetHistory.maintenance.length === 0 ? (
                    <p className="text-slate-400 text-xs font-semibold py-2">No maintenance history recorded for this asset.</p>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Technician</th>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Description</th>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Resolved Date</th>
                          <th className="text-left text-[9px] font-bold text-slate-400 uppercase py-2 border-b border-slate-200">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetHistory.maintenance.map(m => (
                          <tr key={m.id} className="text-xs">
                            <td className="py-2 border-b border-slate-100 text-slate-900 font-bold">{m.technician_name || 'None assigned'}</td>
                            <td className="py-2 border-b border-slate-100 text-slate-600">{m.description}</td>
                            <td className="py-2 border-b border-slate-100 text-slate-600">{m.resolved_date ? new Date(m.resolved_date).toLocaleDateString() : 'Active Repair'}</td>
                            <td className="py-2 border-b border-slate-100 text-slate-600">{m.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-xl py-2.5 px-5 text-sm cursor-pointer shadow-sm" onClick={() => setSelectedAsset(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Register Form Modal */}
      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-bold text-base capitalize tracking-wider">Register New Physical Asset</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowRegModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRegisterSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Asset Name *</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Category *</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    required
                    value={regForm.category_id}
                    onChange={(e) => setRegForm({ ...regForm, category_id: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Serial Number</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={regForm.serial_number}
                    onChange={(e) => setRegForm({ ...regForm, serial_number: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Acquisition Date</label>
                  <input
                    type="date"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={regForm.acquisition_date}
                    onChange={(e) => setRegForm({ ...regForm, acquisition_date: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Acquisition Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={regForm.acquisition_cost}
                    onChange={(e) => setRegForm({ ...regForm, acquisition_cost: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Condition</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={regForm.condition}
                    onChange={(e) => setRegForm({ ...regForm, condition: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Storage / Current Location</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={regForm.location}
                    onChange={(e) => setRegForm({ ...regForm, location: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 w-full justify-start">
                  <input
                    type="checkbox"
                    id="is_bookable"
                    checked={regForm.is_bookable}
                    onChange={(e) => setRegForm({ ...regForm, is_bookable: e.target.checked })}
                    className="w-4 h-4 accent-accent border border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="is_bookable" className="text-xs text-slate-700 font-bold cursor-pointer">Mark as a shared/bookable resource (Room, Vehicle, etc.)</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full py-2.5 px-5 text-xs cursor-pointer transition-colors" onClick={() => setShowRegModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-full py-2.5 px-5 text-xs cursor-pointer shadow-sm transition-colors">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}