# justkoreacorp-site

유스트코리아 법인 사이트 (justkoreacorp.com). Astro 정적 사이트, Cloudflare Workers 배포 (Worker `justkoreacorp`, `main` 푸시 시 Workers Builds 가 배포).

## 콘텐츠 고치기

`/admin` 에서 Sveltia CMS 로 고친다. 저장하면 GitHub `main` 에 커밋되고 Cloudflare 가 다시 배포한다 (1~2분).

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

Worker 비밀값 (`npx wrangler secret put <이름>`):

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

로컬에서 관리자 로그인을 시험하려면 `.dev.vars` 에 `CMS_LOCAL=1` 과 위 변수를 넣는다 (인증번호는 터미널에 찍힘). 로컬에서 저장해도 실제 `main` 에 커밋된다.

## 미리보기

운영 도메인과 별개인 Worker `justkoreacorp-preview` 에 올린다 (`wrangler.jsonc` 의 `env.preview`).

```sh
npm run build
npx wrangler deploy --env preview   # https://justkoreacorp-preview.justkorea.workers.dev
```

미리보기 Worker 의 비밀값은 운영과 따로 넣는다 (`--env preview`). `CMS_BRANCH` 를 작업 브랜치로 두면 관리자 화면 저장이 `main` 대신 그 브랜치에 커밋된다.
