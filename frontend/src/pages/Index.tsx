import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { NegotiationCard } from "@/components/NegotiationCard";
import { negotiations } from "@/data/negotiations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Index() {
  const navigate = useNavigate();

  const activeNegotiations = negotiations.filter(
    (n) => n.status === "IN_PROGRESS" || n.status === "REVIEW_REQUIRED"
  );
  const completedNegotiations = negotiations.filter(
    (n) => n.status === "COMPLETED"
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onNewNegotiation={() => navigate("/new")} />

      <main className="container px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Procurement Negotiations
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage your autonomous procurement negotiations in
            real-time.
          </p>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeNegotiations.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedNegotiations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeNegotiations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No active negotiations
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start a new negotiation to see it here
                </p>
              </div>
            ) : (
              activeNegotiations.map((negotiation) => (
                <NegotiationCard
                  key={negotiation.id}
                  negotiation={negotiation}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedNegotiations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No completed negotiations yet
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Completed negotiations will appear here
                </p>
              </div>
            ) : (
              completedNegotiations.map((negotiation) => (
                <NegotiationCard
                  key={negotiation.id}
                  negotiation={negotiation}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
