import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { NegotiationCard } from "@/components/NegotiationCard";
import { SpatzIcon } from "@/components/SpatzIcon";
import { Negotiation } from "@/data/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export function Index() {
  const navigate = useNavigate();
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNegotiations() {
      try {
        const response = await fetch("http://localhost:3001/api/negotiation-groups");
        if (!response.ok) {
          throw new Error("Failed to fetch negotiations");
        }
        const data = await response.json();
        setNegotiations(data);
      } catch (error) {
        console.error("Error fetching negotiations:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchNegotiations();
  }, []);

  const activeNegotiations = negotiations.filter(
    (n) => n.status === "IN_PROGRESS" || n.status === "REVIEW_REQUIRED"
  );
  const completedNegotiations = negotiations.filter(
    (n) => n.status === "COMPLETED"
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 md:px-6 pt-8 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Centered header section with logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <SpatzIcon size={48} />
              <h1 className="text-4xl font-bold text-foreground">
                ask<span className="text-primary">Spatz</span>
              </h1>
            </div>
            <p className="text-muted-foreground mb-6">
              Monitor and manage your autonomous procurement negotiations in
              real-time.
            </p>
            <Button 
              onClick={() => navigate("/new")} 
              size="lg" 
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              Start New Negotiation
            </Button>
          </div>

          <Tabs defaultValue="active" className="space-y-6">
            <div className="flex justify-center">
              <TabsList className="w-full max-w-md">
                <TabsTrigger 
                  value="active" 
                  className="flex-1 whitespace-nowrap text-sm font-medium px-2 sm:px-3"
                >
                  Active ({activeNegotiations.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="completed" 
                  className="flex-1 whitespace-nowrap text-sm font-medium px-2 sm:px-3"
                >
                  Completed ({completedNegotiations.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">
                    Loading negotiations...
                  </p>
                </div>
              ) : activeNegotiations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">
                    No active negotiations
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start a new negotiation to see it here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {activeNegotiations.map((negotiation) => (
                    <NegotiationCard
                      key={negotiation.id}
                      negotiation={negotiation}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">
                    Loading negotiations...
                  </p>
                </div>
              ) : completedNegotiations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">
                    No completed negotiations yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Completed negotiations will appear here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {completedNegotiations.map((negotiation) => (
                    <NegotiationCard
                      key={negotiation.id}
                      negotiation={negotiation}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
