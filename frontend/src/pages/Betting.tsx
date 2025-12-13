import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, TrendingDown, Trophy, BarChart3, DollarSign } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, cn } from "@/lib/utils";
import { NegotiationDetail, Vendor } from "@/data/types";
import { useToast } from "@/hooks/use-toast";

interface Offer {
  id: number;
  negotiation_id: number;
  vendor_id: number;
  vendor_name: string;
  description: string;
  price: number;
}

interface Negotiation {
  id: number;
  vendor_id: number;
  conversation_id: number;
}

interface BettingOption {
  vendor: Vendor;
  negotiationId: number;
  agentId: string; // Unique identifier for the agent (negotiation_id)
  currentPrice: number | null; // Best offer price, or null if no offers yet
  reduction: number; // Actual price reduction percentage
  odds: number; // Decimal odds (e.g., 2.5 means bet $1 to win $2.50)
  potentialReturn: number;
  winProbability: number;
  performance: {
    attempts: number;
    messageCount: number;
    status: "Strong" | "Moderate" | "Struggling" | "No Offers";
    bestOffer: number | null;
  };
}

export function Betting() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [negotiation, setNegotiation] = useState<NegotiationDetail | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [bettingOptions, setBettingOptions] = useState<BettingOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    async function fetchNegotiationGroup() {
      try {
        const response = await fetch(`http://localhost:3001/api/negotiation-groups/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch negotiation group");
        }
        const data = await response.json();
        
        const negotiationDetail: NegotiationDetail = {
          id: data.id || id,
          title: data.title || "Negotiation",
          productName: data.productName || "",
          best_nap: data.startingPrice || 0,
          savings_percent: 0,
          status: data.status === "running" ? "IN_PROGRESS" : data.status || "IN_PROGRESS",
          vendors_engaged: data.vendors_engaged || 0,
          created_at: new Date().toISOString(),
          startingPrice: data.startingPrice || 25000,
          targetReduction: data.targetReduction || 0,
          targetPrice: data.targetPrice || 0,
          vendors: data.vendors || [],
          priceHistory: data.priceHistory && data.priceHistory.length > 0 ? data.priceHistory : [{ round: 1 }],
          suggestions: data.suggestions || [],
          messages: data.messages || [],
          agentRationale: data.agentRationale || "Negotiation in progress...",
          riskScore: data.riskScore || 5,
          startTime: new Date().toISOString(),
        };
        
        if (isMounted) {
          setNegotiation(negotiationDetail);
          setOffers(data.offers || []);
          setNegotiations(data.negotiations || []);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching negotiation group:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    fetchNegotiationGroup();
    intervalId = setInterval(fetchNegotiationGroup, 3000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [id]);

  // Calculate betting options with odds based on REAL offers data
  useEffect(() => {
    if (!negotiation || !negotiation.vendors || negotiation.vendors.length === 0) return;
    if (!offers || !negotiations) return;

    const startingPrice = negotiation.startingPrice;

    // Create a map of negotiation_id -> vendor_id
    const negotiationToVendor = new Map<number, number>();
    negotiations.forEach((neg) => {
      negotiationToVendor.set(neg.id, neg.vendor_id);
    });

    // Group offers by negotiation_id and find best (lowest) price for each agent
    const agentOffers = new Map<number, Offer[]>();
    offers.forEach((offer) => {
      if (!agentOffers.has(offer.negotiation_id)) {
        agentOffers.set(offer.negotiation_id, []);
      }
      agentOffers.get(offer.negotiation_id)!.push(offer);
    });

    // Calculate agent performance data
    const agentData = negotiation.vendors.map((vendor) => {
      // Find negotiation for this vendor
      const negotiationForVendor = negotiations.find(
        (neg) => Number(neg.vendor_id) === Number(vendor.id)
      );

      if (!negotiationForVendor) {
        return null;
      }

      const negotiationId = negotiationForVendor.id;
      const vendorOffers = agentOffers.get(negotiationId) || [];
      
      // Get best (lowest) offer price
      const bestOffer = vendorOffers.length > 0
        ? Math.min(...vendorOffers.map((o) => o.price))
        : null;

      // Calculate actual reduction based on best offer
      const currentPrice = bestOffer || startingPrice;
      const reduction = bestOffer
        ? ((startingPrice - bestOffer) / startingPrice) * 100
        : 0;

      // Count agent messages (negotiation attempts)
      const agentMessages = negotiation.messages?.filter(
        (m: any) =>
          m.vendor_id &&
          String(m.vendor_id) === String(vendor.id) &&
          m.sender === "agent"
      ) || [];

      // Determine status based on actual performance
      let status: "Strong" | "Moderate" | "Struggling" | "No Offers" = "No Offers";
      if (bestOffer) {
        if (reduction > 15) status = "Strong";
        else if (reduction > 5) status = "Moderate";
        else status = "Struggling";
      }

      return {
        vendor,
        negotiationId,
        agentId: negotiationId.toString(),
        currentPrice: bestOffer,
        reduction,
        odds: 0, // Will be calculated below
        potentialReturn: 0,
        winProbability: 0, // Will be calculated below
        performance: {
          attempts: agentMessages.length,
          messageCount: agentMessages.length,
          status,
          bestOffer,
        },
      };
    }).filter((data): data is BettingOption => data !== null);

    // Sort by reduction (highest reduction = best performance)
    const sortedAgents = [...agentData].sort((a, b) => {
      // Agents with offers come first, sorted by reduction
      if (a.currentPrice && b.currentPrice) {
        return b.reduction - a.reduction;
      }
      if (a.currentPrice) return -1;
      if (b.currentPrice) return 1;
      return 0;
    });

    // Calculate win probabilities based on ACTUAL price reductions
    // Only consider agents with offers
    const agentsWithOffers = sortedAgents.filter((a) => a.currentPrice !== null);
    
    if (agentsWithOffers.length > 0) {
      // Use actual reductions to calculate probabilities
      // Higher reduction = higher probability of winning
      const totalReduction = agentsWithOffers.reduce(
        (sum, a) => sum + Math.max(a.reduction, 0.1),
        0
      );
      
      const probabilities = agentsWithOffers.map((a) =>
        Math.max(a.reduction, 0.1) / totalReduction
      );

      // Calculate decimal odds (inverse of probability, with house edge)
      const houseEdge = 0.1; // 10% house edge
      const odds = probabilities.map((prob) => (1 / prob) * (1 - houseEdge));

      // Update agents with calculated odds and probabilities
      agentsWithOffers.forEach((agent, index) => {
        agent.odds = odds[index];
        agent.winProbability = probabilities[index] * 100;
      });

      // Agents without offers get default low odds
      sortedAgents.forEach((agent) => {
        if (agent.currentPrice === null) {
          agent.odds = 10.0; // High odds (low probability)
          agent.winProbability = 5.0; // Low probability
        }
      });
    } else {
      // No offers yet - give equal probability to all
      sortedAgents.forEach((agent) => {
        agent.odds = sortedAgents.length * 1.1; // Equal odds with house edge
        agent.winProbability = 100 / sortedAgents.length;
      });
    }

    setBettingOptions(sortedAgents);
  }, [negotiation, offers, negotiations]);

  // Calculate potential return when bet amount changes
  useEffect(() => {
    if (!selectedAgentId || !betAmount) {
      setBettingOptions((prev) =>
        prev.map((opt) => ({ ...opt, potentialReturn: 0 }))
      );
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;

    setBettingOptions((prev) =>
      prev.map((opt) =>
        opt.agentId === selectedAgentId
          ? { ...opt, potentialReturn: amount * opt.odds }
          : opt
      )
    );
  }, [selectedAgentId, betAmount]);

  const handlePlaceBet = () => {
    if (!selectedAgentId || !betAmount) {
      toast({
        title: "Please select an agent and enter a bet amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Please enter a valid bet amount",
        variant: "destructive",
      });
      return;
    }

    const option = bettingOptions.find((opt) => opt.agentId === selectedAgentId);
    if (!option) return;

    toast({
      title: "Bet Placed! 🤫",
      description: `You bet ${formatCurrency(amount)} on the agent negotiating with ${option.vendor.company}. Potential return: ${formatCurrency(option.potentialReturn)}`,
      variant: "default",
    });

    // Reset form
    setSelectedAgentId(null);
    setBetAmount("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewNegotiation={() => navigate("/new")} />
        <main className="container px-4 md:px-6 py-8 text-center">
          <p className="text-lg text-muted-foreground">Loading betting options...</p>
        </main>
      </div>
    );
  }

  if (!negotiation) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewNegotiation={() => navigate("/new")} />
        <main className="container px-4 md:px-6 py-8 text-center">
          <p className="text-lg text-muted-foreground">Negotiation not found</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </main>
      </div>
    );
  }

  const selectedOption = selectedAgentId
    ? bettingOptions.find((opt) => opt.agentId === selectedAgentId)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header onNewNegotiation={() => navigate("/new")} />

      <main className="container px-4 md:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/negotiation/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Race
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            🤫 Secret Betting Pool
          </h1>
          <p className="text-muted-foreground">
            Bet on which <strong>agent</strong> will achieve the highest price reduction
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {negotiation.title} • {negotiation.productName} • Starting Price: {formatCurrency(negotiation.startingPrice)}
          </p>
        </div>

        {/* Betting Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {bettingOptions.map((option, index) => {
            const isSelected = selectedAgentId === option.agentId;
            const isLeading = index === 0 && option.currentPrice !== null;

            return (
              <Card
                key={option.vendor.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary",
                  isSelected && "ring-2 ring-primary border-primary",
                  isLeading && "border-success/50 bg-success/5"
                )}
                onClick={() => setSelectedAgentId(option.agentId)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isLeading && <Trophy className="h-5 w-5 text-warning" />}
                      <div>
                        <CardTitle className="text-lg">Agent #{option.agentId}</CardTitle>
                        <p className="text-xs text-muted-foreground">{option.vendor.company}</p>
                      </div>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: option.vendor.color }}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Current Best Offer */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {option.currentPrice ? "Best Offer Price" : "No Offers Yet"}
                      </p>
                      {option.currentPrice ? (
                        <p className="text-2xl font-bold text-success">
                          {formatCurrency(option.currentPrice)}
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-muted-foreground">
                          Negotiating...
                        </p>
                      )}
                    </div>

                    {/* Reduction */}
                    {option.currentPrice && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Price Reduction</p>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-success" />
                          <p className="text-lg font-semibold">
                            {option.reduction.toFixed(1)}%
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Saved: {formatCurrency(negotiation.startingPrice - option.currentPrice)}
                        </p>
                      </div>
                    )}

                    {/* Odds */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">Odds</span>
                        <span className="text-sm font-semibold">
                          {option.odds.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Win Probability</span>
                        <span className="text-sm font-semibold">
                          {option.winProbability.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Performance Stats */}
                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          Performance
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span
                            className={cn(
                              "font-semibold",
                              option.performance.status === "Strong" && "text-success",
                              option.performance.status === "Moderate" && "text-warning",
                              option.performance.status === "Struggling" && "text-destructive"
                            )}
                          >
                            {option.performance.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Messages:</span>
                          <span className="font-semibold">{option.performance.messageCount}</span>
                        </div>
                        {option.performance.bestOffer && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Best Offer:</span>
                            <span className="font-semibold text-success">
                              {formatCurrency(option.performance.bestOffer)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Potential Return (if selected) */}
                    {isSelected && selectedOption && parseFloat(betAmount) > 0 && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-success" />
                          <span className="text-xs font-semibold text-success">
                            Potential Return
                          </span>
                        </div>
                        <p className="text-xl font-bold text-success">
                          {formatCurrency(selectedOption.potentialReturn)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Betting Form */}
        <Card className="sticky bottom-4 z-10">
          <CardHeader>
            <CardTitle>Place Your Bet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedOption && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Selected Agent</p>
                  <p className="text-lg font-semibold">Agent #{selectedOption.agentId}</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Negotiating with {selectedOption.vendor.company}
                  </p>
                  {selectedOption.currentPrice && (
                    <p className="text-sm mb-2">
                      Current Best Offer: <span className="font-semibold text-success">
                        {formatCurrency(selectedOption.currentPrice)}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({selectedOption.reduction.toFixed(1)}% reduction)
                      </span>
                    </p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-muted-foreground">
                      Odds: <span className="font-semibold">{selectedOption.odds.toFixed(2)}x</span>
                    </span>
                    <span className="text-muted-foreground">
                      Win Chance: <span className="font-semibold">{selectedOption.winProbability.toFixed(1)}%</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="betAmount">Bet Amount</Label>
                <Input
                  id="betAmount"
                  type="number"
                  placeholder="Enter amount"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  min="1"
                  step="1"
                />
              </div>

              {selectedOption && parseFloat(betAmount) > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Your Bet:</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(betAmount))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Potential Return:</span>
                    <span className="text-lg font-bold text-success">
                      {formatCurrency(selectedOption.potentialReturn)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Profit:</span>
                    <span className="font-semibold text-success">
                      {formatCurrency(selectedOption.potentialReturn - parseFloat(betAmount))}
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePlaceBet}
                className="w-full"
                disabled={!selectedAgentId || !betAmount || parseFloat(betAmount) <= 0}
                size="lg"
              >
                Place Bet on Agent 🤫
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

