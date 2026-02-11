import type { Pinecone } from "@pinecone-database/pinecone";

export type Metadata = {
  url: string,
  text: string,
  chunk: string,
}

const getMatchesFromEmbeddings = async (embeddings: number[], pinecone: Pinecone, topK: number) => {
  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error("PINECONE_INDEX_NAME is not set")
  }

  const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
  try {
    const queryResult = await index.query({
      vector: embeddings,
      topK,
      includeMetadata: true,
    })
    return queryResult.matches?.map(match => ({
      ...match,
      metadata: match.metadata as unknown as Metadata
    })) || []
  } catch (e) {
    console.log("Error querying embeddings: ", e)
    throw new Error(`Error querying embeddings: ${e}`)
  }
}

export { getMatchesFromEmbeddings }