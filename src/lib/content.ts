import { existsSync } from 'node:fs';
import { getCollection, type CollectionEntry } from 'astro:content';

import { FAQ_CATEGORIES } from './faq-categories';

const byDateDesc = (a: { data: { date: Date } }, b: { data: { date: Date } }) => b.data.date.getTime() - a.data.date.getTime();

/** 숨기기(draft) 를 뺀 글. 운영 빌드에서만 숨기고, 개발 서버에서는 보여 준다 */
const visible = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getHerbs() {
  const items = await getCollection('herbs', visible);
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name, 'ko'));
}

export async function getPress() {
  return (await getCollection('press', visible)).sort(byDateDesc);
}

export async function getCeleb() {
  return (await getCollection('celeb', visible)).sort(byDateDesc);
}

export async function getActivities() {
  return (await getCollection('activities', visible)).sort(byDateDesc);
}

/** 분류별로 묶은 FAQ */
export async function getFaqGroups() {
  const items = await getCollection('faq', visible);
  return FAQ_CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.data.category === category).sort((a, b) => a.data.order - b.data.order),
  })).filter((g) => g.items.length);
}

export type FaqEntry = CollectionEntry<'faq'>;

/** 본문(마크다운)의 첫 이미지 주소 */
export const firstImageOf = (body?: string) => body?.match(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/)?.[1] ?? '';

/** 대표 이미지가 비어 있으면 본문의 첫 이미지를 쓴다 */
export const coverOf = (entry: { data: { thumbnail?: string }; body?: string }) => entry.data.thumbnail || firstImageOf(entry.body);

/**
 * 목록 화면용 작은 섬네일 경로 (scripts/thumbs.mjs 가 public/_thumbs 에 만든다).
 * 섬네일이 아직 없으면 원본을 그대로 쓴다.
 */
export const thumbOf = (src?: string) => {
  if (!src?.startsWith('/images/')) return src;
  const thumb = '/_thumbs' + decodeURI(src).replace(/\.[^./]+$/, '.webp');
  return existsSync('public' + thumb) ? encodeURI(thumb) : src;
};

/** 본문이 대표 이미지로 시작하면 상세 화면에서 그 첫 이미지를 감춘다 (같은 사진이 두 번 보이지 않게) */
export const startsWithCover = (entry: { data: { thumbnail?: string }; body?: string }) => {
  const first = firstImageOf(entry.body);
  return Boolean(first) && first === coverOf(entry) && /^\s*!\[/.test(entry.body ?? '');
};

const dateFmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
const monthDayFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatMonthDay = (d: Date) => monthDayFmt.format(d);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** 목록 안에서 앞뒤 글 */
export function neighbors<T extends { id: string }>(list: T[], id: string) {
  const i = list.findIndex((x) => x.id === id);
  return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined };
}

/** View Transition 이름. CSS 식별자는 숫자로 시작할 수 없어 접두어를 붙인다 */
export const vt = (prefix: string, id: string) => `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/** 본문에서 처음 나오는 유튜브 영상 id (링크 텍스트 속 \_ 이스케이프는 무시) */
export function youtubeIdOf(body?: string) {
  const m = body?.replace(/\\_/g, '_').match(/(?:youtube\.com\/(?:watch\?(?:[^)\s]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? '';
}

/** 노션 시절 제목의 밑줄(보그_31허브 오일)을 띄어쓰기로 보여 준다 */
export const displayName = (name: string) => name.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
