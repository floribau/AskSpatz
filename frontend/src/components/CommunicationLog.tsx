import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SpatzIcon } from "./SpatzIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";
import { Message, Vendor } from "@/data/types";

interface CommunicationLogProps {
  messages: Message[];
  vendors: Vendor[];
}

export function CommunicationLog({ messages, vendors }: CommunicationLogProps) {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(
    vendors.length > 0 ? vendors[0].id : null
  );

  return (
    <Card className="bg-gray-900/80 backdrop-blur-md border-gray-700/50 shadow-lg">
      <CardHeader>
        <CardTitle className="text-white">Negotiation Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedVendorId || ""} onValueChange={setSelectedVendorId} className="w-full">
          <TabsList className="bg-gray-800 mb-4 w-full justify-start">
            {vendors.map((vendor) => (
              <TabsTrigger
                key={vendor.id}
                value={vendor.id}
                className="text-white/70 data-[state=active]:bg-gray-700 data-[state=active]:text-white px-4 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
              >
                {vendor.company}
              </TabsTrigger>
            ))}
          </TabsList>
          {vendors.map((vendor) => (
            <TabsContent key={vendor.id} value={vendor.id} className="mt-0">
              <div className="h-[300px] overflow-y-auto overflow-x-hidden space-y-3 pr-2">
                {messages.filter((m) => m.vendor_id && String(m.vendor_id) === String(vendor.id)).length === 0 ? (
                  <p className="text-center text-white/70 py-8">
                    No messages yet for {vendor.company}
                  </p>
                ) : (
                  messages
                    .filter((m) => m.vendor_id && String(m.vendor_id) === String(vendor.id))
                    .map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "p-3 rounded-lg",
                          message.sender === "agent" &&
                            "bg-blue-500/20 border border-blue-500/30",
                          message.sender === "vendor" &&
                            "bg-gray-800/50 border border-gray-700/50",
                          message.sender === "human" &&
                            "bg-purple-500/20 border border-purple-500/30 ml-8"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {message.sender === "agent" && <SpatzIcon size={20} />}
                            <span className="font-semibold text-sm text-white">{message.name}</span>
                          </div>
                          <span className="text-xs text-white/60">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    ))
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
