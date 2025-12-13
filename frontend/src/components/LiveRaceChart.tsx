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
  selectedVendorId: string | null;
  onVendorClick: (vendorId: string | null) => void;
  finishedVendorIds?: string[];
}

export function LiveRaceChart({ priceHistory, vendors, selectedVendorId, onVendorClick, finishedVendorIds = [] }: LiveRaceChartProps) {
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
    <Card className="bg-gray-900/80 backdrop-blur-md border-gray-700/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <SpatzIcon size={24} />
          Live Price Race
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
            const isSelected = selectedVendorId === vendor.id;
            const isFinished = finishedVendorIds.includes(vendor.id);
            return (
              <button
                key={vendor.id}
                onClick={() => onVendorClick(vendor.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                  isFinished
                    ? "bg-green-500/20 ring-2 ring-green-400"
                    : isSelected
                    ? "ring-2 ring-blue-500 bg-blue-500/20"
                    : isWinner
                    ? "bg-gray-700/50 ring-2 ring-gray-500 hover:bg-gray-700/70"
                    : "bg-gray-800/50 hover:bg-gray-800/70"
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
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
