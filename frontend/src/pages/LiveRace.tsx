import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, CheckCircle, Hand } from "lucide-react";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { SpatzIcon } from "@/components/SpatzIcon";
import { LiveRaceChart } from "@/components/LiveRaceChart";
import { CommunicationLog } from "@/components/CommunicationLog";
import { SuggestionCard } from "@/components/SuggestionCard";
import { VendorLeaderboard } from "@/components/VendorLeaderboard";
import { InterventionModal } from "@/components/InterventionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { NegotiationDetail, Message } from "@/data/types";

export function LiveRace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showIntervention, setShowIntervention] = useState(false);
  const [negotiation, setNegotiation] = useState<NegotiationDetail | null>(null);
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
        
        // Map to NegotiationDetail format with safe defaults
        const negotiationDetail: NegotiationDetail = {
          id: data.id || id,
          title: data.title || "Negotiation",
          productName: data.productName || "",
          best_nap: data.startingPrice || 0,
          savings_percent: 0,
          status: data.status === "running" ? "IN_PROGRESS" : data.status || "IN_PROGRESS",
          vendors_engaged: data.vendors_engaged || 0,
          created_at: new Date().toISOString(),
          startingPrice: data.startingPrice || 0,
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
          setIsLoading(false);

          // Stop polling if negotiation is finished
          if (data.status === "finished" || data.status === "COMPLETED") {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching negotiation group:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    // Initial fetch
    fetchNegotiationGroup();
    
    // Poll every 2 seconds to get updates (messages, status changes)
    intervalId = setInterval(fetchNegotiationGroup, 2000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewNegotiation={() => navigate("/new")} />
        <main className="container px-4 md:px-6 py-8 text-center">
          <p className="text-lg text-muted-foreground">Loading negotiation...</p>
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

  // Get latest price round for calculations
  const latestRound =
    negotiation.priceHistory[negotiation.priceHistory.length - 1];

  const handleSendMessage = (message: string) => {
    const newMessage: Message = {
      sender: "human",
      name: "Human Negotiator",
      content: message,
      timestamp: new Date().toISOString(),
    };
    setNegotiation((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, newMessage],
          }
        : null
    );
    toast({ title: "Message sent", variant: "success" });
  };

  const handleApprove = () => {
    toast({
      title: "Purchase Order Approved",
      description: "The PO has been sent to the winning vendor.",
      variant: "success",
    });
  };

  const handleManualIntervention = () => {
    setShowIntervention(true);
  };

  // Find best price
  let lowestPrice = negotiation.startingPrice;
  let winningVendor = "";
  negotiation.vendors.forEach((vendor) => {
    const price = latestRound?.[vendor.id] as number | undefined;
    if (price && price < lowestPrice) {
      lowestPrice = price;
      winningVendor = vendor.company;
    }
  });
  const savingsPercent = (
    ((negotiation.startingPrice - lowestPrice) / negotiation.startingPrice) *
    100
  ).toFixed(1);

  return (
    <div className="min-h-screen bg-background">
      <Header onNewNegotiation={() => navigate("/new")} />

      <main className="container px-4 md:px-6 py-8">
        {/* Back Link & Title */}
        <div className="flex items-center gap-4 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <SpatzIcon size={32} />
              <h1 className="text-2xl font-bold text-foreground">
                Live Negotiation Race
              </h1>
            </div>
            <p className="text-muted-foreground">{negotiation.title}</p>
            <p className="text-sm text-muted-foreground">
              {negotiation.productName}
            </p>
          </div>
          <StatusBadge status={negotiation.status} />
        </div>

        {/* Current Best Price Banner */}
        <Card className="mb-8 bg-gradient-to-r from-success/10 to-success/5 border-success/30">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Current Best Price
                </p>
                <p className="text-4xl font-bold text-success">
                  {formatCurrency(lowestPrice)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {winningVendor} - {savingsPercent}% savings
                </p>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Starting</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(negotiation.startingPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-lg font-semibold text-primary">
                    {formatCurrency(negotiation.targetPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendors</p>
                  <p className="text-lg font-semibold">
                    {negotiation.vendors.length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Chart & Communication */}
          <div className="lg:col-span-2 space-y-6">
            <LiveRaceChart
              priceHistory={negotiation.priceHistory}
              vendors={negotiation.vendors}
            />
            <CommunicationLog messages={negotiation.messages} />
          </div>

          {/* Right Column - Agent Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SpatzIcon size={20} />
                  Agent Rationale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {negotiation.agentRationale}
                </p>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Risk Score</span>
                  <span className="text-lg font-bold text-warning">
                    {negotiation.riskScore}/10
                  </span>
                </div>
              </CardContent>
            </Card>

            <VendorLeaderboard
              vendors={negotiation.vendors}
              priceHistory={negotiation.priceHistory}
              startingPrice={negotiation.startingPrice}
            />
          </div>
        </div>

        {/* Human Intervention Section (for REVIEW_REQUIRED) */}
        {negotiation.status === "REVIEW_REQUIRED" && (
          <Card className="mt-8 border-warning/50">
            <CardHeader>
              <CardTitle className="text-warning">
                Human Intervention Recommended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {negotiation.suggestions.map((suggestion, idx) => (
                  <SuggestionCard key={idx} suggestion={suggestion} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={handleApprove}
                  variant="success"
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve & Send PO
                </Button>
                <Button
                  onClick={handleManualIntervention}
                  variant="outline"
                  className="gap-2"
                >
                  <Hand className="h-4 w-4" />
                  Manual Intervention
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Always show intervention button for active negotiations */}
        {negotiation.status === "IN_PROGRESS" && (
          <div className="mt-8">
            <Button
              onClick={handleManualIntervention}
              className="gap-2 w-full md:w-auto"
            >
              <MessageCircle className="h-4 w-4" />
              Intervene as Human
            </Button>
          </div>
        )}

        {/* Intervention Modal */}
        <InterventionModal
          open={showIntervention}
          onOpenChange={setShowIntervention}
          negotiation={negotiation}
          onSendMessage={handleSendMessage}
        />
      </main>
    </div>
  );
}
