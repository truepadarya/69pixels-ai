import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync("dist/index.html","utf8");
const tags = [...html.matchAll(/<img\b[^>]*class="rebuilding_(?:tools|experience)"[^>]*>/g)].map(m=>m[0]);
assert.equal(tags.length,2);
for(const tag of tags){
 assert.match(tag,/src="[^"]+\.webp"/,"Flying-card illustrations must use optimized WebP");
 assert.match(tag,/loading="eager"/);
 assert.match(tag,/fetchpriority="high"/);
 assert.match(tag,/srcset="/);
}
let largestTotal = 0;
for (const tag of tags) {
 const variants = tag.match(/srcset="([^"]+)"/)[1].split(",").map(part => part.trim().split(" ")[0]);
 largestTotal += Math.max(...variants.map(url => fs.statSync("dist/" + url.replace(/^\/69pixels-ai\//, "")).size));
}
assert.ok(largestTotal < 60000, "Flying-card images exceed the combined 60 KB budget");
console.log("PASS optimized responsive flying-card images load eagerly; largest combined payload: " + largestTotal + " bytes");
