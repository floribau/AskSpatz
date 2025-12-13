import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { Header } from "@/components/Header";
import { VendorSelector } from "@/components/VendorSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { availableVendors, vendorCategories } from "@/data/vendors";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ConfigForm {
  negotiationName: string;
  productName: string;
  startingPrice: number;
  targetReduction: number;
  selectedVendors: string[];
}

export function NewNegotiation() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [configForm, setConfigForm] = useState<ConfigForm>({
    negotiationName: "",
    productName: "",
    startingPrice: 25000,
    targetReduction: 25,
    selectedVendors: [],
  });

  const targetPrice =
    configForm.startingPrice * (1 - configForm.targetReduction / 100);

  const handleToggleVendor = (vendorId: string) => {
    setConfigForm((prev) => ({
      ...prev,
      selectedVendors: prev.selectedVendors.includes(vendorId)
        ? prev.selectedVendors.filter((v) => v !== vendorId)
        : [...prev.selectedVendors, vendorId],
    }));
  };

  const handleStartNegotiation = () => {
    if (!configForm.negotiationName) {
      toast({
        title: "Missing Information",
        description: "Please enter a negotiation name.",
        variant: "destructive",
      });
      return;
    }
    if (configForm.selectedVendors.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one vendor.",
        variant: "destructive",
      });
      return;
    }

    // In a real app, this would create the negotiation via API
    toast({
      title: "Negotiation Started",
      description: `Starting negotiation with ${configForm.selectedVendors.length} vendor(s).`,
      variant: "success",
    });

    // Navigate to the new negotiation (using first mock negotiation for demo)
    navigate("/negotiation/NEG-2024-001");
  };

  const canStart =
    configForm.negotiationName && configForm.selectedVendors.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header onNewNegotiation={() => {}} />

      <main className="container px-4 md:px-6 py-8">
        {/* Back Link */}
        <div className="flex items-center gap-4 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Configure New Negotiation
          </h1>
          <p className="text-muted-foreground">
            Set up your procurement negotiation parameters and select vendors.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle>Negotiation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Negotiation Name *</Label>
                <Input
                  id="name"
                  value={configForm.negotiationName}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      negotiationName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Q4 Office Supplies Procurement"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Product/Service Name</Label>
                <Input
                  id="product"
                  value={configForm.productName}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      productName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Premium Paper Stock"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Starting Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={configForm.startingPrice}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      startingPrice: parseInt(e.target.value) || 1000,
                    }))
                  }
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Target Price Reduction</Label>
                  <span className="text-lg font-bold text-primary">
                    {configForm.targetReduction}%
                  </span>
                </div>
                <Slider
                  value={[configForm.targetReduction]}
                  onValueChange={([value]) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      targetReduction: value,
                    }))
                  }
                  min={5}
                  max={50}
                  step={1}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Target Price: {formatCurrency(targetPrice)}</span>
                  <span>
                    Savings: {formatCurrency(configForm.startingPrice - targetPrice)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  The negotiation will automatically stop when the target price is
                  reached or when no further progress is made.
                </p>
                <Button
                  onClick={handleStartNegotiation}
                  disabled={!canStart}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Play className="h-4 w-4" />
                  Start Negotiation with {configForm.selectedVendors.length}{" "}
                  Vendor{configForm.selectedVendors.length !== 1 ? "s" : ""}
                </Button>
                {configForm.selectedVendors.length === 0 && (
                  <p className="text-xs text-destructive text-center mt-2">
                    Please select at least one vendor
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vendor Selection */}
          <VendorSelector
            vendors={availableVendors}
            selectedVendors={configForm.selectedVendors}
            onToggleVendor={handleToggleVendor}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            categories={vendorCategories}
            startingPrice={configForm.startingPrice}
          />
        </div>
      </main>
    </div>
  );
}
