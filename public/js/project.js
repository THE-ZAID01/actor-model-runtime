const links = [...document.querySelectorAll('.side-link[href^="#"]')];
const sections = links
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) =>
        link.classList.toggle('active', link.hash === `#${visible.target.id}`),
      );
    },
    { rootMargin: '-15% 0px -70% 0px', threshold: [0, 0.2, 0.5] },
  );
  sections.forEach((section) => observer.observe(section));
}

const copyButton = document.querySelector('[data-copy]');
copyButton?.addEventListener('click', async () => {
  const original = copyButton.textContent;
  try {
    await navigator.clipboard.writeText(
      copyButton.dataset.copy.replaceAll('&#10;', '\n'),
    );
    copyButton.textContent = 'COPIED';
  } catch {
    copyButton.textContent = 'COPY UNAVAILABLE';
  }
  window.setTimeout(() => {
    copyButton.textContent = original;
  }, 1600);
});
