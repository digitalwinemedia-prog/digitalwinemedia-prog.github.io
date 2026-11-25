import Lenis from 'lenis';
import { initField } from './particles.js?v=4';

// switch to dillon@digitalwinemedia.com once the domain email is live
const CONTACT_EMAIL = 'digitalwinemedia@gmail.com';
const reduced =matchMedia('(prefers-reduced-motion: reduce)').matches;

// smooth scroll
let lenis;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  window.lenis = lenis;
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const el = document.querySelector(a.getAttribute('href'));
    if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -20 }); document.querySelector('.nav')?.classList.remove('open'); }
  }));
}

// particles: wait for the brand font so the shape samples correctly
const canvas = document.getElementById('field');
if (canvas) {
  const cfg = JSON.parse(canvas.dataset.cfg || '{}');
  Promise.all([document.fonts.load('400 120px "Anton"'), document.fonts.load('700 20px "Space Mono"')])
    .catch(() => {}).then(() => initField(canvas, cfg));
}

// progress bar
const bar = document.getElementById('progress');
addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - innerHeight;
  if (bar) bar.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
}, { passive: true });

// split headings into words for the rise in
// walks text nodes so nested spans (like the red words) survive
document.querySelectorAll('.split').forEach(el => {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  nodes.forEach(n => {
    const frag = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach(w => {
      if (!w) return;
      if (!w.trim()) { frag.append(document.createTextNode(w)); return; }
      const o = document.createElement('span'); o.className = 'w';
      const i = document.createElement('span'); i.textContent = w; o.append(i); frag.append(o);
    });
    n.replaceWith(frag);
  });
  el.querySelectorAll('.w>span').forEach((s, i) => s.style.transitionDelay = (i * 0.06) + 's');
});

// chapter rail built from sections
const rail = document.querySelector('.rail');
const chapters = [...document.querySelectorAll('[data-chapter]')];
if (rail && chapters.length) {
  chapters.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${String(i + 1).padStart(2, '0')} ${s.dataset.chapter}</span>`;
    li.addEventListener('click', () => lenis ? lenis.scrollTo(s) : s.scrollIntoView({ behavior: 'smooth' }));
    rail.append(li);
  });
  const lis = [...rail.children];
  const mark = () => {
    let idx = 0;
    chapters.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.5) idx = i; });
    lis.forEach((l, i) => l.classList.toggle('on', i === idx));
  };
  addEventListener('scroll', mark, { passive: true }); mark();
}

// reveal on view
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.18 });
document.querySelectorAll('.rv,.split,.glitch').forEach(el => io.observe(el));
// a fully clipped element never counts as visible, so watch its parent for the wipe
document.querySelectorAll('.wipe').forEach(w => {
  const o = new IntersectionObserver(es => { if (es[0].isIntersecting) { w.classList.add('in'); o.disconnect(); } }, { threshold: 0.12 });
  o.observe(w.parentElement);
});

// videos play only while on screen
const vio = new IntersectionObserver(es => es.forEach(e => {
  const v = e.target; if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
}), { threshold: 0.1 });
document.querySelectorAll('video[data-lazy]').forEach(v => vio.observe(v));

// cursor label over work tiles
const cur = document.querySelector('.cursor');
if (cur && matchMedia('(hover:hover)').matches) {
  let x = 0, y = 0, cx = 0, cy = 0;
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
  (function loop() { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; cur.style.translate = `${cx}px ${cy}px`; requestAnimationFrame(loop); })();
  document.querySelectorAll('[data-cursor]').forEach(el => {
    el.addEventListener('pointerenter', () => { cur.textContent = el.dataset.cursor; cur.classList.add('on'); });
    el.addEventListener('pointerleave', () => cur.classList.remove('on'));
  });
  addEventListener('scroll', () => cur.classList.remove('on'), { passive: true });
}

// product cards tilt toward the cursor
if (!reduced && matchMedia('(hover:hover)').matches) {
  document.querySelectorAll('.product').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg)`;
    });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });
}

// buy buttons. Paste each product's Lemon Squeezy checkout link into data-checkout.
document.querySelectorAll('[data-checkout]').forEach(btn => {
  const url = btn.dataset.checkout;
  if (url) {
    btn.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
  } else {
    btn.querySelector('span').textContent = 'Notify me';
    btn.addEventListener('click', () => {
      const name = btn.closest('.product')?.querySelector('h3')?.textContent || 'the drop';
      location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Notify me: ' + name)}`;
    });
  }
});

// shop filters
document.querySelectorAll('.filters button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.filters button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const f = b.dataset.f;
  document.querySelectorAll('.product').forEach(p => p.style.display = (f === 'all' || p.dataset.cat === f) ? '' : 'none');
}));

// mobile menu
document.querySelector('.burger')?.addEventListener('click', () => {
  const n = document.querySelector('.nav'); n.classList.toggle('open');
  document.querySelector('.burger').textContent = n.classList.contains('open') ? 'Close' : 'Menu';
});

document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
