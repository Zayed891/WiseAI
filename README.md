# WiseAI

Compare a YouTube video and an Instagram Reel side by side, then chat with an AI that actually read both of them.

## What it does

Paste two URLs. WiseAI pulls the transcripts, computes engagement rates, chunks everything into a vector database, and gives you a chat interface where you can ask real questions — like why one video outperformed the other, or what the hook looked like in the first 5 seconds.

Answers come with citations so you know exactly which part of which video the AI is referencing.

## Stack

**Backend**
- FastAPI
- Apify (YouTube metadata + transcript, Instagram Reels)
- Groq Whisper (audio transcription for Reels)
- Cohere embeddings
- Qdrant (vector store)
- LangGraph (RAG agent with memory)
- Groq llama-3.3-70b (LLM)

**Frontend**
- Next.js 14 App Router
- Tailwind CSS + shadcn/ui
- Framer Motion

## Running locally

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # fill in your keys
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
# create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Environment variables

```
GROQ_API_KEY
QDRANT_URL
QDRANT_API_KEY
QDRANT_COLLECTION
COHERE_API_KEY
APIFY_API_TOKEN
NEXT_PUBLIC_API_URL
```

## How the RAG works

Each transcript gets split into 300-character chunks with 50-character overlap. Chunks are embedded with Cohere and stored in Qdrant, tagged as Video A or B. When you ask a question, the agent retrieves the most relevant chunks (with special handling for opening/hook questions and cross-video comparisons), injects them into the LLM context, and streams the response back with inline citations.

Memory persists across turns in the same session.
