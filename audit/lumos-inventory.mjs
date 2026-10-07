import { readdirSync, readFileSync } from "node:fs";

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(`${dir}/${entry.name}`)
      : [`${dir}/${entry.name}`],
  );
const files = walk("src").filter((file) => /\.(astro|css|ts|mjs)$/.test(file));
const sources = new Map(
  files.map((file) => [file, readFileSync(file, "utf8")]),
);
const all = [...sources.values()].join("\n");
const occurrences = new Map();
for (const match of all.matchAll(/--[\w-]+/g)) {
  occurrences.set(match[0], (occurrences.get(match[0]) ?? 0) + 1);
}
const definitions = new Map();
for (const [file, source] of sources) {
  for (const match of source.matchAll(/(--[\w-]+)\s*:/g)) {
    if (!definitions.has(match[1])) definitions.set(match[1], new Set());
    definitions.get(match[1]).add(file);
  }
}
const findings = {
  unreferencedCandidates: [...definitions]
    .filter(([name]) => occurrences.get(name) === 1)
    .map(([name, files]) => ({ name, files: [...files] })),
  missingRender: [...sources]
    .filter(
      ([file, source]) =>
        file.includes("components/") &&
        file.endsWith(".astro") &&
        !/\brender\s*=\s*true\b/.test(source.split("---")[1] ?? ""),
    )
    .map(([file]) => file),
  slotChecks: [...sources]
    .filter(([, source]) => source.includes("Astro.slots.has"))
    .map(([file]) => file),
};
console.log(JSON.stringify(findings, null, 2));
process.exitCode = Object.values(findings).some((list) => list.length) ? 1 : 0;
