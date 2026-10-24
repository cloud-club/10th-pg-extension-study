(() => {
  const menu = document.querySelector('.mobile-menu');
  const overlay = document.querySelector('.mobile-overlay');
  const body = document.body;
  const progress = document.querySelector('.read-progress');
  const setMenu = (open) => {
    body.classList.toggle('nav-open', open);
    menu?.setAttribute('aria-expanded', String(open));
    menu?.setAttribute('aria-label', open ? '목차 닫기' : '목차 열기');
  };
  menu?.addEventListener('click', () => setMenu(!body.classList.contains('nav-open')));
  overlay?.addEventListener('click', () => setMenu(false));
  document.querySelectorAll('.toc a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
  const anchors = [...document.querySelectorAll('.toc a[href^="#"]')];
  const sections = anchors.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      anchors.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
    }, { rootMargin: '-12% 0px -72% 0px', threshold: [0, .2, .5] });
    sections.forEach(section => observer.observe(section));
  }
})();
