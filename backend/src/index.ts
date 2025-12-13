import run_agent from "./agent.js";

run_agent().catch((error) => {
  console.error("Agent error:", error);
  process.exit(1);
});