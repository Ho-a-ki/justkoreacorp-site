import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://justkoreacorp.com',
  // 모든 페이지는 빌드할 때 정적으로 만든다. 문의 폼·관리자 로그인 API 만 Cloudflare Worker 로 돈다 (prerender = false).
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough', sessionKVBindingName: 'CMS_KV' }),
});
