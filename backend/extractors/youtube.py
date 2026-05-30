from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import yt_dlp
import re


class VideoData(BaseModel):
    video_id: str
    url: str
    title: str
    creator: str
    transcript: str
    transcript_segments: list[dict] = []  # [{text, start, duration}] for time-aware chunking
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


def fetch_video_data(url: str) -> VideoData:
    video_id = _extract_video_id(url)

    try:
        ytt = YouTubeTranscriptApi()
        transcript_list = ytt.fetch(video_id)
        transcript = " ".join(entry.text for entry in transcript_list)
        transcript_segments = [
            {"text": entry.text, "start": round(entry.start, 2), "duration": round(entry.duration, 2)}
            for entry in transcript_list
        ]
    except TranscriptsDisabled:
        raise ValueError(f"Transcripts are disabled for video: {video_id}")
    except NoTranscriptFound:
        raise ValueError(f"No transcript found for video: {video_id}")
    transcript_segments = locals().get("transcript_segments", [])

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extract_flat": False,
    }

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
