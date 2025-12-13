import { createAgent, tool } from "langchain";
import * as z from "zod";
import dotenv from "dotenv";
import { initChatModel, HumanMessage, SystemMessage } from "langchain";
import systemPrompt from "./prompt.js";
import { supabase } from "./supabase.js";
import { langfuseHandler } from "./langfuse.js";

dotenv.config();

interface ProductInfo {
  name: string;
  quantity: number;
  startingPrice?: number;
  targetReduction?: number;
}

interface VendorInfo {
  id: number;
  name: string;
  behaviour: string | null;
}

class Agent {
  conversation_id: number | null = null;
  negotiation_id: number | null = null;
  negotiation_group_id: number | null = null;
  vendor_id: number | null = null;
  private agent: any = null;
  private vendorInfo: VendorInfo | null = null;
  private productInfo: ProductInfo | null = null;
  message_history: string[] = [];

  private createTools() {
    const writeEmail = tool(
      async ({ body }: { body: string }): Promise<string> => {
        console.log(`[writeEmail] conversation_id: ${this.conversation_id}`);
        console.log(`[writeEmail] body: ${body}`);
        
        if (!this.conversation_id) {
          return "Error: No conversation_id set; cannot send message.";
        }

        try {
          // Save the agent's message to the database
          const { error: assistantMsgError } = await supabase
            .from("message")
            .insert({
              type: "assistant",
              message: body,
              conversation_id: this.conversation_id,
            });

          if (assistantMsgError) {
            console.error("[writeEmail] Failed to save assistant message:", assistantMsgError.message);
          }

          const response = await fetch(
            `https://negbot-backend-ajdxh9axb0ddb0e9.westeurope-01.azurewebsites.net/api/messages/${this.conversation_id}`,
            {
              method: "POST",
              body: new URLSearchParams({
                content: body
              }),
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              }
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            return `Error: Failed to send message: ${response.status} ${response.statusText} - ${errorText}`;
          }

          const data = await response.json();
          console.log(`[writeEmail] Message sent successfully to conversation ${this.conversation_id}`);
          console.log(`[writeEmail] data: ${data.content}`);

          // Save the vendor's response to the database
          const { error: userMsgError } = await supabase
            .from("message")
            .insert({
              type: "user",
              message: data.content,
              conversation_id: this.conversation_id,
            });

          if (userMsgError) {
            console.error("[writeEmail] Failed to save user message:", userMsgError.message);
          }

          // Get competitive leverage and append to vendor's response
          const competitiveOffer = await this.getCompetitiveLeverage();
          const currentBestOffer = await this.getCurrentBestOffer();
          
          let vendorResponse = data.content;
          
          if (competitiveOffer && currentBestOffer && competitiveOffer.price < currentBestOffer.price) {
            vendorResponse += `\n\n[COMPETITIVE LEVERAGE] You have received a better offer from another vendor in this negotiation group: Price $${competitiveOffer.price.toLocaleString()}, Conditions: ${competitiveOffer.description}. You can use this as leverage (anonymously - mention only the price and conditions, never the vendor name) to negotiate a better deal.`;
            console.log(`[writeEmail] Added competitive leverage: $${competitiveOffer.price} vs current best: $${currentBestOffer.price}`);
          }

          // Return the vendor's response with leverage context
          return vendorResponse;
        } catch (err) {
          return `Error sending message: ${err}`;
        }
      },
      {
        name: "write_email",
        description: "Write and send an email to the vendor. CRITICAL: Before writing, review the vendor's behavior profile in the system context and adapt your email's tone, style, and negotiation approach accordingly. The vendor behavior description tells you how this specific vendor negotiates—use it to craft the most effective message. Also consider competitive leverage information if available from other vendors in the same negotiation group.",
        schema: z.object({
          body: z.string().describe("The body of the Email to send. MUST be tailored to the vendor's behavior profile—adjust tone, assertiveness, relationship-building, and negotiation tactics based on their described personality and negotiation style. If competitive leverage is available, incorporate it naturally."),
        }),
      },
    );
    const finishNegotiation = tool(
      async ({ offers }: { offers: { description: string, price: number, pros: string[], cons: string[] }[] }): Promise<string> => {
        console.log(`[finishNegotiation] conversation_id: ${this.conversation_id}`);
        console.log(`[finishNegotiation] negotiation_id: ${this.negotiation_id}`);
        console.log(`[finishNegotiation] offers: ${JSON.stringify(offers)}`);

        // Insert offers into the database
        if (this.negotiation_id) {
          for (const offer of offers) {
            const { error } = await supabase
              .from("offer")
              .insert({
                negotiation_id: this.negotiation_id,
                description: offer.description,
                price: offer.price,
                pros: offer.pros,
                cons: offer.cons,
              });

            if (error) {
              console.error("[finishNegotiation] Failed to save offer:", error.message);
            } else {
              console.log(`[finishNegotiation] Saved offer: ${offer.description} - $${offer.price}`);
            }
          }

          // Check if all negotiations in the group are finished before updating group status
          if (this.negotiation_group_id) {
            // Get all negotiations in this group
            const { data: negotiations, error: negError } = await supabase
              .from("negotiation")
              .select("id")
              .eq("negotiation_group_id", this.negotiation_group_id);

            if (negError) {
              console.error("[finishNegotiation] Failed to fetch negotiations:", negError.message);
            } else if (negotiations && negotiations.length > 0) {
              const negotiationIds = negotiations.map(n => n.id);
              
              // Count how many negotiations have offers
              const { data: offersData, error: offersError } = await supabase
                .from("offer")
                .select("negotiation_id")
                .in("negotiation_id", negotiationIds);

              if (offersError) {
                console.error("[finishNegotiation] Failed to fetch offers:", offersError.message);
              } else {
                // Get unique negotiation IDs that have offers
                const negotiationsWithOffers = new Set(offersData?.map(o => o.negotiation_id) || []);
                
                console.log(`[finishNegotiation] Negotiations in group: ${negotiations.length}, with offers: ${negotiationsWithOffers.size}`);
                
                // Only update group status if ALL negotiations have offers
                if (negotiationsWithOffers.size >= negotiations.length) {
                  const { error: groupError } = await supabase
                    .from("negotiation_group")
                    .update({ status: "finished" })
                    .eq("id", this.negotiation_group_id);

                  if (groupError) {
                    console.error("[finishNegotiation] Failed to update group status:", groupError.message);
                  } else {
                    console.log(`[finishNegotiation] All negotiations complete! Updated negotiation group ${this.negotiation_group_id} status to 'finished'`);
                  }
                } else {
                  console.log(`[finishNegotiation] Waiting for other negotiations to complete (${negotiationsWithOffers.size}/${negotiations.length})`);
                }
              }
            }
          }
        }

        return JSON.stringify(offers);
      },
      {
        name: "finish_negotiation",
        description: "When you are satisfied with the offer the vendor has made or the negotiation is stuck (you have the feeling that the vendor is not willing to make a better offer), use this tool to finish the negotiation. Add also three pros and three cons of the offer to the offer object. It should help to understand the offer better, therefore it is IMPORTANT that you keep them very short and concise.",
        schema: z.object({
          offers: z.array(z.object({
            description: z.string().describe("A short description about the terms and conditions of the offer."),
            price: z.number().describe("The price of the offer."),
            pros: z.array(z.string()).describe("three advantages of the offer. MAX 15 characters per pro."),
            cons: z.array(z.string()).describe("three disadvantages of the offer. MAX 15 characters per con."),
          })).describe("The offers the vendor has made."),
        }),
      },
    );
    const updateState = tool(
      async ({ price, description }: { price: number; description: string }): Promise<string> => {
        console.log(`[updateState] negotiation_id: ${this.negotiation_id}`);
        console.log(`[updateState] price: ${price}, description: ${description}`);
        
        if (!this.negotiation_id) {
          return "Error: No negotiation_id set; cannot update state.";
        }

        try {
          const { data, error } = await supabase
            .from("negotiation_state")
            .insert({
              negotiation_id: this.negotiation_id,
              price: price,
              description: description,
            })
            .select();

          if (error) {
            throw new Error(`Failed to update negotiation state: ${error.message}`);
          }

          console.log(`[updateState] Successfully updated negotiation state:`, data);
          return `State recorded: Price ${price}. Now respond to the vendor using write_email.`;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[updateState] Error updating negotiation state:`, errorMessage);
          return `Error updating negotiation state: ${errorMessage}`;
        }
      },
      {
        name: "update_state",
        description: "MANDATORY: Call this tool ONCE immediately after receiving a vendor response that contains a price or offer. Extract the price and description from the vendor's message. After calling this tool, you must then use write_email to send your response to the vendor. Do not call this tool multiple times for the same vendor response.",
        schema: z.object({
          price: z.number().describe("The current price being discussed or offered in the negotiation. Extract this from the vendor's latest message."),
          description: z.string().describe("A description of the current state extracted from the vendor's response, including the price, any terms, conditions, or details relevant to the current offer."),
        }),
      },
    );
    return [writeEmail, finishNegotiation, updateState];
  }

  async initialize(
    vendorId: string = "8", 
    negotiationGroupId: number,
    productInfo?: ProductInfo
  ): Promise<void> {
    this.vendor_id = parseInt(vendorId) || 8;
    this.negotiation_group_id = negotiationGroupId;
    this.productInfo = productInfo || null;

    // Look up the vendor details from our database
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, behaviour")
      .eq("id", this.vendor_id)
      .single();

    console.log(`[Agent] Looking up vendor ${this.vendor_id}:`, vendorData, vendorError?.message);

    if (vendorData) {
      this.vendorInfo = {
        id: vendorData.id,
        name: vendorData.name,
        behaviour: vendorData.behaviour,
      };
      console.log(`[Agent] Vendor info set:`, this.vendorInfo);
    } else {
      console.error(`[Agent] No vendor data found for ID ${this.vendor_id}`);
    }

    // The vendor ID in our database IS the external vendor ID (synced from external API)
    const externalVendorId = vendorData?.id || this.vendor_id;
    console.log(`[Agent] Using external_vendor_id: ${externalVendorId}`);

    // Create a new conversation with the external API
    const conversationCreateResponse = await fetch(
      "https://negbot-backend-ajdxh9axb0ddb0e9.westeurope-01.azurewebsites.net/api/conversations/?team_id=220239",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: externalVendorId,
          title: "Price Negotiation - Q4 Order"
        })
      }
    );

    if (!conversationCreateResponse.ok) {
      throw new Error(
        `Failed to create conversation: ${conversationCreateResponse.status} ${conversationCreateResponse.statusText}`
      );
    }

    const conversationData = await conversationCreateResponse.json();
    console.log("Created conversation:", conversationData);
    this.conversation_id = conversationData.id;

    // Create a new negotiation record in the database
    const { data: negotiation, error } = await supabase
      .from("negotiation")
      .insert({
        vendor_id: this.vendor_id,
        conversation_id: this.conversation_id,
        negotiation_group_id: negotiationGroupId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Agent] Failed to create negotiation record:", error.message);
    } else {
      this.negotiation_id = negotiation.id;
      console.log(`[Agent] Created negotiation record: ${this.negotiation_id}`);
    }

    // Build dynamic system prompt with vendor and product context
    const dynamicPrompt = this.buildSystemPrompt();
    console.log(`[Agent] System prompt: ${dynamicPrompt}`);

    this.agent = await createAgent({
      model: "claude-haiku-4-5-20251001",
      tools: this.createTools(),
      systemPrompt: dynamicPrompt,
    });
  }

  /**
   * Get the best offer from other negotiations in the same group
   */
  private async getCompetitiveLeverage(): Promise<{ price: number; description: string } | null> {
    if (!this.negotiation_group_id || !this.negotiation_id) {
      return null;
    }

    try {
      // Get all negotiations in the same group, excluding current one
      const { data: negotiations, error: negotiationsError } = await supabase
        .from("negotiation")
        .select("id")
        .eq("negotiation_group_id", this.negotiation_group_id)
        .neq("id", this.negotiation_id);

      if (negotiationsError || !negotiations || negotiations.length === 0) {
        return null;
      }

      const otherNegotiationIds = negotiations.map((n) => n.id);

      // Get the best (lowest price) negotiation_state from other negotiations
      const { data: states, error: statesError } = await supabase
        .from("negotiation_state")
        .select("price, description")
        .in("negotiation_id", otherNegotiationIds)
        .order("price", { ascending: true })
        .limit(1);

      if (statesError || !states || states.length === 0) {
        return null;
      }

      return {
        price: states[0].price,
        description: states[0].description || "",
      };
    } catch (err) {
      console.error("[getCompetitiveLeverage] Error:", err);
      return null;
    }
  }

  /**
   * Get the current negotiation's best offer (lowest price)
   */
  private async getCurrentBestOffer(): Promise<{ price: number; description: string } | null> {
    if (!this.negotiation_id) {
      return null;
    }

    try {
      const { data: states, error: statesError } = await supabase
        .from("negotiation_state")
        .select("price, description")
        .eq("negotiation_id", this.negotiation_id)
        .order("price", { ascending: true })
        .limit(1);

      if (statesError || !states || states.length === 0) {
        return null;
      }

      return {
        price: states[0].price,
        description: states[0].description || "",
      };
    } catch (err) {
      console.error("[getCurrentBestOffer] Error:", err);
      return null;
    }
  }

  private buildSystemPrompt(): string {
    let contextSection = "\n\n## Current Negotiation Context\n";
    
    // Add vendor information with emphasis on behavior
    if (this.vendorInfo) {
      contextSection += `\n### Vendor Information\n`;
      contextSection += `- **Vendor Name**: ${this.vendorInfo.name}\n`;
      if (this.vendorInfo.behaviour) {
        contextSection += `\n### CRITICAL: Vendor Behavior Profile\n`;
        contextSection += `${this.vendorInfo.behaviour}\n\n`;
        contextSection += `**IMPORTANT**: The above behavior description is crucial for your negotiation strategy. You MUST:\n`;
        contextSection += `- Adapt your communication style, tone, and approach to match this vendor's personality and negotiation patterns\n`;
        contextSection += `- Use this information to predict how they might respond to different negotiation tactics\n`;
        contextSection += `- Tailor your emails to be most effective with this specific vendor's style\n`;
        contextSection += `- Adjust your level of assertiveness, relationship-building, and technical detail based on their behavior profile\n`;
        contextSection += `- Consider their likely pain points, motivations, and decision-making style when crafting your messages\n`;
        contextSection += `- Reference specific aspects of their behavior profile when it's strategically advantageous\n\n`;
      }
    }
    
    // Add product information
    if (this.productInfo) {
      contextSection += `\n### Product Requirements\n`;
      contextSection += `- **Product**: ${this.productInfo.name}\n`;
      contextSection += `- **Quantity**: ${this.productInfo.quantity} unit(s)\n`;
      if (this.productInfo.startingPrice) {
        contextSection += `- **Starting/List Price**: $${this.productInfo.startingPrice.toLocaleString()}\n`;
      }
      if (this.productInfo.targetReduction) {
        contextSection += `- **Target Price Reduction**: ${this.productInfo.targetReduction}%\n`;
        if (this.productInfo.startingPrice) {
          const targetPrice = this.productInfo.startingPrice * (1 - this.productInfo.targetReduction / 100);
          contextSection += `- **Target Price**: $${targetPrice.toLocaleString()}\n`;
        }
      }
    }
    
    contextSection += `\n### Negotiation Objectives\n`;
    contextSection += `- Secure the best possible price, ideally meeting or exceeding the target reduction\n`;
    contextSection += `- Negotiate favorable payment terms, warranties, and service agreements\n`;
    contextSection += `- Explore volume discounts, bundled offerings, and value-adds\n`;
    contextSection += `- Maintain a professional relationship with the vendor for future business\n`;
    
    return systemPrompt + contextSection;
  }

  async invoke(message: string): Promise<any> {
    console.log(`[Agent] Invoking agent with message: ${message}`);
    if (!this.agent) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    // Get competitive leverage and include it in the context if available
    const competitiveOffer = await this.getCompetitiveLeverage();
    const currentBestOffer = await this.getCurrentBestOffer();
    
    let leverageContext = "";
    if (competitiveOffer && currentBestOffer && competitiveOffer.price < currentBestOffer.price) {
      leverageContext = `\n\n[COMPETITIVE LEVERAGE] Before writing your next email, note that you have received a better offer from another vendor in this negotiation group: Price $${competitiveOffer.price.toLocaleString()}, Conditions: ${competitiveOffer.description}. You can use this as leverage (anonymously - mention only the price and conditions, never the vendor name) to negotiate a better deal. Consider incorporating this into your negotiation strategy when writing emails.`;
      console.log(`[Agent] Competitive leverage available: $${competitiveOffer.price} vs current best: $${currentBestOffer.price}`);
    }

    const invokeOptions: any = {
      recursionLimit: 100,
    };
    
    // Add langfuse handler if available
    try {
      if (langfuseHandler) {
        invokeOptions.callbacks = [langfuseHandler];
      }
    } catch (err) {
      console.warn("[Agent] Langfuse handler not available, continuing without it");
    }

    const response = await this.agent.invoke(
      {
        messages: [{ role: "user", content: message }],
      },
      invokeOptions
    );

    // Better logging of response structure
    if (response && typeof response === 'object') {
      const messages = response.messages || [];
      const toolCalls = messages.filter((msg: any) => msg.name && msg.name !== 'user' && msg.name !== 'assistant');
      console.log(`[Agent] Response received: ${messages.length} messages, ${toolCalls.length} tool calls`);
      if (toolCalls.length > 0) {
        console.log(`[Agent] Tool calls:`, toolCalls.map((t: any) => t.name));
      } else {
        console.log(`[Agent] WARNING: No tool calls in response`);
      }
    } else {
      console.log(`[Agent] Response: ${JSON.stringify(response)}`);
    }

    return response;
  }
}

export { Agent };