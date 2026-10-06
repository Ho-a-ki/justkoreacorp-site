// 목록 화면용 작은 섬네일을 만든다: public/images/**/*.(jpg|png|webp) → public/_thumbs/images/**/*.webp (가로 640px)
// 원본은 그대로 두고 상세 화면에서만 쓴다. 빌드·개발 서버 시작 전에 돈다 (package.json).
// 이미 만든 섬네일은 원본이 더 새로울 때만 다시 만든다. public/_thumbs 는 git 에 올리지 않는다.
import { readdir, stat, mkdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import sharp from 'sharp';

const SRC = 'public/images';
const OUT = 'public/_thumbs/images';
const WIDTH = 640;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) yield path;
  }
}

const mtime = (path) => stat(path).then((s) => s.mtimeMs, () => 0);

let made = 0;
let skipped = 0;
for await (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  const out = join(OUT, rel.slice(0, -extname(rel).length) + '.webp');
  if ((await mtime(out)) >= (await mtime(src))) {
    skipped++;
    continue;
  }
  await mkdir(dirname(out), { recursive: true });
  try {
    await sharp(src).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 74 }).toFile(out);
    made++;
  } catch (error) {
    console.warn(`[thumbs] 건너뜀 ${src}: ${error.message}`);
  }
}
console.log(`[thumbs] 새로 만듦 ${made}, 그대로 ${skipped}`);
