import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const before = JSON.parse(
  readFileSync(".tmp-lumos-audit/before/metrics.json", "utf8"),
);
const after = JSON.parse(
  readFileSync(".tmp-lumos-audit/after/metrics.json", "utf8"),
);
const differences = [];
for (const baseline of before) {
  const current = after.find(
    (row) => row.path === baseline.path && row.width === baseline.width,
  );
  assert.ok(current, `Missing snapshot: ${baseline.path} ${baseline.width}`);
  assert.equal(
    current.overflow,
    false,
    `${baseline.path} ${baseline.width}: horizontal overflow`,
  );
  assert.deepEqual(
    current.missingAnchors,
    [],
    `${baseline.path}: broken anchors`,
  );
  assert.equal(
    current.elements.length,
    baseline.elements.length,
    `${baseline.path}: changed element count`,
  );
  const growth =
    baseline.path === "/404" && baseline.width === 390
      ? current.elements.find((e) => e.selector === "main").height -
        baseline.elements.find((e) => e.selector === "main").height
      : 0;
  assert.ok(
    growth >= 0 && growth < 64,
    "404 footer navigation change must stay within one row",
  );
  for (const [index, element] of baseline.elements.entries()) {
    const next = current.elements[index];
    for (const key of ["x", "y", "width", "height"]) {
      const offset =
        key === "height" && ["main", "main section"].includes(element.selector)
          ? growth
          : key === "y" &&
              (element.selector === "h1" ||
                (element.selector === ".button_wrap" &&
                  element.text === "Back to home"))
            ? growth / 2
            : 0;
      if (Math.abs(element[key] + offset - next[key]) > 1)
        differences.push({
          path: baseline.path,
          width: baseline.width,
          selector: element.selector,
          text: element.text,
          key,
          before: element[key],
          after: next[key],
        });
    }
    for (const key of ["fontSize", "fontWeight", "color", "background"]) {
      if (element[key] !== next[key])
        differences.push({
          path: baseline.path,
          width: baseline.width,
          selector: element.selector,
          text: element.text,
          key,
          before: element[key],
          after: next[key],
        });
    }
  }
}
console.log(JSON.stringify(differences, null, 2));
assert.equal(differences.length, 0, "Unexpected layout or appearance changes");
console.log(
  `PASS ${after.length} desktop/mobile route snapshots: geometry, typography and colors preserved`,
);
