# [법인 사이트] justkoreacorp.com 개발

> 현재 oopy(Notion 기반)로 운영 중인 career.justkorea.co.kr을
> Astro 정적 사이트로 리뉴얼하여 justkoreacorp.com 에 배포.

---

## 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Astro | 7페이지 → 컴포넌트 재사용, 빌드 결과물은 정적 HTML |
| 배포 | Netlify | 무료 플랜, GitHub 연동 자동 배포 |
| DNS | Cloudflare | 기존 사용 중, CNAME DNS only로 연결 |
| 도메인 | justkoreacorp.com | 루트 도메인 사용 |

---

## 페이지 구성 (확정)

### 자체 페이지 (7개)

- [ ] 홈 / 브랜드 소개 (`/`) — 회사 소개 겸함
- [ ] 주요 활동 (`/activities`)
- [ ] 스토어 안내 (`/stores`)
- [ ] 허브 백과사전 (`/hub`)
- [ ] 사용 가이드 (`/guide`) — 제품 사용법
- [ ] Press & Public (`/press`) — 유튜브, 인플루언서 등 외부 노출 모음
- [ ] 연락처 (`/contact`) — 협업 문의 중심

### 외부 링크 (네비게이션에만 포함)

- 스파 — 외부 사이트 링크
- 제품 찾기 — 쇼핑몰 외부 링크

---

## 프로젝트 구조 (예정)

```
justkoreacorp-site/
  src/
    components/
      Header.astro
      Footer.astro
      Nav.astro
    layouts/
      BaseLayout.astro
    pages/
      index.astro
      activities.astro
      stores.astro
      hub.astro
      guide.astro
      press.astro
      contact.astro
  public/
    images/
    fonts/
  astro.config.mjs
  package.json
```

---

## 배포 설정

### Netlify
- GitHub 레포 연결 → push 시 자동 빌드
- Build command: `npm run build`
- Publish directory: `dist`
- 커스텀 도메인: `justkoreacorp.com` 추가 후 HTTPS 자동 발급

### Cloudflare DNS
```
Type: CNAME  /  Name: @  /  Target: [site].netlify.app  /  Proxy: OFF (DNS only)
Type: CNAME  /  Name: www  /  Target: [site].netlify.app  /  Proxy: OFF (DNS only)
```

> 기존 서브도메인 (admin.justkorea.co.kr 등) 영향 없음

---

## 작업 항목

- [x] 페이지 구성 확정
- [ ] 디자인 레퍼런스 수집
- [ ] GitHub 레포 생성 (`justkoreacorp-site`)
- [ ] Astro 프로젝트 초기화
- [ ] 공통 컴포넌트 개발 (Header, Footer, Nav)
- [ ] 페이지별 개발 (7페이지)
- [ ] 반응형 (모바일) 대응
- [ ] Netlify 배포 연결
- [ ] Cloudflare DNS 설정
- [ ] 기존 oopy 사이트 (career.justkorea.co.kr) 리다이렉트 또는 정리

---

*2026-03-17 작성*
