import { Client } from '@notionhq/client';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');

// .env 파일에서 환경변수 로드
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...vals] = line.split('=');
    if (key?.trim() && vals.length) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  }
} catch {}

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DS_IDS = {
  herbs: '4f6d8d03-3a27-4cca-9007-06004a532702',
  stores: 'f5081f2a-6393-44a4-9f8c-2bedaa2bb2a0',
  activities: '3266d57b-1f96-8104-8750-000b5a0fb69b',
  press: 'b7e5d934-ade8-4c90-93ca-43e7e40ebefb',
  celeb: '0f8d5933-4073-4607-9f6d-87a0b2e7c4ce',
};

const FAQ_PAGE_ID = '571a1a232160486d90d00fa603a7ef9d';

async function queryDS(id, sorts) {
  return notion.dataSources.query({ data_source_id: id, ...(sorts ? { sorts } : {}) });
}

async function getBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function getFirstImage(pageId) {
  try {
    const res = await notion.blocks.children.list({ block_id: pageId, page_size: 10 });
    for (const block of res.results) {
      if (block.type === 'image') {
        return block.image.type === 'external'
          ? block.image.external.url
          : block.image.file.url;
      }
    }
  } catch {}
  return '';
}

function renderRichText(richTexts) {
  return richTexts.map(rt => {
    let text = rt.plain_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (rt.annotations?.bold) text = `<strong>${text}</strong>`;
    if (rt.annotations?.italic) text = `<em>${text}</em>`;
    if (rt.annotations?.underline) text = `<u>${text}</u>`;
    if (rt.annotations?.code) text = `<code>${text}</code>`;
    if (rt.href) text = `<a href="${rt.href}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join('');
}

async function renderBlock(block) {
  let childrenHtml = '';
  if (block.has_children) {
    const children = await getBlocks(block.id);
    childrenHtml = await blocksToHtml(children);
  }

  switch (block.type) {
    case 'paragraph':
      return `<p>${renderRichText(block.paragraph.rich_text)}</p>`;
    case 'heading_1':
      return `<h2>${renderRichText(block.heading_1.rich_text)}</h2>`;
    case 'heading_2':
      return `<h3>${renderRichText(block.heading_2.rich_text)}</h3>`;
    case 'heading_3':
      return `<h4>${renderRichText(block.heading_3.rich_text)}</h4>`;
    case 'bulleted_list_item':
      return `<li>${renderRichText(block.bulleted_list_item.rich_text)}${childrenHtml}</li>`;
    case 'numbered_list_item':
      return `<li>${renderRichText(block.numbered_list_item.rich_text)}${childrenHtml}</li>`;
    case 'quote':
      return `<blockquote>${renderRichText(block.quote.rich_text)}${childrenHtml}</blockquote>`;
    case 'divider':
      return '<hr />';
    case 'image': {
      const url = block.image.type === 'external'
        ? block.image.external.url
        : block.image.file.url;
      const caption = block.image.caption?.[0]?.plain_text ?? '';
      return `<figure><img src="${url}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    }
    case 'callout': {
      const icon = block.callout.icon?.emoji ?? '';
      const text = renderRichText(block.callout.rich_text);
      const content = text || childrenHtml;
      if (!content.trim()) return '';
      return `<div class="callout">${icon ? icon + ' ' : ''}${text}${text ? childrenHtml : childrenHtml}</div>`;
    }
    case 'toggle': {
      const summary = renderRichText(block.toggle.rich_text);
      return `<details><summary>${summary}</summary>${childrenHtml}</details>`;
    }
    case 'table': {
      const rows = await getBlocks(block.id);
      let table = '<table>';
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].table_row?.cells ?? [];
        const tag = i === 0 && block.table.has_column_header ? 'th' : 'td';
        table += '<tr>' + cells.map(cell => `<${tag}>${renderRichText(cell)}</${tag}>`).join('') + '</tr>';
      }
      table += '</table>';
      return table;
    }
    default:
      return '';
  }
}

async function blocksToHtml(blocks) {
  let html = '';
  let inBullet = false;
  let inNumbered = false;
  for (const block of blocks) {
    if (block.type === 'bulleted_list_item') {
      if (!inBullet) { html += '<ul>'; inBullet = true; }
      html += await renderBlock(block);
    } else {
      if (inBullet) { html += '</ul>'; inBullet = false; }
      if (block.type === 'numbered_list_item') {
        if (!inNumbered) { html += '<ol>'; inNumbered = true; }
        html += await renderBlock(block);
      } else {
        if (inNumbered) { html += '</ol>'; inNumbered = false; }
        html += await renderBlock(block);
      }
    }
  }
  if (inBullet) html += '</ul>';
  if (inNumbered) html += '</ol>';
  return html.replace(/<p><\/p>/g, '');
}

function save(name, data) {
  const path = join(DATA_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ ${name}.json (${data.length ?? Object.keys(data).length} items)`);
}

async function syncHerbs() {
  console.log('허브...');
  const res = await queryDS(DS_IDS.herbs, [{ property: '이름', direction: 'ascending' }]);
  const herbs = [];
  for (const page of res.results) {
    const props = page.properties;
    const cover = page.cover?.type === 'external' ? page.cover.external.url : page.cover?.file?.url ?? '';
    const thumbnail = cover || await getFirstImage(page.id);
    const blocks = await getBlocks(page.id);
    herbs.push({
      id: page.id.replace(/-/g, ''),
      name: props['이름']?.title?.[0]?.plain_text ?? '',
      tags: props['태그']?.multi_select?.map(t => t.name) ?? [],
      thumbnail,
      content: await blocksToHtml(blocks),
    });
  }
  save('herbs', herbs);
}

async function syncStores() {
  console.log('스토어...');
  const res = await queryDS(DS_IDS.stores, [{ property: '이름', direction: 'ascending' }]);
  const stores = res.results.map(page => {
    const props = page.properties;
    return {
      id: page.id.replace(/-/g, ''),
      name: props['이름']?.title?.[0]?.plain_text ?? '',
      address: props['주소']?.rich_text?.[0]?.plain_text ?? '',
      phone: props['전화']?.rich_text?.[0]?.plain_text ?? '',
      tag: props['태그']?.select?.name ?? '',
      type: props['매장유형']?.select?.name ?? '',
      spa: props['스파 여부']?.select?.name ?? '',
    };
  });
  save('stores', stores);
}

async function syncActivities() {
  console.log('주요 활동...');
  const res = await queryDS(DS_IDS.activities, [{ property: '날짜', direction: 'descending' }]);
  const activities = [];
  for (const page of res.results) {
    const props = page.properties;
    const blocks = await getBlocks(page.id);
    activities.push({
      id: page.id.replace(/-/g, ''),
      title: props['제목']?.title?.[0]?.plain_text ?? '',
      date: props['날짜']?.date?.start ?? '',
      year: props['연도']?.select?.name ?? '',
      category: props['구분']?.select?.name ?? '',
      summary: props['요약']?.rich_text?.[0]?.plain_text ?? '',
      content: await blocksToHtml(blocks),
    });
  }
  save('activities', activities);
}

async function syncPress() {
  console.log('Press...');
  const res = await queryDS(DS_IDS.press, [{ property: '생성일', direction: 'descending' }]);
  const items = [];
  for (const page of res.results) {
    const props = page.properties;
    const cover = page.cover?.type === 'external' ? page.cover.external.url : page.cover?.file?.url ?? '';
    const thumbnail = cover || await getFirstImage(page.id);
    const blocks = await getBlocks(page.id);
    items.push({
      id: page.id.replace(/-/g, ''),
      name: props['이름']?.title?.[0]?.plain_text ?? '',
      tags: props['태그']?.multi_select?.map(t => t.name) ?? [],
      date: props['생성일']?.created_time?.slice(0, 10) ?? '',
      thumbnail,
      content: await blocksToHtml(blocks),
    });
  }
  save('press', items);
}

async function syncCeleb() {
  console.log('셀럽...');
  const res = await queryDS(DS_IDS.celeb, [{ property: '생성일', direction: 'descending' }]);
  const items = [];
  for (const page of res.results) {
    const props = page.properties;
    const cover = page.cover?.type === 'external' ? page.cover.external.url : page.cover?.file?.url ?? '';
    const thumbnail = cover || await getFirstImage(page.id);
    const blocks = await getBlocks(page.id);
    items.push({
      id: page.id.replace(/-/g, ''),
      name: props['이름']?.title?.[0]?.plain_text ?? '',
      tags: props['태그']?.multi_select?.map(t => t.name) ?? [],
      url: props['URL']?.url ?? '',
      date: props['생성일']?.created_time?.slice(0, 10) ?? '',
      thumbnail,
      content: await blocksToHtml(blocks),
    });
  }
  save('celeb', items);
}

async function syncFaq() {
  console.log('FAQ...');
  const blocks = await getBlocks(FAQ_PAGE_ID);
  const categories = [];

  for (const block of blocks) {
    if (block.type === 'column_list') {
      const columns = await getBlocks(block.id);
      for (const col of columns) {
        if (col.type === 'column') {
          const colBlocks = await getBlocks(col.id);
          let currentCat = null;
          for (const b of colBlocks) {
            if (b.type === 'heading_3') {
              const title = b.heading_3.rich_text.map(r => r.plain_text).join('');
              currentCat = { category: title, items: [] };
              categories.push(currentCat);
            } else if (b.type === 'child_page' && currentCat) {
              const answerBlocks = await getBlocks(b.id);
              currentCat.items.push({
                question: b.child_page.title,
                answer: await blocksToHtml(answerBlocks),
              });
            }
          }
        }
      }
    }
  }
  save('faq', categories);
}

async function main() {
  console.log('Notion 데이터 동기화 시작\n');
  mkdirSync(DATA_DIR, { recursive: true });
  await syncHerbs();
  await syncStores();
  await syncActivities();
  await syncPress();
  await syncCeleb();
  await syncFaq();
  console.log('\n완료!');
}

main().catch(err => {
  console.error('에러:', err);
  process.exit(1);
});
