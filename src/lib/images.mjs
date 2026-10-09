// scripts/thumbs.mjs 가 만든 작은 WebP 를 찾아 쓴다. 아직 없으면 원본을 그대로 쓴다.
// 빌드할 때(Node)만 돈다. astro.config.mjs 의 마크다운 처리에서도 쓴다.
import { existsSync } from 'node:fs';

const PREFIX = { sm: '/_thumbs', lg: '/_thumbs/lg', xl: '/_thumbs/xl' };
const WIDTH = { sm: 640, lg: 1280, xl: 1920 };

const decode = (src) => {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
};

/** '/images/a.jpg' → '/_thumbs/lg/images/a.webp' (파일이 있을 때만) */
export function variant(src, size = 'sm') {
  if (typeof src !== 'string' || !src.startsWith('/images/')) return undefined;
  const path = PREFIX[size] + decode(src).replace(/\.[^./]+$/, '.webp');
  return existsSync('public' + path) ? encodeURI(path) : undefined;
}

/** 목록 카드용 섬네일. 없으면 원본 */
export const thumbOf = (src) => variant(src, 'sm') ?? src;

/**
 * <img> 에 넣을 src·srcset. 브라우저가 화면 폭에 맞는 크기를 고른다.
 * sizes 는 이미지가 화면에서 차지하는 폭.
 */
export function responsive(src, sizes = '100vw', steps = ['sm', 'lg']) {
  const found = steps.map((s) => [variant(src, s), WIDTH[s]]).filter(([v]) => v);
  if (found.length === 0) return { src };
  return {
    src: found[found.length - 1][0],
    srcset: found.length > 1 ? found.map(([v, w]) => `${v} ${w}w`).join(', ') : undefined,
    sizes: found.length > 1 ? sizes : undefined,
  };
}

/** 마크다운 본문의 이미지: 줄인 WebP 로 바꾸고, 화면에 가까워질 때 받는다 */
export function rehypeImages() {
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'img') {
      const original = node.properties?.src;
      // 움직이는 GIF 는 lg(960px 움직이는 WebP) 하나만 만든다
      const steps = /\.gif$/i.test(original ?? '') ? ['lg'] : ['sm', 'lg'];
      const { src, srcset, sizes } = responsive(original, '(min-width: 760px) 704px, 100vw', steps);
      node.properties.src = src;
      if (srcset) {
        node.properties.srcSet = srcset;
        node.properties.sizes = sizes;
      }
      node.properties.loading ??= 'lazy';
      node.properties.decoding ??= 'async';
    }
    node.children?.forEach(walk);
  };
  return walk;
}
