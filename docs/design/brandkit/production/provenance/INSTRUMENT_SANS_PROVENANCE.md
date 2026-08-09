# Instrument Sans provenance

## B2B2 generation record

- **Upstream repository:** `https://github.com/Instrument/instrument-sans`
- **Upstream commit SHA:** `7fa22308a3d0c94ee2b3cd537a1196b65db34a3e`
- **Wordmark font filename:** `fonts/otf/InstrumentSans-SemiBold.otf`
- **Wordmark font SHA-256:** `2846d6247a7f1e4e9f5f33db16beee5158c0e21a880e393701c360be30d085fe`
- **Descriptor font filename:** `fonts/otf/InstrumentSans-Regular.otf`
- **Descriptor font SHA-256:** `33c8c755cba3cc84248b28d58f524deb150f5f9b55b27660270e643086a372fa`
- **License filename:** `InstrumentSans-OFL.txt`
- **License SHA-256:** `841742d77e5deeaf719ad3f9aaf17891abe4b827a49fc8e1b0558ee59a2b3195`
- **Font style/axes used:** SemiBold, weight 600, normal/100% width, upright/normal style; descriptor Regular, weight 400, normal/100% width, upright/normal style. No variable axes, stylistic sets, or tracking adjustments.
- **Wordmark weight:** 600 / SemiBold
- **Wordmark width:** normal
- **Generation tooling:** Node.js `v24.18.0`; `opentype.js@1.3.4` for glyph-to-path conversion; `sharp@0.33.5` for direct target-size raster rendering; `png-to-ico@2.1.8` for multi-image ICO assembly. `pngjs@7.0.0` and `svgson@5.3.1` were installed in the isolated workspace for inspection support. Google Chrome and FFmpeg `8.1` were available but not used to generate final assets.
- **Tooling workspace:** A temporary directory outside the Settle repository. Temporary font binaries and tooling dependencies were not copied into Settle.
- **Generation date:** `2026-08-09`
- **Font binary tracked:** No. No `.ttf`, `.otf`, `.woff`, or `.woff2` remains in the Settle production tree.
- **Legal boundary:** This record identifies the upstream source and preserves the exact upstream OFL text used for this generation. It does not claim trademark clearance and is not legal advice.

## Rendering decisions

- `Settle` uses the exact static SemiBold face, native kerning, normal width/style, and zero added tracking specified by the live-text horizontal source.
- The descriptor uses the exact static Regular face with native kerning and no custom glyph modification.
- Glyphs were converted directly from upstream font contours to fill-based SVG path data. No fallback font, stroke typography, manual redraw, custom cut, or width compression was used.
- Raster exports were rendered directly from generated/canonical SVG geometry at each requested target dimension; outputs were not repeatedly resampled.
