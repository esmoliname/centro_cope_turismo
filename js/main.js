'use strict';

/**
 * Centro Cope — Landing Page Interactive Controller
 * Pure ES6+ modules: Smart Floating Navbar, Accessible M3 FAQ Accordion,
 * Apple-style Gallery Lightbox, and Progressive Reveal-on-Scroll.
 */

(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ========================================================================
     1. Smart Floating Navigation & Mobile Menu
     ======================================================================== */
  function initNavigation() {
    const navShell = document.getElementById('navbar-shell');
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const menuPanel = document.getElementById('mobile-menu-panel');
    const navLinks = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
    const mobileLinks = menuPanel ? Array.from(menuPanel.querySelectorAll('a[href^="#"]')) : [];

    // Scroll-aware Liquid Glass elevation
    if (navShell) {
      let ticking = false;
      const updateNavState = () => {
        const isScrolled = window.scrollY > 24;
        navShell.classList.toggle('is-scrolled', isScrolled);
        ticking = false;
      };

      updateNavState();
      window.addEventListener(
        'scroll',
        () => {
          if (!ticking) {
            window.requestAnimationFrame(updateNavState);
            ticking = true;
          }
        },
        { passive: true }
      );
    }

    // Mobile drawer controls
    if (menuToggle && menuPanel) {
      const setMenuOpen = (open) => {
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
        menuPanel.setAttribute('data-open', String(open));
        menuPanel.setAttribute('aria-hidden', String(!open));
      };

      menuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
        setMenuOpen(!isOpen);
      });

      mobileLinks.forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false));
      });

      document.addEventListener('click', (event) => {
        const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
        if (!isOpen) return;
        const clickedInside = menuPanel.contains(event.target) || menuToggle.contains(event.target);
        if (!clickedInside) {
          setMenuOpen(false);
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
          setMenuOpen(false);
          menuToggle.focus();
        }
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth >= 768 && menuToggle.getAttribute('aria-expanded') === 'true') {
          setMenuOpen(false);
        }
      });
    }

    // Active section scroll spy
    const sections = navLinks
      .map((link) => {
        const targetId = link.getAttribute('href');
        const section = targetId ? document.querySelector(targetId) : null;
        return section ? { id: targetId, section } : null;
      })
      .filter(Boolean);

    if (sections.length > 0 && 'IntersectionObserver' in window) {
      const setActiveLink = (activeHref) => {
        navLinks.forEach((link) => {
          const isMatch = link.getAttribute('href') === activeHref;
          link.classList.toggle('is-active', isMatch);
          if (isMatch) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      };

      const sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveLink(`#${entry.target.id}`);
            }
          });
        },
        {
          rootMargin: '-32% 0px -55% 0px',
          threshold: 0.01,
        }
      );

      sections.forEach(({ section }) => sectionObserver.observe(section));
    }
  }

  /* ========================================================================
     2. Accessible Material Design 3 FAQ Accordion
     ======================================================================== */
  function initFaqAccordion() {
    const items = Array.from(document.querySelectorAll('[data-faq-item]'));
    if (items.length === 0) return;

    const triggers = items
      .map((item) => item.querySelector('[data-faq-trigger]'))
      .filter(Boolean);

    const setItemState = (item, open) => {
      const trigger = item.querySelector('[data-faq-trigger]');
      const panel = item.querySelector('[data-faq-panel]');
      if (!trigger || !panel) return;

      item.setAttribute('data-open', String(open));
      trigger.setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
    };

    items.forEach((item, index) => {
      const trigger = item.querySelector('[data-faq-trigger]');
      if (!trigger) return;

      trigger.addEventListener('click', () => {
        const isCurrentlyOpen = trigger.getAttribute('aria-expanded') === 'true';

        // Close siblings for clean M3 single-expand ergonomics
        items.forEach((otherItem) => {
          if (otherItem !== item) {
            setItemState(otherItem, false);
          }
        });

        setItemState(item, !isCurrentlyOpen);
      });

      // WAI-ARIA keyboard navigation across accordion headers
      trigger.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowDown') {
          nextIndex = (index + 1) % triggers.length;
        } else if (event.key === 'ArrowUp') {
          nextIndex = (index - 1 + triggers.length) % triggers.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = triggers.length - 1;
        }

        if (nextIndex !== null) {
          event.preventDefault();
          triggers[nextIndex].focus();
        }
      });
    });
  }

  /* ========================================================================
     3. Interactive Gallery Lightbox Modal (Keyboard + Touch Swipe)
     ======================================================================== */
  function initGalleryLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const triggers = Array.from(document.querySelectorAll('[data-gallery-item]'));
    if (!modal || triggers.length === 0) return;

    const imgEl = document.getElementById('lightbox-image');
    const titleEl = document.getElementById('lightbox-title');
    const captionEl = document.getElementById('lightbox-caption');
    const tagEl = document.getElementById('lightbox-tag');
    const counterEl = document.getElementById('lightbox-counter');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    const slides = triggers.map((el) => ({
      src: el.dataset.src || '',
      alt: el.dataset.alt || el.dataset.title || 'Fotografía de Centro Cope',
      title: el.dataset.title || '',
      caption: el.dataset.caption || '',
      tag: el.dataset.tag || '',
    }));

    let currentIndex = 0;
    let lastFocusedTrigger = null;
    let touchStartX = 0;

    const preloadAdjacent = (index) => {
      const nextIdx = (index + 1) % slides.length;
      const prevIdx = (index - 1 + slides.length) % slides.length;
      [slides[nextIdx], slides[prevIdx]].forEach((slide) => {
        if (slide && slide.src) {
          const preloader = new Image();
          preloader.src = slide.src;
        }
      });
    };

    const renderSlide = (index) => {
      currentIndex = (index + slides.length) % slides.length;
      const slide = slides[currentIndex];
      if (!slide) return;

      if (imgEl) {
        imgEl.src = slide.src;
        imgEl.alt = slide.alt;
      }
      if (titleEl) titleEl.textContent = slide.title;
      if (captionEl) captionEl.textContent = slide.caption;
      if (tagEl) tagEl.textContent = slide.tag;
      if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${slides.length}`;

      preloadAdjacent(currentIndex);
    };

    const openLightbox = (index, triggerEl) => {
      lastFocusedTrigger = triggerEl || document.activeElement;
      renderSlide(index);
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      if (closeBtn) {
        window.requestAnimationFrame(() => closeBtn.focus());
      }
    };

    const closeLightbox = () => {
      if (modal.getAttribute('aria-hidden') === 'true') return;
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
        lastFocusedTrigger.focus();
      }
    };

    const showPrev = () => renderSlide(currentIndex - 1);
    const showNext = () => renderSlide(currentIndex + 1);

    triggers.forEach((trigger, index) => {
      trigger.addEventListener('click', () => openLightbox(index, trigger));
    });

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', showPrev);
    if (nextBtn) nextBtn.addEventListener('click', showNext);

    // Close when clicking the blurred backdrop outside the media card
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.hasAttribute('data-lightbox-dismiss')) {
        closeLightbox();
      }
    });

    // Keyboard controls & focus containment
    document.addEventListener('keydown', (event) => {
      if (modal.getAttribute('aria-hidden') === 'true') return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      } else if (event.key === 'Tab') {
        const focusables = [closeBtn, prevBtn, nextBtn].filter(Boolean);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Touch swipe navigation on mobile
    modal.addEventListener(
      'touchstart',
      (event) => {
        if (event.changedTouches.length > 0) {
          touchStartX = event.changedTouches[0].clientX;
        }
      },
      { passive: true }
    );

    modal.addEventListener(
      'touchend',
      (event) => {
        if (event.changedTouches.length === 0) return;
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) >= 45) {
          if (deltaX > 0) {
            showPrev();
          } else {
            showNext();
          }
        }
      },
      { passive: true }
    );
  }

  /* ========================================================================
     4. Progressive Reveal-on-Scroll (IntersectionObserver)
     ======================================================================== */
  function initRevealOnScroll() {
    const revealElements = Array.from(document.querySelectorAll('.reveal'));
    if (revealElements.length === 0) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealElements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    document.documentElement.classList.add('js-reveal-ready');

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -36px 0px',
      }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  }

  /* ========================================================================
     Bootstrap
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFaqAccordion();
    initGalleryLightbox();
    initRevealOnScroll();
  });
})();
