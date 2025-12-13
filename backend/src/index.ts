import express from "express";
import cors from "cors";
import { Agent } from "./agent.js";
import { supabase } from "./supabase.js";
import setup_vendors from "./setup_vendors.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Test Supabase connection on startup
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from("vendors").select("count").limit(1);
    if (error) {
      console.log("[Supabase] Warning: Could not query vendors table:", error.message);
    } else {
      console.log("[Supabase] Connected successfully!");
    }
  } catch (err) {
    console.log("[Supabase] Connection test failed:", err);
  }
}

testSupabaseConnection();
setup_vendors();

// Store active negotiations
const activeNegotiations = new Map<string, { agent: Agent; status: string }>();

// Start negotiation endpoint
app.post("/api/negotiations/start", async (req, res) => {
  const { vendorIds, negotiationName, productName, startingPrice, targetReduction, quantity } = req.body;

  if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
    return res.status(400).json({ error: "vendorIds array is required" });
  }

  console.log(`[API] Starting negotiations with vendors: ${vendorIds.join(", ")}`);
  console.log(`[API] Negotiation: ${negotiationName}, Product: ${productName}`);
  console.log(`[API] Starting Price: ${startingPrice}, Target Reduction: ${targetReduction}%`);

  // First, create a negotiation_group for this batch of negotiations
  const { data: negotiationGroup, error: groupError } = await supabase
    .from("negotiation_group")
    .insert({
      name: negotiationName || "Untitled Negotiation",
      product: null, // Can be linked to a product ID if needed
      quantity: quantity || 1,
      status: "running",
    })
    .select()
    .single();

  if (groupError) {
    console.error("[API] Failed to create negotiation group:", groupError.message);
    return res.status(500).json({ error: "Failed to create negotiation group" });
  }

  console.log(`[API] Created negotiation group: ${negotiationGroup.id}`);

  const negotiationPromises = vendorIds.map(async (vendorId: string) => {
    try {
      const localNegotiationId = `${Date.now()}-${vendorId}`;
      const agent = new Agent();
      
      activeNegotiations.set(localNegotiationId, { agent, status: "initializing" });
      
      await agent.initialize(vendorId, negotiationGroup.id);
      activeNegotiations.set(localNegotiationId, { agent, status: "running" });
      
      // Run the agent in the background
      runAgentForVendor(agent, localNegotiationId, productName);
      
      return {
        vendorId,
        localNegotiationId,
        negotiationId: agent.negotiation_id, // Database negotiation ID
        negotiationGroupId: negotiationGroup.id,
        conversationId: agent.conversation_id,
        status: "started",
      };
    } catch (error) {
      console.error(`[API] Error starting negotiation for vendor ${vendorId}:`, error);
      return {
        vendorId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const results = await Promise.all(negotiationPromises);
  res.json({ 
    negotiationGroupId: negotiationGroup.id,
    negotiations: results 
  });
});

// Run agent for a specific vendor
async function runAgentForVendor(agent: Agent, localNegotiationId: string, productName: string) {
  let i = 0;
  let userMessage = "";

  try {
    while (true) {
      if (i === 0) {
        userMessage = `kickoff negotiations for buying: ${productName || "a coffee machine: Maverick Gravimetric 3gr"}`;
      } else {
        userMessage = "continue negotiating";
      }
      
      console.log(`[${localNegotiationId}] user_message: ${userMessage}`);
      const response = await agent.invoke(userMessage);
      
      const hasFinishNegotiation = response.messages?.some(
        (msg: any) => msg.name === "finish_negotiation"
      );
      
      if (hasFinishNegotiation) {
        console.log(`[${localNegotiationId}] Negotiation finished!`);
        activeNegotiations.set(localNegotiationId, { agent, status: "completed" });
        break;
      }
      
      i++;
      
      // Safety limit to prevent infinite loops
      if (i > 50) {
        console.log(`[${localNegotiationId}] Max iterations reached`);
        activeNegotiations.set(localNegotiationId, { agent, status: "max_iterations" });
        break;
      }
    }
  } catch (error) {
    console.error(`[${localNegotiationId}] Error during negotiation:`, error);
    activeNegotiations.set(localNegotiationId, { agent, status: "error" });
  }
}

// Get negotiation status
app.get("/api/negotiations/:id/status", (req, res) => {
  const negotiation = activeNegotiations.get(req.params.id);
  if (!negotiation) {
    return res.status(404).json({ error: "Negotiation not found" });
  }
  res.json({ status: negotiation.status });
});

// Get all vendors
app.get("/api/vendors", async (req, res) => {
  try {
    const { data: vendors, error } = await supabase
      .from("vendors")
      .select("*")
      .order("id");

    if (error) {
      console.error("[API] Error fetching vendors:", error.message);
      return res.status(500).json({ error: "Failed to fetch vendors" });
    }

    // Map to frontend format with generated colors
    const colors = [
      "hsl(207, 90%, 61%)",
      "hsl(142, 71%, 45%)",
      "hsl(262, 83%, 58%)",
      "hsl(25, 95%, 53%)",
      "hsl(330, 81%, 60%)",
      "hsl(235, 76%, 60%)",
      "hsl(0, 84%, 60%)",
      "hsl(48, 96%, 53%)",
    ];

    const formattedVendors = vendors.map((vendor, index) => ({
      id: vendor.id.toString(),
      name: vendor.name,
      company: vendor.name, // Use name as company for now
      color: colors[index % colors.length],
      category: "Vendor",
      behaviour: vendor.behaviour,
    }));

    res.json(formattedVendors);
  } catch (err) {
    console.error("[API] Error fetching vendors:", err);
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

// Get all negotiation groups
app.get("/api/negotiation-groups", async (req, res) => {
  try {
    // Fetch negotiation groups with count of negotiations (vendors)
    const { data: groups, error } = await supabase
      .from("negotiation_group")
      .select(`
        id,
        name,
        product,
        quantity,
        status,
        negotiation (id, vendor_id)
      `)
      .order("id", { ascending: false });

    if (error) {
      console.error("[API] Error fetching negotiation groups:", error.message);
      return res.status(500).json({ error: "Failed to fetch negotiation groups" });
    }

    // Map to frontend format
    const formattedGroups = groups.map((group) => ({
      id: group.id.toString(),
      title: group.name,
      productName: "", // Can be populated from products table if linked
      best_nap: 0, // Can be calculated from offers
      savings_percent: 0, // Can be calculated
      status: group.status === "running" ? "IN_PROGRESS" : "COMPLETED",
      vendors_engaged: Array.isArray(group.negotiation) ? group.negotiation.length : 0,
      created_at: new Date().toISOString(), // Add created_at to table if needed
    }));

    res.json(formattedGroups);
  } catch (err) {
    console.error("[API] Error fetching negotiation groups:", err);
    res.status(500).json({ error: "Failed to fetch negotiation groups" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[Server] Backend running on http://localhost:${PORT}`);
});
