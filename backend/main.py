"""
FastAPI entrypoint for WiseAI backend.

Nginx note: SSE requires `proxy_buffering off` in your Nginx config
to ensure tokens are streamed to the client immediately without buffering.
"""

import asyncio
import json
import os
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from extractors.youtube import fetch_video_data as fetch_youtube
from extractors.instagram import fetch_video_data as fetch_instagram
from pipeline.ingest import ingest, compute_engagement
from agent.graph import graph


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="WiseAI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _detect_platform(url: str) -> str:
    if "instagram.com" in url or "instagr.am" in url:
        return "instagram"
    return "youtube"


async def _fetch_video(url: str):
    platform = _detect_platform(url)
    if platform == "instagram":
        return await asyncio.to_thread(fetch_instagram, url)
    return await asyncio.to_thread(fetch_youtube, url)


def _build_metadata(video, engagement_rate: float, note: str) -> dict:
    return {
        "video_id": video.video_id,
        "url": video.url,
        "title": video.title,
        "creator": video.creator,
        "views": video.views,
        "likes": video.likes,
        "comments": video.comments,
        "hashtags": video.hashtags,
        "upload_date": video.upload_date,
        "duration_seconds": video.duration_seconds,
        "engagement_rate": engagement_rate,
        "engagement_note": note,
        "likes_hidden": getattr(video, "likes_hidden", False),
        "follower_count": getattr(video, "follower_count", 0),
        "thumbnail_url": getattr(video, "thumbnail_url", ""),
    }


# ── Request / Response Models ──────────────────────────────────────────────────

class IngestRequest(BaseModel):
    video_a_url: str
    video_b_url: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    video_metadata: dict | None = None


# ── GET /health ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── POST /ingest ───────────────────────────────────────────────────────────────

@app.post("/ingest")
async def ingest_videos(req: IngestRequest):
    try:
        video_a, video_b = await asyncio.gather(
            _fetch_video(req.video_a_url),
            _fetch_video(req.video_b_url),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    try:
        ingest_result = await ingest(video_a, video_b)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest pipeline failed: {e}")

    engagement_a, note_a = compute_engagement(video_a)
    engagement_b, note_b = compute_engagement(video_b)

    return {
        "video_A": _build_metadata(video_a, engagement_a, note_a),
        "video_B": _build_metadata(video_b, engagement_b, note_b),
        "ingest": ingest_result,
    }


# ── POST /chat ─────────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat_stream(req: ChatRequest):
    """
    Streams SSE with three event types:
      - citations: chunk metadata JSON before streaming begins
      - token: each LLM token
      - done: signals end of stream
    """

    async def event_stream() -> AsyncGenerator[str, None]:
        config = {"configurable": {"thread_id": req.session_id}}

        from agent.graph import AgentState
        from agent.graph import retrieve as retrieve_node

        # Step 1: Run retrieval synchronously to get citations first
        initial_state: AgentState = {
            "messages": [{"role": "user", "content": req.message}],
            "retrieved_chunks": [],
            "citations": [],
            "video_metadata": req.video_metadata or {},
        }

        retrieved_state = await asyncio.to_thread(retrieve_node, initial_state)
        chunks = retrieved_state.get("retrieved_chunks", [])

        # Emit citations event
        citations_payload = [
            {
                "video_id": c["video_id"],
                "chunk_index": c["chunk_index"],
                "score": c["score"],
                "creator": c["creator"],
                "url": c["url"],
            }
            for c in chunks
        ]
        yield f"event: citations\ndata: {json.dumps(citations_payload)}\n\n"

        # Step 2: Build context and stream LLM tokens
        from groq import Groq
        from agent.graph import (
            _embed_query,
            _get_qdrant_client,
        )

        metadata = req.video_metadata or {}
        context_lines = []
        for c in chunks:
            label = f"Video {c['video_id']}, chunk {c['chunk_index']}"
            time_info = ""
            if c.get("start_time_seconds") is not None:
                t = c["start_time_seconds"]
                m, s = divmod(int(t), 60)
                time_info = f" @ {m}:{s:02d}"
                if c.get("is_opening"):
                    time_info += " [opening]"
            context_lines.append(f"[{label}{time_info}]\n{c['text']}")

        context_block = "\n\n".join(context_lines) if context_lines else "No relevant chunks found."

        meta_lines = []
        for label, stats in metadata.items():
            if stats:
                meta_lines.append(
                    f"Video {label}: creator={stats.get('creator', 'N/A')}, "
                    f"views={stats.get('views', 0)}, likes={stats.get('likes', 0)}, "
                    f"comments={stats.get('comments', 0)}, "
                    f"engagement_rate={stats.get('engagement_rate', 0)}%, "
                    f"follower_count={stats.get('follower_count', 'N/A')}, "
                    f"url={stats.get('url', 'N/A')}"
                )
        metadata_block = "\n".join(meta_lines) if meta_lines else "No metadata available."

        system_prompt = f"""You are a sharp video analytics assistant. You have access to metadata and transcript excerpts for two videos: Video A and Video B.

## Video Metadata
{metadata_block}

## Transcript Excerpts (Retrieved)
{context_block}

## Rules — follow strictly
1. Be concise. 3-5 sentences max unless the question genuinely requires more.
2. For engagement questions (why more engagement, engagement rate, performance), ALWAYS answer using the metadata stats above — you have views, likes, comments, engagement_rate for both videos. Analyze and compare them directly.
3. For content questions (hooks, improvements, what was said), use the transcript excerpts. If no excerpts available for a video, say so but still answer from what you do have.
4. If asked for improvements, compare what's in Video A transcripts vs Video B transcripts. Use metadata differences (engagement rate, views) as supporting evidence.
5. Cite inline as [Video A, chunk N] or [Video B, metadata]. Do not cite things you didn't use.
6. No filler, no padding. Every sentence must add value.
7. Never say "I don't have that data" for engagement/metadata questions — that data is always in the metadata block above.
"""

        groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])

        # Retrieve full message history from graph memory
        state_snapshot = graph.get_state(config)
        history = []
        if state_snapshot and state_snapshot.values:
            history = state_snapshot.values.get("messages", [])

        stream_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                *history,
                {"role": "user", "content": req.message},
            ],
            stream=True,
            temperature=0.3,
        )

        full_response = ""
        for token_chunk in stream_response:
            token = token_chunk.choices[0].delta.content or ""
            if token:
                full_response += token
                yield f"event: token\ndata: {json.dumps(token)}\n\n"

        # Save turn to graph memory
        from agent.graph import AgentState as AS
        graph.update_state(
            config,
            {
                "messages": [
                    {"role": "user", "content": req.message},
                    {"role": "assistant", "content": full_response},
                ],
                "retrieved_chunks": chunks,
                "citations": [f"Video {c['video_id']}, chunk {c['chunk_index']}" for c in chunks],
                "video_metadata": metadata,
            },
        )

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx: disables proxy buffering for SSE
        },
    )
