export type NegotiationStatus =
  | "IN_PROGRESS"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "PENDING";

export interface Vendor {
  id: string;
  name: string;
  company: string;
  color: string;
  category: string;
}

export interface PricePoint {
  round: number;
  [vendorId: string]: number;
}

export interface Suggestion {
  type: "cheapest" | "lowest_risk" | "best_nap";
  vendor: string;
  price: number;
  risk: number;
  pros: string[];
  cons: string[];
}

export interface Message {
  sender: "agent" | "vendor" | "human";
  name: string;
  content: string;
  timestamp: string;
  vendor_id?: string | number | null;
  conversation_id?: number | null;
}

export interface Negotiation {
  id: string;
  title: string;
  productName: string;
  best_nap: number;
  savings_percent: number;
  status: NegotiationStatus;
  vendors_engaged: number;
  created_at: string;
}

export interface NegotiationDetail extends Negotiation {
  startingPrice: number;
  targetReduction: number;
  targetPrice: number;
  vendors: Vendor[];
  priceHistory: PricePoint[];
  suggestions: Suggestion[];
  messages: Message[];
  agentRationale: string;
  riskScore: number;
  startTime: string;
  endTime?: string;
  winningVendor?: string;
  finalPrice?: number;
  stoppedReason?: string;
}

export interface AgentStatus {
  vendorId: string;
  vendorName: string;
  currentPrice: number;
  attempts: number;
  reductionPercent: number;
  status: "Strong" | "Moderate" | "Struggling";
  interventionLevel: "green" | "yellow" | "red";
  interventionText: string;
}
