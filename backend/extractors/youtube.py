import os
import json
import httpx
from pydantic import BaseModel
import yt_dlp
import re


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


def _extract_video_id(url: str) -> str:
    match = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    if not match:
        raise ValueError(f"Could not extract video ID from URL: {url}")
    return match.group(1)


def _parse_json3_transcript(data: dict) -> tuple[str, list[dict]]:
    """Parse YouTube's json3 subtitle format into transcript text and segments."""
    segments = []
    texts = []
    for event in data.get("events", []):
        segs = event.get("segs", [])
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if text and text != "\n":
            start = round(event.get("tStartMs", 0) / 1000, 2)
            duration = round(event.get("dDurationMs", 0) / 1000, 2)
            segments.append({"text": text, "start": start, "duration": duration})
            texts.append(text)
    return " ".join(texts), segments


def _fetch_transcript_via_ytdlp(info: dict, proxy_url: str | None) -> tuple[str, list[dict]]:
    """
    Extract transcript from yt-dlp info dict by fetching the json3 subtitle URL.
    Uses yt-dlp's own downloader to respect proxy settings.
    Tries automatic captions first, then manual subtitles.
    """
    ydl_opts = {"quiet": True}
    if proxy_url:
        ydl_opts["proxy"] = proxy_url

    for caption_key in ["automatic_captions", "subtitles"]:
        captions = info.get(caption_key, {})
        for lang in ["en", "en-US", "en-GB"]:
            if lang not in captions:
                continue
            for cap in captions[lang]:
                if cap.get("ext") == "json3":
                    try:
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            data = ydl.urlopen(cap["url"]).read()
                            return _parse_json3_transcript(json.loads(data))
                    except Exception:
                        continue

    raise ValueError("No English transcript found via yt-dlp")


def fetch_video_data(url: str) -> VideoData:
    video_id = _extract_video_id(url)
    proxy_url = os.environ.get("WEBSHARE_PROXY_URL")

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extract_flat": False,
    }
    if proxy_url:
        ydl_opts["proxy"] = proxy_url

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.ExtractorError as e:
        error_msg = str(e).lower()
        if "private" in error_msg:
            raise ValueError(f"Video is private and cannot be accessed: {video_id}")
        if "age" in error_msg or "age-restricted" in error_msg:
            raise ValueError(f"Video is age-restricted and cannot be accessed: {video_id}")
        raise ValueError(f"Failed to extract video metadata: {e}")
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e).lower()
        if "private" in error_msg:
            raise ValueError(f"Video is private and cannot be accessed: {video_id}")
        if "age" in error_msg or "age-restricted" in error_msg:
            raise ValueError(f"Video is age-restricted and cannot be accessed: {video_id}")
        raise ValueError(f"Failed to download video metadata: {e}")

    # Fetch transcript via yt-dlp caption URLs (avoids youtube-transcript-api IP blocks)
    try:
        transcript, transcript_segments = _fetch_transcript_via_ytdlp(info, proxy_url)
    except Exception as e:
        raise ValueError(f"Could not retrieve transcript: {e}")

    hashtags = [tag for tag in (info.get("tags") or []) if tag.startswith("#")]

    return VideoData(
        video_id=video_id,
        url=url,
        title=info.get("title", ""),
        creator=info.get("uploader", ""),
        transcript=transcript,
        transcript_segments=transcript_segments,
        views=info.get("view_count") or 0,
        likes=info.get("like_count") or 0,
        comments=info.get("comment_count") or 0,
        hashtags=hashtags,
        upload_date=info.get("upload_date", ""),
        duration_seconds=info.get("duration") or 0,
    )
