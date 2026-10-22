# Third-party software and references

- Tokscale 4.20.0, https://github.com/junhoyeo/tokscale, MIT. The unmodified Windows x64 CLI is distributed in vendor/tokscale.exe. It provides historical parsing, normalization, source discovery and aggregation. Its license is included alongside the binary.
- Electron 41.10.7, https://github.com/electron/electron, MIT with Chromium third-party notices. The desktop distribution includes LICENSE and LICENSES.chromium.html.
- Koffi 3.3.3, https://github.com/Koromix/koffi, MIT. Used for Windows z-order and rounded regions.
- zcode-tps, https://github.com/KDB-Wind/zcode-tps, MIT. Reference for output-token/request-duration statistics and the distinct decode window.
- Token Pulse, https://github.com/d-ridelman/token-pulse, MIT. Reference for completed-response speed from local Codex event boundaries and explicit timing fallbacks.
- CodexBar, https://github.com/steipete/CodexBar, MIT. Reference for the official Z.ai / BigModel quota endpoint and quota window meanings.

Token Glass does not modify these clients or their model responses. Its hooks return an empty JSON object and do not inject model context.

- Maple Mono CN v7.9, https://github.com/subframe7536/maple-font, SIL OFL 1.1. App-local subsets are renamed TokenGlass Maple; two static weights in TTF/WOFF2. Copyright and full license are in ui/fonts/OFL.txt. Only required UI glyphs are bundled; unknown dynamic characters fall back to Windows fonts.
- GitHub Copilot official icon, Primer Octicons, https://github.com/primer/octicons, MIT. Original SVG and rasterized theme variants in ui/assets; upstream MIT license included.
- Claude and OpenCode official product marks: see ui/assets/SOURCES.md. These brands identify data sources and are not Token Glass artwork.
