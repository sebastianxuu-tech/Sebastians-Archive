(function () {
  window.__portfolioMotionVersion = "motion17-spa";
  document.documentElement.dataset.motionVersion = "motion17-spa";

  function isWorkPage() {
    return /(?:^|\/)work[1-9]\.html$/i.test(window.location.pathname);
  }

  function isSummaryPage() {
    return /(?:^|\/)summary\.html$/i.test(window.location.pathname) || !!document.querySelector(".summary-card");
  }

  function isInternalHtmlLink(link) {
    if (!link || !(link.dataset.motionHref || link.href)) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    var url = new URL(link.dataset.motionHref || link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.hash) return false;
    return /\.html$/i.test(url.pathname);
  }

  function assetKeyFromUrl(value) {
    if (!value) return "";
    try {
      var url = new URL(value, window.location.href);
      var name = decodeURIComponent(url.pathname.split("/").pop() || "");
      return name
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    } catch (error) {
      return "";
    }
  }

  function mediaAssetKey(media) {
    if (!media) return "";
    var tag = media.tagName ? media.tagName.toLowerCase() : "";
    if (tag === "video") {
      return assetKeyFromUrl(media.getAttribute("poster") || media.currentSrc || media.getAttribute("src"));
    }
    return assetKeyFromUrl(media.currentSrc || media.getAttribute("src"));
  }

  function elementAssetKey(element) {
    if (!element) return "";
    if (element.matches && element.matches("img, video")) return mediaAssetKey(element);
    return mediaAssetKey(element.querySelector && element.querySelector("img, video"));
  }

  function transitionNameForKey(key) {
    return key ? "asset-" + key : "";
  }

  function isLogoAsset(key) {
    return key === "logo";
  }

  function setTemporaryTransitionName(element, name, duration) {
    if (!element || !name) return;
    element.style.viewTransitionName = name;
    window.setTimeout(function () {
      if (element.style.viewTransitionName === name) {
        element.style.viewTransitionName = "";
      }
    }, duration || 1100);
  }

  function elementRect(element) {
    if (!element) return null;
    var rect = element.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function rotationFromTransform(transform) {
    if (!transform || transform === "none") return 0;
    var values = transform.match(/matrix\(([^)]+)\)/);
    if (!values) return 0;
    var parts = values[1].split(",").map(function (value) {
      return Number(value.trim());
    });
    if (parts.length < 2 || !isFinite(parts[0]) || !isFinite(parts[1])) return 0;
    return Math.atan2(parts[1], parts[0]) * 180 / Math.PI;
  }

  function visualState(element) {
    if (!element) return null;
    var computed = window.getComputedStyle(element);
    var angle = rotationFromTransform(computed.transform);
    var artboard = element.closest && element.closest(".artboard");
    var viewport = element.closest && element.closest(".viewport");

    if (artboard && viewport && !element.classList.contains("fixed-chrome-clone")) {
      var artboardRect = artboard.getBoundingClientRect();
      var scale = Number(viewport.dataset.scale || 1);
      return {
        left: artboardRect.left + element.offsetLeft * scale,
        top: artboardRect.top + element.offsetTop * scale,
        width: element.offsetWidth * scale,
        height: element.offsetHeight * scale,
        angle: angle
      };
    }

    var rect = elementRect(element);
    if (!rect) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      angle: angle
    };
  }

  function mediaSourceForBridge(element) {
    if (!element) return null;
    var media = element.matches && element.matches("img, video") ? element : element.querySelector("img, video");
    if (!media) return null;
    var tag = media.tagName.toLowerCase();
    return {
      tag: tag === "video" ? "video" : "img",
      src: tag === "video" ? (media.getAttribute("poster") || media.currentSrc || media.getAttribute("src")) : (media.currentSrc || media.getAttribute("src")),
      objectFit: window.getComputedStyle(media).objectFit || "cover"
    };
  }

  function bridgeRecord(key, element, options) {
    var state = visualState(element);
    if (!key || !state) return null;
    var media = mediaSourceForBridge(element);
    var computed = window.getComputedStyle(element);
    var record = {
      key: key,
      state: state,
      borderRadius: computed.borderRadius,
      boxShadow: computed.boxShadow,
      media: media,
      text: "",
      kind: options && options.kind ? options.kind : ""
    };

    if (!media) {
      record.text = (element.textContent || "").trim();
      record.color = computed.color;
      record.font = computed.font;
    }

    return record;
  }

  function chromeBridgeSources() {
    var sources = [];
    var logo = document.querySelector(".fixed-chrome-clone.logo");

    if (logo) sources.push({ key: "chrome-logo", element: logo, kind: "logo" });
    return sources;
  }

  function queueMotionBridgeTransitions(sources) {
    var used = {};
    var records = collectMotionBridgeRecords(sources, used);

    if (!records.length) return false;
    sessionStorage.setItem("motionBridgeTransitions", JSON.stringify(records));
    return true;
  }

  function collectMotionBridgeRecords(sources, used) {
    var seen = used || {};
    return chromeBridgeSources().concat(sources || []).map(function (source) {
      if (!source || !source.key || !source.element || seen[source.key]) return null;
      seen[source.key] = true;
      return bridgeRecord(source.key, source.element, { kind: source.kind });
    }).filter(Boolean).slice(0, 10);
  }

  function preferredSourceElementFromMedia(media) {
    if (!media) return null;
    return media.closest(".summary-card, .menu-card, .home-piece, .moments-slide") || media;
  }

  function visibleMedia(media) {
    if (!media) return false;
    var style = window.getComputedStyle(media);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    var rect = media.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }

  function collectUniqueAssetSources() {
    var selectors = [
      ".summary-card",
      ".menu-card",
      ".home-piece",
      ".artboard > .project-card",
      ".artboard > .project-video"
    ];
    var sources = [];
    var used = {};

    document.querySelectorAll(selectors.join(",")).forEach(function (element) {
      var key = elementAssetKey(element);
      if (!key || isLogoAsset(key) || used[key]) return;
      var media = element.matches("img, video") ? element : element.querySelector("img, video");
      if (!visibleMedia(media)) return;
      used[key] = true;
      sources.push({ key: key, element: preferredSourceElementFromMedia(media) || element });
    });

    return sources;
  }

  function firstProjectAssetSource() {
    var media = Array.prototype.find.call(
      document.querySelectorAll(".artboard > .project-card, .artboard > .project-video"),
      visibleMedia
    );
    if (!media) return null;
    var key = mediaAssetKey(media);
    if (!key || isLogoAsset(key)) return null;
    return { key: key, element: media };
  }

  function hasBridgeKey(records, key) {
    return (records || []).some(function (record) {
      return record && record.key === key;
    });
  }

  function findClickedAssetSource(link) {
    var media = link && link.querySelector && link.querySelector("img, video");
    if (!media || !visibleMedia(media)) return null;
    var key = mediaAssetKey(media);
    if (!key || isLogoAsset(key)) return null;
    return { key: key, element: preferredSourceElementFromMedia(media) };
  }

  function destinationPageName(link) {
    var url = new URL(link.dataset.motionHref || link.href, window.location.href);
    var file = (url.pathname.split("/").pop() || "").toLowerCase();
    return file === "index.html" ? "home.html" : file;
  }

  function currentPageName() {
    var file = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    return file === "index.html" ? "home.html" : file;
  }

  function queueSharedAssetTransitions(sources) {
    var usable = (sources || []).filter(function (source) {
      return source && source.key && source.element;
    }).slice(0, 8);
    if (!usable.length) return false;

    usable.forEach(function (source) {
      setTemporaryTransitionName(source.element, transitionNameForKey(source.key), 1300);
    });
    sessionStorage.setItem("selectedAssetTransitions", JSON.stringify(usable.map(function (source) {
      return source.key;
    })));
    return true;
  }

  function findAssetTransitionTarget(key) {
    var selectorGroups = [
      ".artboard > .project-card, .artboard > .project-video",
      ".summary-card",
      ".artboard > a.layer",
      ".menu-card",
      ".home-piece",
      ".moments-slide",
      ".artboard img, .artboard video"
    ];

    for (var i = 0; i < selectorGroups.length; i += 1) {
      var elements = document.querySelectorAll(selectorGroups[i]);
      for (var j = 0; j < elements.length; j += 1) {
        var element = elements[j];
        if (elementAssetKey(element) !== key) continue;
        var media = element.matches("img, video") ? element : element.querySelector("img, video");
        if (!visibleMedia(media)) continue;
        return element.matches("img, video") ? preferredSourceElementFromMedia(element) : element;
      }
    }
    return null;
  }

  function setupIncomingSharedAssets() {
    var raw = sessionStorage.getItem("selectedAssetTransitions");
    if (!raw) return false;

    var keys = [];
    try {
      keys = JSON.parse(raw);
    } catch (error) {
      keys = [];
    }
    sessionStorage.removeItem("selectedAssetTransitions");

    var usedNames = {};
    keys.forEach(function (key) {
      if (!key || usedNames[key]) return;
      var target = findAssetTransitionTarget(key);
      if (!target) return;
      usedNames[key] = true;
      setTemporaryTransitionName(target, transitionNameForKey(key), 1300);
    });

    return Object.keys(usedNames).length > 0;
  }

  function setupPageTransitions() {
    var hasMotionBridge = !!sessionStorage.getItem("motionBridgeTransitions");
    if (isSummaryPage()) {
      try {
        prepareSummaryEntrance(JSON.parse(sessionStorage.getItem("motionBridgeTransitions") || "[]"), true);
      } catch (error) {
        prepareSummaryEntrance([], true);
      }
    }
    document.body.classList.toggle("has-motion-bridge", hasMotionBridge);
    if (!hasMotionBridge) {
      document.body.classList.add("is-entering");
      window.setTimeout(function () {
        document.body.classList.remove("is-entering");
      }, 620);
    }

    var hasIncomingAsset = setupIncomingSharedAssets();
    var incomingWork = sessionStorage.getItem("selectedWorkTransition");
    if (!hasIncomingAsset && incomingWork && /(?:^|\/)work[1-9]\.html$/i.test(window.location.pathname)) {
      var hero = document.querySelector(".artboard > .project-card, .artboard > .project-video, .moments-carousel");
      if (hero) {
        hero.style.viewTransitionName = "selected-work";
        window.setTimeout(function () {
          hero.style.viewTransitionName = "";
        }, 900);
      }
    }
    sessionStorage.removeItem("selectedWorkTransition");

    function handleInternalLinkClick(event) {
      var link = event.target.closest && event.target.closest("a[href], a[data-motion-href]");
      if (!isInternalHtmlLink(link)) return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (typeof event.button === "number" && event.button !== 0) return;

      var destination = destinationPageName(link);
      var current = currentPageName();
      var clickedSource = findClickedAssetSource(link);
      var queuedSharedAssets = false;
      var bridgeSources = [];

      if ((current === "home.html" && destination === "menu.html") || (current === "menu.html" && destination === "home.html")) {
        bridgeSources = collectUniqueAssetSources();
        queuedSharedAssets = queueSharedAssetTransitions(bridgeSources);
      } else if (clickedSource) {
        bridgeSources = [clickedSource];
        queuedSharedAssets = queueSharedAssetTransitions(bridgeSources);
      } else if (/^work[1-9]\.html$/i.test(current) && destination === "summary.html") {
        bridgeSources = [firstProjectAssetSource()];
        queuedSharedAssets = queueSharedAssetTransitions(bridgeSources);
      }
      var bridgeRecords = collectMotionBridgeRecords(bridgeSources);

      if (!queuedSharedAssets && link.classList.contains("summary-card")) {
        link.style.viewTransitionName = "selected-work";
        sessionStorage.setItem("selectedWorkTransition", "1");
      }

      event.preventDefault();
      var targetHref = link.dataset.motionHref || link.href;
      navigateInsideSite(targetHref, bridgeRecords, true).catch(function () {
        window.console && console.warn("Internal navigation fallback", targetHref);
        if (bridgeRecords.length) {
          sessionStorage.setItem("motionBridgeTransitions", JSON.stringify(bridgeRecords));
        }
        window.location.href = targetHref;
      });
    }

    window.__portfolioHandleInternalLinkClick = handleInternalLinkClick;
    document.addEventListener("click", handleInternalLinkClick, true);
    bindInternalLinks();
    document.documentElement.dataset.motionListener = "ready";
  }

  function bindInternalLinks() {
    if (!window.__portfolioHandleInternalLinkClick) return;
    document.querySelectorAll("a[href]").forEach(function (link) {
      if (!isInternalHtmlLink(link) || link.dataset.internalMotionBound === "1") return;
      link.dataset.motionHref = link.dataset.motionHref || link.href;
      link.setAttribute("href", "javascript:void(0)");
      link.dataset.internalMotionBound = "1";
      link.addEventListener("click", window.__portfolioHandleInternalLinkClick, true);
      link.onclick = function (event) {
        window.__portfolioHandleInternalLinkClick(event);
        return event.defaultPrevented ? false : undefined;
      };
    });
  }

  function bridgeTargetForKey(key) {
    if (key === "chrome-logo") return document.querySelector(".fixed-chrome-clone.logo");
    return findAssetTransitionTarget(key);
  }

  function makeBridgeItem(record) {
    var item = document.createElement("div");
    item.className = "motion-bridge-item";
    if (record.kind === "logo") item.classList.add("is-logo");
    item.style.left = record.state.left + "px";
    item.style.top = record.state.top + "px";
    item.style.width = record.state.width + "px";
    item.style.height = record.state.height + "px";
    item.style.transform = "rotate(" + record.state.angle + "deg)";
    item.style.borderRadius = record.borderRadius || "0";
    if (record.boxShadow && record.boxShadow !== "none") item.style.boxShadow = record.boxShadow;

    if (record.media && record.media.src) {
      var image = document.createElement("img");
      image.src = record.media.src;
      image.alt = "";
      image.style.objectFit = record.kind === "logo" ? "contain" : (record.media.objectFit || "cover");
      item.appendChild(image);
    } else if (record.text) {
      var text = document.createElement("div");
      text.className = "motion-bridge-text";
      text.textContent = record.text;
      text.style.color = record.color || "#fff";
      text.style.font = record.font || "";
      item.appendChild(text);
    }

    return item;
  }

  function bridgeFrame(state) {
    return {
      left: state.left + "px",
      top: state.top + "px",
      width: state.width + "px",
      height: state.height + "px",
      opacity: 1,
      transform: "rotate(" + state.angle + "deg)"
    };
  }

  function viewportScaleForElement(element) {
    var viewport = element && element.closest && element.closest(".viewport");
    return Number(viewport && viewport.dataset.scale || 1);
  }

  function animateTargetInPlace(record, target, targetState, options) {
    var opts = options || {};
    var scale = viewportScaleForElement(target);
    var dx = (record.state.left - targetState.left) / scale;
    var dy = (record.state.top - targetState.top) / scale;
    var sx = record.state.width / targetState.width;
    var sy = record.state.height / targetState.height;
    var from = "translate(" + dx + "px, " + dy + "px) rotate(" + record.state.angle + "deg) scale(" + sx + ", " + sy + ")";
    var to = "translate(0, 0) rotate(" + targetState.angle + "deg) scale(1, 1)";

    target.style.transformOrigin = "top left";
    target.animate([
      { opacity: 1, transform: from },
      {
        opacity: 1,
        transform: "translate(" + (-dx * .025) + "px, " + (-dy * .025) + "px) rotate(" + targetState.angle + "deg) scale(1.012, 1.012)",
        offset: .86
      },
      { opacity: 1, transform: to }
    ], {
      duration: opts.duration || 1080,
      easing: opts.easing || "cubic-bezier(.18, 1.08, .28, 1)",
      fill: "both"
    }).onfinish = function () {
      target.style.transform = "";
    };
  }

  function prepareSummaryEntrance(records, force) {
    if (!isSummaryPage() || (!force && !hasBridgeKey(records, "portfolio-bag"))) return false;
    document.querySelectorAll(".summary-card").forEach(function (card) {
      card.classList.add("summary-card-waiting");
    });
    return true;
  }

  function animateSummaryCardsEntrance(records, force) {
    if (!isSummaryPage() || (!force && !hasBridgeKey(records, "portfolio-bag"))) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll(".summary-card"));
    if (!cards.some(function (card) { return card.classList.contains("summary-card-waiting"); })) return;
    var viewport = document.querySelector(".viewport");
    var scale = Number(viewport && viewport.dataset.scale || 1);

    cards.forEach(function (card, index) {
      var state = visualState(card);
      if (!state) return;

      var enterFromLeft = (state.left + state.width / 2) < window.innerWidth / 2;
      var startLeft = enterFromLeft ? -state.width - 160 : window.innerWidth + 160;
      var verticalDrift = (index % 3 - 1) * 58;
      var dx = (startLeft - state.left) / scale;
      var dy = verticalDrift / scale;
      var angle = state.angle;
      var startAngle = angle + (enterFromLeft ? -7 : 7);

      card.classList.remove("summary-card-waiting");
      card.animate([
        {
          opacity: 0,
          filter: "blur(6px)",
          transform: "translate(" + dx + "px, " + dy + "px) rotate(" + startAngle + "deg) scale(.9)"
        },
        {
          opacity: 1,
          filter: "blur(1px)",
          transform: "translate(" + (-dx * .035) + "px, " + (-dy * .035) + "px) rotate(" + (angle - (enterFromLeft ? -1.2 : 1.2)) + "deg) scale(1.018)"
        },
        {
          opacity: 1,
          filter: "blur(0)",
          transform: "translate(0, 0) rotate(" + angle + "deg) scale(1)"
        }
      ], {
        duration: 1120,
        delay: 260 + index * 118,
        easing: "cubic-bezier(.18, 1.08, .28, 1)",
        fill: "both"
      });
    });
  }

  function setupMotionBridgeTransitions() {
    var raw = sessionStorage.getItem("motionBridgeTransitions");
    if (!raw) return;

    var records = [];
    try {
      records = JSON.parse(raw);
    } catch (error) {
      records = [];
    }
    sessionStorage.removeItem("motionBridgeTransitions");
    runMotionBridge(records);
    animateSummaryCardsEntrance(records, true);
  }

  function runMotionBridge(records) {
    window.__portfolioMotionDebug = {
      phase: "runMotionBridge",
      recordCount: records ? records.length : 0,
      keys: (records || []).map(function (record) { return record.key; })
    };
    if (!records || !records.length) return;
    document.body.classList.add("has-motion-bridge");

    var layer = document.createElement("div");
    layer.className = "motion-bridge-layer";
    document.body.appendChild(layer);

    var animated = 0;
    records.forEach(function (record) {
      var target = bridgeTargetForKey(record.key);
      var targetState = visualState(target);
      if (!targetState) return;

      if (target.classList.contains("summary-bag")) {
        animateTargetInPlace(record, target, targetState, { duration: 1180 });
        return;
      }

      if (target.classList.contains("home-piece") || target.classList.contains("menu-card")) {
        animateTargetInPlace(record, target, targetState, { duration: 1120 });
        return;
      }

      target.classList.add("motion-bridge-target-hidden");
      var item = makeBridgeItem(record);
      layer.appendChild(item);

      var duration = record.kind === "logo" ? 920 : 1120;
      var delay = record.kind === "logo" ? 0 : 80;
      var overshootState = {
        left: targetState.left - (targetState.left - record.state.left) * .025,
        top: targetState.top - (targetState.top - record.state.top) * .025,
        width: targetState.width * 1.012,
        height: targetState.height * 1.012,
        angle: targetState.angle
      };
      var keyframes = [
        bridgeFrame(record.state),
        Object.assign(bridgeFrame(overshootState), { offset: .86 }),
        bridgeFrame(targetState)
      ];
      if (record.kind === "text") {
        keyframes = [
          {
            left: record.state.left + "px",
            top: record.state.top + "px",
            opacity: 1,
            transform: "rotate(" + record.state.angle + "deg)"
          },
          {
            left: targetState.left + "px",
            top: targetState.top + "px",
            opacity: 1,
            transform: "rotate(" + targetState.angle + "deg)"
          }
        ];
      }
      var animation = item.animate(keyframes, {
        duration: duration,
        delay: delay,
        easing: "cubic-bezier(.18, 1.08, .28, 1)",
        fill: "both"
      });

      animated += 1;
      animation.onfinish = function () {
        target.classList.remove("motion-bridge-target-hidden");
        item.remove();
        animated -= 1;
        if (animated <= 0) {
          layer.remove();
          document.body.classList.remove("has-motion-bridge");
        }
      };
    });

    if (!animated) {
      layer.remove();
      document.body.classList.remove("has-motion-bridge");
    }
    window.__portfolioMotionDebug.animated = animated;
  }

  function runInlinePageScripts(doc) {
    doc.querySelectorAll("body script:not([src])").forEach(function (script) {
      if (!script.textContent.trim()) return;
      try {
        new Function(script.textContent)();
      } catch (error) {
        window.console && console.warn("Inline page script failed", error);
      }
    });
  }

  function loadProjectScriptIfNeeded(doc) {
    var needsProject = !!doc.querySelector('script[src*="project.js"]');
    if (!needsProject) return Promise.resolve();
    if (window.initProjectPage) {
      window.initProjectPage();
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "project.js?v=motion17";
      script.onload = function () {
        if (window.initProjectPage) window.initProjectPage();
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function replacePageFromDocument(doc, url, bridgeRecords) {
    var nextShell = doc.querySelector(".page-shell");
    var currentShell = document.querySelector(".page-shell");
    if (!nextShell || !currentShell) throw new Error("Missing page shell");

    document.title = doc.title || document.title;
    currentShell.replaceWith(nextShell);
    window.scrollTo(0, 0);
    prepareSummaryEntrance(bridgeRecords, isSummaryPage());

    setupFixedChrome();
    fitBoards();
    runInlinePageScripts(doc);
    bindInternalLinks();

    return loadProjectScriptIfNeeded(doc).then(function () {
      sessionStorage.removeItem("selectedAssetTransitions");
      sessionStorage.removeItem("selectedWorkTransition");
      window.requestAnimationFrame(function () {
        fitBoards();
        updateFixedChrome();
        runMotionBridge(bridgeRecords);
        animateSummaryCardsEntrance(bridgeRecords, isSummaryPage());
      });
    });
  }

  function navigateInsideSite(url, bridgeRecords, updateHistory) {
    window.__portfolioMotionDebug = {
      phase: "navigateInsideSite",
      recordCount: bridgeRecords ? bridgeRecords.length : 0,
      keys: (bridgeRecords || []).map(function (record) { return record.key; }),
      url: url
    };
    document.body.classList.add("has-motion-bridge");
    return fetch(url, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Navigation fetch failed");
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        return replacePageFromDocument(doc, url, bridgeRecords).then(function () {
          if (updateHistory !== false) {
            history.pushState({ internalPortfolioPage: true }, "", url);
          }
        });
      })
      .catch(function (error) {
        document.body.classList.remove("has-motion-bridge");
        window.console && console.warn("Internal navigation failed", error && error.message ? error.message : error);
        throw error;
      });
  }

  function setupFixedChrome() {
    var oldLayer = document.querySelector(".fixed-chrome-layer");
    if (oldLayer) oldLayer.remove();

    var oldBackdrop = document.querySelector(".fixed-work-backdrop");
    if (oldBackdrop) oldBackdrop.remove();

    var layer = document.createElement("div");
    layer.className = "fixed-chrome-layer";
    document.body.appendChild(layer);

    document.querySelectorAll(".artboard > .logo, .artboard > .nav-text").forEach(function (item) {
      item.classList.add("fixed-chrome-source");
      var clone = item.cloneNode(true);
      clone.classList.remove("fixed-chrome-source");
      clone.classList.add("fixed-chrome-clone");
      clone.removeAttribute("data-internal-motion-bound");
      clone.dataset.sourceLeft = String(item.offsetLeft);
      clone.dataset.sourceTop = String(item.offsetTop);
      clone.dataset.sourceWidth = String(item.offsetWidth);
      clone.dataset.sourceHeight = String(item.offsetHeight);
      if (clone.classList.contains("logo")) {
        clone.style.viewTransitionName = "site-logo";
      }
      layer.appendChild(clone);
    });
    bindInternalLinks();

    if (isWorkPage()) {
      var backdrop = document.createElement("div");
      backdrop.className = "fixed-work-backdrop";
      document.body.appendChild(backdrop);
    }
  }

  function fitBoards() {
    document.querySelectorAll(".viewport").forEach(function (viewport) {
      var h = Number(viewport.dataset.height || 3330);
      var max = Number(viewport.dataset.max || window.innerWidth);
      var available = Math.max(320, Math.min(window.innerWidth, max));
      var scale = available / 2987;
      viewport.dataset.scale = String(scale);
      viewport.style.width = (2987 * scale) + "px";
      viewport.style.height = (h * scale) + "px";
      var artboard = viewport.querySelector(".artboard");
      if (artboard) {
        artboard.style.height = h + "px";
        artboard.style.transform = "scale(" + scale + ")";
      }
    });
    updateFixedChrome();
  }

  function updateFixedChrome() {
    var viewport = document.querySelector(".viewport");
    if (!viewport) return;

    var scale = Number(viewport.dataset.scale || 1);
    var rect = viewport.getBoundingClientRect();

    document.querySelectorAll(".fixed-chrome-clone").forEach(function (item) {
      var left = Number(item.dataset.sourceLeft || 0);
      var top = Number(item.dataset.sourceTop || 0);
      var width = Number(item.dataset.sourceWidth || 0);
      var height = Number(item.dataset.sourceHeight || 0);

      item.style.left = rect.left + left * scale + "px";
      item.style.top = top * scale + "px";
      item.style.width = width + "px";
      item.style.height = height + "px";
      item.style.transform = "scale(" + scale + ")";
    });
  }

  setupPageTransitions();
  setupFixedChrome();
  window.addEventListener("resize", fitBoards);
  window.addEventListener("load", fitBoards);
  window.addEventListener("scroll", updateFixedChrome, { passive: true });
  window.addEventListener("popstate", function () {
    navigateInsideSite(window.location.href, [], false).catch(function () {
      window.location.reload();
    });
  });
  fitBoards();
  window.requestAnimationFrame(function () {
    updateFixedChrome();
    setupMotionBridgeTransitions();
    animateSummaryCardsEntrance([], isSummaryPage());
  });
})();
