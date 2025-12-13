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
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SpatzIcon } from "./SpatzIcon";
import { formatCurrency } from "@/lib/utils";
import { PricePoint, Vendor } from "@/data/types";

interface LiveRaceChartProps {
  priceHistory: PricePoint[];
  vendors: Vendor[];
  finishedVendorIds?: string[];
}

export function LiveRaceChart({ priceHistory, vendors, finishedVendorIds = [] }: LiveRaceChartProps) {
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

  // Check if negotiation is still active
  const isActive = finishedVendorIds.length < vendors.length;

  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  return (
    <Card className="bg-gray-900/80 backdrop-blur-md border-gray-700/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          Price Comparison
          {isActive && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-xs text-red-400 font-medium">Live</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="round"
                tickFormatter={(value) => `R${value}`}
                className="text-xs"
                stroke="#9CA3AF"
              />
              <YAxis
                tickFormatter={formatYAxis}
                className="text-xs"
                domain={["auto", "auto"]}
                stroke="#9CA3AF"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2 text-white">Round {label}</p>
                        {payload.map((entry) => (
                          <div
                            key={entry.dataKey}
                            className="flex justify-between gap-4 text-sm"
                          >
                            <span style={{ color: entry.color }} className="text-white">
                              {vendors.find((v) => v.id === entry.dataKey)
                                ?.company || entry.dataKey}
                            </span>
                            <span className="font-medium text-white">
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
                  stroke="#34D399"
                  strokeDasharray="5 5"
                  label={{
                    value: `Best: ${formatCurrency(lowestPrice)}`,
                    position: "right",
                    fill: "#34D399",
                    className: "text-xs",
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 justify-center">
          {vendors.map((vendor) => {
            const currentPrice = latestRound?.[vendor.id] as number | undefined;
            const isWinner = vendor.id === winningVendorId;
            const isFinished = finishedVendorIds.includes(vendor.id);
            return (
              <div
                key={vendor.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  isFinished
                    ? "bg-green-500/20 ring-2 ring-green-400"
                    : isWinner
                    ? "bg-gray-700/50 ring-2 ring-gray-500"
                    : "bg-gray-800/50"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: vendor.color }}
                />
                <span className="text-sm font-medium text-white">{vendor.company}</span>
                {currentPrice && (
                  <span className="text-sm text-white/70">
                    {formatCurrency(currentPrice)}
                  </span>
                )}
                {isFinished && <CheckCircle className="h-4 w-4 text-green-400" />}
                {!isFinished && isWinner && <SpatzIcon size={16} />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
