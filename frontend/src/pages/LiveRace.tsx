import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, CheckCircle, Hand, DollarSign, Trophy, Users, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { SpatzIcon } from "@/components/SpatzIcon";
import { LiveRaceChart } from "@/components/LiveRaceChart";
import { CommunicationLog } from "@/components/CommunicationLog";
import { SuggestionCard } from "@/components/SuggestionCard";
import { InterventionModal } from "@/components/InterventionModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { NegotiationDetail, Message } from "@/data/types";

interface Offer {
  id: number;
  negotiation_id: number;
  vendor_id: number;
  vendor_name: string;
  description: string;
  price: number;
  pros: string[] | null;
  cons: string[] | null;
}

export function LiveRace() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [showIntervention, setShowIntervention] = useState(false);
  const [showOffersPanel, setShowOffersPanel] = useState(false);
  const hasUserSelectedOffer = useRef(false);
  const [negotiation, setNegotiation] = useState<NegotiationDetail | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerLabels, setOfferLabels] = useState<Record<number, string>>({});
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [acceptedOfferId, setAcceptedOfferId] = useState<number | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<number>>(new Set());
  const [isPriceChartCollapsed, setIsPriceChartCollapsed] = useState(false);
  const [isTranscriptCollapsed, setIsTranscriptCollapsed] = useState(false);
  const [isOffersCollapsed, setIsOffersCollapsed] = useState(false);

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
          status: data.status === "running" ? "IN_PROGRESS" : data.status === "accepted" ? "ACCEPTED" : data.status === "COMPLETED" ? "COMPLETED" : data.status || "IN_PROGRESS",
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
          console.log("[LiveRace] Vendors:", data.vendors?.map((v: any) => ({ id: v.id, name: v.name })));
          console.log("[LiveRace] Messages vendor_ids:", data.messages?.map((m: any) => m.vendor_id));
          
          setNegotiation(negotiationDetail);
          setAllMessages(data.messages || []);
          setOffers(data.offers || []);
          setAcceptedOfferId(data.accepted_offer || null);
          
          // Pre-select accepted offer if one exists
          if (data.accepted_offer) {
            setSelectedOfferId(data.accepted_offer);
          }
          
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

  // Fetch offer labels when panel is opened (must be before early returns)
  useEffect(() => {
    if (showOffersPanel && offers.length > 0 && Object.keys(offerLabels).length === 0) {
      const fetchLabels = async () => {
        setIsLoadingLabels(true);
        try {
          const response = await fetch("http://localhost:3001/api/offers/labels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offers }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setOfferLabels(data.labels || {});
          }
        } catch (error) {
          console.error("Error fetching offer labels:", error);
        } finally {
          setIsLoadingLabels(false);
        }
      };
      fetchLabels();
    }
  }, [showOffersPanel, offers, offerLabels]);

  // Pre-select recommended offer (Best Value with trophy icon) when labels are loaded and panel opens
  useEffect(() => {
    if (
      showOffersPanel &&
      !acceptedOfferId &&
      offers.length > 0 &&
      Object.keys(offerLabels).length > 0 &&
      !hasUserSelectedOffer.current
    ) {
      // Find the offer with "Best Value" label (the one that shows "Recommended Choice" with trophy icon)
      const recommendedOffer = offers.find(
        (offer) => offerLabels[offer.id] === "Best Value"
      );
      
      if (recommendedOffer && selectedOfferId !== recommendedOffer.id) {
        setSelectedOfferId(recommendedOffer.id);
      } else if (!recommendedOffer && selectedOfferId === null) {
        // Fallback to lowest price if no "Best Value" label exists
        const bestOffer = offers.reduce((best: Offer, current: Offer) => 
          current.price < best.price ? current : best
        );
        setSelectedOfferId(bestOffer.id);
      }
    }
  }, [showOffersPanel, offerLabels, offers, acceptedOfferId, selectedOfferId]);

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
        {/* Top bar with back button and centered logo */}
        <div className="w-full px-4 md:px-6 pt-6 relative z-10 flex items-center justify-between">
          {/* Back button - top left */}
          <Button asChild variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-900/80">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          
          {/* Logo - centered */}
          <Link to="/" className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
            <SpatzIcon size={36} />
            <span className="text-xl font-semibold text-white">
              ask<span className="text-stone-900">Spatz</span>
            </span>
          </Link>
          
          {/* Spacer for balance */}
          <div className="w-20"></div>
        </div>
        <main className="w-full h-[calc(100vh-4rem)] flex items-center justify-center relative z-10">
          <p className="text-lg text-white/80">Loading negotiation...</p>
        </main>
      </div>
    );
  }

  if (!negotiation) {
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
        {/* Top bar with back button and centered logo */}
        <div className="w-full px-4 md:px-6 pt-6 relative z-10 flex items-center justify-between">
          {/* Back button - top left */}
          <Button asChild variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-900/80">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          
          {/* Logo - centered */}
          <Link to="/" className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
            <SpatzIcon size={36} />
            <span className="text-xl font-semibold text-white">
              ask<span className="text-stone-900">Spatz</span>
            </span>
          </Link>
          
          {/* Spacer for balance */}
          <div className="w-20"></div>
        </div>
        <main className="container px-4 md:px-6 py-8 text-center relative z-10">
          <p className="text-lg text-white/80">Negotiation not found</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </main>
      </div>
    );
  }

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

  // Find best price from all price history (real data only)
  let lowestPrice = Infinity;
  let winningVendor = "";
  negotiation.priceHistory.forEach((round) => {
    negotiation.vendors.forEach((vendor) => {
      const price = round[vendor.id] as number | undefined;
      if (price && price < lowestPrice) {
        lowestPrice = price;
        winningVendor = vendor.company;
      }
    });
  });
  
  // Count finished agents (unique vendor_ids in offers)
  const finishedAgentsCount = new Set(offers.map(o => o.vendor_id)).size;

  // Helper function to truncate description to first few words
  const truncateDescription = (text: string, wordCount: number = 16): string => {
    const words = text.split(' ');
    if (words.length <= wordCount) return text;
    return words.slice(0, wordCount).join(' ');
  };

  const toggleOfferExpansion = (offerId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking expand button
    setExpandedOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(offerId)) {
        newSet.delete(offerId);
      } else {
        newSet.add(offerId);
      }
      return newSet;
    });
  };

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
      {/* Top bar with back button and centered logo */}
      <div className="w-full px-4 md:px-6 pt-6 relative z-10 flex items-center justify-between">
        {/* Back button - top left */}
        <Button asChild variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-900/50">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        
        {/* Logo - centered */}
        <Link to="/" className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
          <SpatzIcon size={36} />
          <span className="text-xl font-semibold text-white">
            ask<span className="text-gray-900">Spatz</span>
          </span>
        </Link>
        
        {/* Spacer for balance */}
        <div className="w-20"></div>
      </div>

      <main className="w-full px-4 md:px-6 py-8 relative z-10">

        {/* Title */}
        <div className="flex flex-col items-center gap-4 mb-6 text-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">
              {negotiation.productName || negotiation.title}
            </h1>
            <StatusBadge status={negotiation.status} />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6 mb-8">
          {/* Small detail boxes above the chart */}
          <div className="flex items-center justify-center gap-3">
            {/* Best Price - Small box */}
            <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-[10px] text-white/70 leading-tight">Best Price</p>
                  {lowestPrice < Infinity ? (
                    <p className="text-sm font-bold text-emerald-300 leading-tight">
                      {formatCurrency(lowestPrice)}
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-white/60 leading-tight">
                      Awaiting...
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Vendors - Small box */}
            <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white/70" />
                <div>
                  <p className="text-[10px] text-white/70 leading-tight">Vendors</p>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {negotiation.vendors.length}
                  </p>
                </div>
              </div>
            </Card>

            {/* Finished - Small box */}
            <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-[10px] text-white/70 leading-tight">Finished</p>
                  <p className="text-sm font-semibold text-emerald-300 leading-tight">
                    {finishedAgentsCount}/{negotiation.vendors.length}
                  </p>
                </div>
              </div>
            </Card>

            {/* View All Offers button - In same row */}
            {finishedAgentsCount === negotiation.vendors.length && finishedAgentsCount > 0 && (
              <div className="relative">
                <Card 
                  onClick={() => setShowOffersPanel(true)}
                  className="bg-stone-900/80 backdrop-blur-md border-2 border-amber-300/80 shadow-lg px-3 py-2 cursor-pointer hover:bg-stone-900/90 hover:border-amber-300 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="text-[10px] text-white/70 leading-tight">View</p>
                      <p className="text-sm font-semibold text-amber-300 leading-tight">
                        Offers
                      </p>
                    </div>
                  </div>
                </Card>
                {/* Handwritten arrow with "click here ;)" */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 text-white pointer-events-none flex flex-col items-center">
                  <svg 
                    width="50" 
                    height="30" 
                    viewBox="0 0 50 30" 
                    className="transform rotate-180"
                    style={{ filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.5))' }}
                  >
                    <path 
                      d="M 5 15 Q 15 10, 25 15 T 45 15" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      fill="none" 
                      strokeLinecap="round"
                      style={{ strokeDasharray: '2,2' }}
                    />
                    <path 
                      d="M 40 10 L 45 15 L 40 20" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      fill="none" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p 
                    className="text-[9px] text-white font-handwriting whitespace-nowrap mt-1"
                    style={{ 
                      fontFamily: 'cursive',
                      transform: 'rotate(-2deg)',
                      textShadow: '0 0 2px rgba(255, 255, 255, 0.5)'
                    }}
                  >
                    click here ;)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Price Comparison - Collapsible */}
          <div className="relative">
            {!isPriceChartCollapsed ? (
              <>
                <div 
                  className="absolute top-4 right-4 z-10 cursor-pointer p-2 rounded-full bg-stone-800/80 hover:bg-stone-700/80 transition-colors"
                  onClick={() => setIsPriceChartCollapsed(!isPriceChartCollapsed)}
                >
                  <ChevronUp className="h-4 w-4 text-white/70" />
                </div>
                <LiveRaceChart
                  priceHistory={negotiation.priceHistory}
                  vendors={negotiation.vendors}
                  finishedVendorIds={offers.map(o => String(o.vendor_id))}
                />
              </>
            ) : (
              <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Price Comparison</CardTitle>
                    <div 
                      className="cursor-pointer p-2 rounded-full bg-stone-800/80 hover:bg-stone-700/80 transition-colors"
                      onClick={() => setIsPriceChartCollapsed(!isPriceChartCollapsed)}
                    >
                      <ChevronDown className="h-4 w-4 text-white/70" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )}
          </div>

          {/* Negotiation Transcript - Collapsible */}
          <div className="relative">
            {!isTranscriptCollapsed ? (
              <>
                <div 
                  className="absolute top-4 right-4 z-10 cursor-pointer p-2 rounded-full bg-stone-800/80 hover:bg-stone-700/80 transition-colors"
                  onClick={() => setIsTranscriptCollapsed(!isTranscriptCollapsed)}
                >
                  <ChevronUp className="h-4 w-4 text-white/70" />
                </div>
                <CommunicationLog 
                  messages={allMessages}
                  vendors={negotiation.vendors}
                />
              </>
            ) : (
              <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Negotiation Transcript</CardTitle>
                    <div 
                      className="cursor-pointer p-2 rounded-full bg-stone-800/80 hover:bg-stone-700/80 transition-colors"
                      onClick={() => setIsTranscriptCollapsed(!isTranscriptCollapsed)}
                    >
                      <ChevronDown className="h-4 w-4 text-white/70" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )}
          </div>

          {/* Offers Widget - Collapsible */}
          <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  Extracted Offers ({offers.length})
                </CardTitle>
                <div 
                  className="cursor-pointer p-2 rounded-full bg-stone-800/80 hover:bg-stone-700/80 transition-colors"
                  onClick={() => setIsOffersCollapsed(!isOffersCollapsed)}
                >
                  {isOffersCollapsed ? (
                    <ChevronDown className="h-4 w-4 text-white/70" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-white/70" />
                  )}
                </div>
              </div>
            </CardHeader>
            {!isOffersCollapsed && (
            <CardContent>
              {offers.length === 0 ? (
                <p className="text-sm text-white/70 text-center py-4">
                  No offers extracted yet. Offers will appear here once the agent finishes negotiating.
                </p>
              ) : (
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="p-4 border border-stone-700/50 rounded-lg bg-stone-800/80"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/70 mb-1">
                            {offer.vendor_name}
                          </p>
                          <div className="text-sm break-words text-white/70">
                            {expandedOffers.has(offer.id) ? (
                              <>
                                {offer.description}
                                <button
                                  onClick={(e) => toggleOfferExpansion(offer.id, e)}
                                  className="ml-1 text-white/60 hover:text-white/80 underline"
                                >
                                  ... show less
                                </button>
                              </>
                            ) : (
                              <>
                                {truncateDescription(offer.description)}
                                {offer.description.split(' ').length > 16 && (
                                  <button
                                    onClick={(e) => toggleOfferExpansion(offer.id, e)}
                                    className="ml-1 text-white/60 hover:text-white/80 underline"
                                  >
                                    ...
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          {/* Pros and Cons */}
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            {offer.pros && offer.pros.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-300 mb-1">Pros</p>
                                <ul className="text-xs space-y-0.5">
                                  {offer.pros.map((pro, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-emerald-300">+</span>
                                      <span className="text-white/80">{pro}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {offer.cons && offer.cons.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-rose-300 mb-1">Cons</p>
                                <ul className="text-xs space-y-0.5">
                                  {offer.cons.map((con, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-rose-300">−</span>
                                      <span className="text-white/80">{con}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-emerald-300">
                            {formatCurrency(offer.price)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            )}
          </Card>
        </div>

        {/* Human Intervention Section (for REVIEW_REQUIRED) */}
        {negotiation.status === "REVIEW_REQUIRED" && (
          <Card className="mt-8 bg-stone-900/80 backdrop-blur-md border-amber-300/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-amber-200 text-center">
                Human Intervention Recommended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {negotiation.suggestions.map((suggestion, idx) => (
                  <SuggestionCard key={idx} suggestion={suggestion} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
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
          <div className="mt-8 flex justify-center">
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

        {/* Offers Panel (Slide-out from right) */}
        <Sheet open={showOffersPanel} onOpenChange={setShowOffersPanel}>
          <SheetContent className="w-[800px] sm:w-[900px] overflow-y-auto bg-stone-900 border-stone-700">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-white">
                <Trophy className="h-5 w-5 text-emerald-300" />
                All Offers ({offers.length})
              </SheetTitle>
            </SheetHeader>
            {(isLoadingLabels || Object.keys(offerLabels).length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-300 mb-4"></div>
                <p className="text-sm text-white/70">Analyzing offers...</p>
              </div>
            ) : (
            <div className="mt-6 space-y-4">
              {offers
                .sort((a, b) => {
                  // Best Value always on top
                  const aIsBestValue = offerLabels[a.id] === "Best Value";
                  const bIsBestValue = offerLabels[b.id] === "Best Value";
                  if (aIsBestValue && !bIsBestValue) return -1;
                  if (!aIsBestValue && bIsBestValue) return 1;
                  // Then sort by price
                  return a.price - b.price;
                })
                .map((offer) => {
                  const label = offerLabels[offer.id];
                  const isBestValue = label === "Best Value";
                  const isSelected = selectedOfferId === offer.id;
                  const isAccepted = acceptedOfferId === offer.id;
                  const isClickable = !acceptedOfferId;
                  
                  return (
                    <div
                      key={offer.id}
                      onClick={() => {
                        if (isClickable) {
                          setSelectedOfferId(offer.id);
                          hasUserSelectedOffer.current = true; // Mark that user has manually selected
                        }
                      }}
                      className={`p-4 border rounded-lg transition-all relative ${
                        isAccepted
                          ? "bg-emerald-300/20 border-emerald-300 ring-2 ring-emerald-300/50 shadow-lg cursor-default"
                          : isSelected
                          ? "bg-sky-300/10 border-sky-300 ring-2 ring-sky-300/50 shadow-lg cursor-pointer hover:bg-sky-300/15"
                          : isClickable
                          ? "bg-stone-800/50 cursor-pointer hover:bg-stone-800/70 border-stone-700"
                          : "bg-stone-800/50 cursor-default border-stone-700"
                      }`}
                      >
                      {label ? (
                        <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                          isBestValue 
                            ? "border-sky-300/30"
                            : isAccepted
                            ? "border-emerald-300/30"
                            : "border-stone-600/30"
                        }`}>
                          {isBestValue && <Trophy className="h-5 w-5 text-sky-300" />}
                          {isAccepted && <CheckCircle className="h-5 w-5 text-emerald-300" />}
                          <span className={`text-sm font-semibold ${
                            isBestValue 
                              ? "text-sky-300"
                              : isAccepted
                              ? "text-emerald-300"
                              : "text-white/70"
                          }`}>
                            {label}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-600/30">
                          <span className="text-sm font-semibold text-white/70">Alternative</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className={`text-sm font-medium ${isBestValue ? "text-sky-300" : "text-white"}`}>
                              {offer.vendor_name}
                            </p>
                          </div>
                          <div className="text-sm text-white/70 break-words">
                            {expandedOffers.has(offer.id) ? (
                              <>
                                {offer.description}
                                <button
                                  onClick={(e) => toggleOfferExpansion(offer.id, e)}
                                  className="ml-1 text-white/60 hover:text-white/80 underline"
                                >
                                  ... show less
                                </button>
                              </>
                            ) : (
                              <>
                                {truncateDescription(offer.description)}
                                {offer.description.split(' ').length > 16 && (
                                  <button
                                    onClick={(e) => toggleOfferExpansion(offer.id, e)}
                                    className="ml-1 text-white/60 hover:text-white/80 underline"
                                  >
                                    ...
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          {/* Pros and Cons */}
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            {offer.pros && offer.pros.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-300 mb-1">Pros</p>
                                <ul className="text-xs space-y-0.5">
                                  {offer.pros.map((pro, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-emerald-300">+</span>
                                      <span className="text-white/80">{pro}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {offer.cons && offer.cons.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-rose-300 mb-1">Cons</p>
                                <ul className="text-xs space-y-0.5">
                                  {offer.cons.map((con, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-rose-300">−</span>
                                      <span className="text-white/80">{con}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-2xl font-bold ${isBestValue ? "text-sky-300" : "text-white"}`}>
                            {formatCurrency(offer.price)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            )}
            
            {/* Accept Offer Button - only show when no offer is accepted */}
            {!acceptedOfferId && selectedOfferId && offers.length > 0 && (
              <div className="mt-6 pt-6 border-t border-stone-700">
                <Button
                  onClick={() => setShowAcceptConfirm(true)}
                  className="w-full bg-emerald-300/20 hover:bg-emerald-300/30 text-emerald-300 border-emerald-300/50"
                  size="lg"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Offer
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
        
        {/* Confirmation Dialog */}
        <Dialog open={showAcceptConfirm} onOpenChange={setShowAcceptConfirm}>
          <DialogContent className="bg-stone-900 border-stone-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Accept Offer</DialogTitle>
              <DialogDescription className="text-white/70">
                Are you sure you want to accept this offer? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedOfferId && (() => {
              const selectedOffer = offers.find(o => o.id === selectedOfferId);
              return selectedOffer ? (
                <div className="py-4">
                  <p className="font-medium mb-2 text-white">{selectedOffer.vendor_name}</p>
                  <p className="text-2xl font-bold text-emerald-300 mb-2">
                    {formatCurrency(selectedOffer.price)}
                  </p>
                  <p className="text-sm text-white/70">{selectedOffer.description}</p>
                </div>
              ) : null;
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAcceptConfirm(false)} className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedOfferId || !id) return;
                  
                  try {
                    const response = await fetch(`http://localhost:3001/api/negotiation-groups/${id}/accept-offer`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ offerId: selectedOfferId }),
                    });
                    
                    if (!response.ok) {
                      throw new Error("Failed to accept offer");
                    }
                    
                    const data = await response.json();
                    setAcceptedOfferId(selectedOfferId);
                    setShowAcceptConfirm(false);
                    setShowOffersPanel(false);
                    
                    toast({
                      title: "Offer Accepted",
                      description: `Successfully accepted offer from ${data.vendor_name}`,
                      variant: "success",
                    });
                  } catch (error) {
                    console.error("Error accepting offer:", error);
                    toast({
                      title: "Error",
                      description: "Failed to accept offer. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-emerald-300/20 hover:bg-emerald-300/30 text-emerald-300 border-emerald-300/50"
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
