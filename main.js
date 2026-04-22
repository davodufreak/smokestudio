/* =============================================
   SMOKE STUDIO — main.js
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ─── NAV SCROLL EFFECT ─── */
  const navWrapper = document.getElementById('nav-wrapper');
  window.addEventListener('scroll', () => {
    navWrapper.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  /* ─── MOBILE MENU ─── 
     Expands the pill itself, no overlay, no separate layer.
  ─── */
  const hamburger    = document.getElementById('hamburger');
  const mobileMenu   = document.getElementById('mobile-menu');
  const mobileClose  = document.getElementById('mobile-close');
  const mobileLinks  = document.querySelectorAll('.mobile-link:not(.mobile-link--accordion), .mobile-sublink');

  function openMenu() {
    mobileMenu.classList.add('open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    
    // Focus first focusable element
    const focusable = mobileMenu.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }

  function closeMenu() {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    // Also close services submenu when closing main menu
    const sub = document.getElementById('mobile-servicios-sub');
    const btn = document.getElementById('mobile-servicios-btn');
    if (sub) sub.classList.remove('open');
    if (btn) btn.classList.remove('open');
    hamburger.focus(); // Return focus
  }

  hamburger.addEventListener('click', () => {
    mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
  });
  mobileClose.addEventListener('click', closeMenu);
  mobileLinks.forEach(l => l.addEventListener('click', closeMenu));

  // Focus trap and Escape key
  document.addEventListener('keydown', (e) => {
    if (!mobileMenu.classList.contains('open')) return;
    
    if (e.key === 'Escape') {
      closeMenu();
      return;
    }
    
    if (e.key === 'Tab') {
      const focusable = Array.from(mobileMenu.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Mobile servicios sub-accordion
  const mobileSrvBtn = document.getElementById('mobile-servicios-btn');
  const mobileSrvSub = document.getElementById('mobile-servicios-sub');
  if (mobileSrvBtn && mobileSrvSub) {
    mobileSrvBtn.addEventListener('click', () => {
      const isOpen = mobileSrvSub.classList.toggle('open');
      mobileSrvBtn.classList.toggle('open', isOpen);
    });
  }

  /* ─── SCROLL REVEAL ─── */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ─── SERVICES ACCORDION ───
     All items start CLOSED. Only one opens at a time.
     Clicking an open item closes it (toggle).
  ─── */
  const accordionItems = document.querySelectorAll('.accordion__item');

  accordionItems.forEach((item) => {
    const btn = item.querySelector('.accordion__header');

    btn.addEventListener('click', () => {
      const isCurrentlyOpen = item.classList.contains('open');

      // Close ALL items
      accordionItems.forEach(i => {
        i.classList.remove('open');
        i.querySelector('.accordion__header').setAttribute('aria-expanded', 'false');
      });

      // If the clicked one was NOT open → open it now
      if (!isCurrentlyOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');

        // Smooth scroll on mobile so panel comes into view
        if (window.innerWidth < 768) {
          setTimeout(() => {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 120);
        }
      }
      // If it WAS open → we already closed it above (toggle closed)
    });
  });

  /* ─── FAQ ACCORDION ─── */
  const faqItems = document.querySelectorAll('.faq__item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq__question');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq__question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ─── SMOOTH SCROLL FOR ANCHOR LINKS ─── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 88;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ─── ACTIVE NAV LINK ON SCROLL — Commented out to prevent interference with multi-page active states ─── */
  /*
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(s => sectionObserver.observe(s));
  */

  /* ─── PARALLAX HERO BG ─── */
  const heroBg = document.querySelector('.hero__bg img');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      heroBg.style.transform = `translateY(${scrolled * 0.18}px)`;
    }, { passive: true });
  }

  /* ─── LOGO TICKER — respect reduced motion ─── */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logosTrack = document.querySelector('.logos-track');
  if (logosTrack && prefersReduced) {
    logosTrack.style.animationPlayState = 'paused';
  }

});
