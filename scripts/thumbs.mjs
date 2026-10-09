// public/images 의 사진을 화면 크기에 맞춘 WebP 로 줄여 둔다. 원본은 그대로 둔다.
//   sm  public/_thumbs/images/**     가로 640px  — 목록 카드
//   lg  public/_thumbs/lg/images/**  가로 1280px — 상세 본문·큰 사진 (움직이는 GIF 는 960px 움직이는 WebP)
//   xl  public/_thumbs/xl/images/**  가로 1920px — 첫 화면 배경(images/hero)만
// 빌드·개발 서버 시작 전에 돈다 (package.json). 원본이 더 새로울 때만 다시 만든다.
// public/_thumbs 는 git 에 올리지 않는다. 경로 규칙은 src/lib/images.mjs 와 같아야 한다.
import { readdir, stat, mkdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import sharp from 'sharp';

const SRC = 'public/images';
const SIZES = [
  { dir: 'public/_thumbs/images', width: 640, quality: 74 },
  { dir: 'public/_thumbs/lg/images', width: 1280, quality: 78, gif: { width: 960, quality: 60 } },
  { dir: 'public/_thumbs/xl/images', width: 1920, quality: 66, only: /^hero[\\/]/ },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(jpe?g|png|webp|gif)$/i.test(entry.name)) yield path;
  }
}

const mtime = (path) => stat(path).then((s) => s.mtimeMs, () => 0);

let made = 0;
let skipped = 0;
for await (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  const isGif = /\.gif$/i.test(rel);
  for (const size of SIZES) {
    if (size.only && !size.only.test(rel)) continue;
    const out = join(size.dir, rel.slice(0, -extname(rel).length) + '.webp');
    if ((await mtime(out)) >= (await mtime(src))) {
      skipped++;
      continue;
    }
    const { width, quality } = isGif && size.gif ? size.gif : size;
    await mkdir(dirname(out), { recursive: true });
    try {
      await sharp(src, { animated: isGif })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toFile(out);
      made++;
    } catch (error) {
      console.warn(`[thumbs] 건너뜀 ${src}: ${error.message}`);
    }
  }
}
console.log(`[thumbs] 새로 만듦 ${made}, 그대로 ${skipped}`);
