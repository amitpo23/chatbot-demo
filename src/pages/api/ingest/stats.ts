import type { NextApiRequest, NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";

let pinecone: Pinecone | null = null;

const initPineconeClient = () => {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

/**
 * Returns Pinecone index statistics including vector count.
 * Also supports DELETE method to clear all vectors.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.PINECONE_INDEX_NAME) {
    res.status(500).json({ error: "PINECONE_INDEX_NAME not set" });
    return;
  }

  if (!pinecone) {
    initPineconeClient();
  }

  const index = pinecone!.index(process.env.PINECONE_INDEX_NAME);

  if (req.method === "GET") {
    try {
      const stats = await index.describeIndexStats();
      res.status(200).json(stats);
    } catch (error) {
      console.error("Error fetching index stats:", error);
      res.status(500).json({ error: "Failed to fetch index stats" });
    }
    return;
  }

  if (req.method === "DELETE") {
    try {
      await index.deleteAll();
      res.status(200).json({ success: true, message: "All vectors deleted" });
    } catch (error) {
      console.error("Error clearing index:", error);
      res.status(500).json({ error: "Failed to clear index" });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
