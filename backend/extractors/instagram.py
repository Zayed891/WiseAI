import os
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


def fetch_video_data(url: str) -> VideoData:
    api_key = os.environ.get("RAPIDAPI_KEY")
    if not api_key:
        raise ValueError("RAPIDAPI_KEY environment variable is not set")

    headers = {
        "x-rapidapi-host": "instagram-scraper-stable-api.p.rapidapi.com",
        "x-rapidapi-key": api_key,
        "Content-Type": "application/json",
    }

    params = {
        "reel_post_code_or_url": url,
        "type": "reel",
    }

    response = httpx.get(
        "https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data.php",
        headers=headers,
        params=params,
        timeout=30,
    )

    if response.status_code == 404:
        raise ValueError(f"Instagram reel not found: {url}")
    if response.status_code == 403:
        raise ValueError(f"Access denied — reel may be private or restricted: {url}")
    if response.status_code != 200:
        raise ValueError(f"RapidAPI request failed with status {response.status_code}: {response.text}")

    item = response.json()

    # video_id
    video_id = item.get("shortcode") or item.get("id") or ""

    # creator
    creator = (item.get("owner") or {}).get("username") or ""

    # title / caption — nested under edge_media_to_caption.edges[0].node.text
    edges = (item.get("edge_media_to_caption") or {}).get("edges") or []
    title = edges[0]["node"]["text"] if edges else (item.get("title") or "")

    # upload_date from caption node or taken_at
    upload_date = ""
    if edges:
        upload_date = edges[0]["node"].get("created_at", "")

    # likes
    raw_likes = item.get("edge_media_preview_like", {}).get("count") or item.get("like_count")
    likes_hidden = item.get("like_and_view_counts_disabled", False) or raw_likes is None
    likes = 0 if likes_hidden else int(raw_likes)

    # views
    views = int(item.get("video_view_count") or item.get("video_play_count") or 0)

    # comments
    comments = int(
        (item.get("edge_media_to_parent_comment") or {}).get("count")
        or item.get("comment_count")
        or 0
    )

    # duration
    duration_seconds = int(item.get("video_duration") or 0)

    # hashtags — parse from caption
    hashtags = [word for word in title.split() if word.startswith("#")]

    # transcript via Groq Whisper
    transcript = ""
    video_url = item.get("video_url")
    if video_url:
        try:
            transcript = transcribe_from_url(video_url)
        except Exception as e:
            print(f"[instagram] transcription failed: {e}")

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
        likes_hidden=likes_hidden,
    )
