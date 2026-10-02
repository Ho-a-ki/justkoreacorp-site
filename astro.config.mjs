import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://justkoreacorp.com',
  // 모든 페이지는 빌드할 때 정적으로 만든다. 문의 폼·관리자 로그인 API 만 Netlify Function 으로 돈다 (prerender = false).
  output: 'static',
  adapter: netlify(),
});
