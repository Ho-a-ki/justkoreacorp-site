export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  const { name, email, type, message } = data;

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: '필수 항목을 입력해주세요.' }), { status: 400 });
  }

  const webhookUrl = import.meta.env.DISCORD_WEBHOOK;
  if (!webhookUrl) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500 });
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '📩 유스트코리아 법인 사이트에서 새 문의가 도착했습니다',
        color: 0x00509e,
        fields: [
          { name: '이름', value: name, inline: true },
          { name: '이메일', value: email, inline: true },
          { name: '문의 유형', value: type || '미선택', inline: true },
          { name: '메시지', value: message },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: '전송 실패' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
