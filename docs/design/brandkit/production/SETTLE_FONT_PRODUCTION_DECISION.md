# Settle font production decision

**Phase:** D4D0.6B2B1 · **Status:** production typography locked; app integration pending D4D0.7

## 1. Locked production decision

Direction A remains a calm contemporary grotesk: highly legible, financially credible, moderately warm, technically neutral, and balanced between commerce and infrastructure. The exact brand word is **Settle**.

**PRODUCTION PRIMARY:** Instrument Sans
**LICENSE:** SIL Open Font License 1.1 — externally verified
**PRODUCTION MODEL:** open-licensed primary + system fallback
**FALLBACK CONCEPT:** Instrument Sans, then appropriate system sans fallbacks
**TECHNICAL MONO:** `Consolas, "SFMono-Regular", monospace`

Instrument Sans is the approved production-family direction. This is a production strategy/specification lock, not typography exploration.

## 2. Authoritative external evidence

External authoritative review verified the official upstream project:

- **Project:** Instrument Sans
- **Exact upstream source:** https://github.com/Instrument/instrument-sans
- Instrument Sans is a variable sans-serif open-sourced for Google Fonts.
- The upstream repository contains `OFL.txt`.
- Google Fonts onboarding/source evidence establishes the family as an OFL Google Fonts family.
- The upstream evidence records support for tabular figures through OpenType `tnum` and variable font capabilities.

**LICENSE VERIFIED: SIL Open Font License 1.1**

Only the evidence above is recorded here. This document does not claim trademark clearance, legal advice, exclusive rights, or worldwide uniqueness.

## 3. Why this is the correct production strategy

1. It matches locked Direction A more faithfully than platform-dependent Segoe/Arial substitution.
2. Open-license evidence exists from the authoritative upstream project.
3. It improves cross-platform brand consistency.
4. Variable-family capability supports product typography flexibility.
5. Tabular figures support financial amounts and settlement tables.
6. It avoids dependence on proprietary Microsoft font redistribution.
7. It is compatible with a later self-hosted Next.js font implementation.
8. System fallbacks preserve resilience.

## 4. Packaging boundary

No font binary is packaged in B2B1. Do not download or add `.ttf`, `.otf`, `.woff`, or `.woff2` files, and do not add a package. If B2B2 requires local font files for asset generation, source them from the authoritative upstream or Google Fonts source, preserve the applicable OFL license notice, document provenance, perform checksum/source QA, and avoid proprietary Microsoft font files.

## 5. Wordmark policy

The exact brand word remains **Settle**. The production wordmark family is Instrument Sans. The horizontal SVG remains LIVE TEXT for now. Do not convert it to outlines, create proprietary font paths, redraw letters, alter tracking, change the locked 34px / 14px relationship, or alter I-0 geometry. Portable outlined-vector wordmark strategy remains a B2B2/export QA decision.

## 6. D4D0.7 application handoff

Application integration is pending D4D0.7. The preferred implementation path should be evaluated using the existing Next.js built-in `next/font` system. The exact import/API form must be verified against the installed Next.js version during D4D0.7; no unverified import name is hard-coded in B2B1.

The implementation goal is optimized font loading, self-hosted deployment behavior, no runtime third-party font request, predictable fallback, minimal layout shift, and CSS-variable integration where appropriate. D4D0.7 must verify `tnum` behavior during implementation, test fallback rendering and cross-platform output, and retain the technical mono strategy above.

**APP INTEGRATION:** Pending D4D0.7
**PACKAGING:** No font binary packaged in B2B1
**PORTABLE OUTLINED WORDMARK:** Pending B2B2/export decision
**SYSTEM STACK:** fallback, not primary identity