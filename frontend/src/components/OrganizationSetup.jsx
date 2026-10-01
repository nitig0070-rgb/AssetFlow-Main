import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function OrganizationSetup() {
  const [activeSubTab, setActiveSubTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [editingCat, setEditingCat] = useState(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', head_id: '', parent_id: '', status: 'Active' });
  const [catForm, setCatForm] = useState({ name: '', custom_fields: '{}' });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [deptsData, catsData, usersData] = await Promise.all([
          api.get('/departments'),
          api.get('/categories'),
          api.get('/users'),
        ]);
        setDepartments(deptsData.departments || []);
        setCategories(catsData.categories || []);
        setUsers(usersData.users || []);
      } catch (err) {
        setError(err.message || 'Failed to load organization settings');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingDept) {
        const res = await api.put(`/departments/${editingDept.id}`, deptForm);
        setDepartments(prev => prev.map(d => (d.id === editingDept.id ? { ...d, ...res.department } : d)));
        setSuccess('Department updated successfully');
      } else {
        const res = await api.post('/departments', deptForm);
        setDepartments(prev => [...prev, res.department]);
        setSuccess('Department created successfully');
      }
      setShowDeptModal(false);
      const usersData = await api.get('/users');
      setUsers(usersData.users || []);
    } catch (err) {
      setError(err.message || 'Failed to save department');
    }
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    let parsedFields = {};
    try {
      parsedFields = JSON.parse(catForm.custom_fields);
    } catch (err) {
      setError('Invalid custom fields JSON format. Must be a valid JSON object.');
      return;
    }

    try {
      const payload = { name: catForm.name, custom_fields: parsedFields };
      if (editingCat) {
        const res = await api.put(`/categories/${editingCat.id}`, payload);
        setCategories(prev => prev.map(c => (c.id === editingCat.id ? { ...c, ...res.category } : c)));
        setSuccess('Category updated successfully');
      } else {
        const res = await api.post('/categories', payload);
        setCategories(prev => [...prev, res.category]);
        setSuccess('Category created successfully');
      }
      setShowCatModal(false);
    } catch (err) {
      setError(err.message || 'Failed to save category');
    }
  };

  const handleUserRoleChange = async (userId, newRole) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      setSuccess('User role promoted/updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update user role');
    }
  };

  const handleUserStatusChange = async (userId, currentStatus) => {
    setError('');
    setSuccess('');
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.put(`/users/${userId}/status`, { status: newStatus });
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, status: newStatus } : u)));
      setSuccess(`User status changed to ${newStatus}`);
    } catch (err) {
      setError(err.message || 'Failed to change user status');
    }
  };

  const openEditDept = (dept) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      head_id: dept.head_id || '',
      parent_id: dept.parent_id || '',
      status: dept.status
    });
    setShowDeptModal(true);
  };

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm({ name: '', head_id: '', parent_id: '', status: 'Active' });
    setShowDeptModal(true);
  };

  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({
      name: cat.name,
      custom_fields: JSON.stringify(cat.custom_fields, null, 2)
    });
    setShowCatModal(true);
  };

  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', custom_fields: '{\n  "warranty_period_months": 24\n}' });
    setShowCatModal(true);
  };

  if (loading) {
    return <div className="text-slate-400 text-sm font-semibold text-left">Loading system master data...</div>;
  }

  return (
    <div>
      {/* Sub tabs header */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 text-left">
        <button
          className={`py-3 px-5 text-sm font-bold text-slate-400 border-b-2 border-transparent transition-all cursor-pointer hover:text-slate-900 hover:border-slate-300 ${
            activeSubTab === 'departments' ? 'text-accent border-b-accent hover:text-accent hover:border-b-accent' : ''
          }`}
          onClick={() => setActiveSubTab('departments')}
        >
          Departments
        </button>
        <button
          className={`py-3 px-5 text-sm font-bold text-slate-400 border-b-2 border-transparent transition-all cursor-pointer hover:text-slate-900 hover:border-slate-300 ${
            activeSubTab === 'categories' ? 'text-accent border-b-accent hover:text-accent hover:border-b-accent' : ''
          }`}
          onClick={() => setActiveSubTab('categories')}
        >
          Asset Categories
        </button>
        <button
          className={`py-3 px-5 text-sm font-bold text-slate-400 border-b-2 border-transparent transition-all cursor-pointer hover:text-slate-900 hover:border-slate-300 ${
            activeSubTab === 'employees' ? 'text-accent border-b-accent hover:text-accent hover:border-b-accent' : ''
          }`}
          onClick={() => setActiveSubTab('employees')}
        >
          Employee Directory
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 text-red-200 rounded-lg p-3.5 text-xs text-left mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 rounded-lg p-3.5 text-xs text-left mb-6">
          {success}
        </div>
      )}

      {/* Tab A: Departments */}
      {activeSubTab === 'departments' && (
        <div className="bg-panel border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-extrabold text-sm uppercase tracking-wider">Department Management</h3>
            <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-xl py-2.5 px-4 text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={openCreateDept}>+ Add Department</button>
          </div>
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Department Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Department Head</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Parent Department</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Status</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr><td colSpan="5" className="py-8 text-slate-400 text-xs font-bold text-center">No departments registered.</td></tr>
                ) : (
                  departments.map(dept => (
                    <tr key={dept.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{dept.name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{dept.head_name || <span className="text-slate-400 font-bold italic">None assigned</span>}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{dept.parent_name || <span className="text-slate-400 font-bold">Root</span>}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                          dept.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-slate-100 text-slate-500 border-slate-200/50'
                        }`}>
                          {dept.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors" onClick={() => openEditDept(dept)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab B: Asset Categories */}
      {activeSubTab === 'categories' && (
        <div className="bg-panel border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-extrabold text-sm uppercase tracking-wider">Asset Category Configurations</h3>
            <button className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-xl py-2.5 px-4 text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors" onClick={openCreateCat}>+ Add Category</button>
          </div>
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Category Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Custom Field Schema</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan="3" className="py-8 text-slate-400 text-xs font-bold text-center">No categories registered.</td></tr>
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{cat.name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <pre className="margin-0 text-[11px] bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-left max-w-xs overflow-x-auto">
                          {JSON.stringify(cat.custom_fields, null, 2)}
                        </pre>
                      </td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-lg py-1 px-3 text-[10px] cursor-pointer transition-colors" onClick={() => openEditCat(cat)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab C: Employee Directory */}
      {activeSubTab === 'employees' && (
        <div className="bg-panel border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 text-left">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="m-0 text-slate-900 font-extrabold text-sm uppercase tracking-wider">Employee Directory Roles & Status</h3>
          </div>
          <div className="w-full overflow-x-auto mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Name</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Email</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Department</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">System Role</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Account Status</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3 border-b border-slate-200 bg-slate-50/50 px-4">Toggle Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-slate-400 text-xs font-bold text-center">No users registered.</td></tr>
                ) : (
                  users.map(emp => (
                    <tr key={emp.id}>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs font-bold text-slate-900">{emp.name}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{emp.email}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs text-slate-600">{emp.department_name || <span className="text-slate-400 font-bold">None</span>}</td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <select
                          className="w-[150px] bg-white border border-slate-200 text-slate-900 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-accent"
                          value={emp.role}
                          onChange={(e) => handleUserRoleChange(emp.id, e.target.value)}
                        >
                          <option value="Employee">Employee</option>
                          <option value="DepartmentHead">Department Head</option>
                          <option value="AssetManager">Asset Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 uppercase border ${
                          emp.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-red-50 text-red-600 border-red-200/50'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 border-b border-slate-100 text-xs">
                        <button
                          className={`font-bold rounded-lg py-1 px-3 text-[10px] border cursor-pointer transition-colors ${
                            emp.status === 'Active' 
                              ? 'border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50' 
                              : 'border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50'
                          }`}
                          onClick={() => handleUserStatusChange(emp.id, emp.status)}
                        >
                          {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-extrabold text-sm uppercase tracking-wider">{editingDept ? 'Edit Department' : 'Create Department'}</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowDeptModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleDeptSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Department Name</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm transition-all focus:outline-none focus:border-accent"
                    required
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Assign Department Head (Select from Directory)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={deptForm.head_id}
                    onChange={(e) => setDeptForm({ ...deptForm, head_id: e.target.value })}
                  >
                    <option value="">None</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Parent Department (Hierarchy)</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={deptForm.parent_id}
                    onChange={(e) => setDeptForm({ ...deptForm, parent_id: e.target.value })}
                  >
                    <option value="">None (Root)</option>
                    {departments.filter(d => !editingDept || d.id !== editingDept.id).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-accent"
                    value={deptForm.status}
                    onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl py-2.5 px-4 text-xs cursor-pointer" onClick={() => setShowDeptModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-xl py-2.5 px-4 text-xs cursor-pointer">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-left flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900 font-extrabold text-sm uppercase tracking-wider">{editingCat ? 'Edit Category' : 'Create Category'}</h3>
              <button className="text-2xl text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer" onClick={() => setShowCatModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCatSubmit}>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Category Name</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm transition-all focus:outline-none focus:border-accent"
                    required
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  />
                </div>
                <div className="w-full text-left">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Custom Fields JSON Scheme (e.g. warranty: 24, size: "15inch")</label>
                  <textarea
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg py-2 px-3 text-sm font-mono focus:outline-none focus:border-accent h-[120px]"
                    required
                    value={catForm.custom_fields}
                    onChange={(e) => setCatForm({ ...catForm, custom_fields: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4.5 border-t border-slate-100 bg-slate-50">
                <button type="button" className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl py-2.5 px-4 text-xs cursor-pointer" onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold border-none rounded-xl py-2.5 px-4 text-xs cursor-pointer">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
