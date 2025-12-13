import { createAgent, tool } from "langchain";
import * as z from "zod";
import dotenv from "dotenv";
import { initChatModel, HumanMessage, SystemMessage } from "langchain";
import systemPrompt from "./prompt.js";
import { supabase } from "./supabase.js";

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

          return data.content;
        } catch (err) {
          return `Error sending message: ${err}`;
        }
      },
      {
        name: "write_email",
        description: "Write and send an email.",
        schema: z.object({
          body: z.string().describe("The body of the Email to send."),
        }),
      },
    );
    const finishNegotiation = tool(
      async ({ offers }: { offers: { description: string, price: number }[] }): Promise<string> => {
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
              });

            if (error) {
              console.error("[finishNegotiation] Failed to save offer:", error.message);
            } else {
              console.log(`[finishNegotiation] Saved offer: ${offer.description} - $${offer.price}`);
            }
          }

          // Update negotiation_group status to 'finished'
          if (this.negotiation_group_id) {
            const { error: groupError } = await supabase
              .from("negotiation_group")
              .update({ status: "finished" })
              .eq("id", this.negotiation_group_id);

            if (groupError) {
              console.error("[finishNegotiation] Failed to update group status:", groupError.message);
            } else {
              console.log(`[finishNegotiation] Updated negotiation group ${this.negotiation_group_id} status to 'finished'`);
            }
          }
        }

        return JSON.stringify(offers);
      },
      {
        name: "finish_negotiation",
        description: "When you are satisfied with the offer(s) the vendor has made, use this tool to finish the negotiation.",
        schema: z.object({
          offers: z.array(z.object({
            description: z.string().describe("A short description about the terms and conditions of the offer."),
            price: z.number().describe("The price of the offer."),
          })).describe("The offers the vendor has made."),
        }),
      },
    );
    return [writeEmail, finishNegotiation];
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
      .select("id, name, external_vendor_id, behaviour")
      .eq("id", this.vendor_id)
      .single();

    console.log(`[Agent] Looking up vendor ${this.vendor_id}:`, vendorData, vendorError?.message);

    if (vendorData) {
      this.vendorInfo = {
        id: vendorData.id,
        name: vendorData.name,
        behaviour: vendorData.behaviour,
      };
    }

    const externalVendorId = vendorData?.external_vendor_id || 8; // Default to 8 if not found
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
    console.log(`[Agent] System prompt includes vendor: ${this.vendorInfo?.name}, product: ${this.productInfo?.name}`);

    this.agent = await createAgent({
      model: "claude-haiku-4-5-20251001",
      tools: this.createTools(),
      systemPrompt: dynamicPrompt,
    });
  }

  private buildSystemPrompt(): string {
    let contextSection = "\n\n## Current Negotiation Context\n";
    
    // Add vendor information
    if (this.vendorInfo) {
      contextSection += `\n### Vendor Information\n`;
      contextSection += `- **Vendor Name**: ${this.vendorInfo.name}\n`;
      if (this.vendorInfo.behaviour) {
        contextSection += `- **Vendor Personality/Approach**: ${this.vendorInfo.behaviour}\n`;
        contextSection += `- Use this knowledge about their negotiation style to tailor your approach accordingly.\n`;
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
    if (!this.agent) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    const response = await this.agent.invoke({
      messages: [{ role: "user", content: message }],
    });

    return response;
  }
}

export { Agent };