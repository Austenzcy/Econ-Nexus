/* 新资料保存在本地文件中；当前资料库为空。日期采用 YYYY-MM-DD。
 * 条目结构：{ id, title, date, source, overview: [段落],
 * sections: [{ title, paragraphs: [段落] }], attachments: [{ title, url }] }
 * overview 与 paragraphs 使用纯文本，不执行 HTML。
 */
window.PAPER_LIBRARY = [];
