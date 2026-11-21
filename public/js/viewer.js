/**
 * Trình đọc bài giảng:
 *  1. Hiển thị PDF (kể cả Word/PowerPoint đã chuyển đổi) bằng PDF.js lên canvas,
 *     không có nút tải/in như trình xem PDF mặc định của trình duyệt.
 *  2. Bảng tính Excel: chuyển tab giữa các sheet.
 *  3. Chế độ bảo vệ (học viên không có quyền tải):
 *     watermark định danh, che nội dung khi rời cửa sổ hoặc bấm phím chụp màn hình,
 *     chặn chuột phải, bôi đen, sao chép, in, lưu, và ghi nhật ký các hành vi đáng ngờ.
 *  Lưu ý: không website nào chặn tuyệt đối được việc chụp/quay màn hình ở cấp hệ điều hành.
 *  Watermark giúp truy ra người làm lộ.
 */
const root = document.getElementById('reader-content');

/* ---------------- Bảng tính: chuyển sheet ---------------- */
document.querySelectorAll('.xl-tabs').forEach((tabs) => {
  const box = tabs.parentElement;
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sheet]');
    if (!b) return;
    tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    box.querySelectorAll('.xl-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.sheet));
  });
});

/* ---------------- Trình xem PDF ---------------- */
const viewer = document.querySelector('.doc-viewer');
if (viewer) initPdf(viewer).catch((e) => showError(viewer, e.message || String(e)));

function showError(v, msg) {
  v.querySelector('.doc-pages-wrap').innerHTML = `<div class="empty-state"><div class="big">⚠️</div><p></p></div>`;
  v.querySelector('.doc-pages-wrap p').textContent = msg;
}

async function initPdf(v) {
  const pdfjs = await import('/static/pdfjs/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/static/pdfjs/build/pdf.worker.min.mjs';

  const res = await fetch(v.dataset.src, { headers: { 'X-Viewer': '1' }, credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) throw new Error((await res.text()).replace(/<[^>]+>/g, ' ').trim().slice(0, 300) || 'Không tải được tài liệu');
  const data = new Uint8Array(await res.arrayBuffer());

  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: '/static/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/static/pdfjs/standard_fonts/',
    isEvalSupported: false,
  }).promise;

  const wrap = v.querySelector('.doc-pages-wrap');
  const zoomLabel = v.querySelector('.doc-zoom');
  const pagesLabel = v.querySelector('.doc-pages');
  let zoom = 1; // 1 = vừa chiều ngang khung
  let observer;
  let current = 1;

  const firstPage = await doc.getPage(1);
  const baseWidth = firstPage.getViewport({ scale: 1 }).width;

  function fitScale() {
    return Math.max(0.3, (wrap.clientWidth - 24) / baseWidth);
  }

  async function renderPage(holder) {
    if (holder.dataset.rendered) return;
    holder.dataset.rendered = '1';
    const page = await doc.getPage(Number(holder.dataset.page));
    const vp = page.getViewport({ scale: fitScale() * zoom });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = `${Math.floor(vp.width)}px`;
    canvas.style.height = `${Math.floor(vp.height)}px`;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
    holder.replaceChildren(canvas);
  }

  async function layout() {
    if (observer) observer.disconnect();
    wrap.replaceChildren();
    const scale = fitScale() * zoom;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    for (let i = 1; i <= doc.numPages; i++) {
      const p = i === 1 ? firstPage : await doc.getPage(i);
      const vp = p.getViewport({ scale });
      const holder = document.createElement('div');
      holder.className = 'doc-page';
      holder.dataset.page = i;
      holder.style.width = `${Math.floor(vp.width)}px`;
      holder.style.height = `${Math.floor(vp.height)}px`;
      holder.innerHTML = `<span class="page-wait"><span class="spinner"></span> Đang tải trang ${i}…</span>`;
      wrap.appendChild(holder);
    }
    // Chỉ vẽ trang khi sắp cuộn tới → mở file trăm trang vẫn nhanh
    observer = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) renderPage(en.target).catch(() => {});
        }
      },
      { root: null, rootMargin: '600px 0px', threshold: 0 }
    );
    wrap.querySelectorAll('.doc-page').forEach((h) => observer.observe(h));
    updateCounter();
  }

  // Trang hiện tại = trang đang nằm ở giữa màn hình
  function updateCounter() {
    const mid = window.innerHeight / 2;
    const pages = wrap.querySelectorAll('.doc-page');
    current = 1;
    for (const p of pages) {
      if (p.getBoundingClientRect().top <= mid) current = Number(p.dataset.page);
      else break;
    }
    pagesLabel.textContent = `Trang ${current} / ${doc.numPages}`;
  }
  let st;
  const onScroll = () => {
    clearTimeout(st);
    st = setTimeout(updateCounter, 80);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  root && root.addEventListener('scroll', onScroll, { passive: true }); // khi toàn màn hình

  v.querySelectorAll('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.zoom);
      zoom = d === 0 ? 1 : Math.min(3, Math.max(0.4, +(zoom + d * 0.2).toFixed(2)));
      layout();
    })
  );
  let rt;
  let lastW = wrap.clientWidth;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (Math.abs(wrap.clientWidth - lastW) > 20) {
        lastW = wrap.clientWidth;
        layout();
      }
    }, 250);
  });
  await layout();
}

/* ---------------- Bảo vệ nội dung ---------------- */
if (root && root.dataset.protect === '1') initProtection(root);

function initProtection(el) {
  const lectureId = el.dataset.lecture;
  const csrf = el.dataset.csrf;
  const reported = {};
  function report(kind) {
    // Mỗi loại sự kiện chỉ ghi nhật ký tối đa 1 lần / 30 giây
    const now = Date.now();
    if (reported[kind] && now - reported[kind] < 30000) return;
    reported[kind] = now;
    fetch(`/lectures/${lectureId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ kind }),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  }

  /* 1. Watermark định danh, lát kín vùng nội dung */
  const text = el.dataset.watermark || '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220">
    <text x="210" y="110" text-anchor="middle" dominant-baseline="middle" transform="rotate(-24 210 110)"
      font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="rgba(30,41,59,0.16)">${text.replace(/[<&>"]/g, '')}</text></svg>`;
  const wm = document.createElement('div');
  wm.className = 'wm';
  wm.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  el.appendChild(wm);

  /* 2. Che nội dung khi rời cửa sổ (mở công cụ chụp/quay, chuyển ứng dụng…) */
  const shield = (on) => {
    el.classList.toggle('shielded', on);
    if (on) el.querySelectorAll('video, audio').forEach((m) => m.pause());
  };
  window.addEventListener('blur', () => shield(true));
  window.addEventListener('focus', () => setTimeout(() => shield(false), 300));
  document.addEventListener('visibilitychange', () => document.hidden && shield(true));
  // Chuột rời khỏi trang (thường để bấm công cụ chụp trên thanh tác vụ)
  document.documentElement.addEventListener('mouseleave', () => shield(true));
  document.documentElement.addEventListener('mouseenter', () => document.hasFocus() && shield(false));

  /* 3. Phím chụp màn hình và các phím tắt sao chép/lưu/in */
  const wipeClipboard = () => navigator.clipboard && navigator.clipboard.writeText('Nội dung bài giảng được bảo vệ').catch(() => {});
  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (k === 'printscreen') {
      shield(true);
      wipeClipboard();
      report('printscreen');
      return;
    }
    if (e.metaKey && e.shiftKey) {
      // Win+Shift+S (Windows) / Cmd+Shift+3/4/5 (macOS)
      shield(true);
      report('snip');
      return;
    }
    if (mod && ['s', 'p', 'c', 'x', 'a', 'u'].includes(k)) {
      e.preventDefault();
      report({ s: 'save', p: 'print', u: 'devtools' }[k] || 'copy');
    }
    if (k === 'f12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
      e.preventDefault();
      report('devtools');
    }
  });
  document.addEventListener('keyup', (e) => {
    if ((e.key || '').toLowerCase() === 'printscreen') {
      wipeClipboard();
      setTimeout(() => document.hasFocus() && shield(false), 1500);
    }
  });

  /* 4. Chặn chuột phải, kéo thả, bôi đen, sao chép, in */
  ['contextmenu', 'dragstart', 'selectstart'].forEach((ev) => el.addEventListener(ev, (e) => e.preventDefault()));
  ['copy', 'cut'].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      e.preventDefault();
      report('copy');
    })
  );
  window.addEventListener('beforeprint', () => {
    shield(true);
    report('print');
  });
  window.addEventListener('afterprint', () => shield(false));
}
