import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AssetStatusBadge from "../ui/AssetStatusBadge";
import { assets, allocationHistory, maintenanceHistory } from "../../api/mockData";

export default function AssetDetail() {
  const { id } = useParams();
  const asset = assets.find((a) => a.id === Number(id));

  if (!asset) {
    return <p className="text-sm text-gray-400">Asset not found.</p>;
  }

  const allocHist = allocationHistory[asset.id] || [];
  const maintHist = maintenanceHistory[asset.id] || [];

  return (
    <div className="flex flex-col gap-6">
      <Link to="/assets" className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary w-fit">
        <ArrowLeft size={16} /> Back to Directory
      </Link>

      <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-gray-800">{asset.name}</h2>
            <AssetStatusBadge status={asset.status} />
          </div>
          <p className="text-sm text-gray-400">{asset.tag} · {asset.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Asset Details</h3>
          <div className="flex flex-col gap-3 text-sm">
            <DetailRow label="Serial Number" value={asset.serialNumber} />
            <DetailRow label="Acquisition Date" value={asset.acquisitionDate} />
            <DetailRow label="Acquisition Cost" value={`₹${asset.acquisitionCost}`} />
            <DetailRow label="Condition" value={asset.condition} />
            <DetailRow label="Location" value={asset.location} />
            <DetailRow label="Department" value={asset.department} />
            <DetailRow label="Bookable" value={asset.bookable ? "Yes" : "No"} />
            <DetailRow label="Current Holder" value={asset.holder || "-"} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Allocation History</h3>
          {allocHist.length === 0 ? (
            <p className="text-sm text-gray-400">No allocation history.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {allocHist.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="text-gray-700">{h.event}</p>
                  <p className="text-xs text-gray-400">{h.date}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Maintenance History</h3>
          {maintHist.length === 0 ? (
            <p className="text-sm text-gray-400">No maintenance history.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {maintHist.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="text-gray-700">{h.event}</p>
                  <p className="text-xs text-gray-400">{h.date}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}