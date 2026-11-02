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
const meetingNotes = [
  ['01_体育中考_优秀研究问题.md', 'nea-pe-exam-long-run', 'Running to Success: Long-term Returns to the High-stakes PE Exam', '跑向成功：体育中考的长期回报', '桂宇河', '研究问题案例'],
  ['02_有限注意力与消费_优秀研究问题.md', 'nea-attention-consumption', 'Consumption out of Investment Proceeds under Limited Attention', '有限注意力下的投资收益消费', '张凯瑞', '研究问题案例'],
  ['03_生产导向型货币政策_优秀研究方法.md', 'nea-monetary-mandarin-capitalism', 'Monetary Policy in Mandarin Capitalism', '生产导向型经济中的货币政策', '柴森叶', '研究方法案例']
].map(([file, id, title, directoryTitle, presenter, kind]) => ({
  file, id, title, directoryTitle, folder:'nea-2026-10-31', date:'2026-10-31',
  group:'2026年10月31日 · NEA组会', source:`NEA组会 · ${presenter}分享 · ${kind}`
}));
const novemberNotes = [
  ['04_南水北调与健康_隐性福利效应.md', 'water-diversion-health', '流动的福祉：南水北调与健康中国', '流动的福祉：南水北调与健康中国', '梁超、柳杭娟、张荣杰'],
  ['05_旅游扩张与教育_激励权衡.md', 'tourism-growth-education', 'Tourism growth, education decline: Evidence from China’s 5A attraction expansion', '旅游业增长与教育水平下降：来自中国5A级景区扩张的证据', 'Zeyi He、Zhi-An Hu、Wei Huang、Yankun Kang'],
  ['06_同伴富裕与心理健康_准随机识别.md', 'peer-affluence-mental-health', 'Relative affluence and mental health: Evidence from quasi-random class assignments', '相对富裕与心理健康：来自准随机分班的证据', 'Huajun Wu、Ning Neil Yu'],
  ['07_晋升锦标赛与污染_理论与工具变量.md', 'promotion-tournaments-pollution', 'Political career incentives and the environmental costs: Evidence from China’s promotion tournaments', '政治晋升激励与环境成本：来自中国晋升锦标赛的证据', 'JingXuan Xu、Hao Xu、Guangrong Ma']
].map(([file, id, title, directoryTitle, source]) => ({
  file, id, title, directoryTitle, source, folder:'cases-2026-11-02', date:'2026-11-02'
}));
const records = [];
for (const {file, id, title, directoryTitle, folder, date, group, source: credit} of [...meetingNotes, ...novemberNotes]) {
  const source = await fs.readFile(path.join(root, 'notes', folder, file), 'utf8');
  const subtitle = source.match(/^# (.+)$/m)?.[1];
  const lead = source.match(/^> (.+)$/m)?.[1] || '';
  const parts = source.split(/^## /m).slice(1).map(part => {
    const newline = part.indexOf('\n');
    return {title:part.slice(0,newline).trim(), body:part.slice(newline+1).trim()};
  });
  const overview = parts.shift();
  if (overview?.title !== '这份资料说了什么') throw new Error(`Missing overview in ${file}`);
  records.push({id, date, group, title, directoryTitle, subtitle,
    source:credit, overviewHtml:html(lead ? `${overview.body}\n\n> ${lead}` : overview.body),
    sections:parts.map(section => ({title:section.title.replace(/^[一二三四五六七八九十]+、/, ''), blocks:[{type:'rich', html:html(section.body)}]})),
    attachments:[{title:'阅读 Markdown 笔记', url:`notes/${folder}/${file}`}]
  });
}
await fs.writeFile(path.join(root, 'assets/nea-notes.js'), `/* Generated from notes/ by scripts/build-notes.mjs. */\nwindow.PAPER_LIBRARY = (window.PAPER_LIBRARY || []).concat(${JSON.stringify(records, null, 2)});\n`);
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
