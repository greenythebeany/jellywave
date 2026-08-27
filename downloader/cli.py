"""
JSON-lines CLI wrapper around downloader.py, meant to be spawned as a child
process from Electron's main process (see main.js's grab:start handler) --
each line of stdout is one JSON event the renderer can parse and react to
without scraping free-form log text.

Usage: python cli.py <url> <output_dir>
"""
import json
import sys

from downloader import download_and_convert, download_playlist, is_playlist_url, strip_ansi


def emit(event_type, **fields):
    print(json.dumps({"type": event_type, **fields}), flush=True)


def log(message):
    emit("log", message=message)


def main():
    if len(sys.argv) != 3:
        emit("error", message="Usage: cli.py <url> <output_dir>")
        sys.exit(1)

    url, output_dir = sys.argv[1], sys.argv[2]

    def on_progress(done, total):
        emit("progress", done=done, total=total)

    try:
        if is_playlist_url(url):
            results = download_playlist(url, output_dir, log=log, on_progress=on_progress)
            failed = [r for r in results if r[2]]
            emit("done", count=len(results), failedCount=len(failed))
        else:
            path = download_and_convert(url, output_dir, log=log)
            emit("done", count=1, failedCount=0, path=path)
    except Exception as e:
        emit("error", message=strip_ansi(str(e)))
        sys.exit(1)


if __name__ == "__main__":
    main()
