(() => {
 'use strict';
 const app = document.querySelector('#app');
 const home = app.innerHTML;
 const library = Array.isArray(window.PAPER_LIBRARY) ? window.PAPER_LIBRARY : [];
 const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
 const positions = new Map();
 let current = '', revision = 0;
 const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const back = (label, hash) => `<a class="back" href="#${hash}"><span class="back-arrow" aria-hidden="true">←</span>${label}</a>`;
 const heading = title => `<h1 id="page-title" tabindex="-1">${esc(title)}</h1>`;
 const paragraphs = items => (Array.isArray(items) ? items : []).map(p => `<p>${esc(p)}</p>`).join('');
 function safeUrl(value) {
  const s = String(value || '').trim();
  if (!s || /[\u0000-\u001f]/.test(s)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:/i.test(s)) return null;
  if (s.startsWith('//')) return null;
  return s;
 }
 function blocks(items) {
  return (items || []).map(b => {
   if (b.type === 'formula') return `<div class="formula" role="math" aria-label="${esc(b.text)}">${esc(b.text)}</div>`;
   if (b.type === 'note') return `<aside class="reading-note"><p>${esc(b.text)}</p></aside>`;
   if (b.type === 'table') return `<div class="reading-table"><table><caption>${esc(b.caption || '')}</caption><thead><tr>${b.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
   if (b.type === 'links') return `<p class="reading-sources">${esc(b.label || '延伸阅读：')}${b.items.map(item => {const url=safeUrl(item.url);return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>` : esc(item.title);}).join(' · ')}</p>`;
   return `<p>${esc(b.text)}</p>`;
  }).join('');
 }
 function page(route) {
  if (route === 'home') return {html:home,title:'论文整理'};
  if (route === 'original') {
   const rows = [...library].sort((a,b) => String(b.date).localeCompare(String(a.date))).map(item => `<a class="record" href="#article/${encodeURIComponent(item.id)}"><time datetime="${esc(item.date)}">${esc(String(item.date).replaceAll('-','.'))}</time><span class="record-title">${esc(item.title)}</span></a>`).join('');
   return {title:'原始目录',html:back('回到主页','home')+`<section class="directory">${heading('原始目录')}<div class="table-head" aria-hidden="true"><span>整理日期</span><span>论文标题</span></div>${rows || '<div class="empty"><p class="empty-title">尚未收录资料</p><p class="empty-caption">下一次阅读，从这里开始。</p></div>'}</section>`};
  }
  if (route === 'organized') return {title:'整理目录',html:back('回到主页','home')+`<section class="directory">${heading('整理目录')}<div class="empty organized-empty"><p class="empty-title">让积累，慢慢成形</p><p class="empty-caption">这里将收纳按主题整理的阅读积累。</p></div></section>`};
  if (route.startsWith('article/')) {
   let id; try { id = decodeURIComponent(route.slice(8)); } catch { id = ''; }
   const item = library.find(p => String(p.id) === id);
   if (item) {
    const sections = (item.sections || []).map((section,i) => `<section class="article-section"><span class="number">${String(i+1).padStart(2,'0')}</span><h2>${esc(section.title)}</h2>${paragraphs(section.paragraphs)}${blocks(section.blocks)}</section>`).join('');
    const links = (item.attachments || []).map(a => {const url=safeUrl(a.url); return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : '';}).join('');
    return {title:item.title,html:back('回到目录','original')+`<article class="article">${heading(item.title)}<p class="meta">整理于 ${esc(String(item.date).replaceAll('-','.'))}${item.source ? ' · '+esc(item.source) : ''}</p><section class="overview"><h2>先读懂这篇</h2>${paragraphs(item.overview)}</section>${sections}${links ? `<footer class="attachments">${links}</footer>` : ''}</article>`};
   }
   return {title:'资料未找到',html:back('回到目录','original')+`<section class="directory">${heading('资料未找到')}<div class="empty"><p class="empty-caption">这份资料可能已移动，请回到目录查看。</p></div></section>`};
  }
  return {html:home,title:'论文整理'};
 }
 async function render(initial=false) {
  const route = location.hash.slice(1) || 'home';
  const ticket = ++revision;
  if (current) positions.set(current,window.scrollY);
  if (!initial && !motion.matches) {
   app.classList.remove('entering','initial'); app.classList.add('leaving');
   await new Promise(resolve => setTimeout(resolve,420));
  }
  if (ticket !== revision) return;
  const result = page(route);
  app.innerHTML=result.html;document.title=result.title==='论文整理'?'论文整理':result.title+' · 论文整理';
  current=route;
  app.classList.remove('leaving','entering','initial');
  window.scrollTo({top:positions.get(route)||0,behavior:'instant'});
  void app.offsetWidth;
  app.classList.add('entering');if(initial)app.classList.add('initial');
  if(!initial)app.querySelector('h1')?.focus({preventScroll:true});
 }
 if ('scrollRestoration' in history) history.scrollRestoration='manual';
 window.addEventListener('hashchange',()=>render());
 render(true);
})();
