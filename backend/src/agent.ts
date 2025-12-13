import { createAgent, tool } from "langchain";
import * as z from "zod";
import dotenv from "dotenv";
import { initChatModel, HumanMessage, SystemMessage } from "langchain";
import systemPrompt from "./prompt.js";
import { supabase } from "./supabase.js";

dotenv.config();

class Agent {
  conversation_id: number | null = null;
  negotiation_id: number | null = null;
  negotiation_group_id: number | null = null;
  vendor_id: number | null = null;
  private agent: any = null;
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

          // Return the vendor's response
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
        console.log(`[finishNegotiation] offers: ${JSON.stringify(offers)}`);
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

  async initialize(vendorId: string = "8", negotiationGroupId: number): Promise<void> {
    this.vendor_id = parseInt(vendorId) || 8;
    this.negotiation_group_id = negotiationGroupId;

    // Look up the external_vendor_id from our database
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, external_vendor_id")
      .eq("id", this.vendor_id)
      .single();

    console.log(`[Agent] Looking up vendor ${this.vendor_id}:`, vendorData, vendorError?.message);

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

    
    this.agent = await createAgent({
      model: "claude-haiku-4-5-20251001",
      tools: this.createTools(),
      systemPrompt: systemPrompt,
    });
  }

  async invoke(message: string): Promise<any> {
    console.log(`[Agent] Invoking agent with message: ${message}`);
    if (!this.agent) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    const response = await this.agent.invoke({
      messages: [{ role: "user", content: message }],
    });

    console.log(`[Agent] Response: ${response}`);

    return response;
  }
}

export { Agent };