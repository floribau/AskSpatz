// Lazy import of supabase to avoid initialization errors at module load time
let supabaseClient: any = null;
async function getSupabase() {
  if (!supabaseClient) {
    try {
      const supabaseModule = await import("./supabase.js");
      supabaseClient = supabaseModule.supabase;
    } catch (error) {
      console.error("[ProductSearch] Failed to import supabase:", error);
      return null;
    }
  }
  return supabaseClient;
}

// Lazy import and initialization of LangChain OpenAI embeddings
let embeddingsClient: any = null;
async function getEmbeddingsClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (!embeddingsClient) {
    try {
      const { OpenAIEmbeddings } = await import("@langchain/openai");
      embeddingsClient = new OpenAIEmbeddings({
        model: "text-embedding-3-small",
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      console.error("[ProductSearch] Failed to initialize embeddings client:", error);
      return null;
    }
  }
  
  return embeddingsClient;
}

interface ProductSearchResult {
  name: string;
  vendor_id: number;
  similarity: number;
}

/**
 * Search products using semantic similarity
 * @param queryText - The user's search query
 * @param topK - Number of top results to return (default: 3)
 * @returns Array of product search results with vendor IDs
 */
export async function searchProducts(
  queryText: string,
  topK: number = 3
): Promise<ProductSearchResult[]> {
  const embeddings = await getEmbeddingsClient();
  
  if (!embeddings) {
    console.warn("[ProductSearch] OPENAI_API_KEY not set, returning empty results");
    return [];
  }

  try {
    // Generate embedding for the query using LangChain
    const queryEmbedding = await embeddings.embedQuery(queryText);

    // Fetch all products with embeddings
    const supabase = await getSupabase();
    if (!supabase) {
      console.error("[ProductSearch] Supabase client not available");
      return [];
    }

    const { data: products, error } = await supabase
      .from("products")
      .select("name, vendor_id, name_embedded");

    if (error || !products) {
      console.error("[ProductSearch] Error fetching products:", error);
      return [];
    }

    // Calculate cosine similarity for each product
    const results: ProductSearchResult[] = [];

    for (const product of products) {
      if (!product.name_embedded) continue;

      // Parse embedding (might be stored as JSON string or array)
      let embedding: number[];
      if (typeof product.name_embedded === "string") {
        try {
          embedding = JSON.parse(product.name_embedded);
        } catch {
          // If JSON parsing fails, skip this product
          continue;
        }
      } else {
        embedding = product.name_embedded as number[];
      }

      // Calculate cosine similarity
      const similarity = cosineSimilarity(queryEmbedding, embedding);

      results.push({
        name: product.name,
        vendor_id: product.vendor_id,
        similarity,
      });
    }

    // Sort by similarity (highest first) and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  } catch (error) {
    console.error("[ProductSearch] Error during search:", error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
