import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { Negotiation } from "@/data/types";

interface NegotiationCardProps {
  negotiation: Negotiation;
}

export function NegotiationCard({ negotiation }: NegotiationCardProps) {
  return (
    <Card className="p-4 md:p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-muted-foreground font-mono">
              {negotiation.id}
            </span>
            <StatusBadge status={negotiation.status} />
          </div>
          <h3 className="text-lg font-semibold text-foreground truncate">
            {negotiation.title}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {negotiation.productName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Best NAP</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(negotiation.best_nap)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Savings</p>
            <p className="text-lg font-bold text-success">
              {negotiation.savings_percent}%
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">{negotiation.vendors_engaged}</span>
          </div>

          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to={`/negotiation/${negotiation.id}`}>
              View Live Race
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
