/* ============================================================
   CONFIGURATION — edit these values to update the site
   ============================================================ */

const BRAND_NAME = 'Moment';

const ORDER_FORM_URL = 'create.html';

const INSTAGRAM_URL = 'https://instagram.com/yourhandle';

const PROMO_VIDEO = {
  src: 'assets/promo.mp4',
  poster: 'assets/promo-poster.jpg',
};

const EXPERIENCES = {
  romantic: 'romantic.html',
  apology: 'apology.html',
  birthday: 'birthday.html',
  yearWrapped: 'reel.html',
  wedding: 'wedding.html',
  friendship: 'friendship.html',
  anniversary: 'anniversary.html',
  confession: 'confession.html',
};

const DEMO_IMAGES = {
  romantic: '',
  apology: '',
  birthday: '',
  yearWrapped: '',
  wedding: '',
  friendship: '',
  anniversary: '',
  confession: '',
};

const TESTIMONIALS = [
  {
    quote: 'It felt like way more than a message.',
    author: 'Placeholder — add real review',
  },
  {
    quote: "Bro, if someone made this for me, I'd remember it.",
    author: 'Placeholder — add real review',
  },
  {
    quote: "Honestly couldn't express it with just emojis or a normal gift.",
    author: 'Placeholder — add real review',
  },
];

const OCCASIONS = [
  { id: 'birthday', label: 'Birthday', icon: '🎂', demo: 'birthday' },
  { id: 'anniversary', label: 'Anniversary', icon: '✨', demo: 'anniversary' },
  { id: 'apology', label: 'Apology', icon: '🥀', demo: 'apology' },
  { id: 'confession', label: 'Confession', icon: '💌', demo: 'confession' },
  { id: 'romantic', label: 'Romantic', icon: '❤️', demo: 'romantic' },
  { id: 'friendship', label: 'Friendship', icon: '🫂', demo: 'friendship' },
  { id: 'wedding', label: 'Wedding', icon: '💍', demo: 'wedding' },
  { id: 'engagement', label: 'Engagement', icon: '💫', demo: 'wedding' },
  { id: 'farewell', label: 'Farewell', icon: '🌅', demo: null },
  { id: 'yearWrapped', label: 'Year Wrapped', icon: '🎬', demo: 'yearWrapped' },
  { id: 'valentines', label: "Valentine's", icon: '💕', demo: 'romantic' },
  { id: 'justBecause', label: 'Just Because', icon: '🌟', demo: null },
];

const DEMO_CARDS = [
  {
    key: 'romantic',
    emoji: '❤️',
    title: 'Romantic',
    description: 'Soft light, slow reveals, and words that land.',
    theme: 'romantic',
  },
  {
    key: 'apology',
    emoji: '🥀',
    title: 'Apology',
    description: 'Honest, tender, and impossible to ignore.',
    theme: 'apology',
  },
  {
    key: 'birthday',
    emoji: '😂',
    title: 'Birthday Roast',
    description: 'Playful chaos with love underneath.',
    theme: 'birthday',
  },
  {
    key: 'yearWrapped',
    emoji: '🎬',
    title: 'Year Wrapped',
    description: 'Your year, told like a film.',
    theme: 'year-wrapped',
  },
  {
    key: 'wedding',
    emoji: '💍',
    title: 'Wedding',
    description: 'Elegant pages for the biggest day.',
    theme: 'wedding',
  },
  {
    key: 'friendship',
    emoji: '🫂',
    title: 'Friendship',
    description: 'Inside jokes turned into something real.',
    theme: 'friendship',
  },
  {
    key: 'anniversary',
    emoji: '✨',
    title: 'Anniversary',
    description: 'Every chapter of your story, alive.',
    theme: 'anniversary',
  },
  {
    key: 'confession',
    emoji: '💌',
    title: 'Confession',
    description: 'The words you kept in your notes app.',
    theme: 'confession',
  },
];

/* ============================================================
   DOM SETUP
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initBrand();
  initNav();
  initDemoCards();
  initOccasions();
  initTestimonials();
  initCTAs();
  initPromoVideo();
  initScrollReveal();
  initStoryTransform();
  initHeroParallax();
  initReducedMotion();
});

function initBrand() {
  document.querySelectorAll('[data-brand]').forEach((el) => {
    el.textContent = BRAND_NAME;
  });
}

function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');

  if (!nav || !toggle || !menu) return;

  let lastScroll = 0;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      nav.classList.toggle('nav--scrolled', y > 40);
      lastScroll = y;
    },
    { passive: true }
  );

  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('nav-menu--open');
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('nav-menu--open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initDemoCards() {
  const grid = document.getElementById('demo-grid');
  if (!grid) return;

  grid.innerHTML = DEMO_CARDS.map((card) => {
    const url = EXPERIENCES[card.key] || '#';
    const img = DEMO_IMAGES[card.key];
    const preview = img
      ? `<img src="${img}" alt="${card.title} preview" loading="lazy" class="demo-card__img">`
      : `<div class="demo-card__visual demo-card__visual--${card.theme}" aria-hidden="true">
           <span class="demo-card__emoji">${card.emoji}</span>
         </div>`;

    return `
      <a href="${url}" class="demo-card demo-card--${card.theme}" data-tilt>
        <div class="demo-card__preview">${preview}</div>
        <div class="demo-card__body">
          <span class="demo-card__tag">${card.emoji} ${card.title}</span>
          <p class="demo-card__desc">${card.description}</p>
          <span class="demo-card__link">Open Experience →</span>
        </div>
      </a>
    `;
  }).join('');

  initCardTilt();
}

function initOccasions() {
  const grid = document.getElementById('occasions-grid');
  if (!grid) return;

  grid.innerHTML = OCCASIONS.map((occ) => {
    const href = occ.demo && EXPERIENCES[occ.demo]
      ? EXPERIENCES[occ.demo]
      : '#experiences';
    const isExternal = href.endsWith('.html');

    return `
      <a href="${isExternal ? href : '#experiences'}" class="occasion-chip" ${!isExternal ? `data-scroll="${occ.demo ? '#experiences' : ''}"` : ''}>
        <span class="occasion-chip__icon">${occ.icon}</span>
        <span class="occasion-chip__label">${occ.label}</span>
      </a>
    `;
  }).join('');
}

function initTestimonials() {
  const track = document.getElementById('testimonials-track');
  if (!track) return;

  track.innerHTML = TESTIMONIALS.map(
    (t) => `
    <blockquote class="testimonial">
      <p class="testimonial__quote">"${t.quote}"</p>
      <footer class="testimonial__author">— ${t.author}</footer>
    </blockquote>
  `
  ).join('');
}

function initCTAs() {
  document.querySelectorAll('[data-order-link]').forEach((el) => {
    el.setAttribute('href', ORDER_FORM_URL);
  });

  const igLink = document.getElementById('footer-instagram');
  if (igLink) igLink.setAttribute('href', INSTAGRAM_URL);
}

function initPromoVideo() {
  const video = document.getElementById('promo-video');
  if (!video) return;

  video.setAttribute('poster', PROMO_VIDEO.poster);

  const source = video.querySelector('source');
  if (source) source.setAttribute('src', PROMO_VIDEO.src);

  const playBtn = document.getElementById('video-play');
  if (!playBtn) return;

  playBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play().catch(() => {});
      playBtn.classList.add('is-hidden');
    }
  });

  video.addEventListener('pause', () => {
    if (video.currentTime > 0 && !video.ended) {
      playBtn.classList.remove('is-hidden');
    }
  });

  video.addEventListener('ended', () => {
    playBtn.classList.remove('is-hidden');
  });
}
// Add this to your script.js file
const video = document.getElementById('promo-video');
const playBtn = document.getElementById('video-play');

if (playBtn) {
  playBtn.addEventListener('click', () => {
    // Unmute the video so audio can be heard
    video.muted = false;
    
    // Play the video
    video.play();
    
    // Hide the play button overlay
    playBtn.style.display = 'none';
  });
}

function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach((el) => observer.observe(el));
}

function initStoryTransform() {
  const section = document.getElementById('story-transform');
  if (!section) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        section.classList.toggle('is-active', entry.isIntersecting);
      });
    },
    { threshold: 0.35 }
  );

  observer.observe(section);
}

function initHeroParallax() {
  const hero = document.getElementById('hero-visual');
  if (!hero) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (reduced || !finePointer) return;

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    hero.style.setProperty('--px', String(x));
    hero.style.setProperty('--py', String(y));
  });

  hero.addEventListener('mouseleave', () => {
    hero.style.setProperty('--px', '0');
    hero.style.setProperty('--py', '0');
  });
}

function initCardTilt() {
  const cards = document.querySelectorAll('[data-tilt]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (reduced || !finePointer) return;

  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tx', String(x * 8));
      card.style.setProperty('--ty', String(y * -8));
      card.style.setProperty('--rx', String(y * -6));
      card.style.setProperty('--ry', String(x * 6));
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--tx', '0');
      card.style.setProperty('--ty', '0');
      card.style.setProperty('--rx', '0');
      card.style.setProperty('--ry', '0');
    });
  });
}

function initReducedMotion() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    document.documentElement.classList.toggle('reduce-motion', reduced.matches);
  };
  apply();
  reduced.addEventListener('change', apply);
}
