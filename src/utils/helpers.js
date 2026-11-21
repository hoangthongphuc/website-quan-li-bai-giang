const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

function formatBytes(n) {
  n = Number(n || 0);
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < units.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + units[i];
}

function pad(x) {
  return String(x).padStart(2, '0');
}

function formatDate(d, withTime = true) {
  if (!d) return '—';
  d = new Date(d);
  const s = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${s} ${pad(d.getHours())}:${pad(d.getMinutes())}` : s;
}

function isoDate(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Markdown → HTML an toàn (đã lọc script, sự kiện…) */
function renderMarkdown(md) {
  const html = marked.parse(String(md || ''));
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'del']),
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'], code: ['class'], th: ['align'], td: ['align'] },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
  });
}

/** Xác định cách hiển thị bài giảng theo loại file */
function viewerType(mime, fileName) {
  const m = String(mime || '').toLowerCase();
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  if (m === 'text/markdown' || ext === 'md' || ext === 'markdown') return 'markdown';
  if (m === 'application/pdf' || ext === 'pdf' || m.startsWith('application/vnd.google-apps.')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'text/plain' || ext === 'txt') return 'text';
  return 'download';
}

function fileIcon(mime, fileName) {
  return { markdown: '📝', pdf: '📕', image: '🖼️', video: '🎬', audio: '🎧', text: '📄', download: '📦' }[viewerType(mime, fileName)];
}

module.exports = { formatBytes, formatDate, isoDate, renderMarkdown, viewerType, fileIcon };
