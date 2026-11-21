// Tiện ích giao diện nhỏ – không cần thư viện ngoài
document.addEventListener('DOMContentLoaded', () => {
  // Hỏi xác nhận trước thao tác xóa
  document.querySelectorAll('form[data-confirm]').forEach((f) =>
    f.addEventListener('submit', (e) => {
      if (!confirm(f.dataset.confirm)) e.preventDefault();
    })
  );

  // Nút in báo cáo
  document.querySelectorAll('[data-action="print"]').forEach((b) => b.addEventListener('click', () => window.print()));

  // Toàn màn hình khi đọc bài giảng
  document.querySelectorAll('[data-action="fullscreen"]').forEach((b) =>
    b.addEventListener('click', () => {
      const el = document.getElementById('reader-content');
      if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
      else document.exitFullscreen();
    })
  );

  // Chuyển tab "Tải tệp lên" / "Soạn Markdown"
  document.querySelectorAll('[data-seg]').forEach((seg) => {
    const btns = seg.querySelectorAll('button');
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        btns.forEach((x) => {
          x.classList.toggle('active', x === b);
          document.getElementById(x.dataset.target).classList.toggle('hidden', x !== b);
        });
      })
    );
  });

  // Tự ẩn thông báo
  const alert = document.querySelector('main > .alert');
  if (alert) setTimeout(() => (alert.style.opacity = '0'), 6000);
});
