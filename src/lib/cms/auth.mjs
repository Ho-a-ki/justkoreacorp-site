// 관리자 로그인: 비밀번호 → Discord 로 받은 6자리 인증번호 → 세션 토큰.
// CMS(/admin)가 띄우는 로그인 창이 이 주소를 연다. Decap·Sveltia 의 외부 로그인 창 규약을 따라
// 토큰을 window.opener 에 postMessage 로 넘긴다.

import { randomInt } from 'node:crypto';
import {
  SESSION_HOURS,
  authStore,
  checkPassword,
  env,
  json,
  maskIp,
  notifyDiscord,
  randomId,
  safeEqual,
  sessionSecret,
  signToken,
} from './cms.mjs';


const CODE_MINUTES = 5;
const CODE_TRIES = 5;
const IP_FAILS = 5; // IP 하나당 비밀번호 실패 허용 횟수
const IP_LOCK_MINUTES = 15;
const GLOBAL_FAILS = 30; // 전체 비밀번호 실패 허용 횟수 (시간당)

export default async (request, context) => {
  if (request.method === 'GET') {
    return new Response(PAGE, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex',
      },
    });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // GitHub 토큰이 없으면 로그인해도 불러오기·저장을 못 하고, 세션 키도 만들 수 없다
  if (!env('CMS_GITHUB_TOKEN')) return json({ error: 'github_not_configured' }, 500);
  const secret = sessionSecret();
  if (!secret) return json({ error: 'not_configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const store = await authStore();
  const ip = context?.ip ?? request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  const now = Date.now();

  if (body.step === 'password') {
    const ipKey = `ip:${ip}`;
    const hour = new Date(now).toISOString().slice(0, 13);
    const globalKey = `global:${hour}`;
    const ipState = (await store.get(ipKey)) ?? { fails: 0, until: 0 };
    const globalState = (await store.get(globalKey)) ?? { fails: 0 };

    if (ipState.until > now || globalState.fails >= GLOBAL_FAILS) {
      return json({ error: 'locked', retryAfter: Math.ceil((ipState.until - now) / 1000) || 3600 }, 429);
    }

    if (!checkPassword(String(body.password ?? ''))) {
      ipState.fails += 1;
      if (ipState.fails >= IP_FAILS) {
        ipState.until = now + IP_LOCK_MINUTES * 60_000;
        ipState.fails = 0;
      }
      globalState.fails += 1;
      await Promise.all([store.setJSON(ipKey, ipState), store.setJSON(globalKey, globalState)]);
      return json({ error: 'wrong_password', left: ipState.until > now ? 0 : IP_FAILS - ipState.fails }, 401);
    }
    await store.delete(ipKey);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = randomId();
    await store.setJSON(`ch:${challenge}`, { code, exp: now + CODE_MINUTES * 60_000, tries: 0, ip });

    const sent = await notifyDiscord({
      title: '🔐 관리자 로그인 인증번호',
      description: `# ${code}\n${CODE_MINUTES}분 안에 입력하세요.\n직접 요청한 로그인이 아니라면 입력하지 말고 담당자에게 알려 주세요.`,
      color: 0x1e59ae,
      fields: [{ name: '요청 위치', value: maskIp(ip), inline: true }],
      timestamp: new Date(now).toISOString(),
    });
    if (!sent) {
      await store.delete(`ch:${challenge}`);
      return json({ error: 'notify_failed' }, 502);
    }
    return json({ challenge, minutes: CODE_MINUTES });
  }

  if (body.step === 'code') {
    const challenge = String(body.challenge ?? '');
    if (!/^[0-9a-f]{32}$/.test(challenge)) return json({ error: 'invalid_challenge' }, 400);
    const key = `ch:${challenge}`;
    const state = await store.get(key);
    if (!state || state.exp < now) {
      await store.delete(key);
      return json({ error: 'expired' }, 401);
    }
    if (!safeEqual(String(body.code ?? '').trim(), state.code)) {
      state.tries += 1;
      if (state.tries >= CODE_TRIES) {
        await store.delete(key);
        return json({ error: 'expired' }, 401);
      }
      await store.setJSON(key, state);
      return json({ error: 'wrong_code', left: CODE_TRIES - state.tries }, 401);
    }
    await store.delete(key);

    const token = signToken(
      { sub: 'cms', iat: now, exp: now + SESSION_HOURS * 3_600_000, jti: randomId() },
      secret,
    );
    await notifyDiscord({
      title: '✅ 관리자 페이지 로그인',
      description: `${SESSION_HOURS}시간 동안 유지됩니다.`,
      color: 0x2f855a,
      fields: [{ name: '위치', value: maskIp(ip), inline: true }],
      timestamp: new Date(now).toISOString(),
    });
    return json({ token });
  }

  return json({ error: 'invalid_step' }, 400);
};

const PAGE = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>유스트코리아 관리자 로그인</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">
<style>
  :root { --brand: #1e59ae; --ink: #141c2b; --ink-2: #49556a; --line: #c7d0e0; --surface: #f4f6fb; --error: #a8341f; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--surface);
    font-family: 'Pretendard Variable', Pretendard, system-ui, sans-serif; color: var(--ink); letter-spacing: -0.01em; }
  main { width: min(22rem, calc(100vw - 2rem)); background: #fff; border: 1px solid #e0e5ee; border-radius: 6px; padding: 2rem 1.75rem; }
  img { display: block; height: 2.5rem; margin-bottom: 1.25rem; }
  h1 { font-size: 1.125rem; margin: 0 0 0.375rem; }
  p { margin: 0 0 1.25rem; color: var(--ink-2); font-size: 0.875rem; line-height: 1.6; }
  label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.375rem; }
  input { width: 100%; font: inherit; padding: 0.6875rem 0.8125rem; border: 1px solid var(--line); border-radius: 4px; }
  input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 4px rgb(30 89 174 / 12%); }
  #code { font-size: 1.375rem; letter-spacing: 0.4em; text-align: center; font-variant-numeric: tabular-nums; }
  button { width: 100%; margin-top: 1rem; padding: 0.75rem; border: 0; border-radius: 4px; background: var(--brand);
    color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  button[disabled] { opacity: 0.6; cursor: progress; }
  .msg { min-height: 1.25rem; margin: 0.75rem 0 0; font-size: 0.8125rem; color: var(--error); }
  .msg.ok { color: var(--brand); }
  .link { background: none; color: var(--ink-2); font-weight: 400; font-size: 0.8125rem; margin-top: 0.5rem; text-decoration: underline; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  
  <form id="step1">
    <h1>유스트코리아 관리자 로그인</h1>
    <p>비밀번호를 입력하면 Discord 채널로 인증번호가 갑니다.</p>
    <label for="password">비밀번호</label>
    <input id="password" type="password" autocomplete="current-password" required autofocus>
    <button>인증번호 받기</button>
    <p class="msg" id="msg1" role="alert"></p>
  </form>
  <form id="step2" hidden>
    <h1>인증번호 입력</h1>
    <p>Discord 채널에 온 6자리 번호를 <b id="minutes">5</b>분 안에 입력하세요.</p>
    <label for="code">인증번호</label>
    <input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
    <button>로그인</button>
    <button type="button" class="link" id="restart">비밀번호부터 다시 하기</button>
    <p class="msg" id="msg2" role="alert"></p>
  </form>
  <div id="done" hidden>
    <h1>로그인됐습니다</h1>
    <p id="doneText">관리자 화면으로 돌아갑니다. 이 창은 자동으로 닫힙니다.</p>
  </div>
</main>
<script>
  const provider = 'github';
  const $ = (id) => document.getElementById(id);
  const messages = {
    wrong_password: (d) => d.left > 0 ? '비밀번호가 맞지 않습니다. (' + d.left + '번 남음)' : '여러 번 틀려 잠시 잠겼습니다. 15분 뒤에 다시 시도하세요.',
    locked: () => '여러 번 틀려 잠시 잠겼습니다. 잠시 뒤에 다시 시도하세요.',
    notify_failed: () => 'Discord 로 인증번호를 보내지 못했습니다. 담당자에게 알려 주세요.',
    wrong_code: (d) => '인증번호가 맞지 않습니다. (' + d.left + '번 남음)',
    expired: () => '인증번호가 만료됐습니다. 비밀번호부터 다시 해 주세요.',
    not_configured: () => '관리자 로그인이 아직 설정되지 않았습니다. 담당자에게 알려 주세요.',
    github_not_configured: () => 'GitHub 연결 토큰(CMS_GITHUB_TOKEN)이 아직 등록되지 않았습니다. Netlify 환경변수에 등록한 뒤 다시 배포해 주세요.',
  };
  const explain = (d) => (messages[d.error] || (() => '로그인하지 못했습니다. 잠시 뒤에 다시 시도하세요.'))(d);
  let challenge = '';

  async function send(payload) {
    const response = await fetch(location.pathname, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  }
  function busy(form, on) { form.querySelector('button').disabled = on; }

  $('step1').addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(e.target, true); $('msg1').textContent = '';
    const { ok, data } = await send({ step: 'password', password: $('password').value });
    busy(e.target, false);
    if (!ok) { $('msg1').textContent = explain(data); return; }
    challenge = data.challenge; $('minutes').textContent = data.minutes;
    $('password').value = '';
    $('step1').hidden = true; $('step2').hidden = false; $('code').focus();
  });

  $('step2').addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(e.target, true); $('msg2').textContent = '';
    const { ok, data } = await send({ step: 'code', challenge, code: $('code').value });
    busy(e.target, false);
    if (!ok) {
      $('msg2').textContent = explain(data);
      if (data.error === 'expired') setTimeout(restart, 1800);
      return;
    }
    $('step2').hidden = true; $('done').hidden = false;
    handOff(data.token);
  });

  function restart() {
    challenge = ''; $('code').value = ''; $('msg2').textContent = '';
    $('step2').hidden = true; $('step1').hidden = false; $('password').focus();
  }
  $('restart').addEventListener('click', restart);

  // CMS 창과 주고받기: 이 창이 'authorizing:github' 을 보내면 CMS 가 같은 말로 답하고,
  // 그때 토큰을 넘긴다. 같은 출처(origin)의 opener 에게만 보낸다.
  function handOff(token) {
    if (!window.opener) {
      $('doneText').textContent = '관리자 페이지(/admin)에서 로그인 버튼을 눌러 이 창을 열어 주세요.';
      return;
    }
    const content = JSON.stringify({ token, provider });
    window.addEventListener('message', (event) => {
      if (event.source === window.opener && event.origin === location.origin && event.data === 'authorizing:' + provider) {
        window.opener.postMessage('authorization:' + provider + ':success:' + content, event.origin);
        setTimeout(() => window.close(), 400);
      }
    });
    window.opener.postMessage('authorizing:' + provider, location.origin);
  }
</script>
</body>
</html>`;
