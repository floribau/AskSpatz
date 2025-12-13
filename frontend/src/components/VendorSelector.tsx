import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { Vendor } from "@/data/types";

interface VendorSelectorProps {
  vendors: Vendor[];
  selectedVendors: string[];
  onToggleVendor: (vendorId: string) => void;
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  startingPrice: number;
}

export function VendorSelector({
  vendors,
  selectedVendors,
  onToggleVendor,
  categoryFilter,
  onCategoryChange,
  categories,
  startingPrice,
}: VendorSelectorProps) {
  const filteredVendors =
    categoryFilter === "all"
      ? vendors
      : vendors.filter((v) => v.category === categoryFilter);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Select Vendors ({selectedVendors.length} selected)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Category Filter */}
        <div className="mb-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Filter by Category
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                size="sm"
                variant={categoryFilter === category ? "default" : "outline"}
                onClick={() => onCategoryChange(category)}
              >
                {category === "all" ? "All Categories" : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Vendor List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredVendors.map((vendor) => {
            const isSelected = selectedVendors.includes(vendor.id);

            return (
              <button
                key={vendor.id}
                onClick={() => onToggleVendor(vendor.id)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: vendor.color }}
                    />
                    <div>
                      <p className="font-semibold text-foreground">
                        {vendor.company}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {vendor.name}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-background rounded">
                        {vendor.category}
                      </span>
                      {isSelected && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Will negotiate from {formatCurrency(startingPrice)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "w-6 h-6 rounded border-2 flex items-center justify-center",
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary-foreground" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredVendors.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No vendors in this category
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
