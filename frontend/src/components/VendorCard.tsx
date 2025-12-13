import { Card } from "./ui/card";
import { Building2 } from "lucide-react";

interface VendorCardProps {
  vendor: {
    id: string;
    name: string;
    company: string;
    color: string;
    category: string;
    behaviour?: string | null;
  };
  onClick: () => void;
}

export function VendorCard({ vendor, onClick }: VendorCardProps) {
  return (
    <Card 
      onClick={onClick}
      className="h-full p-6 transition-all duration-300 cursor-pointer flex flex-col bg-gray-800/80 border-gray-700 hover:bg-gray-800/80 hover:border-gray-600 hover:shadow-2xl hover:shadow-gray-900/50 hover:-translate-y-1"
    >
      <div className="flex flex-col flex-1 justify-between items-center text-center gap-6">
        {/* Title Section - Centered */}
        <div className="flex-1 flex flex-col justify-center min-w-0 w-full">
          <h3 className="text-xl font-semibold text-white break-words mb-2">
            {vendor.name}
          </h3>
          {vendor.behaviour && (
            <p className="text-sm text-gray-400 break-words line-clamp-2">
              {vendor.behaviour}
            </p>
          )}
        </div>

        {/* Stats Section - Centered */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Vendor Icon */}
          <div className="flex flex-col items-center w-full">
            <p className="text-xs text-gray-400 mb-1">Vendor</p>
            <div className="flex items-center gap-1.5 text-white">
              <Building2 className="h-4 w-4" />
              <span className="text-lg font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
