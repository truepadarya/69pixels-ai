import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ffmpeg = process.env.FFMPEG_PATH || fileURLToPath(new URL('../.astro/media-tools/package/ffmpeg.exe', import.meta.url));
const clips = [
  'visuals_girl-and-horse.mp4',
  'visuals_package.mp4',
  'visuals_premium-card.mp4',
  'visuals_mockup.mp4',
];
const output = 'src/assets/graphics/cases/private-work-preview.mp4';
const poster = 'src/assets/graphics/cases/private-work-preview-poster.webp';
const run = args => {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg exited with ${result.status}`);
};
const inputs = clips.flatMap(clip => ['-stream_loop', '-1', '-t', '4', '-i', `src/assets/graphics/second/${clip}`]);
const filters = clips.map((_, i) =>
  `[${i}:v]fps=24,scale=320:240:force_original_aspect_ratio=increase,crop=320:240,setsar=1,gblur=sigma=16:steps=3,eq=brightness=-0.06:saturation=0.75,scale=960:720:flags=bicubic,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`
);
filters.push(`${clips.map((_, i) => `[v${i}]`).join('')}concat=n=${clips.length}:v=1:a=0[out]`);
run([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-movflags', '+faststart', output]);
run(['-ss', '0.5', '-i', output, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', poster]);
console.log(`Created ${output} and ${poster}`);
