import { useState } from "react";
import { Plus, Pencil, Shield } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import Modal from "../ui/Modal";

const TABS = ["Departments", "Asset Categories", "Employee Directory"];

// ---- Mock data (replace with API later) ----
const initialDepartments = [
  { id: 1, name: "IT", head: "Priya Sharma", parent: "-", status: "Active" },
  { id: 2, name: "Facilities", head: "Rahul Verma", parent: "-", status: "Active" },
  { id: 3, name: "IT Support", head: "Amit Kumar", parent: "IT", status: "Active" },
];

const initialCategories = [
  { id: 1, name: "Electronics", extraField: "Warranty Period (months)" },
  { id: 2, name: "Furniture", extraField: "-" },
  { id: 3, name: "Vehicles", extraField: "Insurance Expiry" },
];

const initialEmployees = [
  { id: 1, name: "Priya Sharma", email: "priya@org.com", department: "IT", role: "Employee", status: "Active" },
  { id: 2, name: "Rahul Verma", email: "rahul@org.com", department: "Facilities", role: "Employee", status: "Active" },
  { id: 3, name: "Amit Kumar", email: "amit@org.com", department: "IT", role: "Employee", status: "Active" },
];

export default function OrganizationSetup() {
  const [activeTab, setActiveTab] = useState("Departments");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Organization Setup</h2>
        <p className="text-sm text-gray-400">Manage departments, categories, and the employee directory</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-1.5 w-fit shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Departments" && <DepartmentsTab />}
      {activeTab === "Asset Categories" && <CategoriesTab />}
      {activeTab === "Employee Directory" && <EmployeesTab />}
    </div>
  );
}

// ---------------- Tab A: Departments ----------------
function DepartmentsTab() {
  const [departments, setDepartments] = useState(initialDepartments);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", head: "", parent: "-" });

  const handleAdd = () => {
    if (!form.name) return;
    setDepartments([
      ...departments,
      { id: Date.now(), name: form.name, head: form.head || "-", parent: form.parent, status: "Active" },
    ]);
    setForm({ name: "", head: "", parent: "-" });
    setShowModal(false);
  };

  const toggleStatus = (id) => {
    setDepartments(departments.map((d) =>
      d.id === id ? { ...d, status: d.status === "Active" ? "Inactive" : "Active" } : d
    ));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Departments</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90"
        >
          <Plus size={16} /> Add Department
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-100">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Department Head</th>
            <th className="pb-3 font-medium">Parent</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id} className="border-b border-gray-50 last:border-0">
              <td className="py-3 font-medium text-gray-800">{d.name}</td>
              <td className="py-3 text-gray-600">{d.head}</td>
              <td className="py-3 text-gray-600">{d.parent}</td>
              <td className="py-3"><StatusBadge status={d.status} /></td>
              <td className="py-3 text-right">
                <button
                  onClick={() => toggleStatus(d.id)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {d.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <Modal title="Add Department" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-3">
            <input
              placeholder="Department Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="Department Head"
              value={form.head}
              onChange={(e) => setForm({ ...form, head: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={form.parent}
              onChange={(e) => setForm({ ...form, parent: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="-">No Parent (Top-level)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              className="bg-primary text-white text-sm font-medium py-2.5 rounded-xl mt-2 hover:opacity-90"
            >
              Save Department
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Tab B: Asset Categories ----------------
function CategoriesTab() {
  const [categories, setCategories] = useState(initialCategories);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", extraField: "" });

  const handleAdd = () => {
    if (!form.name) return;
    setCategories([
      ...categories,
      { id: Date.now(), name: form.name, extraField: form.extraField || "-" },
    ]);
    setForm({ name: "", extraField: "" });
    setShowModal(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Asset Categories</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-100">
            <th className="pb-3 font-medium">Category</th>
            <th className="pb-3 font-medium">Category-specific Field</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-gray-50 last:border-0">
              <td className="py-3 font-medium text-gray-800">{c.name}</td>
              <td className="py-3 text-gray-600">{c.extraField}</td>
              <td className="py-3 text-right">
                <button className="text-gray-400 hover:text-primary">
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <Modal title="Add Asset Category" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-3">
            <input
              placeholder="Category Name (e.g. Electronics)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="Optional field (e.g. Warranty Period)"
              value={form.extraField}
              onChange={(e) => setForm({ ...form, extraField: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleAdd}
              className="bg-primary text-white text-sm font-medium py-2.5 rounded-xl mt-2 hover:opacity-90"
            >
              Save Category
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Tab C: Employee Directory ----------------
function EmployeesTab() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [promoteTarget, setPromoteTarget] = useState(null);

  const promote = (id, role) => {
    setEmployees(employees.map((e) => (e.id === id ? { ...e, role } : e)));
    setPromoteTarget(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Employee Directory</h3>
        <p className="text-xs text-gray-400">Roles are assigned only from here</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-100">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Department</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} className="border-b border-gray-50 last:border-0">
              <td className="py-3 font-medium text-gray-800">{e.name}</td>
              <td className="py-3 text-gray-600">{e.email}</td>
              <td className="py-3 text-gray-600">{e.department}</td>
              <td className="py-3">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-light text-primary">
                  {e.role}
                </span>
              </td>
              <td className="py-3"><StatusBadge status={e.status} /></td>
              <td className="py-3 text-right">
                <button
                  onClick={() => setPromoteTarget(e)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline ml-auto"
                >
                  <Shield size={13} /> Promote
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {promoteTarget && (
        <Modal title={`Promote ${promoteTarget.name}`} onClose={() => setPromoteTarget(null)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500 mb-1">Assign a new role for this employee:</p>
            <button
              onClick={() => promote(promoteTarget.id, "Department Head")}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary text-left"
            >
              Department Head
            </button>
            <button
              onClick={() => promote(promoteTarget.id, "Asset Manager")}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary text-left"
            >
              Asset Manager
            </button>
            <button
              onClick={() => promote(promoteTarget.id, "Employee")}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary text-left"
            >
              Revert to Employee
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}