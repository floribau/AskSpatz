import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, TrendingDown, Trophy, BarChart3, Coins, History, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { SpatzIcon } from "@/components/SpatzIcon";

interface NegotiationGroup {
  id: string;
  title: string;
  productName: string;
  status: string;
  vendors: Vendor[];
  priceHistory: any[];
  startingPrice: number;
  negotiations?: Array<{ id: number; vendor_id: number }>; // Mapping of negotiation_id to vendor_id
}

interface Vendor {
  id: string;
  name: string;
  company: string;
  color: string;
}

interface BettingOption {
  negotiationId: string;
  negotiationTitle: string;
  agentId: string; // Agent ID (negotiation_id for this vendor)
  vendor: Vendor;
  currentPrice: number | null;
  reduction: number;
  odds: number;
  potentialReturn: number;
  winProbability: number;
  startingPrice: number;
}

interface VendorHistory {
  vendorId: string;
  company: string;
  totalNegotiations: number;
  averageReduction: number;
  winRate: number;
  characteristics: string[];
  knownFor: string;
}

// Vendor characteristics data
const vendorCharacteristics: Record<string, VendorHistory> = {
  "56": {
    vendorId: "56",
    company: "Vendor A",
    totalNegotiations: 12,
    averageReduction: 18.5,
    winRate: 65,
    characteristics: ["Tough negotiator", "Slow to respond", "Quality focused"],
    knownFor: "Known for being tough in negotiations but offering high quality products"
  },
  "57": {
    vendorId: "57",
    company: "Vendor B",
    totalNegotiations: 8,
    averageReduction: 22.3,
    winRate: 75,
    characteristics: ["Fast responder", "Price competitive", "Flexible"],
    knownFor: "Quick to respond and competitive on pricing"
  },
  "58": {
    vendorId: "58",
    company: "Vendor C",
    totalNegotiations: 15,
    averageReduction: 15.2,
    winRate: 55,
    characteristics: ["Stable prices", "Reliable", "Less flexible"],
    knownFor: "Stable pricing with less flexibility but very reliable"
  }
};

export function Betting() {
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get("id");
  const id = routeId || queryId; // Use route param first, then query param
  const navigate = useNavigate();
  const { toast } = useToast();
  const [spatzencoins, setSpatzencoins] = useState<number>(1000); // Starting coins
  const [negotiations, setNegotiations] = useState<NegotiationGroup[]>([]);
  const [bettingOptions, setBettingOptions] = useState<BettingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<BettingOption | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("betting");
  const [isCompleted, setIsCompleted] = useState(false);

  // Fetch negotiation data - if id is provided, only fetch that negotiation
  useEffect(() => {
    async function fetchNegotiations() {
      try {
        if (id) {
          // Fetch only the specific negotiation
          const response = await fetch(`http://localhost:3001/api/negotiation-groups/${id}`);
          if (!response.ok) {
            throw new Error("Failed to fetch negotiation");
          }
          const detail = await response.json();
          
          // Check status - backend returns "IN_PROGRESS" or "COMPLETED"
          const status = detail.status;
          const isCompletedStatus = status === "COMPLETED" || 
                                    status === "completed" || 
                                    status === "accepted" ||
                                    (status && status !== "IN_PROGRESS" && status !== "running" && status !== "REVIEW_REQUIRED" && status !== "PENDING");
          
          console.log("[Betting] Negotiation detail:", { id: detail.id, status: detail.status, isCompleted: isCompletedStatus });
          setIsCompleted(isCompletedStatus);
          
          setNegotiations([{
            id: detail.id || id,
            title: detail.title || detail.name || "Negotiation",
            productName: detail.productName || "",
            status: status,
            vendors: detail.vendors || [],
            priceHistory: detail.priceHistory || [],
            startingPrice: detail.startingPrice || 25000,
            negotiations: detail.negotiations || []
          }]);
        } else {
          // No id - fetch all active negotiations
          const response = await fetch("http://localhost:3001/api/negotiation-groups");
          if (!response.ok) {
            throw new Error("Failed to fetch negotiations");
          }
          const groups = await response.json();
          
          // Filter for active negotiations
          const activeGroups = groups.filter((ng: any) => 
            ng.status === "IN_PROGRESS" || ng.status === "running" || ng.status === "IN_PROGRESS"
          );
          
          // Fetch detailed data for each negotiation to get price history
          const detailedNegotiations = await Promise.all(
            activeGroups.map(async (group: any) => {
              try {
                const detailResponse = await fetch(`http://localhost:3001/api/negotiation-groups/${group.id}`);
                if (detailResponse.ok) {
                  const detail = await detailResponse.json();
                  const status = detail.status || group.status;
                  const isCompletedStatus = status === "COMPLETED" || status === "completed" || 
                                            (status !== "IN_PROGRESS" && status !== "running" && status !== "REVIEW_REQUIRED");
                  
                  const negotiationData = {
                    id: group.id,
                    title: group.title || group.name || "Negotiation",
                    productName: group.productName || "",
                    status: status,
                    vendors: detail.vendors || [],
                    priceHistory: detail.priceHistory || [],
                    startingPrice: detail.startingPrice || 25000,
                    negotiations: detail.negotiations || []
                  };
                  
                  if (id && negotiationData.id === id) {
                    setIsCompleted(isCompletedStatus);
                  }
                  
                  return negotiationData;
                }
                return null;
              } catch (error) {
                console.error(`Error fetching details for ${group.id}:`, error);
                return null;
              }
            })
          );
          
          setNegotiations(detailedNegotiations.filter(n => n !== null));
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching negotiations:", error);
        setIsLoading(false);
      }
    }

    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [id]);

  // Calculate betting options based on most recent prices
  useEffect(() => {
    if (negotiations.length === 0) {
      setBettingOptions([]);
      return;
    }

    const options: BettingOption[] = [];

    negotiations.forEach((negotiation) => {
      if (!negotiation.vendors || negotiation.vendors.length === 0) return;

      // Get most recent price from price history
      const latestRound = negotiation.priceHistory?.[negotiation.priceHistory.length - 1];
      const startingPrice = negotiation.startingPrice || 25000;

      // Create mapping of vendor_id to negotiation_id (agent_id)
      const vendorToAgent = new Map<string, string>();
      if (negotiation.negotiations) {
        negotiation.negotiations.forEach((neg: any) => {
          vendorToAgent.set(String(neg.vendor_id), String(neg.id));
        });
      }

      negotiation.vendors.forEach((vendor) => {
        // Get agent ID (negotiation_id) for this vendor
        const agentId = vendorToAgent.get(vendor.id) || `agent-${vendor.id}`;
        
        // Get current price for this vendor from latest round
        const currentPrice = latestRound?.[vendor.id] as number | undefined;
        const price = currentPrice || null;

        // Calculate reduction
        const reduction = price 
          ? ((startingPrice - price) / startingPrice) * 100 
          : 0;

        options.push({
          negotiationId: negotiation.id,
          negotiationTitle: negotiation.title || negotiation.productName || "Negotiation",
          agentId,
          vendor,
          currentPrice: price || null,
          reduction,
          odds: 0, // Will calculate below
          potentialReturn: 0,
          winProbability: 0,
          startingPrice
        });
      });
    });

    // Calculate odds based on current prices (lowest price = favorite)
    if (options.length > 0) {
      // Group by negotiation
      const byNegotiation = new Map<string, BettingOption[]>();
      options.forEach(opt => {
        if (!byNegotiation.has(opt.negotiationId)) {
          byNegotiation.set(opt.negotiationId, []);
        }
        byNegotiation.get(opt.negotiationId)!.push(opt);
      });

      // Calculate odds for each negotiation group
      byNegotiation.forEach((groupOptions) => {
        const withPrices = groupOptions.filter(o => o.currentPrice !== null);
        
        if (withPrices.length > 0) {
          // Sort by price (lowest = best)
          withPrices.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
          
          // Calculate probabilities based on price (lower price = higher probability)
          const prices = withPrices.map(o => o.currentPrice!);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const range = maxPrice - minPrice || 1;

          withPrices.forEach((opt, index) => {
            // Inverse probability: lower price = higher probability
            const priceScore = 1 - ((opt.currentPrice! - minPrice) / range) * 0.7;
            opt.winProbability = (priceScore / withPrices.reduce((sum, o) => {
              const oScore = 1 - ((o.currentPrice! - minPrice) / range) * 0.7;
              return sum + oScore;
            }, 0)) * 100;

            // Calculate odds with house edge
            const houseEdge = 0.15; // 15% house edge
            opt.odds = (100 / opt.winProbability) * (1 - houseEdge);
          });

          // Options without prices get low probability
          groupOptions.forEach(opt => {
            if (opt.currentPrice === null) {
              opt.winProbability = 5;
              opt.odds = 15.0;
            }
          });
        } else {
          // No prices yet - equal odds
          groupOptions.forEach(opt => {
            opt.winProbability = 100 / groupOptions.length;
            opt.odds = groupOptions.length * 1.15;
          });
        }
      });
    }

    setBettingOptions(options);
  }, [negotiations]);

  // Calculate potential return
  useEffect(() => {
    if (!selectedOption || !betAmount) {
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSelectedOption({
      ...selectedOption,
      potentialReturn: amount * selectedOption.odds
    });
  }, [betAmount, selectedOption?.odds]);

  const handlePlaceBet = () => {
    if (!selectedOption || !betAmount) {
      toast({
        title: "Please select an option and enter bet amount",
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

    if (amount > spatzencoins) {
      toast({
        title: "Insufficient Spatzencoins",
        description: `You have ${spatzencoins} Spatzencoins but tried to bet ${amount}`,
        variant: "destructive",
      });
      return;
    }

    // Deduct coins
    setSpatzencoins(prev => prev - amount);

    toast({
      title: "Bet Placed! 🤫",
      description: `You bet ${amount} Spatzencoins on Agent #${selectedOption.agentId} (negotiating with ${selectedOption.vendor.company}) in "${selectedOption.negotiationTitle}". Potential return: ${(amount * selectedOption.odds).toFixed(0)} Spatzencoins`,
    });

    // Reset
    setSelectedOption(null);
    setBetAmount("");
  };

  if (isLoading) {
    return (
      <div 
        className="min-h-screen w-full relative bg-cover bg-center bg-no-repeat bg-fixed"
        style={{
          backgroundImage: 'url(/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-white text-lg">Loading betting platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full relative bg-cover bg-center bg-no-repeat bg-fixed"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Blur overlay when completed */}
      {isCompleted && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 flex items-center justify-center">
          <Card className="bg-stone-900/95 backdrop-blur-xl border-amber-300/50 shadow-2xl max-w-md mx-4 z-50">
            <CardHeader>
              <CardTitle className="text-white text-2xl text-center">⚠️ Bets Closed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white/90 text-center">
                Bets on this negotiation are closed as it's already completed.
              </p>
              <div className="p-4 bg-rose-500/20 border border-rose-500/50 rounded-lg">
                <p className="text-white/90 text-sm">
                  <span className="font-semibold text-rose-300">Disclaimer:</span> That one coworker you really don't like got <span className="font-bold text-rose-300">5,675€</span> out of it.
                </p>
              </div>
              <Button
                onClick={() => navigate(id ? `/negotiation/${id}` : "/")}
                className="w-full bg-amber-300/20 hover:bg-amber-300/30 text-amber-300 border-amber-300/50"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Top bar */}
      <div className="w-full px-4 md:px-6 pt-6 relative z-10 flex items-center justify-between">
        <Button asChild variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-900/50">
          <Link to={id ? `/negotiation/${id}` : "/"}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        
        <Link to="/" className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
          <SpatzIcon size={36} />
          <span className="text-xl font-semibold text-white">
            ask<span className="text-gray-900">Spatz</span>
          </span>
        </Link>

        {/* Spatzencoins display */}
        <div className="flex items-center gap-2 px-4 py-2 bg-stone-900/80 backdrop-blur-md border border-stone-700/50 rounded-lg">
          <Coins className="h-5 w-5 text-amber-400" />
          <span className="text-white font-semibold">{spatzencoins.toLocaleString()}</span>
          <span className="text-amber-400 text-sm">Spatzencoins</span>
        </div>
      </div>

      <main className={`w-full px-4 md:px-6 py-8 relative z-10 max-w-7xl mx-auto ${isCompleted ? 'pointer-events-none' : ''}`}>
        {/* Disclaimer for completed negotiations */}
        {isCompleted && (
          <Card className="bg-rose-500/20 backdrop-blur-md border-rose-500/50 shadow-lg mb-6">
            <CardContent className="py-4 px-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-white font-semibold mb-2">Bets on this negotiation are closed as it's already completed.</p>
                  <p className="text-white/90 text-sm">
                    <span className="font-semibold text-rose-300">Disclaimer:</span> That one coworker you really don't like got <span className="font-bold text-rose-300">5,675€</span> out of it.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">🤫 Secret Betting Platform</h1>
          <p className="text-white/70">Bet on which agent will get the lowest price</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-stone-800 mb-6 w-full justify-start">
            <TabsTrigger value="betting" className="text-white/70 data-[state=active]:bg-stone-700 data-[state=active]:text-white">
              Place Bets
            </TabsTrigger>
            <TabsTrigger value="history" className="text-white/70 data-[state=active]:bg-stone-700 data-[state=active]:text-white">
              Vendor History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="betting" className="mt-0">
            {bettingOptions.length === 0 ? (
              <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-white/70 text-lg">No active negotiations to bet on</p>
                  <p className="text-white/50 text-sm mt-2">Start a negotiation to see betting options</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Betting Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {bettingOptions.map((option) => {
                    const isSelected = selectedOption?.negotiationId === option.negotiationId && 
                                      selectedOption?.agentId === option.agentId;
                    const isLowest = option.currentPrice && bettingOptions
                      .filter(o => o.negotiationId === option.negotiationId && o.currentPrice)
                      .every(o => !o.currentPrice || o.currentPrice >= option.currentPrice!);

                    return (
                      <Card
                        key={`${option.negotiationId}-${option.vendor.id}`}
                        className={cn(
                          "bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg cursor-pointer transition-all hover:border-amber-300/50",
                          isSelected && "ring-2 ring-amber-300 border-amber-300",
                          isLowest && "border-emerald-300/50"
                        )}
                        onClick={() => setSelectedOption(option)}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-white text-lg">Agent #{option.agentId}</CardTitle>
                              <p className="text-xs text-white/60 mt-1">Negotiating with {option.vendor.company}</p>
                              <p className="text-xs text-white/50 mt-0.5">{option.negotiationTitle}</p>
                            </div>
                            {isLowest && <Trophy className="h-5 w-5 text-emerald-300" />}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* Current Price */}
                            <div>
                              <p className="text-xs text-white/70 mb-1">
                                {option.currentPrice ? "Current Best Price" : "No offers yet"}
                              </p>
                              {option.currentPrice ? (
                                <p className="text-2xl font-bold text-emerald-300">
                                  {formatCurrency(option.currentPrice)}
                                </p>
                              ) : (
                                <p className="text-lg font-semibold text-white/60">Negotiating...</p>
                              )}
                            </div>

                            {/* Reduction */}
                            {option.currentPrice && (
                              <div>
                                <p className="text-xs text-white/70 mb-1">Price Reduction</p>
                                <div className="flex items-center gap-2">
                                  <TrendingDown className="h-4 w-4 text-emerald-300" />
                                  <p className="text-lg font-semibold text-emerald-300">
                                    {option.reduction.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Odds */}
                            <div className="p-3 bg-stone-800/50 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/70">Odds</span>
                                <span className="text-sm font-semibold text-white">
                                  {option.odds.toFixed(2)}x
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-white/70">Win Probability</span>
                                <span className="text-sm font-semibold text-emerald-300">
                                  {option.winProbability.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Betting Form */}
                {selectedOption && (
                  <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg sticky bottom-4">
                    <CardHeader>
                      <CardTitle className="text-white">Place Your Bet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-4 bg-stone-800/50 rounded-lg border border-amber-300/20">
                          <p className="text-sm text-white/70 mb-1">Selected Agent</p>
                          <p className="text-lg font-semibold text-white">Agent #{selectedOption.agentId}</p>
                          <p className="text-xs text-white/60 mt-1">Negotiating with {selectedOption.vendor.company}</p>
                          <p className="text-xs text-white/50 mt-0.5">{selectedOption.negotiationTitle}</p>
                          {selectedOption.currentPrice && (
                            <p className="text-sm text-white/80 mt-2">
                              Current Price: <span className="font-semibold text-emerald-300">
                                {formatCurrency(selectedOption.currentPrice)}
                              </span>
                            </p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="text-white/70">
                              Odds: <span className="font-semibold text-white">{selectedOption.odds.toFixed(2)}x</span>
                            </span>
                            <span className="text-white/70">
                              Win Chance: <span className="font-semibold text-emerald-300">{selectedOption.winProbability.toFixed(1)}%</span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="betAmount" className="text-white">Bet Amount (Spatzencoins)</Label>
                          <Input
                            id="betAmount"
                            type="number"
                            placeholder="Enter amount"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min="1"
                            step="1"
                            className="bg-stone-800 border-stone-700 text-white"
                          />
                        </div>

                        {parseFloat(betAmount) > 0 && (
                          <div className="p-4 bg-stone-800/50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-white/70">Your Bet:</span>
                              <span className="font-semibold text-white">{parseFloat(betAmount).toLocaleString()} Spatzencoins</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-white/70">Potential Return:</span>
                              <span className="text-lg font-bold text-emerald-300">
                                {(parseFloat(betAmount) * selectedOption.odds).toFixed(0)} Spatzencoins
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-stone-700">
                              <span className="text-sm text-white/70">Profit:</span>
                              <span className="font-semibold text-emerald-300">
                                {((parseFloat(betAmount) * selectedOption.odds) - parseFloat(betAmount)).toFixed(0)} Spatzencoins
                              </span>
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={handlePlaceBet}
                          className="w-full bg-amber-300/20 hover:bg-amber-300/30 text-amber-300 border-amber-300/50"
                          disabled={!selectedOption || !betAmount || parseFloat(betAmount) <= 0 || parseFloat(betAmount) > spatzencoins}
                          size="lg"
                        >
                          Place Bet 🤫
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {negotiations.length > 0 && negotiations[0].vendors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {negotiations[0].vendors.map((vendor) => {
                  const history = vendorCharacteristics[vendor.id] || {
                    vendorId: vendor.id,
                    company: vendor.company,
                    totalNegotiations: 0,
                    averageReduction: 0,
                    winRate: 0,
                    characteristics: ["No history available"],
                    knownFor: "No historical data available for this vendor"
                  };
                  
                  return (
                    <Card key={vendor.id} className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <History className="h-5 w-5 text-amber-300" />
                          {vendor.company}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-white/70 mb-1">Known For</p>
                            <p className="text-sm text-white/90">{history.knownFor}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-white/70">Total Negotiations</p>
                              <p className="text-lg font-semibold text-white">{history.totalNegotiations}</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/70">Avg. Reduction</p>
                              <p className="text-lg font-semibold text-emerald-300">{history.averageReduction.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/70">Win Rate</p>
                              <p className="text-lg font-semibold text-emerald-300">{history.winRate}%</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-white/70 mb-2 flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              Characteristics
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {history.characteristics.map((char, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 bg-stone-800/50 border border-stone-700/50 rounded text-white/80"
                                >
                                  {char}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-white/70">No vendor history available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
