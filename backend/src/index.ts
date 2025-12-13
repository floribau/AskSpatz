import express from "express";
import cors from "cors";
import { Agent } from "./agent.js";
import { supabase } from "./supabase.js";
import setup_vendors from "./setupVendors.js";

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
      
      // Pass product info to the agent
      await agent.initialize(vendorId, negotiationGroup.id, {
        name: productName || "Product",
        quantity: quantity || 1,
        startingPrice: startingPrice ? parseFloat(startingPrice) : undefined,
        targetReduction: targetReduction ? parseFloat(targetReduction) : undefined,
      });
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
  let consecutiveNoProgress = 0;
  const MAX_CONSECUTIVE_NO_PROGRESS = 3; // Stop if no tools called for 3 iterations

  try {
    while (true) {
      if (i === 0) {
        userMessage = `kickoff negotiations for buying: ${productName || "a coffee machine: Maverick Gravimetric 3gr"}`;
      } else {
        userMessage = "continue negotiating";
      }
      
      console.log(`[${localNegotiationId}] Iteration ${i + 1}, user_message: ${userMessage}`);
      
      try {
        const response = await agent.invoke(userMessage);
        
        // Check if response is valid
        if (!response || typeof response !== 'object') {
          console.error(`[${localNegotiationId}] Invalid response format:`, response);
          consecutiveNoProgress++;
          if (consecutiveNoProgress >= MAX_CONSECUTIVE_NO_PROGRESS) {
            console.log(`[${localNegotiationId}] Stopping: No progress detected (invalid responses)`);
            activeNegotiations.set(localNegotiationId, { agent, status: "stuck" });
            break;
          }
          i++;
          continue;
        }

        // Count tool calls in this response
        const messages = response.messages || [];
        const toolCalls = messages.filter((msg: any) => msg.name && msg.name !== 'user' && msg.name !== 'assistant');
        const currentToolCallCount = toolCalls.length;
        
        console.log(`[${localNegotiationId}] Response has ${currentToolCallCount} tool calls:`, toolCalls.map((t: any) => t.name));
        
        // Check for finish_negotiation
        const hasFinishNegotiation = toolCalls.some(
          (msg: any) => msg.name === "finish_negotiation"
        );
        
        if (hasFinishNegotiation) {
          console.log(`[${localNegotiationId}] Negotiation finished!`);
          activeNegotiations.set(localNegotiationId, { agent, status: "completed" });
          break;
        }
        
        // Detect if agent is stuck (not calling any tools)
        if (currentToolCallCount === 0) {
          consecutiveNoProgress++;
          console.log(`[${localNegotiationId}] No tools called (${consecutiveNoProgress}/${MAX_CONSECUTIVE_NO_PROGRESS})`);
          
          if (consecutiveNoProgress >= MAX_CONSECUTIVE_NO_PROGRESS) {
            console.log(`[${localNegotiationId}] Stopping: Agent stuck - no tools called for ${MAX_CONSECUTIVE_NO_PROGRESS} iterations`);
            activeNegotiations.set(localNegotiationId, { agent, status: "stuck" });
            break;
          }
        } else {
          // Reset counter if tools were called
          consecutiveNoProgress = 0;
        }
        
      } catch (invokeError) {
        console.error(`[${localNegotiationId}] Error invoking agent:`, invokeError);
        consecutiveNoProgress++;
        if (consecutiveNoProgress >= MAX_CONSECUTIVE_NO_PROGRESS) {
          console.log(`[${localNegotiationId}] Stopping: Too many errors`);
          activeNegotiations.set(localNegotiationId, { agent, status: "error" });
          break;
        }
      }
      
      i++;
      
      // Safety limit to prevent infinite loops
      if (i > 50) {
        console.log(`[${localNegotiationId}] Max iterations reached (50)`);
        activeNegotiations.set(localNegotiationId, { agent, status: "max_iterations" });
        break;
      }
      
      // Add a small delay to prevent tight loops
      await new Promise(resolve => setTimeout(resolve, 100));
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

// Get a specific negotiation group with details
app.get("/api/negotiation-groups/:id", async (req, res) => {
  const groupId = req.params.id;

  try {
    // Fetch the negotiation group
    const { data: group, error: groupError } = await supabase
      .from("negotiation_group")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      console.log(`[API] Negotiation group ${groupId} not found`);
      return res.status(404).json({ error: "Negotiation group not found" });
    }

    // Fetch negotiations linked to this group
    const { data: negotiations, error: negError } = await supabase
      .from("negotiation")
      .select("id, vendor_id, conversation_id")
      .eq("negotiation_group_id", groupId);

    if (negError) {
      console.error("[API] Error fetching negotiations:", negError.message);
    }

    // Get unique conversation IDs
    const conversationIds = negotiations?.map((n) => n.conversation_id).filter(Boolean) || [];

    // Fetch all messages for these conversations
    const { data: messages, error: msgError } = await supabase
      .from("message")
      .select("*")
      .in("conversation_id", conversationIds.length > 0 ? conversationIds : [-1])
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("[API] Error fetching messages:", msgError.message);
    }

    // Get vendor IDs and fetch vendor details
    const vendorIds = negotiations?.map((n) => n.vendor_id).filter(Boolean) || [];
    const { data: vendors, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .in("id", vendorIds.length > 0 ? vendorIds : [-1]);

    if (vendorError) {
      console.error("[API] Error fetching vendors:", vendorError.message);
    }

    // Fetch offers for all negotiations in this group
    const negotiationIds = negotiations?.map((n) => n.id).filter(Boolean) || [];
    const { data: offers, error: offersError } = await supabase
      .from("offer")
      .select("*")
      .in("negotiation_id", negotiationIds.length > 0 ? negotiationIds : [-1]);

    if (offersError) {
      console.error("[API] Error fetching offers:", offersError.message);
    }

    // Format offers with vendor info
    const formattedOffers = (offers || []).map((offer) => {
      const negotiation = negotiations?.find((n) => n.id === offer.negotiation_id);
      const vendor = vendors?.find((v) => v.id === negotiation?.vendor_id);
      return {
        id: offer.id,
        negotiation_id: offer.negotiation_id,
        vendor_id: negotiation?.vendor_id,
        vendor_name: vendor?.name || "Unknown Vendor",
        description: offer.description,
        price: offer.price,
      };
    });

    // Fetch negotiation states for price history
    const { data: states, error: statesError } = await supabase
      .from("negotiation_state")
      .select("*")
      .in("negotiation_id", negotiationIds.length > 0 ? negotiationIds : [-1])
      .order("created_at", { ascending: true });

    if (statesError) {
      console.error("[API] Error fetching negotiation states:", statesError.message);
    }

    // Build price history from negotiation states
    // Group states by negotiation_id (vendor) and create rounds
    const priceHistory: { round: number; [vendorId: string]: number }[] = [];
    
    if (states && states.length > 0) {
      // Group states by vendor
      const statesByVendor: { [vendorId: string]: { price: number; created_at: string }[] } = {};
      
      for (const state of states) {
        const negotiation = negotiations?.find((n) => n.id === state.negotiation_id);
        const vendorId = negotiation?.vendor_id?.toString();
        if (vendorId) {
          if (!statesByVendor[vendorId]) {
            statesByVendor[vendorId] = [];
          }
          statesByVendor[vendorId].push({ price: state.price, created_at: state.created_at });
        }
      }

      // Find the max number of rounds across all vendors
      const maxRounds = Math.max(...Object.values(statesByVendor).map(s => s.length), 0);

      // Create price history with rounds
      for (let i = 0; i < maxRounds; i++) {
        const round: { round: number; [vendorId: string]: number } = { round: i + 1 };
        for (const [vendorId, vendorStates] of Object.entries(statesByVendor)) {
          if (vendorStates[i]) {
            round[vendorId] = vendorStates[i].price;
          } else if (i > 0 && vendorStates[i - 1]) {
            // Carry forward the last known price
            round[vendorId] = vendorStates[i - 1].price;
          }
        }
        priceHistory.push(round);
      }
    }

    // Generate colors for vendors
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

    // Format vendors for frontend
    const formattedVendors = (vendors || []).map((vendor, index) => ({
      id: vendor.id.toString(),
      name: vendor.name,
      company: vendor.name,
      color: colors[index % colors.length],
      category: "Vendor",
    }));

    // Format messages for frontend with vendor info
    const formattedMessages = (messages || []).map((msg) => {
      // Find which negotiation this message belongs to (compare as numbers)
      const negotiation = negotiations?.find((n) => Number(n.conversation_id) === Number(msg.conversation_id));
      const vendor = vendors?.find((v) => Number(v.id) === Number(negotiation?.vendor_id));
      return {
        sender: msg.type === "assistant" ? "agent" : "vendor",
        name: msg.type === "assistant" ? "AskSpatz Agent" : (vendor?.name || "Vendor"),
        content: msg.message || "",
        timestamp: msg.created_at,
        conversation_id: msg.conversation_id,
        vendor_id: negotiation?.vendor_id?.toString() || null,
      };
    });

    // Build the response
    const response = {
      id: group.id.toString(),
      title: group.name,
      productName: "", // Can be populated from products table
      status: group.status === "running" ? "IN_PROGRESS" : "COMPLETED",
      vendors_engaged: negotiations?.length || 0,
      vendors: formattedVendors,
      negotiations: negotiations || [],
      messages: formattedMessages,
      offers: formattedOffers,
      // Placeholder values - can be calculated from offers later
      startingPrice: 25000,
      targetReduction: 25,
      targetPrice: 18750,
      priceHistory: priceHistory.length > 0 ? priceHistory : [{ round: 1 }],
      suggestions: [],
      agentRationale: "Negotiation in progress with selected vendors.",
      riskScore: 5,
    };

    res.json(response);
  } catch (err) {
    console.error("[API] Error fetching negotiation group details:", err);
    res.status(500).json({ error: "Failed to fetch negotiation group details" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[Server] Backend running on http://localhost:${PORT}`);
});
