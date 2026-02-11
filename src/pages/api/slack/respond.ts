import type { NextApiRequest, NextApiResponse } from "next";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { OpenAI } from "langchain/llms";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";
import { WebClient } from "@slack/web-api";
import { Metadata, getMatchesFromEmbeddings } from "../matches";
import { templates } from "../templates";
import { summarizeLongDocument } from "../summarizer";
import { detectSkills, buildSkillContext } from "../../../lib/skills";
import { sendEscalationEmail } from "../../../lib/mailer";

let pinecone: Pinecone | null = null;

const initPineconeClient = () => {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

const ESCALATION_MESSAGE =
  "I'm connecting you with the KNOWAA Global team. A team member will follow up shortly.";

/**
 * Processes a Slack question asynchronously:
 * retrieves context from Pinecone, generates a response via OpenAI,
 * and posts the answer back to the Slack channel/thread.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { question, channel_id, thread_ts, user_id } = req.body;

  if (!question || !channel_id) {
    res.status(400).json({ error: "Missing question or channel_id" });
    return;
  }

  // Ack immediately so Slack doesn't timeout
  res.status(200).json({ ok: true });

  try {
    if (!pinecone) {
      initPineconeClient();
    }

    // Embed the question
    const embedder = new OpenAIEmbeddings({
      modelName: "text-embedding-ada-002",
    });
    const embeddings = await embedder.embedQuery(question);

    // Query Pinecone for relevant context
    const matches = await getMatchesFromEmbeddings(embeddings, pinecone!, 3);

    const urls =
      matches &&
      Array.from(
        new Set(
          matches.map((match) => {
            const metadata = match.metadata as Metadata;
            return metadata.url;
          })
        )
      );

    const docs =
      matches &&
      Array.from(
        matches.reduce((map, match) => {
          const metadata = match.metadata as Metadata;
          const { text, url } = metadata;
          if (!map.has(url)) {
            map.set(url, text);
          }
          return map;
        }, new Map<string, string>())
      ).map(([, text]) => text);

    const allDocs = docs.join("\n");

    // Detect skills early for escalation check
    const activeSkills = detectSkills(question);

    // If no relevant context found, escalate
    if (!allDocs || allDocs.trim().length === 0) {
      await slackClient.chat.postMessage({
        channel: channel_id,
        thread_ts,
        text: ESCALATION_MESSAGE,
      });
      // Send escalation email
      sendEscalationEmail({
        question,
        source: "slack",
        userId: user_id,
        channelId: channel_id,
        threadTs: thread_ts,
        detectedSkills: activeSkills.map((s) => s.name),
      }).catch((err) => console.error("Escalation email failed:", err));
      return;
    }

    // Summarize if needed
    const summary =
      allDocs.length > 4000
        ? await summarizeLongDocument({ document: allDocs, inquiry: question })
        : allDocs;

    const skillContext = buildSkillContext(activeSkills);

    // Build the prompt with skill-specific instructions injected
    const enhancedTemplate = templates.qaTemplate.replace(
      "CONTEXT: {summaries}",
      `${skillContext}\nCONTEXT: {summaries}`
    );

    const promptTemplate = new PromptTemplate({
      template: enhancedTemplate,
      inputVariables: ["summaries", "question", "conversationHistory", "urls"],
    });

    const llm = new OpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2,
    });

    const chain = new LLMChain({
      prompt: promptTemplate,
      llm,
    });

    const result = await chain.call({
      summaries: summary,
      question,
      conversationHistory: "",
      urls: urls.join(", "),
    });

    const answer = result.text?.trim() || ESCALATION_MESSAGE;

    // Post the response back to Slack
    await slackClient.chat.postMessage({
      channel: channel_id,
      thread_ts,
      text: answer,
    });

    // If the bot's answer includes escalation language, also send email
    const isEscalation =
      answer.includes("escalat") ||
      answer.includes("human agent") ||
      answer.includes("support team") ||
      activeSkills.some((s) => s.escalationThreshold === "always");

    if (isEscalation) {
      sendEscalationEmail({
        question,
        context: summary.substring(0, 500),
        source: "slack",
        userId: user_id,
        channelId: channel_id,
        threadTs: thread_ts,
        detectedSkills: activeSkills.map((s) => s.name),
      }).catch((err) => console.error("Escalation email failed:", err));
    }
  } catch (error) {
    console.error("Error in Slack respond:", error);

    try {
      await slackClient.chat.postMessage({
        channel: channel_id,
        thread_ts,
        text: "Sorry, I encountered an error processing your request. Please try again or contact support directly.",
      });
    } catch (postError) {
      console.error("Failed to post error message to Slack:", postError);
    }
  }
}
