import { createAgent, tool } from "langchain";
import * as z from "zod";
import dotenv from "dotenv";

dotenv.config();

const writeEmail = tool(
  ({ body }: { body: string }) => `email sent.`,
  {
    name: "write_email",
    description: "Write and send an email.",
    schema: z.object({
      body: z.string().describe("The body of the email to send."),
    }),
  },
);

const agent = createAgent({
  model: "claude-sonnet-4-5-20250929",
  tools: [writeEmail],
});

export default agent;