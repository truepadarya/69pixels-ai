import { loadEnv } from "vite";

const env = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  process.cwd(),
  "SITE_",
);
const configured = (process.env.SITE_URL ?? env.SITE_URL ?? "").trim();
const url = new URL(configured || "http://localhost:4321");

if (
  !["http:", "https:"].includes(url.protocol) ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
) {
  throw new Error(
    "SITE_URL must be an HTTP(S) origin without a path, credentials, query or fragment.",
  );
}

export const SITE_URL = url.origin;
export const SITE_IS_PUBLIC =
  Boolean(configured) &&
  url.protocol === "https:" &&
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
