import { Check, AlertTriangle, Star } from "lucide-react";
import { Card } from "./ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { Suggestion } from "@/data/types";

interface SuggestionCardProps {
  suggestion: Suggestion;
}

const typeConfig = {
  cheapest: {
    label: "Cheapest Option",
    icon: Check,
    className: "border-success/50",
  },
  lowest_risk: {
    label: "Lowest Risk",
    icon: AlertTriangle,
    className: "border-warning/50",
  },
  best_nap: {
    label: "Best NAP (Recommended)",
    icon: Star,
    className: "border-primary ring-2 ring-primary/20",
  },
};

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const config = typeConfig[suggestion.type];
  const Icon = config.icon;

  return (
    <Card className={cn("p-4", config.className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{config.label}</span>
      </div>

      <div className="mb-4">
        <p className="font-semibold text-foreground">{suggestion.vendor}</p>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-lg font-bold text-primary">
            {formatCurrency(suggestion.price)}
          </span>
          <span className="text-sm text-muted-foreground">
            Risk: {suggestion.risk}/10
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Advantages
          </p>
          <ul className="space-y-1">
            {suggestion.pros.map((pro, index) => (
              <li key={index} className="flex items-start gap-1.5 text-sm">
                <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Considerations
          </p>
          <ul className="space-y-1">
            {suggestion.cons.map((con, index) => (
              <li key={index} className="flex items-start gap-1.5 text-sm">
                <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
