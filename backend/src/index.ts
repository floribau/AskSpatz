import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Agent } from "./agent.js";
import { supabase } from "./supabase.js";
import setupVendors from "./setupVendors.js";
import { initChatModel, HumanMessage, SystemMessage } from "langchain";
 
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
// setupVendors();

// Store active negotiations
const activeNegotiations = new Map<string, { agent: Agent; status: string }>();

// Start negotiation endpoint
app.post("/api/negotiations/start", async (req, res) => {
  const { vendorIds, negotiationName, productName, startingPrice, targetReduction, quantity, userRequest } = req.body;

  if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
    return res.status(400).json({ error: "vendorIds array is required" });
  }

  console.log(`[API] Starting negotiations with vendors: ${vendorIds.join(", ")}`);
  console.log(`[API] Negotiation: ${negotiationName}, Product: ${productName}`);
  console.log(`[API] Starting Price: ${startingPrice}, Target Reduction: ${targetReduction}%`);
  if (userRequest) {
    console.log(`[API] User Request: ${userRequest}`);
  }

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
        userRequest: userRequest || undefined,
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
        userMessage = `kickoff negotiations"}`;
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

    // Fetch all offers and negotiation states for all negotiation groups to calculate best_nap and savings
    const groupIds = groups.map((g) => g.id);
    const { data: allNegotiations, error: negError } = await supabase
      .from("negotiation")
      .select("id, negotiation_group_id")
      .in("negotiation_group_id", groupIds.length > 0 ? groupIds : [-1]);

    const negotiationIds = allNegotiations?.map((n) => n.id).filter(Boolean) || [];
    
    // Fetch offers for best_nap calculation
    const { data: allOffers, error: offersError } = await supabase
      .from("offer")
      .select("id, negotiation_id, price")
      .in("negotiation_id", negotiationIds.length > 0 ? negotiationIds : [-1]);

    if (offersError) {
      console.error("[API] Error fetching offers:", offersError.message);
    }

    // Fetch negotiation states to get starting prices
    const { data: allStates, error: statesError } = await supabase
      .from("negotiation_state")
      .select("id, negotiation_id, price, created_at")
      .in("negotiation_id", negotiationIds.length > 0 ? negotiationIds : [-1])
      .order("created_at", { ascending: true });

    if (statesError) {
      console.error("[API] Error fetching negotiation states:", statesError.message);
    }

    // Calculate best_nap and savings_percent for each group
    const formattedGroups = groups.map((group) => {
      const groupNegotiations = allNegotiations?.filter(
        (n) => n.negotiation_group_id === group.id
      ) || [];
      const groupNegotiationIds = groupNegotiations.map((n) => n.id);
      
      // Get offers for this group (final offers when negotiation is finished)
      const groupOffers = (allOffers || []).filter(
        (offer) => offer.negotiation_id && groupNegotiationIds.includes(offer.negotiation_id)
      ) || [];

      // Get states for this group (current prices during negotiation)
      const groupStates = (allStates || []).filter(
        (state) => state.negotiation_id && groupNegotiationIds.includes(state.negotiation_id)
      ) || [];

      // Calculate best_nap from:
      // For ongoing negotiations: use latest negotiation states (current best offers)
      // For completed negotiations: use final offers
      let best_nap = 0;
      
      // Helper function to safely parse price
      const parsePrice = (price: any): number | null => {
        if (price == null) return null;
        const num = typeof price === 'string' ? parseFloat(price) : Number(price);
        return !isNaN(num) && num > 0 ? num : null;
      };
      
      const isOngoing = group.status === "running";
      
      if (isOngoing) {
        // For ongoing negotiations, get the current best price from each negotiation (tile)
        // Then take the minimum across all negotiations
        const bestPricesFromEachNegotiation = groupNegotiationIds
          .map((negId) => {
            // Get all states for this negotiation
            const statesForNeg = groupStates
              .filter((s) => s.negotiation_id === negId)
              .map((s) => parsePrice(s.price))
              .filter((p): p is number => p !== null);
            
            // Return the best (lowest) price from this negotiation
            return statesForNeg.length > 0 ? Math.min(...statesForNeg) : null;
          })
          .filter((p): p is number => p !== null);
        
        // Take the minimum of all best prices from each negotiation
        best_nap = bestPricesFromEachNegotiation.length > 0 ? Math.min(...bestPricesFromEachNegotiation) : 0;
      } else {
        // For completed negotiations, use final offers
        const offerPrices = groupOffers
          .map((offer) => parsePrice(offer.price))
          .filter((p): p is number => p !== null);
        
        best_nap = offerPrices.length > 0 ? Math.min(...offerPrices) : 0;
      }
      
      // Calculate starting price from first negotiation state (most accurate)
      let startingPrice = 0;
      if (isOngoing && groupStates.length > 0) {
        // For ongoing: use first state from each negotiation (starting price per vendor)
        const startingPrices = groupNegotiationIds
          .map((negId) => {
            const statesForNeg = groupStates
              .filter((s) => s.negotiation_id === negId)
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return statesForNeg.length > 0 ? parsePrice(statesForNeg[0].price) : null;
          })
          .filter((p): p is number => p !== null);
        
        // Use the highest starting price across all vendors
        startingPrice = startingPrices.length > 0 ? Math.max(...startingPrices) : 0;
      } else if (!isOngoing) {
        // For completed: use highest offer price as starting price
        const offerPrices = groupOffers
          .map((offer) => parsePrice(offer.price))
          .filter((p): p is number => p !== null);
        
        startingPrice = offerPrices.length > 0 ? Math.max(...offerPrices) : 0;
      }

      // Calculate savings_percent
      const savings_percent =
        startingPrice > 0 && best_nap > 0 && best_nap < startingPrice
          ? Math.round(((startingPrice - best_nap) / startingPrice) * 100)
          : 0;

      // Debug logging
      const bestPricesFromEachNegotiation = isOngoing ? groupNegotiationIds
        .map((negId) => {
          const statesForNeg = groupStates
            .filter((s) => s.negotiation_id === negId)
            .map((s) => parsePrice(s.price))
            .filter((p): p is number => p !== null);
          return statesForNeg.length > 0 ? Math.min(...statesForNeg) : null;
        })
        .filter((p): p is number => p !== null) : [];
      
      const offerPrices = !isOngoing ? groupOffers
        .map((offer) => parsePrice(offer.price))
        .filter((p): p is number => p !== null) : [];
      
      console.log(`[API] Group ${group.id} (${group.name}) [${isOngoing ? 'ONGOING' : 'COMPLETED'}]: ${groupOffers.length} offers, ${groupStates.length} states, ${groupNegotiationIds.length} negotiations`);
      if (isOngoing) {
        console.log(`[API]   - Best price from each negotiation:`, bestPricesFromEachNegotiation);
      } else {
        console.log(`[API]   - Offer prices:`, offerPrices);
      }
      console.log(`[API]   - Starting price: ${startingPrice}, best_nap: ${best_nap}, savings: ${savings_percent}%`);

      return {
        id: group.id.toString(),
        title: group.name,
        productName: "", // Can be populated from products table if linked
        best_nap: best_nap,
        savings_percent: savings_percent,
        status: group.status === "running" ? "IN_PROGRESS" : group.status === "accepted" ? "ACCEPTED" : "COMPLETED",
        vendors_engaged: Array.isArray(group.negotiation) ? group.negotiation.length : 0,
        created_at: new Date().toISOString(),
      };
    });

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
        pros: offer.pros,
        cons: offer.cons,
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
      accepted_offer: group.accepted_offer || null,
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

app.post("/api/offers/labels", async (req, res) => {
  try {
    const { offers } = req.body;
    
    if (!offers || !Array.isArray(offers) || offers.length === 0) {
      return res.status(400).json({ error: "Offers array is required" });
    }

    const model = await initChatModel("claude-sonnet-4-5");
    
    // Format offers for the prompt
    const offersDescription = offers.map((offer: any) => 
      `ID: ${offer.id}, Vendor: ${offer.vendor_name}, Price: $${offer.price}, Description: ${offer.description}, Pros: ${offer.pros?.join(", ") || "N/A"}, Cons: ${offer.cons?.join(", ") || "N/A"}`
    ).join("\n");

    const messages = [
      new SystemMessage(`You analyze procurement offers and assign creative labels. Respond with ONLY valid JSON, no markdown or explanation.`),
      new HumanMessage(`Analyze these procurement offers and assign exactly 3 labels. One offer MUST get "Best Value". The other 2 labels should be creative and relevant (e.g., "Budget Pick", "Premium Choice", "Most Flexible", "Best Terms", etc.).

Each label goes to a DIFFERENT offer. If fewer than 3 offers, only assign labels to existing offers.

Offers:
${offersDescription}

Respond with ONLY a valid JSON array:
[{"offer_id": <id>, "label": "<label>"}]`)
    ];
    
    const response = await model.invoke(messages);
    
    // Parse the JSON response from the model
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    // Clean up any markdown formatting if present
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const labelsJson = JSON.parse(cleanedResponse);
    
    // Convert to a map of offer_id -> label
    const labelsMap: Record<number, string> = {};
    labelsJson.forEach((item: { offer_id: number; label: string }) => {
      labelsMap[item.offer_id] = item.label;
    });

    console.log("[API] Generated offer labels:", labelsMap);
    res.json({ labels: labelsMap });
  } catch (err) {
    console.error("[API] Error generating offer labels:", err);
    res.status(500).json({ error: "Failed to generate offer labels" });
  }
});

// Accept an offer for a negotiation group
app.post("/api/negotiation-groups/:id/accept-offer", async (req, res) => {
  const groupId = req.params.id;
  const { offerId } = req.body;

  if (!offerId) {
    return res.status(400).json({ error: "offerId is required" });
  }

  try {
    // Verify the offer belongs to this negotiation group
    const { data: offer, error: offerError } = await supabase
      .from("offer")
      .select("id, negotiation_id")
      .eq("id", offerId)
      .single();

    if (offerError || !offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    // Get the negotiation to verify it belongs to the group
    const { data: negotiation, error: negError } = await supabase
      .from("negotiation")
      .select("id, negotiation_group_id")
      .eq("id", offer.negotiation_id)
      .single();

    if (negError || !negotiation || negotiation.negotiation_group_id !== parseInt(groupId)) {
      return res.status(400).json({ error: "Offer does not belong to this negotiation group" });
    }

    // Update the negotiation group with the accepted offer and set status to "accepted"
    const { data: updatedGroup, error: updateError } = await supabase
      .from("negotiation_group")
      .update({ accepted_offer: offerId, status: "accepted" })
      .eq("id", groupId)
      .select()
      .single();

    if (updateError) {
      console.error("[API] Error accepting offer:", updateError.message);
      return res.status(500).json({ error: "Failed to accept offer" });
    }

    // Get vendor name for response
    const { data: vendorData } = await supabase
      .from("negotiation")
      .select("vendor_id")
      .eq("id", offer.negotiation_id)
      .single();

    const { data: vendor } = vendorData?.vendor_id
      ? await supabase
          .from("vendors")
          .select("name")
          .eq("id", vendorData.vendor_id)
          .single()
      : { data: null };

    res.json({
      success: true,
      accepted_offer: offerId,
      vendor_name: vendor?.name || "Unknown Vendor",
    });
  } catch (err) {
    console.error("[API] Error accepting offer:", err);
    res.status(500).json({ error: "Failed to accept offer" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[Server] Backend running on http://localhost:${PORT}`);
});
