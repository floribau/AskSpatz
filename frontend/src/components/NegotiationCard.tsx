import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Card } from "./ui/card";
import { Negotiation } from "@/data/types";

interface NegotiationCardProps {
  negotiation: Negotiation;
}

export function NegotiationCard({ negotiation }: NegotiationCardProps) {
  // Debug: log the negotiation data
  if (negotiation.best_nap === 0 || negotiation.best_nap == null) {
    console.log(`[NegotiationCard] ${negotiation.title}: best_nap=${negotiation.best_nap}, savings=${negotiation.savings_percent}`);
  }

  const isRunning = negotiation.status === "IN_PROGRESS" || negotiation.status === "REVIEW_REQUIRED";
  const isCompleted = negotiation.status === "COMPLETED";

  return (
    <Link to={`/negotiation/${negotiation.id}`} className="block h-full">
      <Card className="h-full p-6 transition-all duration-300 cursor-pointer flex flex-col bg-stone-800/80 border-stone-700 hover:bg-stone-800/80 hover:border-stone-600 hover:shadow-2xl hover:shadow-stone-900/50 hover:-translate-y-1">
        <div className="flex flex-col flex-1 justify-between items-center text-center gap-6">
          {/* Title Section - Centered */}
          <div className="flex-1 flex flex-col justify-center min-w-0 w-full">
            <h3 className="text-xl font-semibold text-white mb-2 break-words">
              {negotiation.title}
            </h3>
            {negotiation.productName && (
              <p className="text-sm text-stone-400 break-words">
                {negotiation.productName}
              </p>
            )}
          </div>

          {/* Stats Section - Centered */}
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Status Label - Most Prominent */}
            <div className="text-center w-full pb-3 border-b border-stone-700/50">
              <p className="text-xs text-stone-400 mb-1">Status</p>
              <p className={`text-2xl font-bold ${
                isRunning 
                  ? "text-green-400" 
                  : isCompleted 
                  ? "text-blue-400" 
                  : "text-white"
              }`}>
                {isRunning
                  ? "Running"
                  : isCompleted
                  ? "Completed"
                  : negotiation.status}
              </p>
            </div>

            {/* Vendors */}
            <div className="flex flex-col items-center w-full">
              <p className="text-xs text-stone-400 mb-1">Vendors</p>
              <div className="flex items-center gap-1.5 text-white">
                <Users className="h-4 w-4" />
                <span className="text-lg font-semibold">{negotiation.vendors_engaged || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
