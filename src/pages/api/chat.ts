// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { Pinecone } from "@pinecone-database/pinecone";
import * as Ably from 'ably';
import { CallbackManager } from "langchain/callbacks";
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PromptTemplate } from "langchain/prompts";
import type { NextApiRequest, NextApiResponse } from 'next';
import { uuid } from 'uuidv4';
import { summarizeLongDocument } from './summarizer';

import { ConversationLog } from './conversationLog';
import { Metadata, getMatchesFromEmbeddings } from './matches';
import { templates } from './templates';
import { detectSkills, buildSkillContext } from '../../lib/skills';


const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
let pinecone: Pinecone | null = null

const initPineconeClient = () => {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
}

const ably = new Ably.Realtime({ key: process.env.ABLY_API_KEY });

const handleRequest = async ({ prompt, userId }: { prompt: string, userId: string }) => {
  if (!pinecone) {
    initPineconeClient();
  }

  let fullResponse = "";
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const channel = ably.channels.get(userId);
    const interactionId = uuid()

    // Retrieve the conversation log and save the user's prompt
    const conversationLog = new ConversationLog(userId)
    const conversationHistory = await conversationLog.getConversation({ limit: 10 })
    await conversationLog.addEntry({ entry: prompt, speaker: "user" })

    // Build an LLM chain that will improve the user prompt
    const inquiryChain = new LLMChain({
      llm, prompt: new PromptTemplate({
        template: templates.inquiryTemplate,
        inputVariables: ["userPrompt", "conversationHistory"],
      })
    });
    const inquiryChainResult = await inquiryChain.call({ userPrompt: prompt, conversationHistory })
    const inquiry = inquiryChainResult.text

    console.log(inquiry)

    // Embed the user's intent and query the Pinecone index
    const embedder = new OpenAIEmbeddings({
      modelName: "text-embedding-ada-002"
    });


    const embeddings = await embedder.embedQuery(inquiry);
    channel.publish({
      data: {
        event: "status",
        message: "Finding matches...",
      }
    })

    const matches = await getMatchesFromEmbeddings(embeddings, pinecone!, 2);



    const urls = matches && Array.from(new Set(matches.map(match => {
      const metadata = match.metadata as Metadata
      const { url } = metadata
      return url
    })))

    console.log(urls)


    const docs = matches && Array.from(
      matches.reduce((map, match) => {
        const metadata = match.metadata as Metadata;
        const { text, url } = metadata;
        if (!map.has(url)) {
          map.set(url, text);
        }
        return map;
      }, new Map())
    ).map(([_, text]) => text);


    // Detect active skills based on the user's prompt
    const activeSkills = detectSkills(prompt);
    const skillContext = buildSkillContext(activeSkills);

    const enhancedTemplate = templates.qaTemplate.replace(
      "CONTEXT: {summaries}",
      `${skillContext}\nCONTEXT: {summaries}`
    );

    const promptTemplate = new PromptTemplate({
      template: enhancedTemplate,
      inputVariables: ["summaries", "question", "conversationHistory", "urls"],
    });


    // Token batching to stay under Ably's 50 msg/sec rate limit
    let tokenBuffer = "";
    const FLUSH_INTERVAL_MS = 50; // Flush every 50ms = max 20 publishes/sec

    const flushTokenBuffer = () => {
      if (tokenBuffer.length > 0) {
        const batch = tokenBuffer;
        tokenBuffer = "";
        channel.publish({
          data: {
            event: "response",
            token: batch,
            interactionId
          }
        });
      }
    };

    // Start periodic flushing
    flushTimer = setInterval(flushTokenBuffer, FLUSH_INTERVAL_MS);

    const chat = new ChatOpenAI({
      streaming: true,
      verbose: true,
      modelName: "gpt-3.5-turbo",
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMNewToken(token) {
          tokenBuffer += token;
          fullResponse += token;
        },
        async handleLLMEnd() {
          // Final flush of any remaining tokens
          if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
          }
          flushTokenBuffer();
          channel.publish({
            data: {
              event: "responseEnd",
              token: "END",
              interactionId
            }
          });
          // Save the AI response to the conversation log
          if (fullResponse.trim()) {
            conversationLog.addEntry({ entry: fullResponse.trim(), speaker: "ai" })
              .catch((err) => console.error("Failed to save AI response:", err));
          }
        }
      }),
    });

    const chain = new LLMChain({
      prompt: promptTemplate,
      llm: chat,
    });

    const allDocs = (docs || []).join("\n")
    if (allDocs.length > 4000) {
      channel.publish({
        data: {
          event: "status",
          message: `Just a second, forming final answer...`,
        }
      })
    }

    const summary = allDocs.length > 4000 ? await summarizeLongDocument({ document: allDocs, inquiry }) : allDocs

    await chain.call({
      summaries: summary,
      question: prompt,
      conversationHistory,
      urls
    });



  } catch (error) {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    console.error("Chat error:", error)
    // Notify the client so the UI can stop the typing indicator
    try {
      const channel = ably.channels.get(userId);
      channel.publish({
        data: {
          event: "responseEnd",
          token: "END",
        }
      });
    } catch (_) {
      // Best-effort notification
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, userId } = req.body ?? {};

  if (!prompt || typeof prompt !== "string" || !userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing prompt or userId" });
  }

  await handleRequest({ prompt, userId })
  res.status(200).json({ "message": "started" })
}
