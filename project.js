(function () {
  function setupReveal() {
    var items = document.querySelectorAll(".project-card, .project-video, .project-text, .project-meta");
    items.forEach(function (item, index) {
      item.classList.add("reveal-item");
      item.style.transitionDelay = Math.min(index % 6, 4) * 45 + "ms";
    });

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) {
        item.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.08
    });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function setupMomentsCarousel() {
    document.querySelectorAll(".moments-carousel").forEach(function (carousel) {
      var slides = Array.prototype.slice.call(carousel.querySelectorAll(".moments-slide"));
      var prev = carousel.querySelector(".moments-control.prev");
      var next = carousel.querySelector(".moments-control.next");
      var current = 0;
      var startX = 0;
      var dragX = 0;
      var dragging = false;
      var didDrag = false;
      var suppressClick = false;

      function wrap(index) {
        return (index % slides.length + slides.length) % slides.length;
      }

      function signedOffset(index) {
        var raw = index - current;
        var half = slides.length / 2;
        if (raw > half) raw -= slides.length;
        if (raw < -half) raw += slides.length;
        return raw;
      }

      function render() {
        slides.forEach(function (slide, index) {
          var offset = signedOffset(index);
          var distance = Math.abs(offset);
          var hidden = distance > 2;
          var x = offset * 430;
          var y = distance === 0 ? -12 : distance * 18;
          var scale = distance === 0 ? 1 : distance === 1 ? .78 : .58;
          var opacity = hidden ? 0 : distance === 0 ? 1 : distance === 1 ? .72 : .38;
          var blur = hidden ? 10 : distance === 0 ? 0 : distance === 1 ? 2 : 5;

          slide.classList.toggle("is-active", distance === 0);
          slide.setAttribute("aria-current", distance === 0 ? "true" : "false");
          slide.tabIndex = hidden ? -1 : 0;
          slide.style.pointerEvents = hidden ? "none" : "auto";
          slide.style.zIndex = String(40 - distance * 10);
          slide.style.opacity = String(opacity);
          slide.style.filter = "blur(" + blur + "px)";
          slide.style.transform = "translate(-50%, -50%) translate(" + x + "px, " + y + "px) scale(" + scale + ")";
        });
      }

      function go(step) {
        current = wrap(current + step);
        render();
      }

      function scrollToSlideTarget(slide) {
        var targetId = slide.dataset.target;
        var target = targetId ? document.getElementById(targetId) : null;
        if (!target) return;

        var rect = target.getBoundingClientRect();
        var top = rect.top + window.pageYOffset - 80;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: "smooth"
        });
      }

      slides.forEach(function (slide, index) {
        slide.addEventListener("click", function () {
          if (suppressClick) return;
          var offset = signedOffset(index);
          if (offset !== 0) {
            current = wrap(current + offset);
            render();
          }
          window.setTimeout(function () {
            scrollToSlideTarget(slide);
          }, 120);
        });
      });

      if (prev) {
        prev.addEventListener("click", function () {
          go(-1);
        });
      }

      if (next) {
        next.addEventListener("click", function () {
          go(1);
        });
      }

      carousel.addEventListener("wheel", function (event) {
        event.preventDefault();
        go(event.deltaY > 0 || event.deltaX > 0 ? 1 : -1);
      }, { passive: false });

      carousel.addEventListener("keydown", function (event) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        }
      });

      carousel.addEventListener("pointerdown", function (event) {
        dragging = true;
        didDrag = false;
        startX = event.clientX;
        dragX = 0;
        carousel.classList.add("is-dragging");
        carousel.setPointerCapture(event.pointerId);
      });

      carousel.addEventListener("pointermove", function (event) {
        if (!dragging) return;
        dragX = event.clientX - startX;
        if (Math.abs(dragX) > 8) didDrag = true;
      });

      function finishDrag() {
        if (!dragging) return;
        dragging = false;
        carousel.classList.remove("is-dragging");
        if (Math.abs(dragX) > 60) {
          go(dragX < 0 ? 1 : -1);
        }
        if (didDrag) {
          suppressClick = true;
          window.setTimeout(function () {
            suppressClick = false;
            didDrag = false;
          }, 180);
        }
      }

      carousel.addEventListener("pointerup", finishDrag);
      carousel.addEventListener("pointercancel", finishDrag);
      carousel.addEventListener("pointerleave", finishDrag);

      render();
    });
  }

  function setupPopmartSwap() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".popmart-swap-card"));
    if (!cards.length) return;

    var slots = {
      left: { left: 237, top: 622, width: 749, height: 1059 },
      center: { left: 1036, top: 504, width: 915, height: 1294 },
      right: { left: 2000, top: 622, width: 749, height: 1059 }
    };

    function applySlot(card, slotName) {
      var slot = slots[slotName];
      if (!slot) return;
      card.dataset.slot = slotName;
      card.style.left = slot.left + "px";
      card.style.top = slot.top + "px";
      card.style.width = slot.width + "px";
      card.style.height = slot.height + "px";
    }

    cards.forEach(function (card) {
      card.style.transitionDelay = "0ms";
      applySlot(card, card.dataset.slot || "left");
      card.addEventListener("click", function () {
        var clickedSlot = card.dataset.slot;
        if (clickedSlot === "center") return;

        var centerCard = cards.find(function (item) {
          return item.dataset.slot === "center";
        });
        if (!centerCard) return;

        applySlot(centerCard, clickedSlot);
        applySlot(card, "center");
      });
    });
  }

  function setupWork5SeriesTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".work5-series-tab"));
    if (!tabs.length) return;
    var popmartCards = Array.prototype.slice.call(document.querySelectorAll('.work5-series-card[data-series="popmart"]'));
    var wahahaCards = Array.prototype.slice.call(document.querySelectorAll('.work5-series-card[data-series="wahaha"]'));
    var desc = document.querySelector("[data-series-desc]");
    var copies = Array.prototype.slice.call(document.querySelectorAll("[data-series-copy]")).reduce(function (all, item) {
      all[item.dataset.seriesCopy] = item.innerHTML;
      return all;
    }, {});

    function setSeries(series) {
      var showPopmart = series === "popmart";
      popmartCards.forEach(function (card) {
        card.classList.toggle("work5-series-hidden", !showPopmart);
      });
      wahahaCards.forEach(function (card) {
        card.classList.toggle("work5-series-hidden", showPopmart);
      });
      if (desc && copies[series]) {
        desc.innerHTML = copies[series];
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var series = tab.dataset.series || "popmart";
        tabs.forEach(function (item) {
          var active = item === tab;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        setSeries(series);
      });
    });

    var activeTab = tabs.find(function (tab) {
      return tab.classList.contains("is-active");
    });
    setSeries(activeTab ? activeTab.dataset.series : "popmart");
  }

  function initProjectPage() {
    setupReveal();
    setupMomentsCarousel();
    setupPopmartSwap();
    setupWork5SeriesTabs();
  }

  window.initProjectPage = initProjectPage;

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initProjectPage, { once: true });
  } else {
    initProjectPage();
  }
})();
