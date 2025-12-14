import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SpatzIcon } from "./SpatzIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Message, Vendor } from "@/data/types";
import { Maximize2, Download, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface CommunicationLogProps {
  messages: Message[];
  vendors: Vendor[];
}

// Function to generate TL;DR summary (always one line)
function generateTLDR(content: string, isFirstMessage: boolean = false): string {
  // First message always has this TL;DR
  if (isFirstMessage) {
    return "First message asking about price lists";
  }
  const lowerContent = content.toLowerCase();
  
  // Extract key information based on common patterns
  const priceMatch = content.match(/(?:€|eur|usd|\$|price|cost|offer|quote)[\s:]*([\d,]+\.?\d*)/i);
  const price = priceMatch ? priceMatch[1] : null;
  
  // Extract reason for clarification
  const getClarificationReason = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes("price") || lower.includes("cost")) return "price";
    if (lower.includes("delivery") || lower.includes("shipping")) return "delivery";
    if (lower.includes("specification") || lower.includes("spec")) return "specifications";
    if (lower.includes("payment") || lower.includes("terms")) return "payment";
    if (lower.includes("timeline") || lower.includes("deadline")) return "timeline";
    if (lower.includes("quantity") || lower.includes("amount")) return "quantity";
    return "details";
  };
  
  // Check for key phrases - keep it concise, one line
  if (lowerContent.includes("accept") || lowerContent.includes("agreed") || lowerContent.includes("deal")) {
    return price ? `Accepted offer at ${price}` : "Offer accepted";
  }
  if (lowerContent.includes("reject") || lowerContent.includes("decline") || lowerContent.includes("cannot")) {
    return price ? `Rejected offer of ${price}` : "Offer rejected";
  }
  if (lowerContent.includes("counter") || lowerContent.includes("new offer") || lowerContent.includes("revised")) {
    return price ? `Counter offer: ${price}` : "New counter offer";
  }
  if (lowerContent.includes("question") || lowerContent.includes("clarify") || lowerContent.includes("ask")) {
    const reason = getClarificationReason(content);
    return `Requesting clarification about ${reason}`;
  }
  if (lowerContent.includes("thank") || lowerContent.includes("appreciate")) {
    return "Acknowledgment message";
  }
  if (lowerContent.includes("deadline") || lowerContent.includes("urgent") || lowerContent.includes("asap")) {
    return "Time-sensitive request";
  }
  if (price) {
    return `Price mentioned: ${price}`;
  }
  
  // Fallback: extract first sentence, max 80 chars
  const firstSentence = content.split(/[.!?]\s+/)[0];
  if (firstSentence.length > 80) {
    return firstSentence.substring(0, 77) + "...";
  }
  return firstSentence || "Message";
}

// Function to generate conversation summary
function generateConversationSummary(messages: Message[], vendorName: string): string {
  if (messages.length === 0) {
    return "No messages in this conversation.";
  }

  const prices: string[] = [];
  const keyEvents: string[] = [];
  
  messages.forEach((msg, idx) => {
    const priceMatch = msg.content.match(/(?:€|eur|usd|\$|price|cost|offer|quote)[\s:]*([\d,]+\.?\d*)/i);
    if (priceMatch) {
      prices.push(`${msg.sender === "agent" ? "Agent" : msg.name}: ${priceMatch[1]}`);
    }
    
    const lowerContent = msg.content.toLowerCase();
    if (lowerContent.includes("accept") || lowerContent.includes("agreed")) {
      keyEvents.push(`Message ${idx + 1}: Offer accepted`);
    } else if (lowerContent.includes("reject") || lowerContent.includes("decline")) {
      keyEvents.push(`Message ${idx + 1}: Offer rejected`);
    } else if (lowerContent.includes("counter") || lowerContent.includes("new offer")) {
      keyEvents.push(`Message ${idx + 1}: Counter offer made`);
    }
  });

  let summary = `Conversation Summary with ${vendorName}:\n\n`;
  summary += `Total Messages: ${messages.length}\n\n`;
  
  if (prices.length > 0) {
    summary += `Price Points Discussed:\n${prices.join("\n")}\n\n`;
  }
  
  if (keyEvents.length > 0) {
    summary += `Key Events:\n${keyEvents.join("\n")}\n\n`;
  }
  
  summary += `Timeline: ${new Date(messages[0].timestamp).toLocaleString()} to ${new Date(messages[messages.length - 1].timestamp).toLocaleString()}`;
  
  return summary;
}

// Function to download conversation as text file
function downloadConversation(messages: Message[], vendorName: string) {
  let content = `Negotiation Conversation with ${vendorName}\n`;
  content += `Generated: ${new Date().toLocaleString()}\n\n`;
  content += "=".repeat(60) + "\n\n";
  
  messages.forEach((msg, idx) => {
    content += `[${idx + 1}] ${msg.name} (${msg.sender})\n`;
    content += `Time: ${new Date(msg.timestamp).toLocaleString()}\n`;
    content += `TL;DR: ${generateTLDR(msg.content, idx === 0)}\n\n`;
    content += msg.content + "\n\n";
    content += "-".repeat(60) + "\n\n";
  });
  
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `negotiation-${vendorName}-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CommunicationLog({ messages, vendors }: CommunicationLogProps) {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(
    vendors.length > 0 ? vendors[0].id : null
  );
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [summaryVendorId, setSummaryVendorId] = useState<string | null>(null);
  const [downloadVendorId, setDownloadVendorId] = useState<string | null>(null);
  
  const vendorsWithMessages = vendors.filter(vendor => 
    messages.some(m => m.vendor_id && String(m.vendor_id) === String(vendor.id))
  );

  return (
    <Card className="bg-stone-900/80 backdrop-blur-md border-stone-700/50 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Negotiation Transcript</CardTitle>
          {vendorsWithMessages.length > 0 && (
            <div className="flex items-center gap-2 mr-12">
              <Button
                onClick={() => {
                  setSummaryVendorId(vendorsWithMessages[0].id);
                  setShowSummary(true);
                }}
                size="sm"
                variant="outline"
                className="gap-2 text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50"
              >
                <FileText className="h-4 w-4" />
                Get Summary
              </Button>
              <Button
                onClick={() => {
                  setDownloadVendorId(vendorsWithMessages[0].id);
                  setShowDownloadDialog(true);
                }}
                size="sm"
                variant="outline"
                className="gap-2 text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedVendorId || ""} onValueChange={setSelectedVendorId} className="w-full">
          <TabsList className="bg-stone-800 mb-4 w-full justify-start">
            {vendors.map((vendor) => (
              <TabsTrigger
                key={vendor.id}
                value={vendor.id}
                className="text-white/70 data-[state=active]:bg-stone-700 data-[state=active]:text-white px-4 py-2 cursor-pointer hover:bg-stone-700/50 transition-colors"
              >
                {vendor.company}
              </TabsTrigger>
            ))}
          </TabsList>
          {vendors.map((vendor) => (
            <TabsContent key={vendor.id} value={vendor.id} className="mt-0">
              <div className="h-[600px] overflow-y-auto overflow-x-hidden space-y-3 pr-2">
                {messages.filter((m) => m.vendor_id && String(m.vendor_id) === String(vendor.id)).length === 0 ? (
                  <p className="text-center text-white/70 py-8">
                    No messages yet for {vendor.company}
                  </p>
                ) : (
                  messages
                    .filter((m) => m.vendor_id && String(m.vendor_id) === String(vendor.id))
                    .map((message, index) => {
                      const isFirstMessage = index === 0;
                      const tldr = generateTLDR(message.content, isFirstMessage);
                      const isAgent = message.sender === "agent";
                      return (
                        <div
                          key={index}
                          className={cn(
                            "flex",
                            isAgent ? "justify-start pr-2" : "justify-end pl-2"
                          )}
                        >
                          <div
                            className={cn(
                              "p-4 rounded-lg cursor-pointer transition-all max-w-[100%]",
                              message.sender === "agent" &&
                                "bg-stone-700/50 hover:bg-stone-700/70",
                              message.sender === "vendor" &&
                                "bg-stone-900/50 hover:bg-stone-900/70",
                              message.sender === "human" &&
                                "bg-stone-900/50 hover:bg-stone-900/70"
                            )}
                            onClick={() => setExpandedMessage(message)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {message.sender === "agent" && <SpatzIcon size={32} />}
                                <div>
                                  <span className="font-medium text-sm text-white block">{message.name}</span>
                                  <span className="text-xs text-white/50 mt-0.5">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <Maximize2 className="h-4 w-4 text-white/40 hover:text-white/60 transition-colors flex-shrink-0 mt-0.5" />
                            </div>
                            <div className="text-sm text-white/80 break-words line-clamp-5 leading-relaxed prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="ml-2">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  code: ({ children }) => <code className="bg-stone-800/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                                  pre: ({ children }) => <pre className="bg-stone-800/50 p-2 rounded overflow-x-auto mb-2">{children}</pre>,
                                  a: ({ children, href }) => <a href={href} className="text-sky-400 hover:text-sky-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Full-screen email viewer */}
      <Dialog open={!!expandedMessage} onOpenChange={(open) => !open && setExpandedMessage(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] bg-stone-900 border-stone-700 text-white flex flex-col">
          {expandedMessage && (
            <>
              <DialogHeader className="border-b border-stone-700 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedMessage.sender === "agent" && <SpatzIcon size={32} />}
                    <div>
                      <DialogTitle className="text-white text-xl">
                        {expandedMessage.name}
                      </DialogTitle>
                      <p className="text-sm text-white/70 mt-1">
                        {new Date(expandedMessage.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto mt-6 pr-4">
                <div className={cn(
                  "p-6 rounded-lg",
                  expandedMessage.sender === "agent" &&
                    "bg-sky-300/10 border border-sky-300/20",
                  expandedMessage.sender === "vendor" &&
                    "bg-stone-800/50 border border-stone-700/50",
                  expandedMessage.sender === "human" &&
                    "bg-violet-300/10 border border-violet-300/20"
                )}>
                  <div className="text-base text-white/95 break-words leading-relaxed prose prose-invert prose-base max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children }) => <code className="bg-stone-800/50 px-1.5 py-1 rounded text-sm font-mono">{children}</code>,
                        pre: ({ children }) => <pre className="bg-stone-800/50 p-3 rounded overflow-x-auto mb-3">{children}</pre>,
                        a: ({ children, href }) => <a href={href} className="text-sky-400 hover:text-sky-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      }}
                    >
                      {expandedMessage.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-2xl bg-stone-900 border-stone-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Conversation Summary</DialogTitle>
            <DialogDescription className="text-white/70">
              Select a vendor to view summary
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 mb-4">
            <label className="text-sm text-white/70 mb-2 block">Select Vendor:</label>
            <Select
              value={summaryVendorId || ""}
              onValueChange={(value) => setSummaryVendorId(value)}
            >
              <SelectTrigger className="bg-stone-800 border-stone-700 text-white">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent className="bg-stone-800 border-stone-700">
                {vendorsWithMessages.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id} className="text-white">
                    {vendor.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {summaryVendorId && (
            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              {(() => {
                const vendorMessages = messages.filter(
                  (m) => m.vendor_id && String(m.vendor_id) === String(summaryVendorId)
                );
                const vendor = vendors.find((v) => v.id === summaryVendorId);
                return vendor ? (
                  <pre className="whitespace-pre-wrap text-sm text-white/90 font-sans p-4 bg-stone-800/50 rounded-lg border border-stone-700/50">
                    {generateConversationSummary(vendorMessages, vendor.company)}
                  </pre>
                ) : null;
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Download Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="max-w-md bg-stone-900 border-stone-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Download Conversation</DialogTitle>
            <DialogDescription className="text-white/70">
              Select a vendor to download their conversation
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 mb-4">
            <label className="text-sm text-white/70 mb-2 block">Select Vendor:</label>
            <Select
              value={downloadVendorId || ""}
              onValueChange={(value) => setDownloadVendorId(value)}
            >
              <SelectTrigger className="bg-stone-800 border-stone-700 text-white">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent className="bg-stone-800 border-stone-700">
                {vendorsWithMessages.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id} className="text-white">
                    {vendor.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDownloadDialog(false)}
              className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 bg-stone-800/50"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (downloadVendorId) {
                  const vendorMessages = messages.filter(
                    (m) => m.vendor_id && String(m.vendor_id) === String(downloadVendorId)
                  );
                  const vendor = vendors.find((v) => v.id === downloadVendorId);
                  if (vendor) {
                    downloadConversation(vendorMessages, vendor.company);
                    setShowDownloadDialog(false);
                  }
                }
              }}
              disabled={!downloadVendorId}
              className="bg-emerald-300/20 hover:bg-emerald-300/30 text-emerald-300 border-emerald-300/50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
