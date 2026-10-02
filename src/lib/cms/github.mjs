// CMS(/admin) → GitHub API 중계.
// 브라우저는 우리가 발급한 세션 토큰만 갖고, 진짜 GitHub 토큰(CMS_GITHUB_TOKEN)은 여기에만 있다.
// CMS 설정의 api_root 를 /api/gh 로 두면 Sveltia 는 다음 주소로 요청한다.
//   REST    /api/gh/api/v3/...   → https://api.github.com/...
//   GraphQL /api/gh/api/graphql  → https://api.github.com/graphql
//
// 허용 범위
//   - REST 는 읽기(GET/HEAD)만, 이 레포 아래 경로와 /user 만
//   - GraphQL 쓰기는 이 레포 main 브랜치에 createCommitOnBranch 한 가지만,
//     바뀌는 파일이 모두 ALLOWED_PATHS 안일 때만

import { BRANCH, REPO, env, isAllowedPath, json, sessionSecret, verifyToken } from './cms.mjs';


const GITHUB = 'https://api.github.com';
const REPO_PATH = `/repos/${REPO}`.toLowerCase();
const PASS_HEADERS = ['content-type', 'etag', 'link', 'last-modified', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];

/** CMS 화면에 보일 사용자. 실제 토큰 주인의 계정을 드러내지 않는다 */
const CMS_USER = {
  login: 'justkorea-admin',
  name: '유스트코리아 운영자',
  html_url: 'https://justkoreacorp.com',
  avatar_url: 'https://justkoreacorp.com/favicon.svg',
  email: null,
};

export default async (request) => {
  const secret = sessionSecret();
  const githubToken = env('CMS_GITHUB_TOKEN');
  if (!secret || !githubToken) return json({ message: 'CMS is not configured' }, 500);

  const auth = request.headers.get('authorization') ?? '';
  const session = verifyToken(auth.replace(/^(token|bearer)\s+/i, ''), secret);
  // GitHub 과 같은 모양의 401 을 돌려주면 CMS 가 다시 로그인하게 한다
  if (!session) return json({ message: 'Bad credentials' }, 401);

  const url = new URL(request.url);
  const sub = url.pathname.replace(/^\/api\/gh/, '');

  if (sub === '/api/graphql') return graphql(request, githubToken);

  if (sub.startsWith('/api/v3/')) {
    const path = sub.slice('/api/v3'.length);
    if (request.method !== 'GET' && request.method !== 'HEAD') return forbidden('read only');
    if (path === '/user') return json(CMS_USER);
    const lower = path.toLowerCase();
    if (lower !== REPO_PATH && !lower.startsWith(REPO_PATH + '/')) return forbidden('outside repository');
    return forward(`${GITHUB}${path}${url.search}`, request, githubToken);
  }

  return json({ message: 'Not Found' }, 404);
};

async function graphql(request, githubToken) {
  if (request.method !== 'POST') return forbidden('POST only');
  const text = await request.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ message: 'Problems parsing JSON' }, 400);
  }

  const query = String(body.query ?? '');
  if (/\bmutation\b/.test(query) || /\bsubscription\b/.test(query)) {
    const problem = checkMutation(query, body.variables);
    if (problem) return forbidden(problem);
  }
  return forward(`${GITHUB}/graphql`, request, githubToken, text);
}

/** 허용된 커밋이면 null, 아니면 거부 사유 */
function checkMutation(query, variables) {
  if (/\bsubscription\b/.test(query)) return 'subscriptions are not allowed';
  // GitHub 의 모든 mutation 은 input: 인자를 받는다. 호출되는 mutation 이 정확히 하나여야 한다
  const calls = [...query.matchAll(/([A-Za-z_]\w*)\s*\(\s*input\s*:/g)].map((m) => m[1]);
  if (calls.length !== 1 || calls[0] !== 'createCommitOnBranch') return 'only createCommitOnBranch is allowed';
  if (!/createCommitOnBranch\s*\(\s*input\s*:\s*\$input\s*\)/.test(query)) return 'input must be passed as $input';

  const input = variables?.input;
  if (!input || typeof input !== 'object') return 'missing input';
  if (String(input.branch?.repositoryNameWithOwner ?? '').toLowerCase() !== REPO.toLowerCase()) return 'wrong repository';
  if (input.branch?.branchName !== BRANCH) return 'wrong branch';

  const additions = input.fileChanges?.additions ?? [];
  const deletions = input.fileChanges?.deletions ?? [];
  if (!Array.isArray(additions) || !Array.isArray(deletions)) return 'invalid file changes';
  const denied = [...additions, ...deletions].map((f) => f?.path).find((path) => !isAllowedPath(path));
  if (denied !== undefined) return `path not allowed: ${denied}`;
  return null;
}

async function forward(target, request, githubToken, body) {
  const headers = {
    authorization: `Bearer ${githubToken}`,
    accept: request.headers.get('accept') ?? 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'justkorea-cms',
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const upstream = await fetch(target, { method: request.method, headers, body });

  const out = new Headers({ 'cache-control': 'no-store' });
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: out });
}

const forbidden = (reason) => json({ message: `Forbidden: ${reason}` }, 403);
