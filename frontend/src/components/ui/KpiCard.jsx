export default function KpiCard({ label, value, icon: Icon, tone = "primary" }) {
  const toneStyles = {
    primary: "bg-primary-light text-primary",
    success: "bg-green-100 text-success",
    warning: "bg-yellow-100 text-yellow-600",
    danger: "bg-red-100 text-danger",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${toneStyles[tone]}`}>
        {Icon && <Icon size={20} />}
      </div>
    </div>
  );
}