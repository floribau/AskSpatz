import agent from "./agent.js";

console.log(
    await agent.invoke({
      messages: [{ role: "user", content: "Write an welcome email." }],
    })
  );