// Returns the active allocation for an asset, or null if free
export function getActiveAllocation(assetId, allocations) {
  return allocations.find((a) => a.assetId === assetId && a.status === "Active") || null;
}

// Core conflict check from the PDF spec
export function canAllocate(assetId, allocations) {
  const active = getActiveAllocation(assetId, allocations);
  if (active) {
    return { ok: false, reason: `Currently held by ${active.holderName}` };
  }
  return { ok: true };
}

export function isOverdue(allocation) {
  if (allocation.status !== "Active" || !allocation.expectedReturnDate) return false;
  return new Date(allocation.expectedReturnDate) < new Date();
}