import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { rehypeImages } from './src/lib/images.mjs';

export default defineConfig({
  site: 'https://justkoreacorp.com',
  // 모든 페이지는 빌드할 때 정적으로 만든다. 문의 폼·관리자 로그인 API 만 Cloudflare Worker 로 돈다 (prerender = false).
  output: 'static',
  // 링크에 마우스를 올리면(모바일은 화면에 보이면) 다음 페이지를 미리 받아 둔다. 서버가 멀어도 이동이 빨라진다
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // 본문 이미지를 줄인 WebP 로 바꾸고 늦게 받는다 (scripts/thumbs.mjs 가 만든 파일)
  markdown: { rehypePlugins: [rehypeImages] },
  adapter: cloudflare({ imageService: 'passthrough', sessionKVBindingName: 'CMS_KV' }),
});
