import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { FAQ_CATEGORIES } from './lib/faq-categories';

// 관리자 페이지(/admin, Sveltia CMS)에서 고치는 콘텐츠. 필드를 바꾸면 public/admin/config.js 도 함께 맞춘다.
// 파일 이름이 곧 주소(id)다 — 노션에서 옮겨 온 글은 노션 페이지 id 를 그대로 써서 기존 링크를 지킨다.

const md = (dir: string) => glob({ base: `./src/content/${dir}`, pattern: '**/*.md' });
const draft = z.boolean().default(false);
const tags = z.array(z.string()).default([]);

/** 허브 백과사전 */
const herbs = defineCollection({
  loader: md('herbs'),
  schema: z.object({
    name: z.string(),
    tags,
    thumbnail: z.string().optional(),
    draft,
  }),
});

/** 미디어 — Press */
const press = defineCollection({
  loader: md('press'),
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(),
    tags,
    thumbnail: z.string().optional(),
    draft,
  }),
});

/** 미디어 — 유스트를 사용하는 셀럽. url 이 있으면 카드가 바로 그 주소로 간다 */
const celeb = defineCollection({
  loader: md('celeb'),
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(),
    url: z.string().url().optional(),
    tags,
    thumbnail: z.string().optional(),
    draft,
  }),
});

/** 주요 활동 */
const activities = defineCollection({
  loader: md('activities'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string().optional(),
    summary: z.string().optional(),
    draft,
  }),
});

/** 자주 묻는 질문 */
const faq = defineCollection({
  loader: md('faq'),
  schema: z.object({
    question: z.string(),
    category: z.enum(FAQ_CATEGORIES),
    order: z.number().default(100),
    draft,
  }),
});

export const collections = { herbs, press, celeb, activities, faq };
