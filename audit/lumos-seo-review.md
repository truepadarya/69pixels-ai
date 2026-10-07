# Lumos and SEO review — 2026-10-07

Reviewed all five routes, shared layout/head, component APIs, global CSS tokens, custom components and responsive layouts. The working tree already contained substantial site changes; these were preserved.

## Lumos changes

- Connected the existing button weight token to the button component without changing its computed weight. Removed the unused motion easing token.
- Centralized repeated colors in the palette and replaced literal CSS font weights with the existing typography tokens. Unique illustration colors remain local.
- Replaced CSS pixel lengths in visually hidden controls with rem.
- Added missing `render` controls to the cursor, pricing, credits and head components; empty heading lines no longer render an empty ScrollLetters section.
- Extracted the preloader's styles and behavior from BaseLayout into PagePreloader, including its fallback for disabled JavaScript.
- Namespaced the experience graphic and cursor classes. Moved custom component media queries under their component root; `:where(&)` keeps descendant specificity unchanged.
- ContentWorkAi now owns its Grid breakpoints rather than depending on the nested Grid's column props.
- Corrected the props audit to inspect only types reachable from `Props`, avoiding false findings on internal animation/media data. Public prop names were preserved. Button's union declarations were reviewed manually; its render prop and defaults are correct.
- Replaced the shared footer's template catalogue link with the Work anchor.

The design tokens for framework variants are retained even when only demonstration pages currently exercise them. Graphic coordinates, video/image intrinsic dimensions and animation frame data are not CSS pixel lengths and remain unchanged. The wide marquee breakpoint (93.75rem) adjusts the artwork composition beyond the site's normal content width.

## SEO changes

- Replaced Lumos branding and fallback description with 69pixels, and assigned distinct page titles/descriptions.
- Added one domain setting, `SITE_URL`, read from the environment or `.env`. The domain has not been chosen. Empty/local configuration keeps all pages noindex, robots disallows crawling, and no sitemap or public structured data is emitted.
- With a public HTTPS origin, the homepage has an absolute normalized canonical, Organization/WebSite/WebPage JSON-LD, OG locale, image dimensions and accessible OG/Twitter image descriptions.
- `/about` is currently a card preview, `/example-components` a component catalogue and `/hero-original` an alternative hero preview. These and 404 remain noindex and outside the sitemap in both modes. No demo page was deleted or turned into a new marketing page.
- Replaced the template social image with a 1200×630 69pixels card; added the brand logo asset and matching SVG/ICO favicons.
- Both `/404` and `/404.html` are covered by the same exclusion rule. Existing URLs with or without a trailing slash continue to work.

## Verification

- `npm run audit:lumos`: no prop findings, unreferenced variable candidates, missing render defaults or direct Astro.slots.has checks.
- `npm run check`: zero errors, warnings or hints.
- `npm run test:seo`: separate local and public builds; all five pages checked for title, description, one h1, social tags, canonical, robots policy and JSON-LD. Sitemap has only the homepage in public mode. Invalid origin settings are rejected.
- Desktop/mobile comparisons at 1440 and 390: main-page geometry, typography and colors preserved, no horizontal overflow or missing anchors. The shorter footer navigation removes a wrapped row on mobile 404, which increases its flexible main area and shifts centered content by half that difference.
- Responsive regression checks at 320, 390, 768, 820, 1024 and 1440: layouts, reduced motion and input focus pass.
- Preloader checks: content is released with JavaScript enabled and the overlay is hidden when JavaScript is disabled.

## When the domain is selected

Copy `.env.example` to `.env`, set `SITE_URL=https://your-final-domain`, and run `npm run build`. On the deployed domain, verify redirects, HTTPS and actual 404 status, then submit `/sitemap-index.xml` in Google Search Console. Search Console ownership and hosting redirect rules require the final domain/account and have not been configured locally.

References: [Lumos conventions](../LUMOS.md), [Astro styling](https://docs.astro.build/en/guides/styling/), [Astro routing](https://docs.astro.build/en/guides/routing/), [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Google Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization).
