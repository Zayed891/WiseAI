import os
import asyncio
import cohere
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from langchain_text_splitters import RecursiveCharacterTextSplitter
from extractors.youtube import VideoData


# ── Engagement Rate ────────────────────────────────────────────────────────────

def compute_engagement(video: VideoData) -> tuple[float, str]:
    """
    Returns (engagement_rate, note).
    If likes are hidden, only comments are used in the numerator.
    """
    if video.views == 0:
        return 0.0, "views = 0, engagement rate cannot be computed"

    likes_hidden = getattr(video, "likes_hidden", False)

    if likes_hidden:
        rate = (video.comments / video.views) * 100
        note = "likes hidden — engagement computed as (comments / views) * 100"
    else:
        rate = ((video.likes + video.comments) / video.views) * 100
        note = "engagement computed as (likes + comments) / views * 100"

    return round(rate, 4), note


# ── Chunking ───────────────────────────────────────────────────────────────────

def chunk_transcript(transcript: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=300,
        chunk_overlap=50,
    )
    return splitter.split_text(transcript) if transcript.strip() else []


# ── Embedding ──────────────────────────────────────────────────────────────────

def embed_chunks(chunks: list[str]) -> list[list[float]]:
    if not chunks:
        return []
    co = cohere.Client(os.environ["COHERE_API_KEY"])
    response = co.embed(
        texts=chunks,
        model="embed-english-light-v3.0",
        input_type="search_document",
    )
    return response.embeddings


# ── Qdrant Storage ─────────────────────────────────────────────────────────────

def get_qdrant_client() -> QdrantClient:
    return QdrantClient(
        url=os.environ["QDRANT_URL"],
        api_key=os.environ.get("QDRANT_API_KEY"),
    )


def ensure_collection(client: QdrantClient, collection: str, vector_size: int):
    existing = [c.name for c in client.get_collections().collections]
    if collection not in existing:
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )


def store_chunks(
    client: QdrantClient,
    collection: str,
    chunks: list[str],
    embeddings: list[list[float]],
    video: VideoData,
    label: str,  # "A" or "B"
    engagement_rate: float,
):
    points = [
        PointStruct(
            id=abs(hash(f"{video.video_id}_{i}")) % (2**63),
            vector=embeddings[i],
            payload={
                "video_id": label,
                "source_id": video.video_id,
                "creator": video.creator,
                "url": video.url,
                "engagement_rate": engagement_rate,
                "chunk_index": i,
                "text": chunks[i],
            },
        )
        for i in range(len(chunks))
    ]
    if points:
        client.upsert(collection_name=collection, points=points)


# ── Per-video pipeline ─────────────────────────────────────────────────────────

async def process_video(video: VideoData, label: str):
    collection = os.environ["QDRANT_COLLECTION"]

    engagement_rate, note = compute_engagement(video)
    print(f"[{label}] engagement_rate={engagement_rate}% — {note}")

    chunks = chunk_transcript(video.transcript)
    print(f"[{label}] {len(chunks)} chunks from transcript")

    if not chunks:
        print(f"[{label}] no transcript — skipping embed + store")
        return {"label": label, "engagement_rate": engagement_rate, "note": note, "chunks": 0}

    embeddings = await asyncio.to_thread(embed_chunks, chunks)
    print(f"[{label}] {len(embeddings)} embeddings generated")

    client = get_qdrant_client()
    vector_size = len(embeddings[0])
    ensure_collection(client, collection, vector_size)
    store_chunks(client, collection, chunks, embeddings, video, label, engagement_rate)
    print(f"[{label}] stored in Qdrant collection '{collection}'")

    return {"label": label, "engagement_rate": engagement_rate, "note": note, "chunks": len(chunks)}


# ── Main entry point ───────────────────────────────────────────────────────────

async def ingest(video_a: VideoData, video_b: VideoData) -> dict:
    results = await asyncio.gather(
        process_video(video_a, "A"),
        process_video(video_b, "B"),
    )
    return {"video_A": results[0], "video_B": results[1]}


if __name__ == "__main__":
    # Quick smoke test with dummy data
    from extractors.youtube import VideoData as YTVideoData

    dummy_a = YTVideoData(
        video_id="test_a", url="https://example.com/a", title="Test A",
        creator="Creator A", transcript="This is a test transcript for video A. " * 20,
        views=10000, likes=500, comments=50, hashtags=[], upload_date="20240101", duration_seconds=120,
    )
    dummy_b = YTVideoData(
        video_id="test_b", url="https://example.com/b", title="Test B",
        creator="Creator B", transcript="This is a test transcript for video B. " * 20,
        views=5000, likes=0, comments=30, hashtags=[], upload_date="20240101", duration_seconds=90,
    )
    # Simulate hidden likes on B
    dummy_b.__dict__["likes_hidden"] = True

    result = asyncio.run(ingest(dummy_a, dummy_b))
    print(result)
