import type { NextApiRequest, NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TokenTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import Bottleneck from "bottleneck";
import { uuid } from "uuidv4";
import { IncomingForm, File } from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

let pinecone: Pinecone | null = null;

const initPineconeClient = () => {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

const limiter = new Bottleneck({ minTime: 50 });

const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

type PineconeVector = { id: string; values: number[]; metadata: Record<string, string> };

const sliceIntoChunks = (arr: PineconeVector[], chunkSize: number) =>
  Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );

/**
 * Parses a multipart form upload and returns the file.
 */
const parseForm = (req: NextApiRequest): Promise<{ file: File }> =>
  new Promise((resolve, reject) => {
    const form = new IncomingForm({ keepExtensions: true });
    form.parse(req, (err, _fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      const uploaded = files.file;
      const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      if (!file) {
        reject(new Error("No file uploaded"));
        return;
      }
      resolve({ file });
    });
  });

/**
 * Extracts text content from a file based on its extension.
 */
const extractText = async (
  filePath: string,
  filename: string
): Promise<string> => {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(filePath, "utf-8");
  }

  throw new Error(`Unsupported file type: ${ext}`);
};

/**
 * Ingests an uploaded file (PDF, DOCX, TXT, MD) into the Pinecone vector store.
 * Extracts text, chunks it, generates embeddings, and upserts to Pinecone.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.PINECONE_INDEX_NAME) {
    res.status(500).json({ error: "PINECONE_INDEX_NAME not set" });
    return;
  }

  try {
    const { file } = await parseForm(req);
    const filename =
      file.originalFilename || file.newFilename || "unknown_file";
    const filePath = file.filepath;

    const text = await extractText(filePath, filename);

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: "No text content extracted from file" });
      return;
    }

    // Initialize Pinecone
    if (!pinecone) {
      initPineconeClient();
    }

    // Chunk the text
    const splitter = new TokenTextSplitter({
      encodingName: "gpt2",
      chunkSize: 300,
      chunkOverlap: 20,
    });

    const docs = await splitter.splitDocuments([
      new Document({
        pageContent: text,
        metadata: {
          url: `file://${filename}`,
          text: truncateStringByBytes(text, 36000),
        },
      }),
    ]);

    // Generate embeddings
    const embedder = new OpenAIEmbeddings({
      modelName: "text-embedding-ada-002",
    });

    const getEmbedding = async (doc: Document) => {
      const embedding = await embedder.embedQuery(doc.pageContent);
      return {
        id: uuid(),
        values: embedding,
        metadata: {
          chunk: doc.pageContent,
          text: truncateStringByBytes(doc.metadata.text as string, 36000),
          url: doc.metadata.url as string,
          source: filename,
          type: "file",
          timestamp: new Date().toISOString(),
        },
      } as PineconeVector;
    };

    const rateLimitedGetEmbedding = limiter.wrap(getEmbedding);

    const vectors = (await Promise.all(
      docs.map((doc) => rateLimitedGetEmbedding(doc))
    )) as unknown as PineconeVector[];

    // Upsert to Pinecone in batches
    const index = pinecone!.index(process.env.PINECONE_INDEX_NAME);
    const chunks = sliceIntoChunks(vectors, 10);

    await Promise.all(
      chunks.map(async (chunk) => {
        await index.upsert({ records: chunk });
      })
    );

    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }

    res.status(200).json({
      success: true,
      filename,
      chunks: vectors.length,
    });
  } catch (error) {
    console.error("File ingestion error:", error);
    res.status(500).json({
      error: `File ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
