import os
import time
import re
import httpx
from pydantic import BaseModel


class VideoData(BaseModel):
    video_id: str
    url: str
    title: str
    creator: str
    transcript: str
    transcript_segments: list[dict] = []
    views: int
    likes: int
    comments: int
    hashtags: list[str]
    upload_date: str
    duration_seconds: int
    follower_count: int = 0  # subscriber count for YouTube
    thumbnail_url: str = ""


APIFY_BASE = "https://api.apify.com/v2"
METADATA_ACTOR = "streamers~youtube-scraper"
TRANSCRIPT_ACTOR = "faVsWy9VTSNVIhWpR"


def _extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})", url)
    if not match:
        raise ValueError(f"Could not extract video ID from URL: {url}")
    return match.group(1)


def _run_apify_actor(actor_id: str, run_input: dict, label: str) -> list:
    api_token = os.environ.get("APIFY_API_TOKEN")
    if not api_token:
        raise ValueError("APIFY_API_TOKEN environment variable is not set")

    params = {"token": api_token}

    start_resp = httpx.post(
        f"{APIFY_BASE}/acts/{actor_id}/runs",
        params=params,
        json=run_input,
        timeout=30,
    )
    if start_resp.status_code not in (200, 201):
        raise ValueError(f"Failed to start {label} actor: {start_resp.status_code} {start_resp.text}")

    run_id = start_resp.json()["data"]["id"]
    print(f"[youtube] {label} run started: {run_id}")

    for _ in range(36):  # up to 180s
        time.sleep(5)
        status = httpx.get(
            f"{APIFY_BASE}/actor-runs/{run_id}", params=params, timeout=15
        ).json()["data"]["status"]
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise ValueError(f"{label} actor run {status}: {run_id}")
    else:
        raise ValueError(f"{label} actor timed out: {run_id}")

    items = httpx.get(
        f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items",
        params={**params, "format": "json"},
        timeout=20,
    ).json()
    return items


def _parse_duration(duration: str) -> int:
    """Convert 'HH:MM:SS' or 'MM:SS' to seconds."""
    if not duration:
        return 0
    parts = [int(p) for p in duration.split(":")]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0] if parts else 0


def fetch_video_data(url: str) -> VideoData:
    video_id = _extract_video_id(url)

    # 1. Metadata via youtube-scraper
    meta_items = _run_apify_actor(
        METADATA_ACTOR,
        {
            "startUrls": [{"url": url}],
            "maxResults": 1,
            "maxResultsShorts": 0,
            "maxResultStreams": 0,
        },
        "metadata",
    )
    if not meta_items:
        raise ValueError(f"No metadata returned for video: {video_id}")
    meta = meta_items[0]

    # 2. Transcript via transcript scraper
    transcript = ""
    transcript_segments = []
    try:
        tr_items = _run_apify_actor(
            TRANSCRIPT_ACTOR,
            {"videoUrl": url, "targetLanguage": "en"},
            "transcript",
        )
        if tr_items and tr_items[0].get("data"):
            for seg in tr_items[0]["data"]:
                text = seg.get("text", "").strip()
                if not text:
                    continue
                transcript_segments.append({
                    "text": text,
                    "start": round(float(seg.get("start", 0)), 2),
                    "duration": round(float(seg.get("dur", 0)), 2),
                })
            transcript = " ".join(s["text"] for s in transcript_segments)
    except Exception as e:
        print(f"[youtube] transcript fetch failed: {e}")

    if not transcript:
        raise ValueError(f"No transcript available for video: {video_id}")

    # hashtags
    raw_tags = meta.get("hashtags") or []
    hashtags = [t if t.startswith("#") else f"#{t}" for t in raw_tags]

    return VideoData(
        video_id=video_id,
        url=url,
        title=meta.get("title", ""),
        creator=meta.get("channelName", ""),
        transcript=transcript,
        transcript_segments=transcript_segments,
        views=int(meta.get("viewCount") or 0),
        likes=int(meta.get("likes") or 0),
        comments=int(meta.get("commentsCount") or 0),
        hashtags=hashtags,
        upload_date=meta.get("date", ""),
        duration_seconds=_parse_duration(meta.get("duration", "")),
        follower_count=int(meta.get("numberOfSubscribers") or 0),
        thumbnail_url=meta.get("thumbnailUrl", ""),
    )
