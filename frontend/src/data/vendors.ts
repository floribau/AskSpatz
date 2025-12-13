import { Vendor } from "./types";

export const availableVendors: Vendor[] = [
  {
    id: "vendor1",
    name: "Sarah Chen",
    company: "Global Supplies Co.",
    color: "hsl(207, 90%, 61%)",
    category: "Office Supplies",
  },
  {
    id: "vendor2",
    name: "Michael Torres",
    company: "Prime Materials Ltd.",
    color: "hsl(142, 71%, 45%)",
    category: "Raw Materials",
  },
  {
    id: "vendor3",
    name: "Emily Watson",
    company: "Enterprise Solutions Inc.",
    color: "hsl(262, 83%, 58%)",
    category: "IT Services",
  },
  {
    id: "vendor4",
    name: "James Miller",
    company: "Quality First Corp.",
    color: "hsl(25, 95%, 53%)",
    category: "Manufacturing",
  },
  {
    id: "vendor5",
    name: "Lisa Anderson",
    company: "Best Value Partners",
    color: "hsl(330, 81%, 60%)",
    category: "Office Supplies",
  },
  {
    id: "vendor6",
    name: "David Kim",
    company: "Strategic Resources Group",
    color: "hsl(235, 76%, 60%)",
    category: "Consulting",
  },
  {
    id: "vendor7",
    name: "Rachel Green",
    company: "Premium Procurement LLC",
    color: "hsl(0, 84%, 60%)",
    category: "Raw Materials",
  },
  {
    id: "vendor8",
    name: "Thomas Brown",
    company: "Reliable Vendors United",
    color: "hsl(48, 96%, 53%)",
    category: "Logistics",
  },
];

export const vendorCategories = [
  "all",
  ...new Set(availableVendors.map((v) => v.category)),
];
