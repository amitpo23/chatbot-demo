import { config } from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

config({ path: ".env.local" });

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

async function getEmbedding(text, apiKey) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!pineconeApiKey || !openaiApiKey || !indexName) {
    console.error("Missing env vars: PINECONE_API_KEY, OPENAI_API_KEY, or PINECONE_INDEX_NAME");
    process.exit(1);
  }

  console.log(`Using index: ${indexName}`);

  // Read the knowledge base
  const text = readFileSync("public/knowaa-knowledge-base.txt", "utf-8");
  console.log(`Knowledge base: ${text.length} characters`);

  // Split by sections first, then chunk
  const sections = text.split(/\n---\n/);
  const allChunks = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.length <= CHUNK_SIZE) {
      allChunks.push(trimmed);
    } else {
      const chunks = chunkText(trimmed, CHUNK_SIZE, CHUNK_OVERLAP);
      allChunks.push(...chunks);
    }
  }

  console.log(`Created ${allChunks.length} chunks`);

  // Initialize Pinecone
  const pinecone = new Pinecone({ apiKey: pineconeApiKey });
  const index = pinecone.index(indexName);

  // Generate embeddings and upsert
  const vectors = [];

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    console.log(`Embedding chunk ${i + 1}/${allChunks.length} (${chunk.length} chars)`);

    const embedding = await getEmbedding(chunk, openaiApiKey);

    vectors.push({
      id: randomUUID(),
      values: embedding,
      metadata: {
        chunk: chunk,
        text: chunk,
        url: "https://www.knowaaglobal.com",
        source: "knowaa-knowledge-base",
        type: "knowledge-base",
      },
    });

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Upserting ${vectors.length} vectors...`);

  // Upsert in batches of 10
  for (let i = 0; i < vectors.length; i += 10) {
    const batch = vectors.slice(i, i + 10);
    await index.upsert({ records: batch });
    console.log(`Upserted batch ${Math.floor(i / 10) + 1}/${Math.ceil(vectors.length / 10)}`);
  }

  console.log("Done! Knowledge base ingested successfully.");

  // Verify
  const stats = await index.describeIndexStats();
  console.log("Index stats:", JSON.stringify(stats, null, 2));
}

main().catch(console.error);
