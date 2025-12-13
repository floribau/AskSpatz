import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { AgentStatus } from "@/data/types";

interface AgentPerformanceProps {
  agents: AgentStatus[];
}

const interventionColors = {
  green: {
    border: "border-l-success",
    dot: "bg-success",
    text: "text-success",
  },
  yellow: {
    border: "border-l-warning",
    dot: "bg-warning",
    text: "text-warning",
  },
  red: {
    border: "border-l-destructive",
    dot: "bg-destructive",
    text: "text-destructive",
  },
};

export function AgentPerformance({ agents }: AgentPerformanceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Agent Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const colors = interventionColors[agent.interventionLevel];
            return (
              <div
                key={agent.vendorId}
                className={cn(
                  "p-4 rounded-lg border-l-4 bg-muted/50",
                  colors.border
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-foreground">
                    {agent.vendorName}
                  </p>
                  <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-semibold text-success">
                      {formatCurrency(agent.currentPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reduction:</span>
                    <span className="font-semibold">
                      {agent.reductionPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-semibold">{agent.status}</span>
                  </div>
                </div>

                <div className="p-2 rounded bg-background text-xs text-muted-foreground mb-2">
                  {agent.attempts} negotiation attempts,{" "}
                  {agent.reductionPercent.toFixed(1)}% price reduction
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={cn("w-1.5 h-1.5 rounded-full", colors.dot)}
                  />
                  <p className={cn("text-xs", colors.text)}>
                    {agent.interventionText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
