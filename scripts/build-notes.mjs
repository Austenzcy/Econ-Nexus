// Compile reviewed Markdown into the offline library. No Markdown/TeX runtime is needed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const markedModule = process.argv[2] ? pathToFileURL(process.argv[2]).href : 'marked';
const katexModule = process.argv[3] ? pathToFileURL(process.argv[3]).href : 'katex';
const { Marked } = await import(markedModule);
const { default: katex } = await import(katexModule);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parser = new Marked({
  gfm: true,
  renderer: {
    html() { throw new Error('Raw HTML is not allowed in source notes'); },
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (href === '../../index.html#original') return `<a href="#original">${text}</a>`;
      if (!/^https:\/\//i.test(href)) throw new Error(`Unsupported source link: ${href}`);
      return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
  }
});
function html(source) {
  const math = [];
  const prepared = source.replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g, (_, block, inline) => {
    const displayMode = block !== undefined;
    const index = math.push({displayMode, html: katex.renderToString((block ?? inline).trim(), {
      displayMode, throwOnError: true, trust: false, output: 'htmlAndMathml'
    })}) - 1;
    return `NEAMATHTOKEN${index}END`;
  });
  let result = parser.parse(prepared);
  math.forEach((item, i) => {
    const token = `NEAMATHTOKEN${i}END`;
    if (item.displayMode) result = result.replace(`<p>${token}</p>`, `<div class="math-scroll" tabindex="0" role="region" aria-label="数学公式，可横向滚动">${item.html}</div>`);
    else result = result.replaceAll(token, item.html);
  });
  if (/NEAMATHTOKEN/.test(result)) throw new Error('Unrendered equation');
  return result.replace(/<table>([\s\S]*?)<\/table>/g, (_, body) => {
    const columns = (body.split('</thead>')[0].match(/<th(?:\s|>)/g) || []).length;
    return `<div class="reading-table rich-table${columns === 2 ? ' two-column' : ''}" tabindex="0" role="region" aria-label="资料表格，可横向滚动"><table>${body}</table></div>`;
  });
}
const cases = [
  ['01_体育中考_优秀研究问题.md', 'nea-pe-exam-long-run', 'Running to Success: Long-term Returns to the High-stakes PE Exam', '桂宇河', '研究问题案例'],
  ['02_有限注意力与消费_优秀研究问题.md', 'nea-attention-consumption', 'Consumption out of Investment Proceeds under Limited Attention', '张凯瑞', '研究问题案例'],
  ['03_生产导向型货币政策_优秀研究方法.md', 'nea-monetary-mandarin-capitalism', 'Monetary Policy in Mandarin Capitalism', '柴森叶', '研究方法案例']
];
const records = [];
for (const [file, id, title, presenter, kind] of cases) {
  const source = await fs.readFile(path.join(root, 'notes/nea-2026-10-31', file), 'utf8');
  const subtitle = source.match(/^# (.+)$/m)?.[1];
  const lead = source.match(/^> (.+)$/m)?.[1] || '';
  const parts = source.split(/^## /m).slice(1).map(part => {
    const newline = part.indexOf('\n');
    return {title:part.slice(0,newline).trim(), body:part.slice(newline+1).trim()};
  });
  const overview = parts.shift();
  if (overview?.title !== '这份资料说了什么') throw new Error(`Missing overview in ${file}`);
  records.push({id, date:'2026-10-31', group:'2026年10月31日 · NEA组会', title, subtitle,
    source:`NEA组会 · ${presenter}分享 · ${kind}`, overviewHtml:html(`${overview.body}\n\n> ${lead}`),
    sections:parts.map(section => ({title:section.title.replace(/^[一二三四五六七八九十]+、/, ''), blocks:[{type:'rich', html:html(section.body)}]})),
    attachments:[{title:'阅读 Markdown 笔记', url:`notes/nea-2026-10-31/${file}`}]
  });
}
await fs.writeFile(path.join(root, 'assets/nea-notes.js'), `/* Generated from notes/nea-2026-10-31 by scripts/build-notes.mjs. */\nwindow.PAPER_LIBRARY = (window.PAPER_LIBRARY || []).concat(${JSON.stringify(records, null, 2)});\n`);
const katexEntry = process.argv[3] || fileURLToPath(import.meta.resolve('katex'));
const dist = path.dirname(katexEntry);
const vendor = path.join(root, 'assets/vendor/katex');
await fs.mkdir(path.join(vendor, 'fonts'), {recursive:true});
let css = await fs.readFile(path.join(dist, 'katex.min.css'), 'utf8');
css = css.replace(/,url\([^)]*\) format\("woff"\)|,url\([^)]*\) format\("truetype"\)/g, '');
await fs.writeFile(path.join(vendor, 'katex.min.css'), css);
for (const file of await fs.readdir(path.join(dist, 'fonts'))) {
  if (file.endsWith('.woff2')) await fs.copyFile(path.join(dist, 'fonts', file), path.join(vendor, 'fonts', file));
}
await fs.copyFile(path.join(dist, '../LICENSE'), path.join(vendor, 'LICENSE'));
console.log(`Compiled ${records.length} notes with offline math and source links.`);
