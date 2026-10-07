import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const routes = [
  "index.html",
  "about/index.html",
  "example-components/index.html",
  "hero-original/index.html",
  "404.html",
];
const astroBin = `node_modules/astro/${JSON.parse(readFileSync("node_modules/astro/package.json", "utf8")).bin.astro}`;
const meta = (html, name) => {
  const tag = [...html.matchAll(/<meta\b[^>]*>/g)]
    .map((match) => match[0])
    .find(
      (tag) =>
        tag.includes(`name="${name}"`) || tag.includes(`property="${name}"`),
    );
  return tag?.match(/content="([^"]*)"/)?.[1];
};

for (const [mode, origin] of [
  ["local", ""],
  ["public", "https://seo.example"],
]) {
  const out = `.tmp-seo-audit/${mode}`;
  const build = spawnSync(
    process.execPath,
    [astroBin, "build", "--outDir", out],
    {
      env: { ...process.env, SITE_URL: origin },
      encoding: "utf8",
      timeout: 120000,
    },
  );
  assert.equal(
    build.status,
    0,
    `${mode} build failed:\n${build.stdout}\n${build.stderr}`,
  );
  const titles = new Set();
  for (const [index, route] of routes.entries()) {
    const html = readFileSync(`${out}/${route}`, "utf8");
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    assert.ok(
      title?.includes("69pixels"),
      `${route}: title must use the brand`,
    );
    assert.ok(!titles.has(title), `${route}: duplicate title`);
    titles.add(title);
    assert.ok(
      meta(html, "description")?.length > 20,
      `${route}: missing description`,
    );
    assert.equal(
      (html.match(/<h1\b/g) ?? []).length,
      1,
      `${route}: must have one h1`,
    );
    assert.ok(html.includes('<html lang="en"'), `${route}: language missing`);
    assert.ok(
      !html.includes("preview.lumosframework.com"),
      `${route}: template origin remains`,
    );
    assert.equal(meta(html, "og:site_name"), "69pixels");
    assert.equal(
      meta(html, "og:image"),
      `${origin || "http://localhost:4321"}/og-image.jpg`,
    );
    assert.equal(meta(html, "og:image:width"), "1200");
    assert.equal(meta(html, "og:image:height"), "630");
    assert.ok(meta(html, "og:image:alt"));
    assert.ok(meta(html, "twitter:image:alt"));
    const indexable = mode === "public" && index === 0;
    assert.equal(
      Boolean(meta(html, "robots")?.includes("noindex")),
      !indexable,
      `${route}: wrong indexing policy`,
    );
    const canonical = html.match(
      /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/,
    )?.[1];
    assert.equal(
      canonical,
      indexable ? `${origin}/` : undefined,
      `${route}: wrong canonical`,
    );
    const schema = html.match(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1];
    assert.equal(
      Boolean(schema),
      indexable,
      `${route}: unexpected structured data`,
    );
    if (schema) {
      const graph = JSON.parse(schema)["@graph"];
      assert.deepEqual(
        graph.map((node) => node["@type"]),
        ["Organization", "WebSite", "WebPage"],
      );
      assert.equal(graph[0].name, "69pixels");
      assert.equal(graph[0].logo, `${origin}/brand-logo.png`);
      assert.ok(graph.every((node) => node.url.startsWith(origin)));
    }
  }
  const guide = readFileSync(`${out}/llms.txt`, "utf8");
  const homepage = readFileSync(`${out}/index.html`, "utf8");
  assert.ok(guide.startsWith("# 69pixels\n\n> "));
  assert.ok(
    !guide.includes("localhost") &&
      !guide.includes("preview.lumosframework.com"),
  );
  assert.ok(homepage.includes('href="/llms.txt"'));
  assert.ok(homepage.includes('rel="describedby"'));
  const links = [...guide.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (link.startsWith("mailto:") || link.includes("calendar.app.google"))
      continue;
    const url = new URL(link, origin || "http://localhost:4321");
    assert.equal(url.pathname, "/", `Unexpected agent guide page: ${link}`);
    if (url.hash)
      assert.ok(
        homepage.includes(`id="${url.hash.slice(1)}"`),
        `Broken agent guide anchor: ${link}`,
      );
    assert.ok(
      mode === "public" ? link.startsWith(origin) : link.startsWith("/"),
    );
  }
  console.log(
    `PASS ${mode}: llms.txt content, domain-aware links, section anchors and discovery`,
  );
  const robots = readFileSync(`${out}/robots.txt`, "utf8");
  if (mode === "public") {
    assert.ok(robots.includes(`Sitemap: ${origin}/sitemap-index.xml`));
    assert.ok(robots.includes("Allow: /"));
    const sitemap = readFileSync(`${out}/sitemap-0.xml`, "utf8");
    assert.deepEqual(
      [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
      [`${origin}/`],
    );
  } else {
    assert.ok(robots.includes("Disallow: /"));
    assert.ok(!robots.includes("Sitemap:"));
    assert.ok(!existsSync(`${out}/sitemap-index.xml`));
  }
  console.log(
    `PASS ${mode}: metadata, h1, social previews, canonical, indexing, schema, robots and sitemap (${routes.length} pages)`,
  );
}

const image = await sharp("public/og-image.jpg").metadata();
assert.equal(image.width, 1200);
assert.equal(image.height, 630);
assert.ok(existsSync("public/brand-logo.png"));
for (const origin of [
  "https://seo.example/path",
  "https://user:password@seo.example",
  "ftp://seo.example",
  "https://seo.example?tracking=true",
]) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./site.config.mjs')"],
    {
      env: { ...process.env, SITE_URL: origin },
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0, `Invalid SITE_URL was accepted: ${origin}`);
}
console.log("PASS social assets and SITE_URL validation");
