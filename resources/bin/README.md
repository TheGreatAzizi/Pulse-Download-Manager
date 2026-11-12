# Bundled binaries

Place optional executables here before packaging:

- `yt-dlp.exe` (Windows) / `yt-dlp` (Linux)
- `ffmpeg.exe` (Windows) / `ffmpeg` (Linux)

Pulse looks for them at runtime in this order:

1. The path configured in **Settings → Tools**
2. This folder (bundled with the app as `resources/bin`)
3. The system `PATH`
4. `python -m yt_dlp` (yt-dlp only)

You can also install `yt-dlp` automatically from **Settings → Tools**; it is saved to
the app's user-data folder and does not require this directory.
