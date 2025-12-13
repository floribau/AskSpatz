import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SpatzIcon } from "./SpatzIcon";
import { formatCurrency } from "@/lib/utils";
import { PricePoint, Vendor } from "@/data/types";

interface LiveRaceChartProps {
  priceHistory: PricePoint[];
  vendors: Vendor[];
}

export function LiveRaceChart({ priceHistory, vendors }: LiveRaceChartProps) {
  // Find the vendor with the lowest current price
  const latestRound = priceHistory[priceHistory.length - 1];
  let lowestPrice = Infinity;
  let winningVendorId = "";

  vendors.forEach((vendor) => {
    const price = latestRound?.[vendor.id] as number | undefined;
    if (price && price < lowestPrice) {
      lowestPrice = price;
      winningVendorId = vendor.id;
    }
  });

  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SpatzIcon size={24} />
          Live Price Race
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="round"
                tickFormatter={(value) => `R${value}`}
                className="text-xs"
              />
              <YAxis
                tickFormatter={formatYAxis}
                className="text-xs"
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2">Round {label}</p>
                        {payload.map((entry) => (
                          <div
                            key={entry.dataKey}
                            className="flex justify-between gap-4 text-sm"
                          >
                            <span style={{ color: entry.color }}>
                              {vendors.find((v) => v.id === entry.dataKey)
                                ?.company || entry.dataKey}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(entry.value as number)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {vendors.map((vendor) => (
                <Line
                  key={vendor.id}
                  type="monotone"
                  dataKey={vendor.id}
                  stroke={vendor.color}
                  strokeWidth={vendor.id === winningVendorId ? 4 : 2}
                  dot={{ r: vendor.id === winningVendorId ? 6 : 4 }}
                  activeDot={{ r: 8 }}
                />
              ))}
              {lowestPrice < Infinity && (
                <ReferenceLine
                  y={lowestPrice}
                  stroke="hsl(var(--success))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Best: ${formatCurrency(lowestPrice)}`,
                    position: "right",
                    className: "text-xs fill-success",
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4">
          {vendors.map((vendor) => {
            const currentPrice = latestRound?.[vendor.id] as number | undefined;
            const isWinner = vendor.id === winningVendorId;
            return (
              <div
                key={vendor.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  isWinner ? "bg-secondary/20 ring-2 ring-secondary" : "bg-muted"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: vendor.color }}
                />
                <span className="text-sm font-medium">{vendor.company}</span>
                {currentPrice && (
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(currentPrice)}
                  </span>
                )}
                {isWinner && <SpatzIcon size={16} />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
