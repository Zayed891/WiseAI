import os
import tempfile
import httpx
from groq import Groq


def transcribe_from_url(video_url: str) -> str:
    """
    Downloads a video/audio file from a URL into a temp file,
    transcribes it using Groq Whisper large-v3, then deletes the temp file.
    Returns the transcript as a string.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set")

    # Download video into a temp file
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
        with httpx.stream("GET", video_url, follow_redirects=True, timeout=httpx.Timeout(connect=10, read=120, write=60, pool=10)) as r:
            if r.status_code != 200:
                raise ValueError(f"Failed to download video: HTTP {r.status_code}")
            for chunk in r.iter_bytes(chunk_size=8192):
                tmp.write(chunk)

    # Transcribe with Groq Whisper
    try:
        client = Groq(api_key=api_key)
        with open(tmp_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(tmp_path), audio_file),
                model="whisper-large-v3",
                response_format="text",
                language="en",
            )
        return transcription if isinstance(transcription, str) else transcription.text
    finally:
        # Always delete the temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
