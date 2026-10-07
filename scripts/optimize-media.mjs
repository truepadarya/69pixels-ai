import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import sharp from "sharp";

for (const name of ["background", "silhouette", "silhouette-mobile"]) {
  const source = `public/pointillist/${name}.${name === "background" ? "png" : "svg"}`;
  const output = `public/pointillist/${name}.webp`;
  let image;
  if (name === "background") image = sharp(source);
  else {
    const mobile = name.endsWith("-mobile");
    const buffer = readFileSync(
      `public/pointillist/relight${mobile ? "-mobile" : ""}.bin`,
    );
    const map = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / 4,
    );
    const width = 342;
    const height = mobile ? 366 : 206;
    const pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      pixels[i * 4 + 3] = Math.round(Math.max(0, Math.min(0.97, map[i])) * 255);
    }
    image = sharp(pixels, { raw: { width, height, channels: 4 } })
      .resize(width * 6, height * 6, { kernel: "nearest" })
      .extract({ left: 0, top: 0, width: 2048, height: mobile ? 2191 : 1231 });
  }
  await image.webp({ lossless: true, effort: 6 }).toFile(output);
  console.log(
    `${name}: ${statSync(source).size} → ${statSync(output).size} bytes`,
  );
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(`${dir}/${entry.name}`)
      : [`${dir}/${entry.name}`],
  );
const dimensions = {};
for (const file of walk("src/assets").filter((file) => file.endsWith(".mp4"))) {
  const data = readFileSync(file);
  let offset = 0;
  while ((offset = data.indexOf("tkhd", offset)) !== -1) {
    const end = offset - 4 + data.readUInt32BE(offset - 4);
    if (end <= data.length && end > offset + 8) {
      const width = data.readUInt32BE(end - 8) / 65536;
      const height = data.readUInt32BE(end - 4) / 65536;
      if (width > 0 && height > 0) {
        const name = file.split("/").at(-1);
        if (
          dimensions[name] &&
          JSON.stringify(dimensions[name]) !== JSON.stringify([width, height])
        )
          throw new Error(`Conflicting video filenames: ${name}`);
        dimensions[name] = [width, height];
        break;
      }
    }
    offset += 4;
  }
}
writeFileSync(
  "src/data/video-dimensions.json",
  `${JSON.stringify(dimensions, null, 2)}\n`,
);
console.log(
  `Recorded aspect ratios for ${Object.keys(dimensions).length} local videos.`,
);
