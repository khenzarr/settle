# Settle production brand QA checklist

## Current B2B1 gates

- [ ] Human review confirms source ownership and intended context.
- [ ] `settle-symbol-master.svg` has byte-equal I-0 `d` attributes, in order.
- [ ] `settle-symbol-small.svg` has byte-equal I-3 `d` attributes, in order.
- [ ] Every SVG parses as XML; viewBox is exactly `0 0 24 24` for symbol masters.
- [ ] No `script`, `foreignObject`, event handler, external href/CSS URL, image, data URL, base64, remote reference, embedded font, filter, clip, hidden layer, or unsafe transform exists.
- [ ] `currentColor` behavior is verified in light and dark contexts.
- [ ] No unexpected transforms or duplicate geometry drift exists; lockup transform is intentional and documented.
- [ ] I-3 routes only to 16–20px/favicon/tiny UI; I-0 routes to 24px+, header, deck, and social.
- [ ] Mark is flat, monochrome-capable, and legible on approved grounds.
- [ ] Clearspace and minimum-size rules are applied without ad hoc gap changes.
- [ ] Wordmark remains live text unless licensing and portability are verified.
- [ ] Instrument Sans provenance is recorded from the exact upstream source: https://github.com/Instrument/instrument-sans.
- [ ] The OFL-1.1 license notice is preserved if font files are later sourced for B2B2.
- [ ] Instrument Sans version/provenance record and source checksum are captured before any later local asset generation.
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

- [ ] 16/32/48 favicon raster dimensions and legibility checked.
- [ ] Apple 180, PWA 192/512 and maskable 512 exports checked.
- [ ] Maskable mark stays inside the adaptive safe zone.
- [ ] Favicon uses I-3; normal-size icon exports use I-0 as routed.
- [ ] OG/social safe areas and 1:1 / 1.91:1 compositions checked.
- [ ] Naming, MIME type, color profile, transparency, and metadata are deterministic.

## Misuse review

- [ ] No stretching, rotation, skew, outline, drop shadow, neon glow, arbitrary gradient, random piece colors, circle container, coin/blockchain motif, or Arc/Circle mark in a Settle lockup.
- [ ] I-0 is not reconstructed, turned into arrows, or used as a payout node pattern.
- [ ] Brand Accent is not used as a universal identity/CTA color.