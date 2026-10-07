/** Page metadata accepted by `BaseHead` and by every layout that renders it. */
export interface SeoProps {
  /** Page title. Rendered as `{title} | {SITE_NAME}`; omit for `SITE_NAME` alone. */
  title?: string;
  /** Full page title, used verbatim for search and social previews. */
  titleOverride?: string;
  /** Meta description, also used for `og:description` and `twitter:description`. Defaults to `SITE_DESCRIPTION`. */
  description?: string;
  /** Social share image. Defaults to `/og-image.jpg`. Relative paths resolve against `site` in `astro.config.mjs`. */
  image?: string;
  /** Accessible description of the social share image. Defaults to `SITE_IMAGE_ALT`. */
  imageAlt?: string;
  /** Width of a custom social image, in pixels. Defaults to 1200 for the site image. */
  imageWidth?: number;
  /** Height of a custom social image, in pixels. Defaults to 630 for the site image. */
  imageHeight?: number;
  /** Open Graph type. Defaults to `website`; use `article` for posts and news pages. */
  type?: "website" | "article";
  /**
   * Set `robots: noindex, nofollow` for this page.
   *
   * Routes in `NOINDEX_ROUTES` and builds without a public `SITE_URL` always
   * remain noindex. Add permanently excluded pages to `NOINDEX_ROUTES` so the
   * sitemap and robots tag agree. This prop only affects the robots tag.
   */
  noindex?: boolean;
}
