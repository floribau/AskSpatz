import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { NegotiationCard } from "@/components/NegotiationCard";
import { SpatzIcon } from "@/components/SpatzIcon";
import { Negotiation } from "@/data/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export function AllNegotiations() {
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
  const acceptedNegotiations = negotiations.filter(
    (n) => n.status === "ACCEPTED"
  );

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
      <main className="w-full px-4 md:px-6 py-8 relative z-10">
        <div className="w-full mx-auto max-w-7xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button asChild variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-900/50">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <SpatzIcon size={32} />
              <h1 className="text-3xl font-bold text-white">
                All Negotiations
              </h1>
            </div>
          </div>

          {/* Dark gray tile container for negotiations */}
          <div className="bg-stone-900 rounded-2xl p-6 md:p-8">
            <Tabs defaultValue="active" className="space-y-6">
              <div className="flex justify-start">
                <TabsList className="bg-stone-800">
                  <TabsTrigger 
                    value="active" 
                    className="whitespace-nowrap text-sm font-medium px-4 py-2 data-[state=active]:bg-stone-700"
                  >
                    Active ({activeNegotiations.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="completed" 
                    className="whitespace-nowrap text-sm font-medium px-4 py-2 data-[state=active]:bg-stone-700"
                  >
                    Completed ({completedNegotiations.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="accepted" 
                    className="whitespace-nowrap text-sm font-medium px-4 py-2 data-[state=active]:bg-stone-700"
                  >
                    Accepted ({acceptedNegotiations.length})
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

              <TabsContent value="accepted" className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                      Loading negotiations...
                    </p>
                  </div>
                ) : acceptedNegotiations.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-lg text-muted-foreground">
                      No accepted negotiations yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Accepted negotiations will appear here
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                    {acceptedNegotiations.map((negotiation) => (
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
        </div>
      </main>
    </div>
  );
}
