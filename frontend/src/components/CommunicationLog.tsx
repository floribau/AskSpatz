import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SpatzIcon } from "./SpatzIcon";
import { cn } from "@/lib/utils";
import { Message } from "@/data/types";
import ReactMarkdown from "react-markdown";

interface CommunicationLogProps {
  messages: Message[];
}

export function CommunicationLog({ messages }: CommunicationLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negotiation Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] overflow-y-auto overflow-x-hidden space-y-3 pr-2">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No messages yet
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg",
                  message.sender === "agent" &&
                    "bg-primary/10 border border-primary/20",
                  message.sender === "vendor" &&
                    "bg-muted border border-border",
                  message.sender === "human" &&
                    "bg-secondary/10 border border-secondary/20 ml-8"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {message.sender === "agent" && <SpatzIcon size={20} />}
                    <span className="font-semibold text-sm">{message.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm text-foreground markdown-content">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
