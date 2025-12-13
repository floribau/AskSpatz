import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Card } from "./ui/card";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { Negotiation } from "@/data/types";

interface NegotiationCardProps {
  negotiation: Negotiation;
}

export function NegotiationCard({ negotiation }: NegotiationCardProps) {
  return (
    <Link to={`/negotiation/${negotiation.id}`} className="block h-full">
      <Card className="h-full p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer flex flex-col bg-gray-800/80 border-gray-700">
        <div className="flex flex-col flex-1 justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-400 font-mono">
                {negotiation.id}
              </span>
              <StatusBadge status={negotiation.status} />
            </div>
            <h3 className="text-lg font-semibold text-white truncate">
              {negotiation.title}
            </h3>
            <p className="text-sm text-gray-400 truncate">
              {negotiation.productName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Best NAP</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(negotiation.best_nap)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Savings</p>
              <p className="text-lg font-bold text-green-400">
                {negotiation.savings_percent}%
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-gray-400">
              <Users className="h-4 w-4" />
              <span className="text-sm">{negotiation.vendors_engaged}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
