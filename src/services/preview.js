/**
 * Xem trước bài giảng trên web, không cần tải file gốc:
 *  - Word / PowerPoint / OpenDocument / RTF → chuyển sang PDF bằng LibreOffice (headless)
 *  - Excel / ODS / CSV → chuyển sang bảng HTML
 * Kết quả được lưu cache trong PREVIEW_CACHE_DIR, nên chỉ chuyển đổi 1 lần cho mỗi phiên bản file.
 */
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const config = require('../config');
const { getStorage } = require('../storage');
const { viewerType, fileExt } = require('../utils/helpers');

const cacheDir = path.resolve(config.root, process.env.PREVIEW_CACHE_DIR || './storage/.preview');
const profileDir = path.join(os.tmpdir(), 'qlbg-libreoffice-profile');

/* ---------- Tìm LibreOffice ---------- */
let sofficePath;
function findSoffice() {
  if (sofficePath !== undefined) return sofficePath;
  const candidates = [
    process.env.SOFFICE_PATH,
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/lib/libreoffice/program/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ].filter(Boolean);
  sofficePath = candidates.find((p) => fs.existsSync(p)) || null;
  return sofficePath;
}

/* LibreOffice không chạy song song tốt với cùng một profile → xếp hàng từng việc */
let queue = Promise.resolve();
function runExclusive(fn) {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

async function convertWithLibreOffice(buffer, ext, target) {
  const soffice = findSoffice();
  if (!soffice) throw new Error('Máy chủ chưa cài LibreOffice nên chưa xem trước được định dạng này (chạy lại setup.bat).');
  return runExclusive(async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'qlbg-conv-'));
    try {
      const inFile = path.join(dir, `input.${ext}`);
      await fsp.writeFile(inFile, buffer);
      await new Promise((resolve, reject) =>
        execFile(
          soffice,
          [`-env:UserInstallation=file:///${profileDir.replace(/\\/g, '/')}`, '--headless', '--norestore', '--nolockcheck',
            '--convert-to', target, '--outdir', dir, inFile],
          { timeout: 240000, windowsHide: true },
          (err, stdout, stderr) => {
            if (!err) return resolve();
            console.error('[LibreOffice]', err.message, stderr);
            const why = err.killed ? 'quá thời gian chờ (file quá lớn)' : (String(stderr || '').trim().split('\n').pop() || `mã lỗi ${err.code}`);
            reject(new Error(`Không chuyển đổi được bài giảng sang bản xem trực tuyến: ${why}`));
          }
        )
      );
      const out = path.join(dir, `input.${target}`);
      if (!fs.existsSync(out)) throw new Error('LibreOffice không tạo ra bản xem trước (file có thể bị hỏng hoặc có mật khẩu).');
      return await fsp.readFile(out);
    } finally {
      fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}

/* ---------- Cache ---------- */
function cachePath(lecture, suffix) {
  const h = crypto.createHash('sha1').update(String(lecture.file_id)).digest('hex').slice(0, 12);
  return path.join(cacheDir, `${lecture.id}-${h}.${suffix}`);
}

async function readAll(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

async function sourceBuffer(lecture) {
  const f = await getStorage().getFile(lecture.file_id);
  return readAll(f.stream);
}

const inflight = new Map(); // tránh chuyển đổi trùng khi nhiều người mở cùng lúc
async function cached(file, build) {
  if (fs.existsSync(file)) return file;
  if (inflight.has(file)) return inflight.get(file);
  const p = (async () => {
    await fsp.mkdir(cacheDir, { recursive: true });
    const data = await build();
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, file);
    return file;
  })().finally(() => inflight.delete(file));
  inflight.set(file, p);
  return p;
}

/* ---------- PDF (pdf gốc hoặc Office đã chuyển đổi) ---------- */
async function getPdf(lecture) {
  const type = viewerType(lecture.mime_type, lecture.file_name);
  if (type === 'pdf') {
    const f = await getStorage().getFile(lecture.file_id);
    return { stream: f.stream };
  }
  if (type === 'office') {
    const file = await cached(cachePath(lecture, 'pdf'), async () =>
      convertWithLibreOffice(await sourceBuffer(lecture), fileExt(lecture.file_name), 'pdf')
    );
    return { stream: fs.createReadStream(file) };
  }
  throw new Error('Định dạng này không xem dạng PDF');
}

/* ---------- Excel → HTML ---------- */
const MAX_ROWS = 2000;
const MAX_COLS = 60;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function colName(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function cellText(cell) {
  try {
    if (cell.value === null || cell.value === undefined) return '';
    return cell.text != null ? String(cell.text) : String(cell.value);
  } catch {
    return '';
  }
}

async function buildSheetHtml(lecture) {
  let buf = await sourceBuffer(lecture);
  let ext = fileExt(lecture.file_name);
  const wb = new ExcelJS.Workbook();
  if (ext === 'csv') {
    await wb.csv.read(Readable.from(buf));
  } else {
    if (ext !== 'xlsx' && ext !== 'xlsm') {
      buf = await convertWithLibreOffice(buf, ext, 'xlsx');
      ext = 'xlsx';
    }
    await wb.xlsx.load(buf);
  }
  const sheets = wb.worksheets.filter((ws) => ws.state !== 'hidden' && ws.state !== 'veryHidden');
  let tabs = '';
  let panes = '';
  sheets.forEach((ws, i) => {
    const rows = Math.min(ws.actualRowCount ? ws.rowCount : 0, MAX_ROWS);
    const cols = Math.min(ws.columnCount || 0, MAX_COLS);
    tabs += `<button type="button" class="${i === 0 ? 'active' : ''}" data-sheet="${i}">${esc(ws.name)}</button>`;
    let t = '<table class="xl"><thead><tr><th></th>';
    for (let c = 1; c <= cols; c++) t += `<th>${colName(c)}</th>`;
    t += '</tr></thead><tbody>';
    for (let r = 1; r <= rows; r++) {
      const row = ws.getRow(r);
      t += `<tr><th>${r}</th>`;
      for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c);
        const txt = cellText(cell);
        const st = [];
        if (cell.font && cell.font.bold) st.push('font-weight:700');
        if (typeof cell.value === 'number' || (cell.value && cell.value.result !== undefined && typeof cell.value.result === 'number')) st.push('text-align:right');
        t += `<td${st.length ? ` style="${st.join(';')}"` : ''}>${esc(txt)}</td>`;
      }
      t += '</tr>';
    }
    t += '</tbody></table>';
    const note = ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS ? `<p class="muted small">Chỉ hiển thị ${MAX_ROWS} dòng × ${MAX_COLS} cột đầu tiên.</p>` : '';
    panes += `<div class="xl-pane${i === 0 ? '' : ' hidden'}" data-pane="${i}">${note}<div class="xl-scroll">${t}</div></div>`;
  });
  if (!sheets.length) return '<p class="muted">Bảng tính trống.</p>';
  return `<div class="xl-tabs">${tabs}</div>${panes}`;
}

async function getSheetHtml(lecture) {
  const file = await cached(cachePath(lecture, 'html'), async () => Buffer.from(await buildSheetHtml(lecture), 'utf8'));
  return fsp.readFile(file, 'utf8');
}

/** Chuyển đổi trước (chạy nền sau khi upload) để lần mở đầu tiên không phải chờ */
function warm(lecture) {
  if (!lecture || !lecture.file_id) return;
  const type = viewerType(lecture.mime_type, lecture.file_name);
  const job = type === 'office' ? getPdf(lecture).then((r) => r.stream.destroy()) : type === 'sheet' ? getSheetHtml(lecture) : null;
  if (job) job.catch((e) => console.error('[preview]', lecture.id, e.message));
}

async function clear(lectureId) {
  try {
    const files = await fsp.readdir(cacheDir);
    await Promise.all(files.filter((f) => f.startsWith(`${lectureId}-`)).map((f) => fsp.rm(path.join(cacheDir, f), { force: true })));
  } catch {
    /* chưa có cache */
  }
}

module.exports = { getPdf, getSheetHtml, warm, clear, available: () => !!findSoffice() };
