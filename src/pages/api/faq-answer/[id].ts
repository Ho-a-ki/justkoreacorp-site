export const prerender = false;

import type { APIRoute } from 'astro';
import { getPageBlocks } from '../../../lib/notion';

function renderRichText(richTexts: any[]): string {
  return richTexts.map(rt => {
    let text = rt.plain_text;
    if (rt.annotations?.bold) text = `<strong>${text}</strong>`;
    if (rt.annotations?.underline) text = `<u>${text}</u>`;
    if (rt.href) text = `<a href="${rt.href}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join('');
}

function renderBlock(block: any, childrenHtml = ''): string {
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
      return `<blockquote>${renderRichText(block.quote.rich_text)}</blockquote>`;
    case 'divider':
      return `<hr />`;
    case 'toggle':
      return `<details><summary>${renderRichText(block.toggle.rich_text)}</summary>${childrenHtml}</details>`;
    case 'image': {
      const url = block.image.type === 'external'
        ? block.image.external.url
        : block.image.file.url;
      const caption = block.image.caption?.[0]?.plain_text ?? '';
      return `<figure><img src="${url}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    }
    case 'callout': {
      const icon = block.callout.icon?.emoji ?? '';
      return `<div class="callout">${icon ? icon + ' ' : ''}${renderRichText(block.callout.rich_text)}${childrenHtml}</div>`;
    }
    case 'table':
      return `<table>${childrenHtml}</table>`;
    case 'table_row': {
      const cells = block.table_row.cells as any[][];
      const tag = block._isHeader ? 'th' : 'td';
      const row = cells.map(cell => `<${tag}>${renderRichText(cell)}</${tag}>`).join('');
      return `<tr>${row}</tr>`;
    }
    default:
      return '';
  }
}

async function blocksToHtml(pageBlocks: any[]): Promise<string> {
  let html = '';
  let inBulletList = false;
  let inNumberedList = false;
  for (const block of pageBlocks) {
    let childrenHtml = '';
    if (block.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
      const childBlocks = await getPageBlocks(block.id);
      if (block.type === 'table' && block.table?.has_column_header) {
        childBlocks.forEach((cb: any, idx: number) => { if (idx === 0) cb._isHeader = true; });
      }
      childrenHtml = await blocksToHtml(childBlocks);
    }

    if (block.type === 'bulleted_list_item') {
      if (!inBulletList) { html += '<ul>'; inBulletList = true; }
      html += renderBlock(block, childrenHtml);
    } else {
      if (inBulletList) { html += '</ul>'; inBulletList = false; }
      if (block.type === 'numbered_list_item') {
        if (!inNumberedList) { html += '<ol>'; inNumberedList = true; }
        html += renderBlock(block, childrenHtml);
      } else {
        if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
        html += renderBlock(block, childrenHtml);
      }
    }
  }
  if (inBulletList) html += '</ul>';
  if (inNumberedList) html += '</ol>';
  return html;
}

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  try {
    const blocks = await getPageBlocks(id);
    const html = await blocksToHtml(blocks);
    return new Response(JSON.stringify({ html }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ html: '<p>답변을 불러오지 못했습니다.</p>' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
