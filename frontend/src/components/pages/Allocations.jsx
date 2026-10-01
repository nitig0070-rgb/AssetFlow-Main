import { useState } from "react";
import { Plus, ArrowRightLeft, RotateCcw, AlertTriangle } from "lucide-react";

import Modal from "../ui/Modal";

import {
  assets,
  employees,
  departments,
  allocations as initialAllocations,
} from "../../api/mockData";

import { canAllocate, isOverdue } from "../../api/allocations";

export default function Allocations() {
  const [allocations, setAllocations] = useState(initialAllocations);
  const [assetStatuses, setAssetStatuses] = useState(
    Object.fromEntries(assets.map((a) => [a.id, a.status]))
  );

  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [conflict, setConflict] = useState(null); // { asset, message }
  const [transferModal, setTransferModal] = useState(null); // allocation being transferred
  const [returnModal, setReturnModal] = useState(null); // allocation being returned

  const [form, setForm] = useState({
    assetId: assets[0]?.id,
    holderType: "Employee",
    holderName: employees[0]?.name,
    expectedReturnDate: "",
  });

  const activeAllocations = allocations.filter((a) => a.status === "Active");

  const handleAllocate = () => {
    const check = canAllocate(form.assetId, allocations);
    if (!check.ok) {
      const asset = assets.find((a) => a.id === form.assetId);
      setConflict({ asset, message: check.reason });
      setShowAllocateModal(false);
      return;
    }

    const asset = assets.find((a) => a.id === form.assetId);
    const newAllocation = {
      id: Date.now(),
      assetId: asset.id,
      assetTag: asset.tag,
      assetName: asset.name,
      holderType: form.holderType,
      holderName: form.holderName,
      allocatedDate: new Date().toISOString().split("T")[0],
      expectedReturnDate: form.expectedReturnDate,
      status: "Active",
    };

    setAllocations([...allocations, newAllocation]);
    setAssetStatuses({ ...assetStatuses, [asset.id]: "Allocated" });
    setShowAllocateModal(false);
  };

  const handleTransferRequest = (holderName) => {
    // In real app this creates a "Requested" transfer, waiting for approval.
    // For the frontend mock, we simulate immediate approval + re-allocation.
    setAllocations(
      allocations.map((a) =>
        a.id === transferModal.id ? { ...a, holderName, allocatedDate: new Date().toISOString().split("T")[0] } : a
      )
    );
    setTransferModal(null);
  };

  const handleReturn = (condition, notes) => {
    setAllocations(
      allocations.map((a) => (a.id === returnModal.id ? { ...a, status: "Returned" } : a))
    );
    setAssetStatuses({ ...assetStatuses, [returnModal.assetId]: "Available" });
    setReturnModal(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Allocations & Transfers</h2>
          <p className="text-sm text-gray-400">Manage who holds what, and handle transfers</p>
        </div>
        <button
          onClick={() => setShowAllocateModal(true)}
          className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:opacity-90"
        >
          <Plus size={16} /> Allocate Asset
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-3 font-medium">Asset</th>
              <th className="pb-3 font-medium">Holder</th>
              <th className="pb-3 font-medium">Allocated On</th>
              <th className="pb-3 font-medium">Expected Return</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeAllocations.map((a) => {
              const overdue = isOverdue(a);
              return (
                <tr key={a.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 font-medium text-gray-800">{a.assetTag} · {a.assetName}</td>
                  <td className="py-3 text-gray-600">{a.holderName}</td>
                  <td className="py-3 text-gray-600">{a.allocatedDate}</td>
                  <td className="py-3">
                    <span className={overdue ? "text-danger font-medium flex items-center gap-1" : "text-gray-600"}>
                      {overdue && <AlertTriangle size={13} />}
                      {a.expectedReturnDate || "-"}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${overdue ? "bg-red-100 text-danger" : "bg-primary-light text-primary"}`}>
                      {overdue ? "Overdue" : "Active"}
                    </span>
                  </td>
                  <td className="py-3 text-right flex items-center justify-end gap-3">
                    <button
                      onClick={() => setTransferModal(a)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ArrowRightLeft size={13} /> Transfer
                    </button>
                    <button
                      onClick={() => setReturnModal({ ...a })}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:underline"
                    >
                      <RotateCcw size={13} /> Return
                    </button>
                  </td>
                </tr>
              );
            })}
            {activeAllocations.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400 text-sm">
                  No active allocations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Allocate Modal */}
      {showAllocateModal && (
        <Modal title="Allocate Asset" onClose={() => setShowAllocateModal(false)}>
          <div className="flex flex-col gap-3">
            <select
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: Number(e.target.value) })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.tag} · {a.name}</option>
              ))}
            </select>

            <select
              value={form.holderType}
              onChange={(e) => setForm({ ...form, holderType: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="Employee">Employee</option>
              <option value="Department">Department</option>
            </select>

            <select
              value={form.holderName}
              onChange={(e) => setForm({ ...form, holderName: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {(form.holderType === "Employee" ? employees.map((e) => e.name) : departments).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Expected Return Date (optional)</label>
              <input
                type="date"
                value={form.expectedReturnDate}
                onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none w-full"
              />
            </div>

            <button
              onClick={handleAllocate}
              className="bg-primary text-white text-sm font-medium py-2.5 rounded-xl mt-2 hover:opacity-90"
            >
              Allocate
            </button>
          </div>
        </Modal>
      )}

      {/* Conflict Modal — the key PDF rule */}
      {conflict && (
        <Modal title="Allocation Blocked" onClose={() => setConflict(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 bg-red-50 p-3 rounded-xl">
              <AlertTriangle size={18} className="text-danger mt-0.5" />
              <p className="text-sm text-gray-700">
                <span className="font-medium">{conflict.asset.name}</span> can't be allocated — {conflict.message}.
              </p>
            </div>
            <button
              onClick={() => {
                const activeAlloc = allocations.find(
                  (a) => a.assetId === conflict.asset.id && a.status === "Active"
                );
                setConflict(null);
                setTransferModal(activeAlloc);
              }}
              className="flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2.5 rounded-xl hover:opacity-90"
            >
              <ArrowRightLeft size={15} /> Request Transfer Instead
            </button>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <Modal title={`Transfer ${transferModal.assetTag}`} onClose={() => setTransferModal(null)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">
              Currently held by <span className="font-medium text-gray-700">{transferModal.holderName}</span>. Select a new holder:
            </p>
            <select
              onChange={(e) => setForm({ ...form, holderName: e.target.value })}
              defaultValue=""
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="" disabled>Select new holder</option>
              {employees
                .filter((e) => e.name !== transferModal.holderName)
                .map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <button
              onClick={() => handleTransferRequest(form.holderName)}
              className="bg-primary text-white text-sm font-medium py-2.5 rounded-xl mt-2 hover:opacity-90"
            >
              Approve & Re-allocate
            </button>
            <p className="text-xs text-gray-400 text-center">
              (Simulated instantly here — real flow: Requested → Approved by Asset Manager → Re-allocated)
            </p>
          </div>
        </Modal>
      )}

      {/* Return Modal */}
      {returnModal && (
        <ReturnModalContent allocation={returnModal} onClose={() => setReturnModal(null)} onConfirm={handleReturn} />
      )}
    </div>
  );
}

function ReturnModalContent({ allocation, onClose, onConfirm }) {
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");

  return (
    <Modal title={`Return ${allocation.assetTag}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          Returning from <span className="font-medium text-gray-700">{allocation.holderName}</span>
        </p>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
        >
          <option>Good</option>
          <option>Fair</option>
          <option>Poor</option>
          <option>Damaged</option>
        </select>
        <textarea
          placeholder="Condition check-in notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"
        />
        <button
          onClick={() => onConfirm(condition, notes)}
          className="bg-primary text-white text-sm font-medium py-2.5 rounded-xl mt-2 hover:opacity-90"
        >
          Confirm Return
        </button>
      </div>
    </Modal>
  );
}