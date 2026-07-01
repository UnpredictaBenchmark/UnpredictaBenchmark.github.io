document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('nav');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const copyBtn = document.getElementById('copy-bibtex');
  const bibtex = document.getElementById('bibtex');
  const sections = document.querySelectorAll('main section[id]');
  const themeToggle = document.getElementById('theme-toggle');

  function syncThemeSwitch(theme) {
    if (!themeToggle) return;
    themeToggle.querySelectorAll('.theme-switch-seg').forEach(seg => {
      seg.classList.toggle('active', seg.dataset.themeValue === theme);
    });
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      theme = 'light';
    }
    localStorage.setItem('theme', theme);
    syncThemeSwitch(theme);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  if (themeToggle) {
    const initial = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    syncThemeSwitch(initial);

    themeToggle.addEventListener('click', e => {
      const seg = e.target.closest('.theme-switch-seg');
      if (!seg) return;
      applyTheme(seg.dataset.themeValue);
    });
  }

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);

    let current = '';
    sections.forEach(section => {
      if (window.scrollY >= section.offsetTop - 120) {
        current = section.id;
      }
    });

    navLinks.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${current}`);
    });
  });

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  if (copyBtn && bibtex) {
    copyBtn.addEventListener('click', async () => {
      const text = bibtex.textContent.trim();
      const label = copyBtn.querySelector('span');
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.classList.add('copied');
        label.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          label.textContent = 'Copy';
        }, 2000);
      } catch {
        const range = document.createRange();
        range.selectNode(bibtex);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        label.textContent = 'Copied!';
        setTimeout(() => { label.textContent = 'Copy'; }, 2000);
      }
    });
  }
});