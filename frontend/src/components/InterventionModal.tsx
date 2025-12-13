import { useState } from "react";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SpatzIcon } from "./SpatzIcon";
import { formatCurrency, cn } from "@/lib/utils";
import { NegotiationDetail, Message } from "@/data/types";

interface InterventionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negotiation: NegotiationDetail | null;
  onSendMessage: (message: string) => void;
}

export function InterventionModal({
  open,
  onOpenChange,
  negotiation,
  onSendMessage,
}: InterventionModalProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  if (!negotiation) return null;

  const latestRound = negotiation.priceHistory[negotiation.priceHistory.length - 1];
  let lowestPrice = negotiation.startingPrice;
  negotiation.vendors.forEach((vendor) => {
    const price = latestRound?.[vendor.id] as number | undefined;
    if (price && price < lowestPrice) {
      lowestPrice = price;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Human Intervention</DialogTitle>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{negotiation.title}</p>
            <p>{negotiation.productName}</p>
          </div>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Starting Price</p>
            <p className="text-lg font-bold">
              {formatCurrency(negotiation.startingPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Best</p>
            <p className="text-lg font-bold text-success">
              {formatCurrency(lowestPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target Price</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(negotiation.targetPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price Improvements</p>
            <p className="text-lg font-bold">
              {negotiation.priceHistory.length}
            </p>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] space-y-3 p-4 border rounded-lg">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Negotiation History
          </h4>
          {negotiation.messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No messages yet
            </p>
          ) : (
            negotiation.messages.map((msg: Message, idx: number) => (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-lg",
                  msg.sender === "human" && "bg-secondary/20 ml-12",
                  msg.sender === "agent" && "bg-primary/10 mr-12",
                  msg.sender === "vendor" && "bg-muted mr-12"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {msg.sender === "agent" && <SpatzIcon size={18} />}
                    <span className="font-semibold text-sm">{msg.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-3 pt-4 border-t">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your intervention message..."
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!message.trim()}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
