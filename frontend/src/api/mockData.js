export const departments = ["IT", "Facilities", "IT Support"];

export const categories = ["Electronics", "Furniture", "Vehicles"];

export let assets = [
  {
    id: 1,
    tag: "AF-0001",
    name: "Dell Laptop 14",
    category: "Electronics",
    serialNumber: "SN-88213",
    acquisitionDate: "2025-02-10",
    acquisitionCost: 65000,
    condition: "Good",
    location: "Bangalore HQ",
    department: "IT",
    status: "Allocated",
    bookable: false,
    holder: "Priya Sharma",
  },
  {
    id: 2,
    tag: "AF-0002",
    name: "Conference Room B2",
    category: "Furniture",
    serialNumber: "-",
    acquisitionDate: "2024-11-01",
    acquisitionCost: 0,
    condition: "Good",
    location: "Bangalore HQ, Floor 3",
    department: "Facilities",
    status: "Available",
    bookable: true,
    holder: null,
  },
  {
    id: 3,
    tag: "AF-0003",
    name: "Projector Epson X200",
    category: "Electronics",
    serialNumber: "SN-44120",
    acquisitionDate: "2023-06-15",
    acquisitionCost: 32000,
    condition: "Fair",
    location: "Bangalore HQ",
    department: "IT",
    status: "Under Maintenance",
    bookable: true,
    holder: null,
  },
  {
    id: 4,
    tag: "AF-0004",
    name: "Company Vehicle - Swift Dzire",
    category: "Vehicles",
    serialNumber: "KA-01-AB-1234",
    acquisitionDate: "2022-09-01",
    acquisitionCost: 850000,
    condition: "Good",
    location: "Bangalore HQ Parking",
    department: "Facilities",
    status: "Reserved",
    bookable: true,
    holder: null,
  },
];

export const allocationHistory = {
  1: [
    { event: "Allocated to Priya Sharma", date: "2025-03-01" },
    { event: "Returned by Rahul Verma", date: "2025-02-28" },
    { event: "Allocated to Rahul Verma", date: "2025-02-11" },
  ],
};

export const maintenanceHistory = {
  3: [
    { event: "Maintenance approved - Lamp replacement", date: "2026-07-05" },
    { event: "Maintenance requested - Dim projection", date: "2026-07-02" },
  ],
};

export const employees = [
  { id: 1, name: "Priya Sharma", department: "IT" },
  { id: 2, name: "Rahul Verma", department: "Facilities" },
  { id: 3, name: "Amit Kumar", department: "IT Support" },
];

export let allocations = [
  {
    id: 1,
    assetId: 1,
    assetTag: "AF-0001",
    assetName: "Dell Laptop 14",
    holderType: "Employee",
    holderName: "Priya Sharma",
    allocatedDate: "2025-03-01",
    expectedReturnDate: "2026-07-15",
    status: "Active", // Active | Returned
  },
];

export const transferRequests = [
  // { id, assetId, fromHolder, toHolder, status: "Requested" | "Approved" | "Re-allocated" }
];