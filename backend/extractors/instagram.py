import os
import re
import time
import httpx
from pydantic import BaseModel
from extractors.transcriber import transcribe_from_url


class VideoData(BaseModel):
    video_id: str
    url: str
    title: str
    creator: str
    transcript: str
    views: int
    likes: int
    comments: int
    hashtags: list[str]
    upload_date: str
    duration_seconds: int
    likes_hidden: bool = False
    follower_count: int = 0
    thumbnail_url: str = ""


APIFY_ACTOR_ID = "apify~instagram-scraper"
APIFY_BASE = "https://api.apify.com/v2"


def _run_apify_actor(reel_url: str) -> dict:
    api_token = os.environ.get("APIFY_API_TOKEN")
    if not api_token:
        raise ValueError("APIFY_API_TOKEN environment variable is not set")

    params = {"token": api_token}

    run_input = {
        "directUrls": [reel_url],
        "resultsType": "posts",
        "resultsLimit": 1,
    }

    start_resp = httpx.post(
        f"{APIFY_BASE}/acts/{APIFY_ACTOR_ID}/runs",
        params=params,
        json=run_input,
        timeout=30,
    )

    if start_resp.status_code not in (200, 201):
        raise ValueError(f"Failed to start Apify actor: {start_resp.status_code} {start_resp.text}")

    run_id = start_resp.json()["data"]["id"]
    print(f"[instagram] Apify run started: {run_id}")

    # Poll until finished (max 120s)
    for _ in range(24):
        time.sleep(5)
        status_resp = httpx.get(
            f"{APIFY_BASE}/actor-runs/{run_id}",
            params=params,
            timeout=15,
        )
        status = status_resp.json()["data"]["status"]
        print(f"[instagram] Apify run status: {status}")

        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise ValueError(f"Apify actor run {status}: {run_id}")
    else:
        raise ValueError(f"Apify actor timed out after 120s: {run_id}")

    items_resp = httpx.get(
        f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items",
        params={**params, "format": "json"},
        timeout=15,
    )

    items = items_resp.json()
    if not items:
        raise ValueError(f"Apify returned no results for: {reel_url}")

    return items[0]


def _fetch_follower_count(username: str) -> int:
    api_token = os.environ.get("APIFY_API_TOKEN")
    if not api_token:
        return 0

    params = {"token": api_token}
    run_input = {
        "usernames": [username],
    }

    start_resp = httpx.post(
        f"{APIFY_BASE}/acts/apify~instagram-profile-scraper/runs",
        params=params,
        json=run_input,
        timeout=30,
    )

    if start_resp.status_code not in (200, 201):
        return 0

    run_id = start_resp.json()["data"]["id"]

    for _ in range(12):
        time.sleep(5)
        status = httpx.get(
            f"{APIFY_BASE}/actor-runs/{run_id}",
            params=params,
            timeout=15,
        ).json()["data"]["status"]
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            return 0

    items = httpx.get(
        f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items",
        params={**params, "format": "json"},
        timeout=15,
    ).json()

    if not items:
        return 0

    return int(items[0].get("followersCount") or items[0].get("edge_followed_by", {}).get("count", 0) or 0)


def fetch_video_data(url: str) -> VideoData:
    item = _run_apify_actor(url)

    # video_id from shortCode
    video_id = item.get("shortCode") or item.get("id") or ""

    # creator
    creator = item.get("ownerUsername") or item.get("ownerFullName") or ""

    # caption / title
    title = item.get("caption") or ""

    # likes — -1 means hidden by Instagram
    raw_likes = item.get("likesCount")
    likes_hidden = raw_likes is None or raw_likes < 0
    likes = 0 if likes_hidden else int(raw_likes)

    # views
    views = int(item.get("videoViewCount") or item.get("videoPlayCount") or 0)

    # comments
    comments = int(item.get("commentsCount") or 0)

    # duration
    duration_seconds = int(item.get("videoDuration") or 0)

    # upload date
    upload_date = item.get("timestamp") or ""

    # hashtags — returned as array without #, add it back
    raw_tags = item.get("hashtags") or []
    hashtags = [f"#{tag}" for tag in raw_tags]

    # thumbnail
    thumbnail_url = item.get("displayUrl") or item.get("thumbnailUrl") or ""

    # follower count — fetch from profile
    follower_count = 0
    if creator:
        try:
            follower_count = _fetch_follower_count(creator)
        except Exception as e:
            print(f"[instagram] follower count fetch failed: {e}")

    # transcript via Groq Whisper
    transcript = ""
    video_url = item.get("videoUrl")
    if video_url:
        try:
            transcript = transcribe_from_url(video_url)
        except Exception as e:
            print(f"[instagram] transcription failed: {e}")
    else:
        print("[instagram] no videoUrl returned — skipping transcription")

    return VideoData(
        video_id=video_id,
        url=url,
        title=title,
        creator=creator,
        transcript=transcript,
        views=views,
        likes=likes,
        comments=comments,
        hashtags=hashtags,
        upload_date=upload_date,
        duration_seconds=duration_seconds,
        follower_count=follower_count,
        likes_hidden=likes_hidden,
        thumbnail_url=thumbnail_url,
    )
