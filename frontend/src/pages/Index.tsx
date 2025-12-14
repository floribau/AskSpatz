import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { NegotiationCard } from "@/components/NegotiationCard";
import { VendorCard } from "@/components/VendorCard";
import { SpatzIcon } from "@/components/SpatzIcon";
import { Negotiation } from "@/data/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  id: string;
  name: string;
  company: string;
  color: string;
  category: string;
  behaviour?: string | null;
}

export function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [typingText, setTypingText] = useState("");
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedBehaviour, setEditedBehaviour] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const userName = "Spatz"; // TODO: Replace with actual logged-in user name
  
  const examples = [
    "I want the best deal for a coffee machine for the office...",
    "We need a banner for going on fairs with our company logo on it...",
    "We want to find a food delivery service for providing the best food in a hackathon..."
  ];

  useEffect(() => {
    async function fetchNegotiations() {
      try {
        const response = await fetch("http://localhost:3001/api/negotiation-groups");
        if (!response.ok) {
          throw new Error("Failed to fetch negotiations");
        }
        const data = await response.json();
        console.log("[Index] Fetched negotiations:", data);
        console.log("[Index] Sample negotiation:", data[0]);
        setNegotiations(data);
      } catch (error) {
        console.error("Error fetching negotiations:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchNegotiations();
  }, []);

  useEffect(() => {
    async function fetchVendors() {
      try {
        const response = await fetch("http://localhost:3001/api/vendors");
        if (!response.ok) {
          throw new Error("Failed to fetch vendors");
        }
        const data = await response.json();
        setVendors(data);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      } finally {
        setIsLoadingVendors(false);
      }
    }
    fetchVendors();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Typing effect
  useEffect(() => {
    if (inputValue) return; // Don't show typing effect if user is typing
    
    const currentExample = examples[currentExampleIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      // Typing
      if (typingText.length < currentExample.length) {
        timeout = setTimeout(() => {
          setTypingText(currentExample.slice(0, typingText.length + 1));
        }, 50);
      } else {
        // Finished typing, wait then start deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    } else {
      // Deleting
      if (typingText.length > 0) {
        timeout = setTimeout(() => {
          setTypingText(typingText.slice(0, -1));
        }, 30);
      } else {
        // Finished deleting, move to next example
        setIsDeleting(false);
        setCurrentExampleIndex((prev) => (prev + 1) % examples.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [typingText, currentExampleIndex, isDeleting, inputValue, examples]);

  const handleSubmit = async () => {
    if (inputValue.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        // Call the API to start negotiation - backend will search products and find matching vendors
        const response = await fetch("http://localhost:3001/api/negotiations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Don't send vendorIds - let backend search products and find matching vendors
            negotiationName: "",
            productName: inputValue.trim().substring(0, 50),
            userRequest: inputValue.trim(),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Navigate to the live race page with the negotiation group ID
          navigate(`/negotiation/${data.negotiationGroupId}`);
        } else {
          console.error("Failed to start negotiation");
          setIsSubmitting(false);
        }
      } catch (error) {
        console.error("Error starting negotiation:", error);
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift+Enter = new line (allow default behavior)
        return;
      } else {
        // Enter = submit
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleVendorClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setEditedBehaviour(vendor.behaviour || "");
    setIsEditModalOpen(true);
  };

  const handleSaveBehaviour = async () => {
    if (!selectedVendor) return;

    setIsSaving(true);
    try {
      const response = await fetch(`http://localhost:3001/api/vendors/${selectedVendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ behaviour: editedBehaviour }),
      });

      if (response.ok) {
        // Update the vendor in the local state
        setVendors((prev) =>
          prev.map((v) =>
            v.id === selectedVendor.id ? { ...v, behaviour: editedBehaviour } : v
          )
        );
        toast({
          title: "Vendor updated",
          description: `Behavior for ${selectedVendor.name} has been updated.`,
          variant: "success",
        });
        setIsEditModalOpen(false);
      } else {
        throw new Error("Failed to update vendor");
      }
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast({
        title: "Error",
        description: "Failed to update vendor behavior.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
      <main className="w-full px-4 md:px-6 pt-8 pb-8 relative z-10">
        <div className="w-full mx-auto">
          {/* Centered header section with logo */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <SpatzIcon size={48} />
              <h1 className="text-4xl font-bold text-white">
                ask<span className="text-stone-900">Spatz</span>
              </h1>
            </div>
            <p className="text-white/80">
              Monitor and manage your autonomous procurement negotiations in
              real-time.
            </p>
          </div>

          {/* Main content: Natural language input field */}
          <div className="flex flex-col items-center my-32 w-full max-w-4xl mx-auto">
            <label 
              htmlFor="negotiation-input" 
              className="text-white text-3xl font-semibold mb-6 text-center w-full"
            >
              Ready to negotiate, {userName}?
            </label>
            <div className="relative w-full">
              <textarea
                id="negotiation-input"
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder=""
                disabled={isSubmitting}
                className="w-full min-h-[120px] px-6 py-4 pr-20 text-white text-lg bg-stone-900/80 backdrop-blur-md border border-stone-700/50 rounded-2xl shadow-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-stone-600 focus:border-stone-600 transition-all disabled:opacity-50"
                style={{ 
                  fontFamily: 'inherit',
                  lineHeight: '1.5'
                }}
              />
              {!inputValue && typingText && !isSubmitting && (
                <div className="absolute top-4 left-6 text-white/50 text-lg pointer-events-none">
                  {typingText}
                  <span className="animate-pulse">|</span>
                </div>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isSubmitting}
                size="sm"
                className="absolute bottom-4 right-4 h-8 px-3 bg-stone-700 hover:bg-stone-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Dark gray tile container for negotiations and vendors */}
          <div className="bg-stone-900/80 rounded-t-2xl mt-64 p-6 md:p-8">
            <div className="space-y-12">
              {/* Negotiations Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Negotiations</h2>
                  {negotiations.length > 3 && (
                    <Button
                      onClick={() => navigate("/all-negotiations")}
                      variant="outline"
                      size="sm"
                      className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50"
                    >
                      Browse All ({negotiations.length})
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                      Loading negotiations...
                    </p>
                  </div>
                ) : negotiations.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                      No negotiations yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Start a new negotiation to see it here
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                    {negotiations.slice(0, 3).map((negotiation) => (
                      <NegotiationCard
                        key={negotiation.id}
                        negotiation={negotiation}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Vendors Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Vendors</h2>
                  {vendors.length > 3 && (
                    <Button
                      onClick={() => navigate("/all-vendors")}
                      variant="outline"
                      size="sm"
                      className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50"
                    >
                      Browse All ({vendors.length})
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
                {isLoadingVendors ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                      Loading vendors...
                    </p>
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                      No vendors available
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                    {vendors.slice(0, 3).map((vendor) => (
                      <VendorCard
                        key={vendor.id}
                        vendor={vendor}
                        onClick={() => handleVendorClick(vendor)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Vendor Behavior Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-stone-900 border-stone-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Edit Behavior: {selectedVendor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-white/70 mb-2 block">
              Behavior Description
            </label>
            <Textarea
              value={editedBehaviour}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedBehaviour(e.target.value)}
              placeholder="Enter vendor behavior description..."
              className="min-h-[200px] bg-stone-800 border-stone-700 text-white placeholder:text-stone-500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-gray-800/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBehaviour}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
