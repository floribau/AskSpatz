import { CallbackHandler } from "@langfuse/langchain";
import {NodeSDK} from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

// Initialize the Langfuse CallbackHandler
// Automatically reads from env vars: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_BASEURL
export const langfuseHandler = new CallbackHandler();

console.log("[Langfuse] CallbackHandler initialized");
