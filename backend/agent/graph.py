import os
from typing import Any
from typing_extensions import TypedDict, Annotated

import cohere
from groq import Groq
from qdrant_client import QdrantClient
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

def retrieve(state: AgentState) -> dict:
    last_message = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"),
        "",
    )

    query_vector = _embed_query(last_message)
    client = _get_qdrant_client()
    collection = os.environ["QDRANT_COLLECTION"]

    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        limit=4,
        with_payload=True,
        score_threshold=0.3,
    ).points

    chunks = [
        {
            "video_id": r.payload.get("video_id", ""),
            "chunk_index": r.payload.get("chunk_index", 0),
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
        context_lines.append(f"[{label}]\n{chunk['text']}")
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
                f"url={stats.get('url', 'N/A')}"
            )
    metadata_block = "\n".join(meta_lines) if meta_lines else "No metadata available."

    system_prompt = f"""You are a video analytics assistant with deep knowledge of two videos: Video A and Video B.

Your job is to answer questions about these videos — their content, performance, engagement, and comparisons.

## Video Metadata
{metadata_block}

## Retrieved Context
{context_block}

## Instructions
- Always cite your sources inline using the format [Video A, chunk 2] or [Video B, chunk 0]
- When comparing videos, reference both metadata stats and transcript content
- If information is not available in the context, say so clearly
- Be concise, insightful, and data-driven
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
