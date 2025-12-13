import { supabase } from "./supabase.js";

interface Vendor {
  id: number;
  name: string;
  description: string;
  behavioral_prompt: string;
  is_predefined: boolean;
  team_id: number | null;
  documents: any[];
}

interface Document {
  [key: string]: any;
}

async function handle_vendor(vendor: Vendor): Promise<void> {
  console.log(`[handle_vendor] Processing vendor: ${vendor.name} (ID: ${vendor.id})`);
  
  try {
    const { data, error } = await supabase
      .from("vendors")
      .upsert({
        id: vendor.id,
        name: vendor.name,
        behaviour: vendor.description,
      }, {
        onConflict: "id"
      })
      .select();

    if (error) {
      throw new Error(`Failed to write vendor to Supabase: ${error.message}`);
    }

    console.log(`[handle_vendor] Successfully wrote vendor ${vendor.name} to Supabase:`, data);
  } catch (error) {
    console.error(`[handle_vendor] Error writing vendor ${vendor.name} to Supabase:`, error);
    throw error;
  }

  // Process each document for this vendor
  if (vendor.documents && Array.isArray(vendor.documents)) {
    console.log(`[setup] Vendor ${vendor.name} has ${vendor.documents.length} documents`);
    
    for (const document of vendor.documents) {
      read_document(document);
    }
  } else {
    console.log(`[setup] Vendor ${vendor.name} has no documents`);
  }
}

/**
 * Dummy function to read a document
 */
function read_document(document: Document): void {
  console.log(`[read_document] Processing document:`, document);
  // Dummy implementation - replace with actual document reading logic
}

/**
 * Setup method that fetches vendors and processes their documents
 */
async function setup(): Promise<void> {
  const apiBaseUrl = "https://negbot-backend-ajdxh9axb0ddb0e9.westeurope-01.azurewebsites.net";
  
  try {
    // Fetch vendors from the API
    const response = await fetch(`${apiBaseUrl}/api/vendors/?team_id=220239`);
    
    if (!response.ok) {
      throw new Error(
        `Failed to fetch vendors: ${response.status} ${response.statusText}`
      );
    }
    
    const vendors: Vendor[] = await response.json();
    console.log(`[setup] Fetched ${vendors.length} vendors`);
    
    // Process each vendor (update if id matches, insert if new)
    for (const vendor of vendors) {
      await handle_vendor(vendor);
    }
    
    console.log("[setup] Setup completed successfully");
  } catch (error) {
    console.error("[setup] Error during setup:", error);
    throw error;
  }
}

export { setup, read_document };
export default setup;

