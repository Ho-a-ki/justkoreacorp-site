# justkoreacorp-site

유스트코리아 법인 사이트 (justkoreacorp.com). Astro 정적 사이트, Netlify 배포.

## 콘텐츠 고치기

`/admin` 에서 Sveltia CMS 로 고친다. 저장하면 GitHub `main` 에 커밋되고 Netlify 가 다시 배포한다 (1~2분).

| 메뉴 | 파일 |
|------|------|
| 주요 활동 | `src/content/activities/*.md` |
| 미디어 · Press / 셀럽 | `src/content/press/*.md`, `src/content/celeb/*.md` |
| 허브 백과사전 | `src/content/herbs/*.md` |
| 자주 묻는 질문 | `src/content/faq/*.md` |
| 스토어 | `src/data/stores.json` |

필드를 바꿀 때는 `src/content.config.ts`(스키마)와 `public/admin/config.js`(관리자 화면)를 같이 맞춘다.

### 관리자 로그인

비밀번호 → Discord 로 온 6자리 인증번호 → 12시간 세션 (repureum 과 같은 방식).
브라우저에는 GitHub 토큰이 가지 않고, `/api/gh/*` 가 허용된 경로(`src/lib/cms/cms.mjs` 의 `ALLOWED_PATHS`)만 커밋한다.

Netlify 환경변수:

- `CMS_GITHUB_TOKEN` — 이 레포 Contents 읽기·쓰기만 허용한 fine-grained 토큰 (필수)
- `CMS_PASSWORD` — 관리자 비밀번호, 8자 이상 (필수)
- `CMS_DISCORD_WEBHOOK` — 인증번호 받을 채널 (없으면 `DISCORD_WEBHOOK` 사용)
- `DISCORD_WEBHOOK` — 문의 폼 알림

## 개발

```sh
npm install
npm run dev      # http://localhost:4321 (관리자 화면은 /admin/index.html)
npm run build
```

로컬에서 관리자 로그인을 시험하려면 `.env` 에 `CMS_LOCAL=1` 과 위 변수를 넣는다 (인증번호는 터미널에 찍힘). 로컬에서 저장해도 실제 `main` 에 커밋된다.
