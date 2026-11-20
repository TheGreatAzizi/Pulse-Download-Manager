<p align="center">
  <img src="resources/icon.png" width="104" height="104" alt="Pulse Download Manager icon">
</p>

<h1 align="center">Pulse Download Manager</h1>

<p align="center">
  <b>A fast, local-first download manager for Windows and Linux.</b><br>
  Direct links, YouTube and 1000+ sites, BitTorrent, and a Chrome/Edge extension.
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
  <a href="#proxy-support">Proxy</a> |
  <a href="#notifications">Notifications</a> |
  <a href="#development">Development</a> |
  <a href="#troubleshooting">Troubleshooting</a> |
  <a href="#contributing">Contributing</a>
</p>

## Overview

Pulse is a desktop download manager built with Electron, React and TypeScript. It combines a multi-connection HTTP engine, yt-dlp for video and audio, and a BitTorrent client in one clean interface.

The app is local-first: settings, task state and files stay on your machine. It ships in English, Persian (RTL), Japanese and Russian, with light and dark themes.

## Features

| Area | Highlights |
| --- | --- |
| HTTP downloads | Multi-connection engine, resume, smart queue, global speed limit, expired link recovery, batch links |
| Network | HTTP, HTTPS, SOCKS5 and SOCKS5H proxy support with optional authentication |
| Video and audio | yt-dlp integration, 1000+ supported sites, quality selection, audio extraction, subtitles, thumbnails, playlists |
| BitTorrent | Magnet links and `.torrent` files, file selection, secure resume, peer and seeder stats, upload ratio |
| Browser integration | Chrome/Edge extension, download takeover, context menus, multi-link selection, cookies/referrer/user agent forwarding, popup, `Alt+Shift+P` |
| GitHub | Repository search, source ZIPs, release assets, optional personal access token |
| Desktop experience | English, Persian (RTL), Japanese, Russian, light and dark themes, completion and failure notifications, auto-start, tray, in-app updates |
| Privacy | Local WebSocket bridge on `127.0.0.1`, pinned extension origin, no account required |

## Screenshots

| Main dashboard | Dark theme |
| --- | --- |
| ![Main dashboard][main-light] | ![Dark theme][main-dark] |

| Persian RTL | Add download |
| --- | --- |
| ![Persian RTL][main-fa] | ![Add download][add-download] |

| GitHub browser | Settings |
| --- | --- |
| ![GitHub browser][github-browser] | ![Settings][settings-general] |

### Extension preview

| Popup | Options |
| --- | --- |
| ![Browser extension popup][ext-popup] | ![Browser extension options][ext-options] |

<details>
<summary>More screenshots</summary>

| Browser extension settings | Software update |
| --- | --- |
| ![Browser extension settings][settings-browser] | ![Software update][update-available] |

| Resume with a new link | Empty state |
| --- | --- |
| ![Resume with a new link][resume-new-link] | ![Empty state][empty-paused] |

| About | Search and filters |
| --- | --- |
| ![About][settings-about] | ![Search and filters][search-filter] |

</details>

## Download

Get the latest files from the [Releases page](https://github.com/TheGreatAzizi/Pulse-Download-Manager/releases).

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
   - **BitTorrent:** open a magnet link or a `.torrent` file.
   - **Browser:** enable browser integration and install the extension, then let Pulse take over downloads.
4. Use the sidebar to filter by status, source or category. Pause, resume, retry, open the folder, copy the link or remove tasks from the task row.

## Browser extension

Pulse ships a Manifest V3 extension for Chrome and Edge. It works like a classic download manager extension: it hands downloads to Pulse, adds right-click actions, and shows live progress from the popup. The popup and options page use a light palette that matches the desktop app.

### What it does

- **Download takeover:** new Chrome/Edge downloads are cancelled in the browser and queued in Pulse with cookies, referrer and user agent.
- **Context menus:** send a link, image, video or audio file, the current page, a text selection, or every link on a page.
- **Multi-link selection:** highlight one or more links or any text that contains links, right-click, and choose **Send selected links to Pulse**. The selection is collected from the page, so link text works without copying the destination URL.
- **Popup:** connection status, current page, an **Add a link** field, active downloads, and a takeover switch.
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
- Takeover can be paused from the popup or disabled per domain in the extension options.
- If Pulse is not running, the browser keeps the download.

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
- YouTube and other yt-dlp downloads, plus the yt-dlp installer.
- GitHub API requests, repository downloads and release assets.
- Update checks and update downloads.

BitTorrent traffic, including peer connections and trackers, stays direct. Pulse does not change the system proxy or the Chromium session proxy.

## Notifications

Pulse can show a system notification when a download completes or fails. Turn on **Settings → General → Show a notification when a download finishes or fails**. Failed downloads include the task name and the error detail. Notifications are best effort and depend on support in the operating system.

## Development

### Requirements

- Node.js 20 or newer
- npm
- Windows or Linux
- Optional: `yt-dlp` and `ffmpeg` for video and audio downloads. Pulse can install yt-dlp from **Settings → Tools** and detects ffmpeg from system paths or user data.

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

```
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
| Downloads stay in the browser | Turn on takeover in the popup, remove the site from domain exclusions, and make sure Pulse is running. |
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
- When you add or change UI text, update all four locale files in `src/renderer/src/i18n.ts` and the extension locales in `extension/_locales/`.

For security-sensitive reports, contact the maintainer privately instead of opening a public issue.

## Credits

Batch download support was inspired by [@mamfan](https://github.com/mamfan) and the original [pull request #8](https://github.com/TheGreatAzizi/Pulse-Download-Manager/pull/8). Thank you for the idea and the groundwork.

Pulse is built with [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [WebTorrent](https://webtorrent.io/) and [ws](https://github.com/websockets/ws).

## License

GNU General Public License v3.0 or later.

Copyright (C) 2026 TheGreatAzizi.

See [LICENSE](LICENSE) for the full text. Pulse is free software; you can redistribute it and modify it under the terms of the GPL-3.0.

<p align="center">
  <sub>If Pulse saves you time, consider starring the repository. It helps the project grow.</sub>
</p>

[main-light]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/main-light.png
[main-dark]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/main-dark.png
[main-fa]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/main-fa.png
[add-download]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/add-download-en.png
[github-browser]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/github-browser.png
[settings-general]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/settings-general-light.png
[ext-popup]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/extension-popup.png
[ext-options]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/extension-options.png
[settings-browser]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/settings-browser-light.png
[update-available]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/update-available.png
[resume-new-link]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/resume-new-link.png
[empty-paused]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/empty-paused.png
[settings-about]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/settings-about-light.png
[search-filter]: https://raw.githubusercontent.com/TheGreatAzizi/Pulse-Download-Manager/main/docs/screenshots/final/search-filter.png
