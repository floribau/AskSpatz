import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import { Vendor, PricePoint } from "@/data/types";

interface VendorLeaderboardProps {
  vendors: Vendor[];
  priceHistory: PricePoint[];
  startingPrice: number;
}

export function VendorLeaderboard({
  vendors,
  priceHistory,
  startingPrice,
}: VendorLeaderboardProps) {
  const latestRound = priceHistory[priceHistory.length - 1];

  // Get current prices and sort vendors
  const vendorPrices = vendors
    .map((vendor) => ({
      ...vendor,
      currentPrice: (latestRound?.[vendor.id] as number) || startingPrice,
    }))
    .sort((a, b) => a.currentPrice - b.currentPrice);

  const lowestPrice = vendorPrices[0]?.currentPrice || startingPrice;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          Live Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {vendorPrices.map((vendor, index) => {
            const reduction =
              ((startingPrice - vendor.currentPrice) / startingPrice) * 100;
            const isLeading = index === 0;

            return (
              <div
                key={vendor.id}
                className={cn(
                  "p-4 rounded-lg border transition-all",
                  isLeading
                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                    : "bg-card border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                        isLeading
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      #{index + 1}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: vendor.color }}
                    />
                    <div>
                      <p className="font-semibold text-foreground">
                        {vendor.company}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xl font-bold",
                        isLeading ? "text-success" : "text-foreground"
                      )}
                    >
                      {formatCurrency(vendor.currentPrice)}
                    </p>
                    {isLeading && (
                      <span className="text-xs text-warning font-semibold">
                        LEADING
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Price Reduction</span>
                    <span>{reduction.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={reduction}
                    className="h-2"
                    indicatorClassName={isLeading ? "bg-success" : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
