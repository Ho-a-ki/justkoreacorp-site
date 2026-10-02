// 관리자 화면 → GitHub API 중계 (/api/gh/*). 실제 처리는 src/lib/cms/github.mjs
import type { APIRoute } from 'astro';
import handler from '../../../lib/cms/github.mjs';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => handler(request);
