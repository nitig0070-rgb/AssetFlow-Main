import { Boxes, UserCheck, Wrench, CalendarClock, ArrowLeftRight, Clock, PlusCircle, CalendarPlus, AlertTriangle } from "lucide-react";
import KpiCard from "../ui/KpiCard";
// Mock data — swap with real API data later
const kpis = [
  { label: "Assets Available", value: 128, icon: Boxes, tone: "success" },
  { label: "Assets Allocated", value: 94, icon: UserCheck, tone: "primary" },
  { label: "Maintenance Today", value: 6, icon: Wrench, tone: "warning" },
  { label: "Active Bookings", value: 12, icon: CalendarClock, tone: "primary" },
  { label: "Pending Transfers", value: 3, icon: ArrowLeftRight, tone: "warning" },
  { label: "Upcoming Returns", value: 9, icon: Clock, tone: "success" },
];

const overdueReturns = [
  { asset: "Laptop AF-0114", holder: "Priya Sharma", dueDate: "10 Jul 2026" },
  { asset: "Projector AF-0092", holder: "Rahul Verma", dueDate: "08 Jul 2026" },
];

const quickActions = [
  { label: "Register Asset", icon: PlusCircle },
  { label: "Book Resource", icon: CalendarPlus },
  { label: "Raise Maintenance Request", icon: Wrench },
];

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Returns */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-danger" />
            <h3 className="font-semibold text-gray-800">Overdue Returns</h3>
          </div>

          {overdueReturns.length === 0 ? (
            <p className="text-sm text-gray-400">No overdue returns 🎉</p>
          ) : (
            <div className="flex flex-col gap-3">
              {overdueReturns.map((item) => (
                <div
                  key={item.asset}
                  className="flex items-center justify-between p-3 rounded-xl bg-red-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.asset}</p>
                    <p className="text-xs text-gray-500">Held by {item.holder}</p>
                  </div>
                  <span className="text-xs font-semibold text-danger">
                    Due {item.dueDate}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-light text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors"
              >
                <action.icon size={18} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}