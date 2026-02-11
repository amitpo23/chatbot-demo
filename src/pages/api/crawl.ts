import { NextApiRequest, NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";
import { Crawler, Page } from '../../crawler'
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import Bottleneck from "bottleneck";
import { uuid } from "uuidv4";
import { TokenTextSplitter } from "langchain/text_splitter";
import { summarizeLongDocument } from "./summarizer";

const limiter = new Bottleneck({
  minTime: 50
});

let pinecone: Pinecone | null = null

const initPineconeClient = () => {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
}

type Response = {
  message: string
}

type PineconeVector = { id: string; values: number[]; metadata: Record<string, string> };

const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};


const sliceIntoChunks = (arr: PineconeVector[], chunkSize: number) => {
  return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {

  if (!process.env.PINECONE_INDEX_NAME) {
    res.status(500).json({ message: "PINECONE_INDEX_NAME not set" })
    return
  }

  const { query } = req;
  const { urls: urlString, limit, indexName, summmarize } = query;
  const urls = (urlString as string).split(",");
  const crawlLimit = parseInt(limit as string) || 100;
  const pineconeIndexName = indexName as string || process.env.PINECONE_INDEX_NAME!
  const shouldSummarize = summmarize === "true"

  if (!pinecone) {
    initPineconeClient();
  }

  try {
    const indexList = pinecone && await pinecone.listIndexes();
    const indexNames = indexList?.indexes?.map(idx => idx.name) || [];
    if (!indexNames.includes(pineconeIndexName)) {
      res.status(500).json({
        message: `Index ${pineconeIndexName} does not exist`
      })
      return
    }
  } catch (e) {
    console.error("Error listing indexes:", e);
  }

  const crawler = new Crawler(urls, crawlLimit, 200)
  const pages = await crawler.start() as Page[]

  const documents = await Promise.all(pages.map(async row => {

    const splitter = new TokenTextSplitter({
      encodingName: "gpt2",
      chunkSize: 300,
      chunkOverlap: 20,
    });

    const pageContent = shouldSummarize ? await summarizeLongDocument({ document: row.text }) : row.text

    const docs = splitter.splitDocuments([
      new Document({ pageContent, metadata: { url: row.url, text: truncateStringByBytes(pageContent, 36000) } }),
    ]);
    return docs
  }))



  const index = pinecone && pinecone.index(pineconeIndexName);

  const embedder = new OpenAIEmbeddings({
    modelName: "text-embedding-ada-002"
  })
  let counter = 0

  //Embed the documents
  const getEmbedding = async (doc: Document) => {
    const embedding = await embedder.embedQuery(doc.pageContent)
    console.log(doc.pageContent)
    console.log("got embedding", embedding.length)
    process.stdout.write(`${Math.floor((counter / documents.flat().length) * 100)}%\r`)
    counter = counter + 1
    return {
      id: uuid(),
      values: embedding,
      metadata: {
        chunk: doc.pageContent,
        text: doc.metadata.text as string,
        url: doc.metadata.url as string,
      }
    } as PineconeVector
  }
  const rateLimitedGetEmbedding = limiter.wrap(getEmbedding);
  process.stdout.write("100%\r")
  console.log("done embedding");

  let vectors = [] as PineconeVector[]

  try {
    vectors = await Promise.all(documents.flat().map((doc) => rateLimitedGetEmbedding(doc))) as unknown as PineconeVector[]
    const chunks = sliceIntoChunks(vectors, 10)
    console.log(chunks.length)


    try {
      await Promise.all(chunks.map(async chunk => {
        await index!.upsert({ records: chunk })
      }))

      res.status(200).json({ message: "Done" })
    } catch (e) {
      console.log(e)
      res.status(500).json({ message: `Error ${JSON.stringify(e)}` })
    }
  } catch (e) {
    console.log(e)
  }
}