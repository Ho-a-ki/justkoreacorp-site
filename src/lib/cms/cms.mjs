// 관리자 페이지(/admin) 로그인과 GitHub 중계에서 함께 쓰는 것들. (repureum 과 같은 구조)
//
// 환경변수 (Netlify → Site configuration → Environment variables)
//   CMS_GITHUB_TOKEN     (필수) 이 레포의 Contents 읽기·쓰기만 허용한 fine-grained 토큰
//   CMS_PASSWORD         (필수) 관리자 비밀번호, 8자 이상
//   CMS_SESSION_SECRET   (선택) 세션 토큰 서명 키. 없으면 CMS_GITHUB_TOKEN 에서 만든다
//   CMS_DISCORD_WEBHOOK  인증번호를 보낼 Discord 웹훅 (없으면 DISCORD_WEBHOOK 사용)

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const REPO = 'Ho-a-ki/justkoreacorp-site';
// 테스트할 때만 CMS_BRANCH 로 다른 브랜치를 쓴다. 운영은 main.
export const BRANCH = process.env.CMS_BRANCH || import.meta.env?.CMS_BRANCH || 'main';
export const SESSION_HOURS = 12;

/** 운영자가 고칠 수 있는 경로. 이 밖의 파일은 저장을 거부한다. */
export const ALLOWED_PATHS = ['src/content/', 'src/data/stores.json', 'public/images/uploads/'];

export const isAllowedPath = (path) =>
  typeof path === 'string' &&
  !path.includes('..') &&
  !path.startsWith('/') &&
  ALLOWED_PATHS.some((allowed) => (allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed));

// 운영(Netlify)은 process.env, 개발 서버(astro dev)는 .env 를 읽은 import.meta.env
export const env = (name) => process.env[name] ?? import.meta.env?.[name] ?? '';

const sha256 = (value) => createHash('sha256').update(String(value)).digest();

/** 길이와 무관하게 일정한 시간으로 비교한다 */
export const safeEqual = (a, b) => timingSafeEqual(sha256(a), sha256(b));

/** 관리자 비밀번호는 환경변수 CMS_PASSWORD 로만 둔다 (코드에 기본값 없음). 없으면 로그인을 막는다 */
export function checkPassword(input) {
  const configured = env('CMS_PASSWORD');
  return configured.length >= 8 && safeEqual(input, configured);
}

/** 세션 서명 키. 따로 없으면 GitHub 토큰에서 만든다 (둘 다 서버에만 있는 비밀) */
export function sessionSecret() {
  const secret = env('CMS_SESSION_SECRET');
  if (secret.length >= 32) return secret;
  const githubToken = env('CMS_GITHUB_TOKEN');
  return githubToken ? createHmac('sha256', 'justkorea-cms-session').update(githubToken).digest('hex') : '';
}

export const randomId = () => randomBytes(16).toString('hex');

/** 세션 토큰: base64url(JSON).서명 */
export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyToken(token, secret) {
  if (!secret || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(mac, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/**
 * 로그인 시도 횟수·인증번호를 담는 저장소. Netlify Blobs 를 쓴다.
 * 로컬 테스트(CMS_LOCAL=1)에서만 메모리로 대신한다 — 운영에서 저장소가 없으면 로그인을 막는다.
 */
let memory;
export async function authStore() {
  if (env('CMS_LOCAL') === '1') {
    memory ??= new Map();
    return {
      get: async (key) => (memory.has(key) ? JSON.parse(memory.get(key)) : null),
      setJSON: async (key, value) => void memory.set(key, JSON.stringify(value)),
      delete: async (key) => void memory.delete(key),
    };
  }
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'cms-auth', consistency: 'strong' });
  return {
    get: (key) => store.get(key, { type: 'json' }),
    setJSON: (key, value) => store.setJSON(key, value),
    delete: (key) => store.delete(key),
  };
}

export async function notifyDiscord(embed) {
  const webhook = env('CMS_DISCORD_WEBHOOK') || env('DISCORD_WEBHOOK');
  if (env('CMS_LOCAL') === '1' && !webhook) {
    console.log('[discord]', JSON.stringify(embed));
    return true;
  }
  if (!webhook) return false;
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: '유스트코리아 관리자', allowed_mentions: { parse: [] }, embeds: [embed] }),
  });
  return response.ok;
}

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

/** IP 를 그대로 남기지 않고 앞부분만 보여 준다 */
export const maskIp = (ip = '') =>
  ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':…' : ip.split('.').slice(0, 2).join('.') + '.*.*';
