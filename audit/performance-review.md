# Media performance review — 2026-10-07

The largest avoidable initial work came from loading 19 videos below the hero
and shipping a large rectangle-based SVG for the static silhouette.

## Changes

- `Video` defaults to loading within 400px of the viewport. Decorative videos
  play while visible and pause offscreen or when the document is hidden.
- Local MP4 display dimensions are recorded before rendering, so `auto` cards
  reserve their height without fetching metadata. Unknown intrinsic ratios still
  load metadata; `loading="eager"` is available for first-screen videos.
- Observation starts after layout scripts and fonts settle, avoiding downloads
  triggered by the initial positions of animated capability cards.
- The hero uses lossless WebP images. Its static silhouette is generated from
  the same alpha map as the animation's first frame; the original SVGs remain
  available as picture fallbacks.
- With reduced motion, the hero draws that static frame once and skips the
  lighting binary. Live preference changes restore the appropriate mode.
- Font preloads now target weights 400 and 500, including the hero heading.

## Measurements

Chrome, local Astro development server, cache disabled, no scrolling.
The totals below are browser resource `encodedBodySize` sums and include
development scripts. They are not production speed scores or Core Web Vitals.

| Viewport | Initial resource bytes before | After | Reduction |
| --- | ---: | ---: | ---: |
| Desktop, 1440px | 33,084,988 | 7,552,776 | 77% |
| Mobile, 390px | 28,600,018 | 7,320,660 | 74% |
| Mobile, reduced motion | 35,099,088 | 5,782,050 | 84% |

| Asset | Before | After |
| --- | ---: | ---: |
| Background | 696,974 bytes | 625,898 bytes |
| Desktop silhouette | 1,217,496 bytes | 13,548 bytes |
| Mobile silhouette | 3,525,358 bytes | 38,648 bytes |

On the initial desktop screen only one nearby video prefetches; all 19 no
longer download immediately. Reduced motion avoids the 1,502,064-byte mobile
lighting file entirely.

## Verification and maintenance

- Astro check and static build pass.
- Browser media checks pass against the development server and the built site:
  delayed downloads, visible playback, offscreen pause, stable card height,
  all 19 intrinsic ratios, and live reduced-motion preference changes.
- Responsive checks cover 320, 390, 768, 820, 1024 and 1440px.
- Gyroscope permission, fallback, landscape, desktop pointer and cleanup checks
  pass. The static mobile hero was visually compared with its original frame.
- Regenerate assets and dimensions after changing local videos or hero maps:
  `npm run optimize:media`.
- `npm run test:media` uses the existing Chrome CDP session on port 9223 and
  the dev server on 4321. Set `TEST_SITE_URL` to check another served build.
- Repeat snapshots with `node audit/performance-snapshot.mjs before` / `after`.

Production cache headers, compression and real Core Web Vitals should be
measured on the eventual hosting/domain. No domain has been selected yet.
