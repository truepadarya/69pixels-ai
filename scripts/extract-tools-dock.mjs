import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const output = new URL("../src/assets/graphics/tools-dock/", import.meta.url);
await mkdir(output, { recursive: true });
const mask = Buffer.from(
  `<svg width="225" height="225" xmlns="http://www.w3.org/2000/svg"><path fill="white" d="M70 0H155C203 0 225 22 225 70V155C225 203 203 225 155 225H70C22 225 0 203 0 155V70C0 22 22 0 70 0Z"/></svg>`,
);
for (const [name, left] of [
  ["finder", 67],
  ["69", 362],
  ["settings", 655],
]) {
  await sharp(
    new URL(
      "../src/assets/graphics/work-ai-tools-dock.png",
      import.meta.url,
    ).pathname.replace(/^\/([A-Z]:)/, "$1"),
  )
    .extract({ left, top: 73, width: 225, height: 225 })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(
      new URL(`${name}.png`, output).pathname.replace(/^\/([A-Z]:)/, "$1"),
    );
}
