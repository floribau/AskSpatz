import { createAgent, tool } from "langchain";
import * as z from "zod";
import dotenv from "dotenv";

dotenv.config();

class Agent {
  conversation_id: number | null = null;
  private agent: any = null;

  private createTools() {
    const writeEmail = tool(
      async ({ body }: { body: string }): Promise<string> => {
        console.log(`[writeEmail] conversation_id: ${this.conversation_id}`);
        
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

    return [writeEmail];
  }

  async initialize(): Promise<void> {
    // Create a new conversation
    const conversationCreateResponse = await fetch(
      "https://negbot-backend-ajdxh9axb0ddb0e9.westeurope-01.azurewebsites.net/api/conversations/?team_id=220239",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: 8,
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

    // Create the agent with tools
    this.agent = await createAgent({
      model: "claude-sonnet-4-5-20250929",
      tools: this.createTools(),
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

async function run_agent(): Promise<void> {
  const agent = new Agent();
  await agent.initialize();

  const response = await agent.invoke("Write a welcome email.");
  console.log(response);
}

export { Agent };
export default run_agent;