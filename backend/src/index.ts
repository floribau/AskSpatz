import express from "express";
import cors from "cors";
import { Agent } from "./agent.js";
import { supabase } from "./supabase.js";

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

// Store active negotiations
const activeNegotiations = new Map<string, { agent: Agent; status: string }>();

// Start negotiation endpoint
app.post("/api/negotiations/start", async (req, res) => {
  const { vendorIds, negotiationName, productName, startingPrice, targetReduction } = req.body;

  if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
    return res.status(400).json({ error: "vendorIds array is required" });
  }

  console.log(`[API] Starting negotiations with vendors: ${vendorIds.join(", ")}`);
  console.log(`[API] Negotiation: ${negotiationName}, Product: ${productName}`);
  console.log(`[API] Starting Price: ${startingPrice}, Target Reduction: ${targetReduction}%`);

  const negotiationPromises = vendorIds.map(async (vendorId: string) => {
    try {
      const negotiationId = `${Date.now()}-${vendorId}`;
      const agent = new Agent();
      
      activeNegotiations.set(negotiationId, { agent, status: "initializing" });
      
      await agent.initialize(vendorId);
      activeNegotiations.set(negotiationId, { agent, status: "running" });
      
      // Run the agent in the background
      runAgentForVendor(agent, negotiationId, productName);
      
      return {
        vendorId,
        negotiationId,
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
  res.json({ negotiations: results });
});

// Run agent for a specific vendor
async function runAgentForVendor(agent: Agent, negotiationId: string, productName: string) {
  let i = 0;
  let userMessage = "";

  try {
    while (true) {
      if (i === 0) {
        userMessage = `kickoff negotiations for buying: ${productName || "a coffee machine: Maverick Gravimetric 3gr"}`;
      } else {
        userMessage = "continue negotiating";
      }
      
      console.log(`[${negotiationId}] user_message: ${userMessage}`);
      const response = await agent.invoke(userMessage);
      
      const hasFinishNegotiation = response.messages?.some(
        (msg: any) => msg.name === "finish_negotiation"
      );
      
      if (hasFinishNegotiation) {
        console.log(`[${negotiationId}] Negotiation finished!`);
        activeNegotiations.set(negotiationId, { agent, status: "completed" });
        break;
      }
      
      i++;
      
      // Safety limit to prevent infinite loops
      if (i > 50) {
        console.log(`[${negotiationId}] Max iterations reached`);
        activeNegotiations.set(negotiationId, { agent, status: "max_iterations" });
        break;
      }
    }
  } catch (error) {
    console.error(`[${negotiationId}] Error during negotiation:`, error);
    activeNegotiations.set(negotiationId, { agent, status: "error" });
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[Server] Backend running on http://localhost:${PORT}`);
});
