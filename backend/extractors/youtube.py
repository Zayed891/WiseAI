import os
import base64
import tempfile
import binascii
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


def _write_cookies_file() -> str | None:
    """
    Writes cookies to a temp file and returns its path. Returns None if unset.
    Accepts either:
      - YOUTUBE_COOKIES_B64: base64-encoded cookies.txt (preferred for cloud env vars)
      - YOUTUBE_COOKIES: raw Netscape cookie text
    """
    cookies = None

    b64 = os.environ.get("YOUTUBE_COOKIES_B64")
    if b64:
        try:
            cookies = base64.b64decode(b64).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError):
            cookies = None

    if not cookies:
        cookies = os.environ.get("YOUTUBE_COOKIES")

    if not cookies:
        return None

    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
    tmp.write(cookies)
    tmp.close()
    return tmp.name


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


def _fetch_transcript_via_ytdlp(info: dict) -> tuple[str, list[dict]]:
    """
    Extract transcript by fetching the json3 subtitle URL via httpx.
    Caption (timedtext) URLs are signed CDN links and usually accessible.
    Tries automatic captions first, then manual subtitles.
    """
    for caption_key in ["automatic_captions", "subtitles"]:
        captions = info.get(caption_key, {})
        for lang in ["en", "en-US", "en-GB"]:
            if lang not in captions:
                continue
            for cap in captions[lang]:
                if cap.get("ext") == "json3":
                    try:
                        resp = httpx.get(cap["url"], timeout=30, follow_redirects=True)
                        if resp.status_code == 200:
                            return _parse_json3_transcript(resp.json())
                    except Exception:
                        continue

    raise ValueError("No English transcript found via yt-dlp")


def fetch_video_data(url: str) -> VideoData:
    video_id = _extract_video_id(url)
    cookies_file = _write_cookies_file()

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extract_flat": False,
        "ignore_no_formats_error": True,
    }
    if cookies_file:
        ydl_opts["cookiefile"] = cookies_file

    try:
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
            if "sign in" in error_msg or "bot" in error_msg:
                raise ValueError("YouTube blocked the request (bot detection). Cookies may have expired.")
            raise ValueError(f"Failed to download video metadata: {e}")

        try:
            transcript, transcript_segments = _fetch_transcript_via_ytdlp(info)
        except Exception as e:
            raise ValueError(f"Could not retrieve transcript: {e}")
    finally:
        if cookies_file and os.path.exists(cookies_file):
            os.remove(cookies_file)

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
