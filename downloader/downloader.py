"""
Core download/convert logic: pulls audio from a YouTube (or YouTube Music)
video, playlist, or album (content you own) and converts it to MP3.

Uses yt-dlp rather than pytube: pytube parses playlist/page data by
scraping YouTube's embedded JSON, which breaks every time YouTube tweaks
that structure (this is why playlists could silently report "0 videos").
yt-dlp is actively maintained specifically to track those changes.
"""
import os
import re
import subprocess

import yt_dlp

FFMPEG_LOCATION = None  # set to a full path if ffmpeg isn't on PATH

# Exported via a browser extension (e.g. "Get cookies.txt LOCALLY"), not read
# live from the browser -- avoids the cookie-database-lock errors you get
# from reading a running Chromium browser's profile directly.
COOKIES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")


def normalize_url(url: str) -> str:
    """YouTube Music shares youtube.com's video/playlist IDs; rewrite
    music.youtube.com links to the regular domain for consistency."""
    return url.replace("music.youtube.com", "www.youtube.com")


def is_playlist_url(url: str) -> bool:
    return "list=" in url or "/sets/" in url  # /sets/ = a SoundCloud playlist/album


def to_playlist_url(url: str) -> str:
    """Canonicalize a YouTube URL to /playlist?list=... . A "watch" URL that
    also carries list= (e.g. from "Play all" on a YT Music album) makes
    yt-dlp's flat-playlist extraction return a shallow reference instead of
    expanding the entries, so always extract via the plain form. Only
    applies to YouTube -- SoundCloud's /sets/ URLs already work as-is and
    don't share this bug."""
    if "youtube.com" not in url:
        return url
    match = re.search(r"[?&]list=([^&]+)", url)
    if not match:
        return url
    return f"https://www.youtube.com/playlist?list={match.group(1)}"


def safe_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    return name.strip() or "untitled"


def clean_playlist_title(title: str) -> str:
    """YouTube Music auto-names album/playlist pages like "Album - Foo" or
    "Playlist - Foo"; strip that label so folders are just named "Foo"."""
    match = re.match(r"^(?:Album|Playlist|EP|Single)\s*[-:]\s*(.+)$", title, re.IGNORECASE)
    return match.group(1).strip() if match else title


class _PreferReleaseDatePP(yt_dlp.postprocessor.PostProcessor):
    """yt-dlp's FFmpegMetadata postprocessor always tags files with
    upload_date (when the video hit YouTube), ignoring release_date /
    release_year (when the track actually came out) even when both are
    known. Overwrite upload_date with the real release date first."""

    def run(self, info):
        release_date = info.get("release_date")
        release_year = info.get("release_year")
        if release_date:
            info["upload_date"] = release_date
        elif release_year:
            info["upload_date"] = f"{release_year}0101"
        return [], info


class _NormalizeArtistSeparatorPP(yt_dlp.postprocessor.PostProcessor):
    """yt-dlp's FFmpegMetadata postprocessor joins a multi-artist "artists"
    list with ", " into the embedded artist tag (e.g. "A, B"). Jellyfin (and
    most library scanners) split multiple artists on ";", not ",", so a
    comma-joined tag gets read as one single artist literally named "A, B"
    instead of two separate artists whose tracks group correctly. Pre-join
    with ";" so the tag round-trips through Jellyfin's parser correctly."""

    def run(self, info):
        artists = info.get("artists")
        if isinstance(artists, list) and len(artists) > 1:
            info["artist"] = "; ".join(artists)
        return [], info


_CROPDETECT_LIMITS = (30, 35, 40, 45, 50, 55, 60)


def _detect_pillarbox_crop(image_path: str, ffmpeg: str):
    """Return (w, h, x, y) crop box if the image looks like a square
    cover padded with solid-color bars into a wider frame, else None.

    The padding color varies per upload (often a dark theme color, not
    pure black) and its detected luma shifts with image codec/compression
    (jpg vs webp versions of the "same" thumbnail need different
    thresholds), so cropdetect's default limit (~24) is unreliable. Sweep
    increasing thresholds and stop at the first that finds a plausible
    crop -- the smallest threshold that detects anything is the most
    conservative, least likely to eat into real artwork.
    """
    orig_w = orig_h = None
    for limit in _CROPDETECT_LIMITS:
        result = subprocess.run(
            [ffmpeg, "-i", image_path, "-vf", f"cropdetect=limit={limit}:round=2:skip=0", "-f", "null", "-"],
            capture_output=True, text=True, timeout=20,
        )

        if orig_w is None:
            size_match = re.search(r"Video:.*?(\d+)x(\d+)", result.stderr)
            if not size_match:
                return None
            orig_w, orig_h = int(size_match.group(1)), int(size_match.group(2))
            if not orig_w or not orig_h:
                return None

        crop_match = re.search(r"crop=(\d+):(\d+):(\d+):(\d+)", result.stderr)
        if not crop_match:
            continue
        crop_w, crop_h, crop_x, crop_y = (int(g) for g in crop_match.groups())
        area_ratio = (crop_w * crop_h) / (orig_w * orig_h)
        if 0.4 <= area_ratio < 0.95:
            return crop_w, crop_h, crop_x, crop_y

    return None


class _CropPillarboxedThumbnailPP(yt_dlp.postprocessor.PostProcessor):
    """Many "official" music uploads on YouTube pad a square album cover
    with solid color bars to fill out a 16:9 thumbnail frame. Detect and
    strip that padding before EmbedThumbnail runs, so the embedded art
    is the clean square cover instead of a pillarboxed one.

    Every step here is wrapped so a crop failure can only ever mean "skip
    the crop, embed the original thumbnail" -- it must never be able to
    break or block the rest of the download the way it did before (an
    earlier version left thumbnails unembedded entirely on some tracks).

    Takes `log` directly rather than using to_screen/self.to_screen: those
    route through yt-dlp's own logger, which "quiet": True in _base_opts
    silently swallows -- log is the callback that actually reaches the
    Import page's UI."""

    def __init__(self, log):
        super().__init__()
        self._log = log

    def run(self, info):
        for thumb in info.get("thumbnails", []):
            filepath = thumb.get("filepath")
            if not filepath or not os.path.exists(filepath):
                continue
            try:
                self._crop(filepath)
            except Exception as exc:
                self._log(f"Skipping pillarbox crop ({exc})")
        return [], info

    def _crop(self, image_path: str) -> None:
        ffmpeg = FFMPEG_LOCATION or "ffmpeg"
        box = _detect_pillarbox_crop(image_path, ffmpeg)
        if box is None:
            return
        w, h, x, y = box

        # Keep the output in the same format as the input (ffmpeg infers
        # format from the output extension) -- writing e.g. jpeg bytes into
        # a ".webp"-named path desyncs the filename from its content, which
        # broke yt-dlp's later webp->png conversion step for EmbedThumbnail.
        ext = os.path.splitext(image_path)[1]
        cropped_path = image_path + f".cropped{ext}"
        try:
            result = subprocess.run(
                [ffmpeg, "-y", "-i", image_path, "-vf", f"crop={w}:{h}:{x}:{y}", cropped_path],
                capture_output=True, timeout=20,
            )
            if result.returncode == 0 and os.path.getsize(cropped_path) > 0:
                os.replace(cropped_path, image_path)
                self._log("Cropped pillarboxed cover art to the actual square artwork")
        finally:
            if os.path.exists(cropped_path) and cropped_path != image_path:
                try:
                    os.remove(cropped_path)
                except OSError:
                    pass


class _QuietLogger:
    def __init__(self, log):
        self._log = log

    def debug(self, msg):
        pass

    def info(self, msg):
        pass

    def warning(self, msg):
        self._log(f"Warning: {msg}")

    def error(self, msg):
        self._log(f"Error: {msg}")


def _base_opts(output_dir: str, log) -> dict:
    opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            },
            {"key": "EmbedThumbnail"},
            {"key": "FFmpegMetadata"},
        ],
        "writethumbnail": True,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "logger": _QuietLogger(log),
        # Lets yt-dlp fetch its JS challenge-solver script (runs via Deno) --
        # required for YouTube's signature/format checks; disabled by
        # default since it's remote code, but needed for downloads to work.
        "remote_components": ["ejs:github"],
    }
    if FFMPEG_LOCATION:
        opts["ffmpeg_location"] = FFMPEG_LOCATION
    if os.path.isfile(COOKIES_FILE):
        opts["cookiefile"] = COOKIES_FILE
    return opts


def download_and_convert(url: str, output_dir: str, log=print, title: str = None) -> str:
    """Download one video's audio and convert to MP3. Returns the mp3 path."""
    os.makedirs(output_dir, exist_ok=True)
    normalized = normalize_url(url)

    with yt_dlp.YoutubeDL(_base_opts(output_dir, log)) as ydl:
        ydl.add_post_processor(_PreferReleaseDatePP(), when="pre_process")
        ydl.add_post_processor(_NormalizeArtistSeparatorPP(), when="pre_process")
        ydl.add_post_processor(_CropPillarboxedThumbnailPP(log), when="before_dl")
        if not title:
            preview = ydl.extract_info(normalized, download=False)
            title = preview.get("title", "audio")
        log(f"Downloading: {title}")

        info = ydl.extract_info(normalized, download=True)
        raw_path = ydl.prepare_filename(info)

    mp3_path = os.path.splitext(raw_path)[0] + ".mp3"
    log(f"Done: {os.path.basename(mp3_path)}")
    return mp3_path


def _list_playlist_entries(url: str):
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
    if os.path.isfile(COOKIES_FILE):
        opts["cookiefile"] = COOKIES_FILE
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    title = info.get("title") or "playlist"
    entries = [e for e in (info.get("entries") or []) if e]
    return title, entries


def download_playlist(url: str, output_dir: str, log=print, on_progress=None):
    """Download every video in a playlist/album into a subfolder named
    after it. on_progress(done, total) if given."""
    normalized = to_playlist_url(normalize_url(url))
    title, entries = _list_playlist_entries(normalized)
    title = clean_playlist_title(title)
    total = len(entries)
    log(f"Playlist: {title} ({total} videos)")

    playlist_dir = os.path.join(output_dir, safe_filename(title))
    os.makedirs(playlist_dir, exist_ok=True)

    results = []
    for i, entry in enumerate(entries, start=1):
        video_id = entry.get("id")
        video_url = entry.get("url") or f"https://www.youtube.com/watch?v={video_id}"
        try:
            path = download_and_convert(video_url, playlist_dir, log=log, title=entry.get("title"))
            results.append((video_url, path, None))
        except Exception as e:
            log(f"Failed ({video_url}): {e}")
            results.append((video_url, None, str(e)))
        if on_progress:
            on_progress(i, total)

    return results
