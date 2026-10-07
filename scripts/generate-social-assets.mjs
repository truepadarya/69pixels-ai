import { writeFileSync } from "node:fs";
import sharp from "sharp";

const logo = await sharp("src/assets/logo/logo-pixel.png")
  .resize({ width: 240 })
  .png()
  .toBuffer();
const metadata = await sharp(logo).metadata();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="glow"><stop stop-color="#292929"/><stop offset="1" stop-color="#080808"/></radialGradient></defs>
  <rect width="1200" height="630" fill="#080808"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <image href="data:image/png;base64,${logo.toString("base64")}" x="480" y="55" width="240" height="${metadata.height}"/>
  <g fill="white" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" font-weight="600" font-size="100" letter-spacing="-5">
    <text x="600" y="282">From first</text><text x="600" y="387">idea to launch</text>
  </g>
  <g fill="#a0a0a0" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" font-size="25">
    <text x="600" y="472">Brand identities, websites and digital products</text>
    <text x="600" y="507">by AI-Native Senior Leads</text>
  </g>
</svg>`;
await sharp(Buffer.from(svg))
  .jpeg({ quality: 92 })
  .toFile("public/og-image.jpg");
await sharp("src/assets/logo/logo-pixel.png")
  .flatten({ background: "#080808" })
  .png()
  .toFile("public/brand-logo.png");
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#080808"/><text x="32" y="44" fill="white" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="36" letter-spacing="-3" text-anchor="middle">69</text></svg>`;
writeFileSync("public/favicon.svg", favicon);
const png = await sharp(Buffer.from(favicon)).resize(64, 64).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 64;
ico[7] = 64;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([ico, png]));
console.log(
  "Generated 1200×630 social image, brand logo and SVG/ICO favicons.",
);
