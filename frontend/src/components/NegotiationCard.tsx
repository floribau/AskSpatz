import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Card } from "./ui/card";
import { formatCurrency } from "@/lib/utils";
import { Negotiation } from "@/data/types";

interface NegotiationCardProps {
  negotiation: Negotiation;
}

export function NegotiationCard({ negotiation }: NegotiationCardProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <Link to={`/negotiation/${negotiation.id}`} className="block h-full">
      <Card className="h-full p-6 transition-all duration-300 cursor-pointer flex flex-col bg-gray-800/80 border-gray-700 hover:bg-gray-800/95 hover:border-gray-600 hover:shadow-2xl hover:shadow-gray-900/50 hover:-translate-y-1">
        <div className="flex flex-col flex-1 justify-between items-center text-center gap-6">
          {/* Title Section - Centered */}
          <div className="flex-1 flex flex-col justify-center min-w-0 w-full">
            <h3 className="text-xl font-semibold text-white mb-2 break-words">
              {negotiation.title}
            </h3>
            {negotiation.productName && (
              <p className="text-sm text-gray-400 break-words">
                {negotiation.productName}
              </p>
            )}
          </div>

          {/* Stats Section - Centered */}
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center justify-center gap-6 w-full">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Best NAP</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(negotiation.best_nap)}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Savings</p>
                <p className="text-xl font-bold text-green-400">
                  {negotiation.savings_percent}%
                </p>
              </div>

              <div className="flex flex-col items-center">
                <p className="text-xs text-gray-400 mb-1">Vendors</p>
                <div className="flex items-center gap-1.5 text-white">
                  <Users className="h-4 w-4" />
                  <span className="text-lg font-semibold">{negotiation.vendors_engaged}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Created Date - Bottom */}
          {negotiation.created_at && (
            <div className="w-full pt-4 border-t border-gray-700/50">
              <p className="text-xs text-gray-500">
                {formatDate(negotiation.created_at)}
              </p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
