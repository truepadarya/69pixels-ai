/** Site name. Appended to every page title and used as `og:site_name`. */
export const SITE_NAME = "69pixels";
/** Fallback meta description for pages that don't set their own. */
export const SITE_DESCRIPTION =
  "69pixels is a creative studio for brands, websites, digital products and campaigns. Senior creators use AI throughout the work.";
/** Canonical origin. Resolves canonical URLs, social images, and the sitemap. */
export { SITE_URL, SITE_IS_PUBLIC } from "../site.config.mjs";
/** Default image and accessible description for social previews. */
export const SITE_IMAGE = "/og-image.jpg";
export const SITE_IMAGE_ALT =
  "69pixels — From first idea to launch. Brand identities, websites and digital products.";
/** BCP 47 locale tag used to format dates and numbers. */
export const SITE_LOCALE = "en-US";
/**
 * Routes kept out of search results. Each is excluded from the sitemap and
 * served with a `robots: noindex, nofollow` tag, so the two can't disagree.
 *
 * Surrounding slashes are optional: `"/thanks"`, `"thanks"` and `"/thanks/"`
 * all match the same route.
 */
export const NOINDEX_ROUTES: string[] = [
  "/404",
  "/about",
  "/example-components",
  "/hero-original",
];
