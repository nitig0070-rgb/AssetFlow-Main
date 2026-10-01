import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, QrCode } from "lucide-react";
import AssetStatusBadge from "../ui/AssetStatusBadge";
import Modal from "../ui/Modal";
import { assets as initialAssets, categories, departments } from "../../api/mockData";

const STATUS_FILTERS = ["All", "Available", "Allocated", "Reserved", "Under Maintenance", "Lost", "Retired", "Disposed"];

export default function AssetDirectory() {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name: "", category: categories[0], serialNumber: "", acquisitionDate: "",
    acquisitionCost: "", condition: "Good", location: "", department: departments[0], bookable: false,
  });

  const filtered = assets.filter((a) => {
    const matchesSearch =
      a.tag.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || a.status === statusFilter;
    const matchesCategory = categoryFilter === "All" || a.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleRegister = () => {
    if (!form.name) return;
    const nextTag = `AF-${String(assets.length + 1).padStart(4, "0")}`;
    setAssets([
      ...assets,
      { id: Date.now(), tag: nextTag, ...form, status: "Available", holder: null },
    ]);
    setForm({ name: "", category: categories[0], serialNumber: "", acquisitionDate: "", acquisitionCost: "", condition: "Good", location: "", department: departments[0], bookable: false });
    setShowModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Asset Directory</h2>
          <p className="text-sm text-gray-400">Register and track all assets across the organization</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:opacity-90"
        >
          <Plus size={16} /> Register Asset
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl flex-1 min-w-[220px]">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by tag, name, serial number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-gray-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none text-gray-600"
        >
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none text-gray-600"
        >
          <option value="All">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:border-primary hover:text-primary">
          <QrCode size={16} /> Scan QR
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-3 font-medium">Asset Tag</th>
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium">Location</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Holder</th>
              <th className="pb-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 last:border-0">
                <td className="py-3 font-medium text-gray-800">{a.tag}</td>
                <td className="py-3 text-gray-600">{a.name}</td>
                <td className="py-3 text-gray-600">{a.category}</td>
                <td className="py-3 text-gray-600">{a.location}</td>
                <td className="py-3"><AssetStatusBadge status={a.status} /></td>
                <td className="py-3 text-gray-600">{a.holder || "-"}</td>
                <td className="py-3 text-right">
                  <Link to={`/assets/${a.id}`} className="text-xs font-medium text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400 text-sm">
                  No assets match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Register New Asset" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <input
              placeholder="Asset Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Serial Number"
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              placeholder="Acquisition Cost"
              value={form.acquisitionCost}
              onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.bookable}
                onChange={(e) => setForm({ ...form, bookable: e.target.checked })}
              />
              Shared / Bookable resource
            </label>

            <button
              onClick={handleRegister}
              className="bg-primary text-white text-sm font-medium py-2.5 rounded-xl mt-2 hover:opacity-90"
            >
              Register Asset
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}