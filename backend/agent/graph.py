import os
from typing import Any
from typing_extensions import TypedDict, Annotated

import cohere
from groq import Groq
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver


# ── State ──────────────────────────────────────────────────────────────────────

def _merge_lists(a: list, b: list) -> list:
    return a + b


class AgentState(TypedDict):
    messages: Annotated[list[dict], _merge_lists]
    retrieved_chunks: list[dict]
    citations: list[str]
    video_metadata: dict[str, Any]  # stats for video A and B


# ── Helpers ────────────────────────────────────────────────────────────────────

def _embed_query(query: str) -> list[float]:
    co = cohere.Client(os.environ["COHERE_API_KEY"])
    response = co.embed(
        texts=[query],
        model="embed-english-light-v3.0",
        input_type="search_query",
    )
    return response.embeddings[0]


def _get_qdrant_client() -> QdrantClient:
    return QdrantClient(
        url=os.environ["QDRANT_URL"],
        api_key=os.environ.get("QDRANT_API_KEY"),
    )


# ── Node 1: Retrieve ───────────────────────────────────────────────────────────

OPENING_KEYWORDS = {
    "first", "opening", "hook", "intro", "introduction",
    "start", "beginning", "seconds", "opens", "started"
}

COMPARISON_KEYWORDS = {
    "improve", "improvement", "improvements", "based on",
    "worked", "suggest", "better", "compare", "comparison",
    "versus", "vs", "difference", "differences"
}

def _is_opening_query(query: str) -> bool:
    words = set(query.lower().split())
    return bool(words & OPENING_KEYWORDS)

def _is_comparison_query(query: str) -> bool:
    q = query.lower()
    return any(k in q for k in COMPARISON_KEYWORDS)


def _fetch_opening_chunks(client: QdrantClient, collection: str) -> list[dict]:
    """Force-fetch opening chunks (is_opening=True) for both Video A and B."""
    results = client.scroll(
        collection_name=collection,
        scroll_filter=Filter(
            must=[FieldCondition(key="is_opening", match=MatchValue(value=True))]
        ),
        limit=10,
        with_payload=True,
        with_vectors=False,
    )[0]

    return [
        {
            "video_id": r.payload.get("video_id", ""),
            "chunk_index": r.payload.get("chunk_index", 0),
            "start_time_seconds": r.payload.get("start_time_seconds"),
            "is_opening": True,
            "text": r.payload.get("text", ""),
            "score": 1.0,
            "creator": r.payload.get("creator", ""),
            "url": r.payload.get("url", ""),
            "engagement_rate": r.payload.get("engagement_rate", 0.0),
        }
        for r in results
    ]


def retrieve(state: AgentState) -> dict:
    last_message = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"),
        "",
    )

    client = _get_qdrant_client()
    collection = os.environ["QDRANT_COLLECTION"]

    # Use opening-specific retrieval for hook/intro/first-seconds questions
    if _is_opening_query(last_message):
        chunks = _fetch_opening_chunks(client, collection)
        return {"retrieved_chunks": chunks}

    query_vector = _embed_query(last_message)

    # For comparison/improvement questions, force-fetch from both videos
    if _is_comparison_query(last_message):
        chunks = []
        for label in ["A", "B"]:
            # First try semantic search filtered by label
            results = client.query_points(
                collection_name=collection,
                query=query_vector,
                limit=3,
                with_payload=True,
                score_threshold=0.0,
                query_filter=Filter(
                    must=[FieldCondition(key="video_id", match=MatchValue(value=label))]
                ),
            ).points

            # If no results, scroll to get any chunks from this video
            if not results:
                scroll_results = client.scroll(
                    collection_name=collection,
                    scroll_filter=Filter(
                        must=[FieldCondition(key="video_id", match=MatchValue(value=label))]
                    ),
                    limit=3,
                    with_payload=True,
                    with_vectors=False,
                )[0]
                chunks += [
                    {
                        "video_id": r.payload.get("video_id", ""),
                        "chunk_index": r.payload.get("chunk_index", 0),
                        "start_time_seconds": r.payload.get("start_time_seconds"),
                        "is_opening": r.payload.get("is_opening", False),
                        "text": r.payload.get("text", ""),
                        "score": 0.0,
                        "creator": r.payload.get("creator", ""),
                        "url": r.payload.get("url", ""),
                        "engagement_rate": r.payload.get("engagement_rate", 0.0),
                    }
                    for r in scroll_results
                ]
            else:
                chunks += [
                    {
                        "video_id": r.payload.get("video_id", ""),
                        "chunk_index": r.payload.get("chunk_index", 0),
                        "start_time_seconds": r.payload.get("start_time_seconds"),
                        "is_opening": r.payload.get("is_opening", False),
                        "text": r.payload.get("text", ""),
                        "score": round(r.score, 4),
                        "creator": r.payload.get("creator", ""),
                        "url": r.payload.get("url", ""),
                        "engagement_rate": r.payload.get("engagement_rate", 0.0),
                    }
                    for r in results
                ]
        return {"retrieved_chunks": chunks}

    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        limit=6,
        with_payload=True,
        score_threshold=0.1,
    ).points

    chunks = [
        {
            "video_id": r.payload.get("video_id", ""),
            "chunk_index": r.payload.get("chunk_index", 0),
            "start_time_seconds": r.payload.get("start_time_seconds"),
            "is_opening": r.payload.get("is_opening", False),
            "text": r.payload.get("text", ""),
            "score": round(r.score, 4),
            "creator": r.payload.get("creator", ""),
            "url": r.payload.get("url", ""),
            "engagement_rate": r.payload.get("engagement_rate", 0.0),
        }
        for r in results
    ]

    return {"retrieved_chunks": chunks}


# ── Node 2: Generate ───────────────────────────────────────────────────────────

def generate(state: AgentState) -> dict:
    chunks = state.get("retrieved_chunks", [])
    metadata = state.get("video_metadata", {})

    # Build context block from retrieved chunks
    context_lines = []
    citations = []
    for i, chunk in enumerate(chunks):
        label = f"Video {chunk['video_id']}, chunk {chunk['chunk_index']}"
        time_info = ""
        if chunk.get("start_time_seconds") is not None:
            t = chunk["start_time_seconds"]
            m, s = divmod(int(t), 60)
            time_info = f" @ {m}:{s:02d}"
            if chunk.get("is_opening"):
                time_info += " [opening]"
        context_lines.append(f"[{label}{time_info}]\n{chunk['text']}")
        citations.append(label)

    context_block = "\n\n".join(context_lines) if context_lines else "No relevant chunks found."

    # Build metadata block
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

    client = Groq(api_key=os.environ["GROQ_API_KEY"])

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            *state["messages"],
        ],
        stream=True,
        temperature=0.3,
    )

    full_response = ""
    for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        full_response += delta

    new_message = {"role": "assistant", "content": full_response}

    return {
        "messages": [new_message],
        "citations": citations,
    }


# ── Graph ──────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    memory = MemorySaver()

    builder = StateGraph(AgentState)
    builder.add_node("retrieve", retrieve)
    builder.add_node("generate", generate)

    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "generate")
    builder.add_edge("generate", END)

    return builder.compile(checkpointer=memory)


# ── Singleton graph ────────────────────────────────────────────────────────────

graph = build_graph()


# ── Public interface ───────────────────────────────────────────────────────────

def chat(
    question: str,
    session_id: str,
    video_metadata: dict[str, Any] | None = None,
) -> str:
    """
    Send a question to the agent and get a response.
    video_metadata should be: {"A": {...stats}, "B": {...stats}}
    session_id is used to key cross-turn memory.
    """
    config = {"configurable": {"thread_id": session_id}}

    input_state: AgentState = {
        "messages": [{"role": "user", "content": question}],
        "retrieved_chunks": [],
        "citations": [],
        "video_metadata": video_metadata or {},
    }

    result = graph.invoke(input_state, config=config)
    return result["messages"][-1]["content"]
