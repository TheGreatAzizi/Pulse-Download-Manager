<p align="center">
  <img src="resources/icon.png" width="104" height="104" alt="Pulse Download Manager icon">
</p>

<h1 align="center">Pulse Download Manager</h1>

<p align="center">
  <b>A fast, local-first download manager for Windows and Linux.</b><br>
  Direct links, YouTube and 1000+ sites, HLS/DASH streams, BitTorrent, multi-network downloads and a Chrome/Edge extension.
</p>

<p align="center">
  <a href="https://github.com/TheGreatAzizi/Pulse-Download-Manager/releases"><img src="https://img.shields.io/github/v/release/TheGreatAzizi/Pulse-Download-Manager?style=for-the-badge&amp;label=release&amp;color=2563eb" alt="Latest release"></a>
  <a href="https://github.com/TheGreatAzizi/Pulse-Download-Manager/releases"><img src="https://img.shields.io/github/downloads/TheGreatAzizi/Pulse-Download-Manager/total?style=for-the-badge&amp;label=downloads&amp;color=2563eb" alt="Total downloads"></a>
  <a href="https://github.com/TheGreatAzizi/Pulse-Download-Manager/stargazers"><img src="https://img.shields.io/github/stars/TheGreatAzizi/Pulse-Download-Manager?style=for-the-badge&amp;label=stars&amp;color=2563eb" alt="Stars"></a>
  <a href="https://github.com/TheGreatAzizi/Pulse-Download-Manager/forks"><img src="https://img.shields.io/github/forks/TheGreatAzizi/Pulse-Download-Manager?style=for-the-badge&amp;label=forks&amp;color=2563eb" alt="Forks"></a>
  <a href="https://github.com/TheGreatAzizi/Pulse-Download-Manager"><img src="https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2Fgithub.com%2FTheGreatAzizi%2FPulse-Download-Manager&amp;label=repo%20views&amp;countColor=%232563eb&amp;style=for-the-badge" alt="Repo views"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-2563eb?style=for-the-badge" alt="License: GPL-3.0-or-later"></a>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#screenshots">Screenshots</a> |
  <a href="#download">Download</a> |
  <a href="#browser-extension">Browser extension</a> |
  <a href="#multi-network-downloads">Multi-network</a> |
  <a href="#hls-and-dash-streams">HLS/DASH</a> |
  <a href="#proxy-support">Proxy</a> |
  <a href="#support-the-project">Support</a> |
  <a href="#development">Development</a> |
  <a href="#troubleshooting">Troubleshooting</a>
</p>

## Overview

Pulse is a desktop download manager built with Electron, React and TypeScript. It combines a multi-connection HTTP engine, yt-dlp for video and audio, HLS/DASH manifest downloads, and a BitTorrent client in one clean interface.

The app is local-first. Settings, task history and downloaded files stay on your machine. Pulse runs on Windows and Linux, ships in English, Persian (RTL), Japanese and Russian, and includes light and dark themes.

## Features

| Area | Highlights |
| --- | --- |
| HTTP downloads | Multi-connection engine, resume, named queues with schedules, global speed limit, expired link recovery, batch links |
| Multi-network | Optional round-robin distribution of direct HTTP connections across selected Wi-Fi, Ethernet and other adapters |
| Video and audio | yt-dlp integration, 1000+ supported sites, quality selection, audio extraction, subtitles, thumbnails, playlists |
| HLS and DASH | Manifest detection, stream analysis, quality selection, Referer and cookie forwarding, browser-captured streams |
| BitTorrent | Magnet links and `.torrent` files, file selection, secure resume, peer and seeder stats, upload ratio |
| Browser integration | Chrome/Edge extension, download takeover, history-safe startup, context menus, multi-link selection, stream capture, popup, `Alt+Shift+P` |
| GitHub | Repository search, source ZIPs, release assets, optional personal access token |
| Network | HTTP, HTTPS, SOCKS5 and SOCKS5H proxy support with optional authentication |
| Desktop experience | Four languages, Persian RTL, Vazirmatn, light and dark themes, notifications, tray, start minimized, pause all, bulk actions, in-app updates |
| Privacy | Local WebSocket bridge on `127.0.0.1`, pinned extension origin, no account required |

## Screenshots

| Main window | Dark theme |
| --- | --- |
| ![Pulse main window][main-light] | ![Pulse dark theme][main-dark] |

| Persian interface (RTL) | Add download |
| --- | --- |
| ![Persian interface][main-fa] | ![Add download dialog][add-download] |

| HLS/DASH download | GitHub browser |
| --- | --- |
| ![HLS and DASH download][add-download-vod] | ![GitHub browser][github-browser] |

| Settings | Multi-network adapters |
| --- | --- |
| ![Settings][settings-general] | ![Multi-network adapters][settings-multinetwork] |

### Browser extension

| Extension popup | Extension options |
| --- | --- |
| ![Browser extension popup][ext-popup] | ![Browser extension options][ext-options] |

<details>
<summary>More screenshots</summary>

| Proxy | Appearance |
| --- | --- |
| ![Proxy settings][settings-proxy] | ![Appearance settings][settings-appearance] |

| Browser integration | About |
| --- | --- |
| ![Browser integration][settings-browser] | ![About Pulse][settings-about] |

</details>

## Download

Get the latest files from the [Releases page](https://github.com/TheGreatAzizi/Pulse-Download-Manager/releases). Builds are produced by GitHub Actions for every release.

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `Pulse-Setup-*.exe` | Installer with Start Menu and desktop shortcuts, optional auto-start |
| Windows | `Pulse-Portable-*.exe` | Portable build, no installation required |
| Linux | `Pulse-*.AppImage` | Runs on most distributions, including Arch |
| Linux | `Pulse-*.deb` | Debian and Ubuntu package |
| Chrome/Edge | `Pulse-Chrome-Extension-*.zip` | Browser integration, load unpacked after extracting |

**Notes**

- Windows builds are currently unsigned. SmartScreen may show a warning; choose **More info → Run anyway**.
- On Linux, make the AppImage executable with `chmod +x Pulse-*.AppImage`.
- Arch and similar distributions: install `fuse2` for AppImage support (`sudo pacman -S fuse2`). If FUSE is unavailable, run `./Pulse-*.AppImage --appimage-extract-and-run`.
- `.deb` packages can be converted with `debtap`.

### Installation and auto-start

The Windows installer lets you choose the install directory, creates desktop and Start Menu shortcuts, and registers Pulse in Programs and Features. Pulse launches at system start by default. You can change this in **Settings → General → Launch Pulse when the system starts**. Portable builds do not enable auto-start.

## Getting started

1. Install Pulse for your platform and open it.
2. Choose a download folder in **Settings → General**.
3. Add your first download:
   - **Direct link:** choose **New download** or press `Ctrl+N`, paste the URL, then start.
   - **Video or audio:** paste a YouTube or supported site URL, then choose the quality or audio-only mode.
   - **HLS or DASH:** open the **HLS/DASH** tab and paste a `.m3u8` playlist or `.mpd` manifest.
   - **BitTorrent:** open a magnet link or a `.torrent` file.
   - **Browser:** enable browser integration and install the extension, then let Pulse take over downloads.
4. Use the sidebar to filter by status, source or category. Pause, resume, retry, open the folder, copy the link or remove tasks from the task row.

## Browser extension

Pulse ships a Manifest V3 extension for Chrome and Edge. It works like a classic download manager extension: it hands downloads to Pulse, adds right-click actions, captures media streams, and shows live progress from the popup. The popup and options page use the same light palette as the desktop app.

### What it does

- **Download takeover:** new Chrome/Edge downloads are cancelled in the browser and queued in Pulse with cookies, referrer and user agent. Takeover ignores completed or stale history entries when the browser restarts.
- **Context menus:** send a link, image, video or audio file, the current page, a text selection, or every link on a page.
- **Multi-link selection:** highlight one or more links or any text that contains links, right-click, and choose **Send selected links to Pulse**. The selection is collected from the page, so link text works without copying the destination URL.
- **Stream capture:** Pulse watches for `.m3u8` and `.mpd` requests and lists them in the popup. Choose a stream and send it to Pulse as an HLS/DASH download.
- **Popup:** connection status, current page, an **Add a link** field, captured streams, active downloads, and a takeover switch.
- **Shortcut:** `Alt+Shift+P` sends the current page.
- **Domain exclusions:** disable takeover for specific sites in the extension options.
- **Languages:** English, Persian, Japanese and Russian.

### Install

You can load the extension from the copy bundled with Pulse or from the release ZIP.

1. Open **Settings → Tools → Browser extension** in Pulse and turn on **Enable browser integration**. Pulse listens on `127.0.0.1` ports `19527` to `19530` and only accepts the Pulse extension origin.
2. Get the extension files:
   - **Bundled:** click **Open extension folder** or **Copy path** in Pulse.
   - **Release ZIP:** download `Pulse-Chrome-Extension-*.zip` from the [Releases page](https://github.com/TheGreatAzizi/Pulse-Download-Manager/releases) and extract it.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Turn on **Developer mode**, choose **Load unpacked**, and select the `extension` folder, or the extracted folder that contains `manifest.json`.
5. Pin the Pulse extension to the toolbar if you want quick access.
6. Open the popup and confirm that the status shows **Connected**.

The extension ID is fixed by the key in `extension/manifest.json`, so unpacked installs keep the same ID. After an app update, click **Reload** on `chrome://extensions` to pick up the new extension files.

### How it works

- Pulse runs a local WebSocket bridge on `127.0.0.1`, using the first free port from `19527` to `19530`.
- The bridge accepts only the Pulse extension origin, which is derived from the public key in the extension manifest.
- Cookies, referrer and user agent are forwarded only for the download you send to Pulse.
- Captured streams are stored per tab and cleared when the tab navigates or closes.
- Takeover can be paused from the popup or disabled per domain in the extension options.
- If Pulse is not running, the browser keeps the download.

## Multi-network downloads

On machines with more than one active network adapter, Pulse can spread direct HTTP connections across the adapters you choose.

1. Open **Settings → General**.
2. Turn on **Use multiple network adapters**.
3. Select two or more adapters and save.

The option requires at least two active adapters. It applies to direct HTTP downloads, not to BitTorrent or proxy traffic, and turns off automatically while a proxy is configured.

## HLS and DASH streams

Pulse can download HTTP Live Streaming (HLS) and MPEG-DASH video directly from a manifest.

- Paste a `.m3u8` playlist or `.mpd` manifest in **New download → HLS/DASH**.
- Pulse analyzes available streams with yt-dlp, then downloads the selected quality through yt-dlp and ffmpeg.
- Add a **Referer**, **User-Agent** or **Cookie** when a site requires them.
- Captured streams from the browser extension appear in the popup and can be sent to Pulse with one click.

HLS/DASH downloads require `yt-dlp` and `ffmpeg`. Pulse can install yt-dlp from **Settings → Tools** and detects ffmpeg from system paths or user data.

## Startup and bulk actions

- **Start minimized to tray:** enable **Settings → General → Start minimized to the tray at login** to keep Pulse out of the way when Windows or Linux starts it automatically. The tray icon still opens the main window.
- **Pause all:** use the **Pause all** button above the download list to stop every queued and active download at once. Paused downloads can be resumed individually.
- **Select multiple:** choose **Select** above the download list, tick any downloads, then pause, resume, move them to another queue or delete them together.
- **Download queues:** open **Manage queues** in the sidebar to add named queues, set daily time windows with overnight support, limit each queue's simultaneous downloads, and choose the queue used for new downloads. Quick presets cover nightly, work hours and weekend schedules, while each queue shows its local clock state, next transition and a live countdown. Boundaries are applied at the exact minute, with a one second fallback after sleep or clock changes.

## GitHub integration

Open **GitHub** in the sidebar to search public repositories, download a repository ZIP for the default branch or a tag, and fetch release assets directly into the download queue. Add a personal access token in **Settings → Tools → GitHub token** to raise the GitHub API limit from 60 to 5,000 requests per hour.

## Proxy support

Pulse can send its network traffic through an HTTP, HTTPS or SOCKS5 proxy. Open **Settings → Proxy**, enter the proxy address, and save. Leave the field empty for a direct connection.

| Scheme | Example | Notes |
| --- | --- | --- |
| HTTP | `http://127.0.0.1:8080` | Used when the address has no scheme |
| HTTPS | `https://proxy.example.com:8443` | Encrypted connection to the proxy itself |
| SOCKS5 | `socks5://127.0.0.1:1080` | Resolves host names locally |
| SOCKS5H | `socks5h://127.0.0.1:1080` | Resolves host names through the proxy |

Authentication is optional and can be embedded in the address:

```text
socks5://user:password@127.0.0.1:1080
```

Percent-encode special characters in the username or password, for example `@` becomes `%40`. `socks://` is accepted as an alias for `socks5://`. SOCKS4 is not supported.

The proxy applies to:

- Direct HTTP and HTTPS downloads, including segmented transfers and resume.
- YouTube, HLS/DASH and other yt-dlp downloads, plus the yt-dlp installer.
- GitHub API requests, repository downloads and release assets.
- Update checks and update downloads.

BitTorrent traffic, including peer connections and trackers, stays direct. Pulse does not change the system proxy or the Chromium session proxy.

## Notifications

Pulse can show a system notification when a download completes or fails. Turn on **Settings → General → Show a notification when a download finishes or fails**. Failed downloads include the task name and the error detail. Notifications are best effort and depend on support in the operating system.

## Support the project

Pulse is free and open source, and development continues in the maintainer's spare time. If Pulse saves you time, you can support the project through Daramet:

<p align="center">
  <a href="https://daramet.com/AziziWarmCorner"><img src="https://img.shields.io/badge/Support%20Pulse-Daramet-e11d48?style=for-the-badge" alt="Support Pulse on Daramet"></a>
</p>

Donations are optional. Starring the repository, reporting bugs and sharing Pulse with others also help the project grow.

## Development

### Requirements

- Node.js 20 or newer
- npm
- Windows or Linux
- Optional: `yt-dlp` and `ffmpeg` for video, audio and HLS/DASH downloads. Pulse can install yt-dlp from **Settings → Tools** and detects ffmpeg from system paths or user data.

### Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the app in development mode |
| `npm run typecheck` | Run TypeScript checks |
| `npm run build` | Build the production app |
| `npm start` | Run the built app |
| `npm run dist:win` | Build the Windows NSIS installer and portable build |
| `npm run dist:linux` | Build the Linux AppImage and `.deb` package |

Build output is written to `dist/`.

### Project structure

```text
src/
  main/       Electron main process: HTTP, YouTube, torrent engines, queue, persistence
  preload/    Secure window.pulse bridge
  renderer/   React and Tailwind UI
  shared/     Types and IPC contracts
extension/    Chrome/Edge extension (Manifest V3)
resources/    App icons and optional bundled binaries
docs/         Screenshots and documentation assets
.github/      CI and release workflows
```

### Local data

- Settings and task state are stored in Electron's `userData` directory as `pulse-state.json`.
- Unfinished HTTP downloads use `.pulse-part` and `.pulse-meta` sidecars.
- Proxy settings are stored in the same file. Embedded proxy credentials are saved as plain text.
- The global speed limit is available in **Settings → Bandwidth** or from the status bar.
- Optional binaries can be placed in `resources/bin/` (`yt-dlp` and `ffmpeg`) to bundle them with the app. Otherwise Pulse discovers them from system paths or user data.

## Troubleshooting

### YouTube bot detection

If YouTube asks you to confirm that you are not a bot:

1. Update `yt-dlp` in **Settings → Tools**.
2. Provide authentication:
   - **Browser cookies:** choose a logged-in browser.
   - **Cookies file:** load a `cookies.txt` exported with an extension such as "Get cookies.txt LOCALLY".
3. Re-analyze the link.

Keep `yt-dlp` newer than 2025.11 for JavaScript runtime support.

### Common issues

| Problem | Fix |
| --- | --- |
| Browser extension shows Offline | Start Pulse, enable browser integration, reload the extension, and check the port in **Settings → Tools**. |
| Chrome re-downloads old history | Reload the extension from `chrome://extensions` or `edge://extensions`. Takeover now ignores completed downloads and stale history entries. |
| Downloads stay in the browser | Turn on takeover in the popup, remove the site from domain exclusions, and make sure Pulse is running. |
| HLS/DASH analysis fails | Update yt-dlp, install ffmpeg, and add the required Referer, User-Agent or Cookie. |
| Multi-network is unavailable | Connect at least two active adapters, or disable the proxy, which takes priority over multi-network transfers. |
| AppImage does not start | Install `fuse2`, or run `./Pulse-*.AppImage --appimage-extract-and-run`. |
| SmartScreen warning on Windows | Builds are unsigned; choose **More info → Run anyway**. |
| Cookie database is locked | Close the browser before reading cookies, or use an exported `cookies.txt`. |
| Proxy downloads fail | Check the address, port and credentials in **Settings → Proxy**. Percent-encode special characters. SOCKS4 is not supported; use SOCKS5 or SOCKS5H. |
| Speed is lower than expected | Raise the connection count or remove the speed limit in **Settings → Bandwidth**. |

## Contributing

Contributions are welcome. Open an issue for bugs and feature requests, or submit a pull request.

Before opening a pull request:

- Run `npm run typecheck` and `npm run build`.
- Keep changes focused and describe the behavior you changed.
- When you add or change UI text, update all four locales in `src/renderer/src/i18n.ts` and `src/renderer/src/queueI18n.ts`, and the extension locales in `extension/_locales/`.

For security-sensitive reports, contact the maintainer privately instead of opening a public issue.

## Credits

Batch download support was inspired by [@mamfan](https://github.com/mamfan) and the original [pull request #8](https://github.com/TheGreatAzizi/Pulse-Download-Manager/pull/8). Thank you for the idea and the groundwork.

Pulse is built with [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [WebTorrent](https://webtorrent.io/) and [ws](https://github.com/websockets/ws).

## License

GNU General Public License v3.0 or later.

Copyright (C) 2026 TheGreatAzizi.

See [LICENSE](LICENSE) for the full text. Pulse is free software; you can redistribute it and modify it under the terms of the GPL-3.0.

The bundled [Vazirmatn](https://github.com/rastikerdar/vazirmatn) Persian font is copyright 2015 The Vazirmatn Project Authors and is licensed under the SIL Open Font License 1.1. Its license text is included at [src/renderer/src/assets/fonts/OFL.txt](src/renderer/src/assets/fonts/OFL.txt) and in packaged builds at `resources/licenses/Vazirmatn-OFL.txt`.

<p align="center">
  <sub>If Pulse saves you time, consider starring the repository or supporting development.</sub>
</p>

[main-light]: docs/screenshots/final/main-light.png
[main-dark]: docs/screenshots/final/main-dark.png
[main-fa]: docs/screenshots/final/main-fa.png
[add-download]: docs/screenshots/final/add-download-en.png
[add-download-vod]: docs/screenshots/final/add-download-vod.png
[github-browser]: docs/screenshots/final/github-browser.png
[settings-general]: docs/screenshots/final/settings-general-light.png
[settings-multinetwork]: docs/screenshots/final/settings-multinetwork.png
[settings-proxy]: docs/screenshots/final/settings-proxy-light.png
[settings-appearance]: docs/screenshots/final/settings-appearance-light.png
[settings-browser]: docs/screenshots/final/settings-browser-light.png
[settings-about]: docs/screenshots/final/settings-about-light.png
[ext-popup]: docs/screenshots/final/extension-popup.png
[ext-options]: docs/screenshots/final/extension-options.png
