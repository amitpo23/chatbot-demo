# Medici Hotels — B2B Customer Service Bot

AI-powered customer service bot for B2B travel agent partners.
Answers questions from a knowledge base via Slack and web chat.

## Features

- Slack bot — mention @MediciBot or DM directly
- Web chat interface (existing, unchanged)
- Knowledge base from URLs (web crawling) and file uploads (PDF, DOCX)
- RAG with Pinecone vector search
- GPT-4o-mini powered responses
- Hebrew + English support
- Auto-escalation when answer not found

## Architecture

```
Travel Agent (Slack) ──> /api/slack/events ──> /api/slack/respond ──> Pinecone + OpenAI ──> Slack reply
Admin (Web) ──────────> /admin ──────────────> /api/crawl or /api/ingest/file ──> Pinecone
Web Chat ─────────────> /api/chat ───────────> Pinecone + OpenAI ──> Ably streaming
```

## Quick Start

1. Clone and install:

```bash
git clone <repo> && cd chatbot-demo && npm install
```

2. Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

3. Create Pinecone index (dimension: 1536, metric: cosine)

4. Create Slack App at https://api.slack.com/apps:
   - Bot Token Scopes: `chat:write`, `app_mentions:read`, `im:history`, `im:read`, `im:write`
   - Event Subscriptions URL: `https://your-app.vercel.app/api/slack/events`
   - Subscribe to events: `app_mention`, `message.im`

5. Set up CockroachDB and run `db/dbinit.sql` for conversation history

6. Start development server:

```bash
npm run dev
```

7. Deploy to Vercel:

```bash
vercel --prod
```

8. Ingest knowledge base content:
   - Go to `https://your-app.vercel.app/admin?secret=YOUR_ADMIN_SECRET`
   - Add URLs to crawl or upload PDF/DOCX/TXT files

9. Test: mention @MediciBot in Slack!

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_ENVIRONMENT` | Pinecone environment |
| `PINECONE_INDEX_NAME` | Pinecone index name |
| `DATABASE_URL` | CockroachDB connection string |
| `ABLY_API_KEY` | Ably real-time messaging key |
| `SLACK_BOT_TOKEN` | Slack bot token (xoxb-...) |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `ADMIN_SECRET` | Secret for admin dashboard access |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed app |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/chat` | POST | Web chat endpoint (streams via Ably) |
| `/api/crawl` | GET | Crawl URLs and ingest into Pinecone |
| `/api/slack/events` | POST | Slack Events API handler (ack + dispatch) |
| `/api/slack/respond` | POST | Async Slack response (RAG + OpenAI) |
| `/api/ingest/file` | POST | Upload and ingest PDF/DOCX/TXT files |
| `/api/ingest/stats` | GET/DELETE | Pinecone index stats / clear all vectors |

## Admin Dashboard

Access at `/admin?secret=YOUR_ADMIN_SECRET`. Features:

- **URL Ingestion**: Single or bulk URL crawling
- **File Upload**: PDF, DOCX, TXT, MD file ingestion
- **Knowledge Base Overview**: Vector count and clear all
- **Test Chat**: Quick test of the RAG pipeline
