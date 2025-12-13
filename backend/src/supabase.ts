import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions for database tables
export interface Vendor {
  id: number;
  name: string;
  behaviour: string | null;
}

export interface Product {
  id: number;
  name: string;
  vendor_ids: number[];
}

export type NegotiationGroupStatus = "running" | "finished";

export interface NegotiationGroup {
  id: number;
  name: string;
  product: number | null;
  quantity: number;
  status: NegotiationGroupStatus;
}

export interface Negotiation {
  id: number;
  negotiation_group_id: number | null;
  conversation_id: number | null;
  vendor_id: number | null;
}

export interface Message {
  id: number;
  type: string | null;
  message: string | null;
  conversation_id: number | null;
  created_at: string;
}

export interface Offer {
  id: number;
  negotiation_id: number | null;
  description: string | null;
  price: number | null;
}

export interface NegotiationState {
  id: number;
  negotiation_id: number;
  price: number;
  description: string | null;
  created_at: string;
}
