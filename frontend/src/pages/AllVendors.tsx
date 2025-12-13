import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { VendorCard } from "@/components/VendorCard";
import { SpatzIcon } from "@/components/SpatzIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  id: string;
  name: string;
  company: string;
  color: string;
  category: string;
  behaviour?: string | null;
}

export function AllVendors() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedBehaviour, setEditedBehaviour] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
        setIsLoading(false);
      }
    }
    fetchVendors();
  }, []);

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
      <main className="w-full px-4 md:px-6 py-8 relative z-10">
        <div className="w-full mx-auto max-w-7xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button asChild variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-900/80">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-white">
              All Vendors
            </h1>
          </div>

          {/* Dark gray tile container for vendors */}
          <div className="bg-stone-900 rounded-2xl p-6 md:p-8">
            {isLoading ? (
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
                {vendors.map((vendor) => (
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
              className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50"
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
