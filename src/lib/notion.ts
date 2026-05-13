import { Client } from '@notionhq/client';

const notion = new Client({ auth: import.meta.env.NOTION_API_KEY });

const cache = new Map<string, { data: any; expires: number }>();
const TTL = 5 * 60 * 1000; // 5분

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + TTL });
}

export async function queryDataSource(dataSourceId: string, sorts?: any[]) {
  const key = `ds:${dataSourceId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;

  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    ...(sorts ? { sorts } : {}),
  });
  setCache(key, res);
  return res;
}

export async function getFirstImage(pageId: string): Promise<string> {
  const key = `img:${pageId}`;
  const cached = getCached<string>(key);
  if (cached !== null) return cached;

  let url = '';
  try {
    const res = await notion.blocks.children.list({ block_id: pageId, page_size: 10 });
    for (const block of res.results as any[]) {
      if (block.type === 'image') {
        url = block.image.type === 'external'
          ? block.image.external.url
          : block.image.file.url;
        break;
      }
    }
  } catch {}
  setCache(key, url);
  return url;
}

export async function getPageBlocks(pageId: string) {
  const key = `blocks:${pageId}`;
  const cached = getCached<any[]>(key);
  if (cached) return cached;

  const blocks: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    });
    blocks.push(...(res.results as any[]));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  setCache(key, blocks);
  return blocks;
}

export async function getPage(pageId: string) {
  const key = `page:${pageId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;

  const page = await notion.pages.retrieve({ page_id: pageId });
  setCache(key, page);
  return page;
}

export { notion };
