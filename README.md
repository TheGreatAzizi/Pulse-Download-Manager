# Pulse — Download Manager

A fast, professional cross-platform download manager for direct links, YouTube videos, and BitTorrent. Built with Electron, React and TypeScript.

[![GitHub](https://img.shields.io/badge/GitHub-TheGreatAzizi%2FPulse--Download--Manager-181717?logo=github)](https://github.com/TheGreatAzizi/Pulse-Download-Manager)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](https://github.com/TheGreatAzizi/Pulse-Download-Manager/blob/main/LICENSE)

## Downloads

Get the latest releases from the [Releases page](https://github.com/TheGreatAzizi/Pulse-Download-Manager/releases).

**Windows**
- `Pulse-Setup-*.exe` — NSIS installer with optional auto-start, desktop and Start Menu shortcuts
- `Pulse-Portable-*.exe` — portable build, no installation required

**Linux**
- `Pulse-*.AppImage` — runs on most distributions including Arch
- `Pulse-*.deb` — Debian/Ubuntu package

> Arch / similar distros: install `fuse2` for AppImage support `sudo pacman -S fuse2`. If FUSE is unavailable, run `./Pulse-*.AppImage --appimage-extract-and-run`. `.deb` can be converted with `debtap`.

### Installation and Auto-start

The Windows installer allows choosing the install directory, creates desktop and Start Menu shortcuts, and registers Pulse in Programs and Features. After install, Pulse launches at system start by default. Toggle this in **Settings → General → Launch Pulse when the system starts**. Portable builds do not enable auto-start.

## Features

- **Multi-connection HTTP downloads** — Range requests, resume on disconnect, smart queue, speed limit
- **YouTube & 1000+ sites** via `yt-dlp` — quality selection, audio extraction, subtitles, thumbnails, playlists
- **BitTorrent** — magnet and .torrent files, file selection, secure resume, peer/seeder stats, upload ratio
- **GitHub browser** — search public repositories, download source ZIPs, release assets and archives. Optional GitHub token raises API limits
- **Multilingual UI** — English, Persian RTL, Japanese, Russian; Light/Dark theme
- **Built-in tools** — automatic `yt-dlp` installer, `ffmpeg` detection, torrent engine management
- **Auto-start** — optional launch on Windows login and Linux autostart
- **Clipboard monitor** — suggests adding copied links

## GitHub Integration

Open **GitHub** in the sidebar to search public repositories, download ZIP archives of default branches or tags, and fetch release assets directly into the download queue. Add a personal access token in **Settings → Tools → GitHub token** to increase API rate limits from 60 to 5,000 requests/hour.

## Development

```bash
npm install
npm run dev        # development mode
npm run typecheck  # type check
npm run build      # production build
npm start          # run built app
```

Build distributions:

```bash
npm run dist:win   # Windows NSIS + Portable
npm run dist:linux # AppImage + deb
```

Output is written to `dist/`.

Optional binaries can be placed in `resources/bin/` — `yt-dlp` and `ffmpeg` — to be bundled with the app. Otherwise Pulse discovers them from system paths or user data.

## YouTube bot detection

If YouTube returns “Sign in to confirm you’re not a bot”:

1. Update `yt-dlp` in **Settings → Tools**
2. Provide authentication:
   - Browser cookies: choose a logged-in browser
   - Cookies file: load a `cookies.txt` exported with an extension such as “Get cookies.txt LOCALLY”
3. Re-analyze the link

Keep `yt-dlp` newer than 2025.11 for JavaScript runtime support.

## Project Structure

```
src/
  main/       Electron main process: HTTP, YouTube, torrent engines, queue, persistence
  preload/    Secure window.pulse bridge
  renderer/   React + Tailwind UI
  shared/     Types and IPC contracts
resources/bin/  Optional bundled binaries
```

- State is persisted in `userData/pulse-state.json`
- Unfinished HTTP downloads use `.pulse-part` and `.pulse-meta` sidecars
- Global speed limit is configurable in **Settings → Speed** or the status bar

## Contributing

Repository: [github.com/TheGreatAzizi/Pulse-Download-Manager](https://github.com/TheGreatAzizi/Pulse-Download-Manager)

Report bugs and request features via [Issues](https://github.com/TheGreatAzizi/Pulse-Download-Manager/issues). Pull requests are welcome.

## License

GNU General Public License v3.0 or later

Copyright (C) 2026 TheGreatAzizi

See [LICENSE](LICENSE) for full text. Pulse is free software; you may redistribute and modify it under GPL-3.0 terms.
