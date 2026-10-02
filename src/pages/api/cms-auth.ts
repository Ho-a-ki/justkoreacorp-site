// 관리자 로그인 창 (/api/cms-auth). 실제 처리는 src/lib/cms/auth.mjs
import type { APIRoute } from 'astro';
import handler from '../../lib/cms/auth.mjs';

export const prerender = false;

export const ALL: APIRoute = ({ request, clientAddress }) => handler(request, { ip: clientAddress });
