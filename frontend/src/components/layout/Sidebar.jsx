import { NavLink } from "react-router-dom";
import { LayoutDashboard, Boxes, Building2, ArrowLeftRight, CalendarClock, Wrench, ClipboardCheck, BarChart3, Bell } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Organization", icon: Building2, to: "/organization" },
  { label: "Assets", icon: Boxes, to: "/assets" },
  { label: "Allocations", icon: ArrowLeftRight, to: "/allocations" },
  { label: "Bookings", icon: CalendarClock, to: "/bookings" },
  { label: "Maintenance", icon: Wrench, to: "/maintenance" },
  { label: "Audits", icon: ClipboardCheck, to: "/audits" },
  { label: "Reports", icon: BarChart3, to: "/reports" },
  { label: "Notifications", icon: Bell, to: "/notifications" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white h-screen border-r border-gray-100 flex flex-col p-5">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">
          A
        </div>
        <span className="text-lg font-bold text-gray-800">AssetFlow</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-light text-primary"
                  : "text-gray-500 hover:bg-gray-50"
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}