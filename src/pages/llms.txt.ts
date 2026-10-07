import type { APIRoute } from "astro";
import guide from "@/data/agent-guide.md?raw";
import { SITE_URL, SITE_IS_PUBLIC } from "@/consts.ts";

export const GET: APIRoute = () => {
  const content = SITE_IS_PUBLIC
    ? guide.replace(
        /\]\((\/[^\s)]*)\)/g,
        (_, path: string) => `](${new URL(path, SITE_URL).href})`,
      )
    : guide;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
