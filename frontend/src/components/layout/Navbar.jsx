import { Search, Bell } from "lucide-react";

export default function Navbar() {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-100">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
        <p className="text-xs text-gray-400">Welcome back 👋</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl w-64">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search assets, employees..."
            className="bg-transparent text-sm outline-none w-full text-gray-600"
          />
        </div>

        <button className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100">
          <Bell size={18} />
        </button>

        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white text-sm font-semibold">
          PS
        </div>
      </div>
    </header>
  );
}