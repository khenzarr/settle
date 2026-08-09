# Settle production brand QA checklist

## Status key

- **PASS:** automated or provenance evidence completed.
- **FAIL:** an explicit validation failure.
- **BLOCKED:** not honestly verifiable in this environment.
- **APPROVED — B2B2:** generated, machine-checked, and visually approved in the B2B2 human review.

## Current B2B1 gates

- [ ] Human review confirms source ownership and intended context.
- **PASS — automated:** `settle-symbol-master.svg` has byte-equal I-0 `d` attributes, in order.
- **PASS — automated:** `settle-symbol-small.svg` has byte-equal I-3 `d` attributes, in order.
- **PASS — automated:** every production SVG parses as XML; symbol master viewBoxes are `0 0 24 24`.
- [ ] No `script`, `foreignObject`, event handler, external href/CSS URL, image, data URL, base64, remote reference, embedded font, filter, clip, hidden layer, or unsafe transform exists.
- [ ] `currentColor` behavior is verified in light and dark contexts.
- [ ] No unexpected transforms or duplicate geometry drift exists; lockup transform is intentional and documented.
- [ ] I-3 routes only to 16–20px/favicon/tiny UI; I-0 routes to 24px+, header, deck, and social.
- [ ] Mark is flat, monochrome-capable, and legible on approved grounds.
- [ ] Clearspace and minimum-size rules are applied without ad hoc gap changes.
- [ ] Wordmark remains live text unless licensing and portability are verified.
- **PASS:** Instrument Sans provenance is recorded from the exact upstream source: https://github.com/Instrument/instrument-sans.
- **PASS:** verbatim OFL license text is preserved in `licenses/InstrumentSans-OFL.txt`.
- **PASS:** upstream commit, face filenames, SHA-256 values, axes/style, tools, and date are recorded before export review.
- [ ] No Microsoft proprietary font binary is downloaded, packaged, or redistributed.
- [ ] Font binaries/licenses are not packaged in B2B1; app integration is pending D4D0.7.
- [ ] `tnum` support is verified during D4D0.7 implementation.
- [ ] Instrument Sans fallback rendering, optimized loading, layout shift, and CSS-variable behavior are checked during D4D0.7.
- [ ] Cross-platform screenshot QA checks Instrument Sans and fallback rendering.
- [ ] Horizontal lockup wordmark geometry is not manually altered: complete I-0, 34px mark, 14px gap, live `Settle`, existing size/weight/tracking/alignment.

## Reproduction and accessibility

- [ ] Contrast is tested for each exact foreground/background, size, and weight; essential text is at least 4.5:1.
- [ ] Status uses text/icon as well as color; focus is at least 2px and separated.
- [ ] Full IDs/addresses remain available to assistive technology and copy actions.
- [ ] Amounts, percentages, and aligned tables use tabular numerals; required precision is retained.
- [ ] Complex/photo backgrounds receive an opaque safe field when flat contrast is not reliable.

## B2B2 export gates

- **PASS — automated; APPROVED — B2B2:** 16/32/48 favicon raster dimensions and output files exist.
- **PASS — automated; APPROVED — B2B2:** Apple 180, PWA 192/512, maskable 512, avatar 1024, OG 1200x630, and social 1200x675 outputs exist at exact dimensions.
- **PASS — documented; APPROVED — B2B2:** maskable mark uses a conservative 48% mark field, inside the central adaptive safe zone.
- **PASS — automated; APPROVED — B2B2:** favicon routing is I-3 at 16px and I-0 at 32/48px; normal-size icons use I-0.
- **PASS — automated; APPROVED — B2B2:** OG/social compositions have the required aspect ratios and restrained brand content.
- **PASS — automated; APPROVED — B2B2:** names, dimensions, hashes, and generation settings are recorded in the export manifest.

## B2B2 machine validation record

- **PASS:** all generated SVGs parse through PowerShell/.NET XML parsing.
- **PASS:** SVG safety scan finds no script, foreignObject, event handler, external href/CSS URL, image, data URL, base64, remote asset, or embedded font binary.
- **PASS:** outlined SVGs contain no `<text>` element and no font-family dependency.
- **PASS:** I-0 and I-3 ordered path equality checks pass against the authoritative exploration sources.
- **PASS:** SHA-256 values in `SETTLE_EXPORT_MANIFEST.md` match generated files.
- **APPROVED — B2B2:** native 16/20/24/32/48 small-size legibility, contrast on all approved fields, optical lockup matching, and contact-sheet review.
- **RELEASE-PACKAGING NOTE:** full ICC profile introspection was not available using the isolated raster toolchain. PNGs are standard RGB/RGBA sRGB-compatible outputs, and human review observed no visual color anomaly; deep ICC metadata verification remains outstanding and no ICC certification is claimed.

## Misuse review

- [ ] No stretching, rotation, skew, outline, drop shadow, neon glow, arbitrary gradient, random piece colors, circle container, coin/blockchain motif, or Arc/Circle mark in a Settle lockup.
- [ ] I-0 is not reconstructed, turned into arrows, or used as a payout node pattern.
- [ ] Brand Accent is not used as a universal identity/CTA color.