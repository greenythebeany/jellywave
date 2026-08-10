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


_BORDER_TOLERANCE = 24   # per RGB channel; JPEG/WebP compression adds noise even to flat color
_BORDER_SAMPLE_STEP = 4  # sample every Nth row/column instead of all of them, for speed
_BORDER_MATCH_FRACTION = 0.95  # how much of a row/column must match to still count as border


def _detect_pillarbox_crop(image_path: str):
    """Return a PIL crop box (left, top, right, bottom) if the image looks
    like a square cover padded with a solid-color border into a wider
    frame, else None.

    Samples the actual corner color and scans inward looking for where
    that color stops, rather than assuming padding is black-ish the way
    ffmpeg's cropdetect filter does -- padding shows up in every color
    (dark red, olive, navy, ...) and a fixed black-detection threshold
    misses most of them, which is exactly what happened before this.
    """
    from PIL import Image

    with Image.open(image_path) as img:
        img = img.convert("RGB")
        w, h = img.size
        px = img.load()

        corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
        ref = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

        def matches(color):
            return all(abs(color[i] - ref[i]) <= _BORDER_TOLERANCE for i in range(3))

        def column_is_border(x):
            ys = range(0, h, _BORDER_SAMPLE_STEP)
            hits = sum(1 for y in ys if matches(px[x, y]))
            return hits / len(ys) >= _BORDER_MATCH_FRACTION

        def row_is_border(y):
            xs = range(0, w, _BORDER_SAMPLE_STEP)
            hits = sum(1 for x in xs if matches(px[x, y]))
            return hits / len(xs) >= _BORDER_MATCH_FRACTION

        left = 0
        while left < w // 2 and column_is_border(left):
            left += 1
        right = w - 1
        while right > w // 2 and column_is_border(right):
            right -= 1
        top = 0
        while top < h // 2 and row_is_border(top):
            top += 1
        bottom = h - 1
        while bottom > h // 2 and row_is_border(bottom):
            bottom -= 1

        crop_w, crop_h = right - left + 1, bottom - top + 1
        if crop_w <= 0 or crop_h <= 0:
            return None

        area_ratio = (crop_w * crop_h) / (w * h)
        if not (0.4 <= area_ratio < 0.95):
            return None
        # Specifically hunting for square album art padded into a wider
        # frame -- require the result to actually look square-ish, so a
        # real photo that happens to have uniform-colored edges doesn't
        # get cropped into some arbitrary non-square shape.
        aspect = crop_w / crop_h
        if not (0.8 <= aspect <= 1.25):
            return None

        return left, top, right + 1, bottom + 1


class _CropPillarboxedThumbnailPP(yt_dlp.postprocessor.PostProcessor):
    """Many "official" music uploads on YouTube pad a square album cover
    with a solid color border to fill out a 16:9 thumbnail frame. Detect
    and strip that padding before EmbedThumbnail runs, so the embedded
    art is the clean square cover instead of a padded one.

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
        from PIL import Image

        box = _detect_pillarbox_crop(image_path)
        if box is None:
            return

        with Image.open(image_path) as img:
            fmt = img.format
            cropped = img.crop(box)
            # Re-save under the exact same path/format the original was in
            # -- guarantees the extension and the actual file content stay
            # in sync (a mismatch there, from an earlier ffmpeg-based
            # version of this, broke yt-dlp's later thumbnail-format
            # conversion step for EmbedThumbnail).
            save_kwargs = {"quality": 95} if fmt == "JPEG" else {}
            if fmt == "JPEG":
                cropped = cropped.convert("RGB")
            cropped.save(image_path, format=fmt, **save_kwargs)

        self._log("Cropped pillarboxed cover art to the actual square artwork")


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
