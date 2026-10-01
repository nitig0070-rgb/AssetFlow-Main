const STATUS_STYLES = {
  Available: "bg-green-100 text-success",
  Allocated: "bg-primary-light text-primary",
  Reserved: "bg-yellow-100 text-yellow-700",
  "Under Maintenance": "bg-orange-100 text-orange-600",
  Lost: "bg-red-100 text-danger",
  Retired: "bg-gray-200 text-gray-600",
  Disposed: "bg-gray-100 text-gray-400",
};

export default function AssetStatusBadge({ status }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status] || "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}