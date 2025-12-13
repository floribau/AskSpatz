import { createAgent, tool } from "langchain";
import * as z from "zod";
import dotenv from "dotenv";
import { initChatModel, HumanMessage, SystemMessage } from "langchain";
import systemPrompt from "./prompt.js";

dotenv.config();

class Agent {
  conversation_id: number | null = null;
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
    return [writeEmail, finishNegotiation];
  }

  async initialize(vendorId: string = "8"): Promise<void> {
    // Create a new conversation
    const conversationCreateResponse = await fetch(
      "https://negbot-backend-ajdxh9axb0ddb0e9.westeurope-01.azurewebsites.net/api/conversations/?team_id=220239",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: parseInt(vendorId) || 8,
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

    this.agent = await createAgent({
      model: "claude-haiku-4-5-20251001",
      tools: this.createTools(),
      systemPrompt: systemPrompt,
    });
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