/*
 * Quest Agent – Theme-Skript (ohne Abhängigkeiten).
 * - Hell/Dunkel-Umschalter, Header, mobiles Menü
 * - EIN requestAnimationFrame-Durchlauf für alle scrollgebundenen Effekte (Fortschritt, Hero, Pipeline,
 *   Plattformen, Dashboard, roter Faden, Kaufleiste) – nur transform/opacity/CSS-Variablen
 * - Einblenden per IntersectionObserver, Wort-Animationen
 * - Warenkorb über die Shopify-AJAX-API inkl. Section Rendering (Preise/Abos rechnet immer Shopify)
 * - Produktvarianten und Abo-Pläne
 * - Theme-Editor: section:load/unload, block:select – wiederholte Ausführung registriert nichts doppelt
 */
(function () {
  "use strict";

  if (window.QA_THEME) {
    window.QA_THEME.init(document);
    return;
  }

  var root = document.documentElement;
  var reduce = function () {
    return root.classList.contains("qa-no-motion") || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };
  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };
  var clamp = function (v, a, b) {
    return Math.min(b, Math.max(a, v));
  };
  var STR = window.QA_STRINGS || {};
  var ROUTES = window.QA_ROUTES || { cart: "/cart", cartAdd: "/cart/add", cartChange: "/cart/change", root: "/" };

  /* ------------------------------------------------------------------ Toast */
  var toastTimer;
  function toast(text) {
    var el = $("[data-qa-toast]");
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2600);
  }

  /* ---------------------------------------------------------- Hell/Dunkel */
  // Ausgangslage: gespeicherte Wahl, sonst Theme-Standard bzw. Systemeinstellung. Ein Klick wechselt immer
  // sichtbar zwischen hell und dunkel und merkt sich die Wahl.
  function applyTheme(pref) {
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.setAttribute("data-theme-pref", pref);
    $$("[data-theme-toggle]").forEach(function (b) {
      var base = b.getAttribute("data-label-base") || b.getAttribute("aria-label").split(":")[0];
      b.setAttribute("data-label-base", base);
      b.setAttribute("aria-label", base + ": " + ((dark ? STR.themeDark : STR.themeLight) || (dark ? "dark" : "light")));
      b.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("qa-theme", next);
    } catch (err) {
      /* Speicher nicht verfügbar – Wahl gilt nur für diese Seite */
    }
    var r = btn.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    if (document.startViewTransition && !reduce()) {
      var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var vt = document.startViewTransition(function () {
        applyTheme(next);
      });
      vt.ready
        .then(function () {
          root.animate({ clipPath: ["circle(0 at " + x + "px " + y + "px)", "circle(" + end + "px at " + x + "px " + y + "px)"] }, { duration: 650, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" });
        })
        .catch(function () {});
    } else {
      applyTheme(next);
    }
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () {
      if ((root.getAttribute("data-theme-pref") || "system") === "system") applyTheme("system");
    };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
  }

  /* ---------------------------------------------------- Header & Menü */
  var lastFocus = null;
  function openMenu() {
    var nav = $("[data-mnav]");
    if (!nav) return;
    lastFocus = document.activeElement;
    nav.classList.add("is-open");
    nav.setAttribute("aria-hidden", "false");
    $$("[data-menu-open]").forEach(function (b) {
      b.setAttribute("aria-expanded", "true");
    });
    document.body.classList.add("qa-lock");
    setTimeout(function () {
      var f = $("[data-menu-close]", nav);
      if (f) f.focus();
    }, 50);
  }
  function closeMenu() {
    var nav = $("[data-mnav]");
    if (!nav || !nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    nav.setAttribute("aria-hidden", "true");
    $$("[data-menu-open]").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
    document.body.classList.remove("qa-lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-menu-open]")) openMenu();
    else if (t.closest("[data-menu-close]") || t.closest("[data-menu-close-link]")) closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenu();
      closeDrawer();
      closeSearch();
    }
  });

  /* ------------------------------------------------------- Wörter teilen */
  var wordCounter = 0;
  function splitWords(el, startIndex) {
    if (el.getAttribute("data-split-done")) return startIndex;
    var i = startIndex || 0;
    // Knoten in Dokumentreihenfolge durchlaufen, damit die Verzögerung der Wörter der Lesereihenfolge folgt
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) {
          walk(child);
          return;
        }
        if (child.nodeType !== 3 || !child.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          var s = document.createElement("span");
          s.className = "qa-word";
          s.style.setProperty("--w", i++);
          s.textContent = part;
          frag.appendChild(s);
        });
        child.parentNode.replaceChild(frag, child);
      });
    };
    walk(el);
    el.setAttribute("data-split-done", "1");
    return i;
  }

  /* ------------------------------------------------------------ Einblenden */
  var revealIO =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) {
                en.target.classList.add("is-visible");
                revealIO.unobserve(en.target);
              }
            });
          },
          { rootMargin: "0px 0px -4% 0px", threshold: 0.08 },
        )
      : null;
  function initReveal(scope) {
    $$("[data-split]", scope).forEach(function (el) {
      splitWords(el, 0);
    });
    $$("[data-reveal], [data-split]", scope).forEach(function (el) {
      if (!revealIO || reduce()) el.classList.add("is-visible");
      else revealIO.observe(el);
    });
  }

  /* ------------------------------------------------------------------ Hero */
  var heroes = [];
  // Zahlen im deutschen Format hochzählen (data-decimals: Nachkommastellen, Wert in kleinster Einheit)
  function formatCount(v, dec) {
    return (v / Math.pow(10, dec)).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function countTo(el, ms) {
    var to = parseInt(el.getAttribute("data-hero-count"), 10) || 0;
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    if (reduce()) {
      el.textContent = formatCount(to, dec);
      return;
    }
    var t0 = performance.now();
    var tick = function (t) {
      var k = clamp((t - t0) / ms, 0, 1);
      el.textContent = formatCount(Math.round(to * (1 - Math.pow(1 - k, 3))), dec);
      if (k < 1 && document.documentElement.contains(el)) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // Beispiel-Ablauf im Hero: Phasen mit Fortschrittsbalken, danach laufen Beispiel-Zahlen ein. Wiederholt sich.
  var HERO_PHASES = ["research", "script", "voice", "edit", "check", "approve", "upload", "live"];
  var HERO_MS = [1400, 1700, 1500, 1500, 1300, 1500, 1700, 5600];
  function heroTimeline(hero) {
    var stage = $("[data-hero-stage]", hero);
    var status = $("[data-qa-status]", hero);
    if (!stage) return;
    var labels = status ? (status.getAttribute("data-labels") || "").split("|") : [];
    var chips = $$(".qa-hero__phases li", hero);
    var counters = $$("[data-hero-count]", hero);
    var bar = $(".qa-hero__video-bar span", hero);
    var visible = true;
    var idx = 0;
    var set = function (i) {
      idx = i;
      var name = HERO_PHASES[i];
      stage.setAttribute("data-phase", name);
      chips.forEach(function (li, k) {
        li.classList.toggle("is-done", k < i);
        li.classList.toggle("is-active", k === i);
      });
      if (status && labels[i]) {
        status.classList.add("is-swap");
        setTimeout(function () {
          status.textContent = labels[i];
          status.classList.remove("is-swap");
        }, 160);
      }
      if (bar) {
        var target = Math.min(1, (i + 1) / (HERO_PHASES.length - 1));
        if (i === 0) {
          bar.style.transition = "none";
          bar.style.transform = "scaleX(0)";
          void bar.offsetWidth;
        }
        bar.style.transition = "transform " + HERO_MS[i] + "ms linear";
        bar.style.transform = "scaleX(" + target + ")";
      }
      if (name === "live")
        counters.forEach(function (el) {
          countTo(el, 1800);
        });
      if (i === 0)
        counters.forEach(function (el) {
          el.textContent = "0";
        });
    };
    if (reduce()) {
      set(HERO_PHASES.length - 1);
      return;
    }
    var next = function () {
      // außerhalb des Bildschirms oder im Hintergrund-Tab wird angehalten
      if (!visible || document.hidden) {
        hero._timer = setTimeout(next, 600);
        return;
      }
      set((idx + 1) % HERO_PHASES.length);
      hero._timer = setTimeout(next, HERO_MS[idx]);
    };
    set(0);
    hero._timer = setTimeout(next, HERO_MS[0] + 500);
    if ("IntersectionObserver" in window) {
      hero._io = new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
      });
      hero._io.observe(stage);
    }
  }
  function initHero(scope) {
    $$("[data-qa-hero]", scope).forEach(function (hero) {
      if (hero._qa) return;
      hero._qa = true;
      wordCounter = 0;
      $$("[data-words]", hero).forEach(function (el) {
        wordCounter = splitWords(el, wordCounter);
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hero.classList.add("is-in");
        });
      });
      heroTimeline(hero);
      var move = function (e) {
        var r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        hero.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      };
      if (window.matchMedia("(pointer: fine)").matches && !reduce()) hero.addEventListener("pointermove", move, { passive: true });
      hero._cleanup = function () {
        clearTimeout(hero._timer);
        if (hero._io) hero._io.disconnect();
        hero.removeEventListener("pointermove", move);
      };
      heroes.push(hero);
    });
  }

  /* -------------------------------------------------------------- Pipeline */
  // Läuft von selbst durch (zeitgesteuert statt scrollgesteuert), sobald der Bereich sichtbar ist.
  // Schritte sind Tabs: anklicken, Pfeiltasten, Pause/Abspielen, „Nächster Schritt“, „Überspringen“.
  var pipes = [];
  var easeOut = function (x) {
    return 1 - Math.pow(1 - x, 3);
  };
  function pipeGo(pipe, index, focus) {
    var s = pipe._qa;
    var n = s.steps.length || 1;
    s.idx = ((index % n) + n) % n;
    s.elapsed = 0;
    s.scene = 0;
    s.steps.forEach(function (el, i) {
      el.classList.toggle("is-active", i === s.idx);
      el.classList.toggle("is-done", i < s.idx);
      el.style.setProperty("--t", "0");
    });
    s.btns.forEach(function (b, i) {
      b.setAttribute("aria-selected", i === s.idx ? "true" : "false");
      b.tabIndex = i === s.idx ? 0 : -1;
    });
    s.scenes.forEach(function (el, i) {
      el.classList.toggle("is-active", i === s.idx);
      el.classList.toggle("is-past", i < s.idx);
    });
    if (s.stage) s.stage.setAttribute("aria-labelledby", s.btns[s.idx] ? s.btns[s.idx].id : "");
    if (s.caption) {
      var d = $(".qa-pipe__d", s.steps[s.idx]);
      s.caption.textContent = d ? d.textContent : "";
    }
    // aktiven Schritt in der mobilen Leiste sichtbar halten (nur waagerecht, die Seite springt nicht)
    var list = s.list;
    var li = s.steps[s.idx];
    if (list && li && list.scrollWidth > list.clientWidth + 4) {
      list.scrollTo({ left: li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2, behavior: reduce() ? "auto" : "smooth" });
    }
    if (focus && s.btns[s.idx]) s.btns[s.idx].focus();
    pipeRender(pipe);
  }
  function pipeRender(pipe) {
    var s = pipe._qa;
    var n = s.steps.length || 1;
    var sp = reduce() ? 1 : easeOut(clamp(s.scene / (s.dur * 0.6), 0, 1));
    var t = clamp(s.elapsed / s.dur, 0, 1);
    pipe.style.setProperty("--p", ((s.idx + t) / n).toFixed(4));
    if (s.steps[s.idx]) s.steps[s.idx].style.setProperty("--t", t.toFixed(4));
    if (s.stage) {
      s.stage.style.setProperty("--sp", sp.toFixed(4));
      s.stage.style.setProperty("--press", (1 - 0.06 * Math.max(0, 1 - Math.abs(sp - 0.55) * 12)).toFixed(3));
    }
  }
  function pipeLoop(pipe) {
    var s = pipe._qa;
    if (s.raf) return;
    var last = performance.now();
    var step = function (now) {
      var dt = Math.min(100, now - last);
      last = now;
      if (!s.visible || document.hidden || !document.documentElement.contains(pipe)) {
        s.raf = 0;
        return;
      }
      s.scene += dt;
      if (s.playing && !s.focusPause) s.elapsed += dt;
      if (s.elapsed >= s.dur) pipeGo(pipe, s.idx + 1);
      else pipeRender(pipe);
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }
  function pipeSetPlaying(pipe, on) {
    var s = pipe._qa;
    s.playing = on;
    pipe.classList.toggle("is-paused", !on);
    if (s.toggle) s.toggle.setAttribute("aria-pressed", on ? "false" : "true");
  }
  function initPipes(scope) {
    $$("[data-qa-pipe]", scope).forEach(function (pipe) {
      if (pipe._qa) return;
      var s = {
        list: $("[data-pipe-steps]", pipe),
        steps: $$("[data-step]", pipe),
        btns: $$("[data-step-btn]", pipe),
        scenes: $$("[data-scene]", pipe),
        stage: $("[data-pipe-stage]", pipe),
        caption: $("[data-pipe-caption]", pipe),
        toggle: $("[data-pipe-toggle]", pipe),
        dur: parseInt(pipe.getAttribute("data-step-ms"), 10) || 3500,
        idx: 0,
        elapsed: 0,
        scene: 0,
        playing: false,
        visible: false,
        raf: 0,
      };
      pipe._qa = s;
      pipeSetPlaying(pipe, pipe.getAttribute("data-autoplay") !== "false" && !reduce() && !(window.Shopify && window.Shopify.designMode));
      pipeGo(pipe, 0);
      s.btns.forEach(function (b, i) {
        b.addEventListener("click", function () {
          pipeGo(pipe, i);
        });
        b.addEventListener("keydown", function (e) {
          var k = e.key;
          if (k !== "ArrowRight" && k !== "ArrowDown" && k !== "ArrowLeft" && k !== "ArrowUp" && k !== "Home" && k !== "End") return;
          e.preventDefault();
          var target = k === "Home" ? 0 : k === "End" ? s.steps.length - 1 : s.idx + (k === "ArrowRight" || k === "ArrowDown" ? 1 : -1);
          pipeGo(pipe, target, true);
        });
      });
      // Tastatur-Nutzer:innen bekommen Ruhe: Solange der Fokus in den Schritten liegt, läuft nichts weiter
      pipe.addEventListener("focusin", function (e) {
        if (e.target.matches("[data-step-btn]") && e.target.matches(":focus-visible")) s.focusPause = true;
      });
      pipe.addEventListener("focusout", function () {
        s.focusPause = false;
      });
      if (s.toggle)
        s.toggle.addEventListener("click", function () {
          pipeSetPlaying(pipe, !s.playing);
          if (s.playing && s.elapsed >= s.dur) pipeGo(pipe, s.idx + 1);
        });
      var next = $("[data-pipe-next]", pipe);
      if (next)
        next.addEventListener("click", function () {
          pipeGo(pipe, s.idx + 1);
        });
      var skip = $("[data-pipe-skip]", pipe);
      if (skip)
        skip.addEventListener("click", function (e) {
          // zum nächsten Bereich unterhalb – unabhängig davon, welche Section dort im Editor steht
          var wrap = pipe.closest(".shopify-section");
          var nextSec = wrap && wrap.nextElementSibling;
          if (!nextSec) return;
          e.preventDefault();
          pipeSetPlaying(pipe, false);
          var top = nextSec.getBoundingClientRect().top + scrollY - (header ? header.offsetHeight : 0);
          window.scrollTo({ top: top, behavior: reduce() ? "auto" : "smooth" });
        });
      if ("IntersectionObserver" in window) {
        s.io = new IntersectionObserver(
          function (en) {
            s.visible = en[0].isIntersecting;
            if (s.visible) pipeLoop(pipe);
          },
          { threshold: 0.3 },
        );
        s.io.observe(s.stage || pipe);
      } else {
        s.visible = true;
        pipeLoop(pipe);
      }
      pipes.push(pipe);
    });
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden)
      pipes.forEach(function (p) {
        if (p._qa && p._qa.visible) pipeLoop(p);
      });
  });

  /* ------------------------------------------------------ Plattformen */
  var phoneIO =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) {
                $$("[data-phone]", en.target).forEach(function (ph) {
                  ph.classList.add("is-live");
                });
                phoneIO.unobserve(en.target);
              }
            });
          },
          { threshold: 0.45 },
        )
      : null;
  var phoneGroups = [];
  function initPlatforms(scope) {
    $$("[data-qa-platforms]", scope).forEach(function (sec) {
      if (sec._qa) return;
      sec._qa = { phones: $$("[data-phone]", sec) };
      phoneGroups.push(sec);
      var box = $(".qa-platforms__phones", sec);
      if (phoneIO && !reduce() && box) phoneIO.observe(box);
      else
        sec._qa.phones.forEach(function (p) {
          p.classList.add("is-live");
        });
    });
  }
  function updatePhones(sec, vh) {
    if (reduce()) return;
    sec._qa.phones.forEach(function (ph, i) {
      var r = ph.getBoundingClientRect();
      var v = clamp((vh - r.top) / (vh * 0.55) - i * 0.06, 0, 1);
      ph.style.setProperty("--v", (1 - Math.pow(1 - v, 3)).toFixed(3));
    });
  }

  /* -------------------------------------------------------- Dashboard */
  // Klickbare Nachbildung des Kundenbereichs. Alle Daten sind Beispiele, nichts wird gespeichert oder gesendet.
  var dashes = [];
  var DASH_LABELS = {
    overview: "Übersicht",
    systems: "Systeme",
    production: "Pipeline",
    review: "Freigaben",
    calendar: "Kalender",
    analytics: "Analytics",
    agents: "Agents",
    connections: "Verbindungen",
    plan: "Abo",
  };
  function animateNumber(el, to, dec, ms) {
    dec = dec || 0;
    if (reduce()) {
      el.textContent = formatCount(to, dec);
      return;
    }
    var t0 = performance.now();
    var tick = function (t) {
      var k = clamp((t - t0) / (ms || 1000), 0, 1);
      el.textContent = formatCount(Math.round(to * (1 - Math.pow(1 - k, 3))), dec);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function growMeters(scope) {
    $$(".qa-meter__bar span", scope).forEach(function (b) {
      b.style.setProperty("--v", "0");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          b.style.setProperty("--v", "1");
        });
      });
    });
  }
  function dashToast(st, text) {
    var t = st.toast;
    if (!t) return;
    $("[data-toast-text]", t).textContent = text;
    t.classList.add("is-on");
    clearTimeout(st.toastT);
    st.toastT = setTimeout(function () {
      t.classList.remove("is-on");
    }, 2800);
  }
  function dashShow(sec, name) {
    var st = sec._qa;
    if (!st || !st.views[name]) return;
    st.view = name;
    st.dash.setAttribute("data-view", name);
    Object.keys(st.views).forEach(function (k) {
      var on = k === name;
      st.views[k].classList.toggle("is-on", on);
      st.views[k].hidden = !on;
    });
    $$(".qa-dash__nav", st.dash).forEach(function (n) {
      var on = n.getAttribute("data-dash-go") === name;
      n.classList.toggle("is-on", on);
      if (on) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });
    if (st.crumb) st.crumb.textContent = "/ " + (DASH_LABELS[name] || name);
    if (st.main) st.main.scrollTop = 0;
    // in der waagerechten Leiste (schmale Ansicht) den aktiven Bereich sichtbar halten
    var side = st.side;
    var navOn = $(".qa-dash__nav.is-on", st.dash);
    if (side && navOn && side.scrollWidth > side.clientWidth + 4)
      side.scrollTo({ left: navOn.offsetLeft - (side.clientWidth - navOn.offsetWidth) / 2, behavior: reduce() ? "auto" : "smooth" });
    dashEnter(sec, name);
  }
  function dashEnter(sec, name) {
    var st = sec._qa;
    clearInterval(st.viewTimer);
    st.viewTimer = null;
    var v = st.views[name];
    if (name === "overview" || name === "plan") {
      $$("[data-count]", v).forEach(function (el) {
        animateNumber(el, parseInt(el.getAttribute("data-count"), 10) || 0, 0, 900);
      });
      growMeters(v);
    }
    if (name === "production") {
      var jobs = function () {
        $$(".qa-job", v).forEach(function (j) {
          var pr = parseFloat(j.getAttribute("data-progress")) || 0;
          if (pr < 99 && !reduce()) pr = Math.min(99, pr + Math.random() * 3.2);
          j.setAttribute("data-progress", pr.toFixed(1));
          j.style.setProperty("--pr", pr.toFixed(1));
          var pct = $("[data-job-pct]", j);
          if (pct) pct.textContent = Math.round(pr) + " %";
        });
      };
      jobs();
      if (!reduce()) st.viewTimer = setInterval(jobs, 900);
    }
    if (name === "analytics") dashAnalytics(sec, $(".qa-seg .is-on[data-dash-act='range']", v));
    if (name === "agents" && !reduce()) st.viewTimer = setInterval(function () {
      dashLog(sec);
    }, 1700);
  }
  function dashAnalytics(sec, btn) {
    var st = sec._qa;
    var v = st.views.analytics;
    if (!btn || !v) return;
    var k = btn.getAttribute("data-k").split(",").map(Number);
    $$("[data-an]", v).forEach(function (el) {
      var i = parseInt(el.getAttribute("data-an"), 10);
      animateNumber(el, k[i] || 0, parseInt(el.getAttribute("data-decimals") || "0", 10), 1000);
    });
    var series = btn.getAttribute("data-s").split(",").map(Number);
    var min = Math.min.apply(null, series);
    var max = Math.max.apply(null, series);
    var pts = series.map(function (y, i) {
      return [(i * 600) / (series.length - 1), 168 - ((y - min) / (max - min || 1)) * 138];
    });
    var d = pts
      .map(function (p, i) {
        return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      })
      .join(" ");
    var chart = $("[data-chart]", v);
    $("[data-chart-line]", v).setAttribute("d", d);
    $("[data-chart-area]", v).setAttribute("d", d + " L600 180 L0 180 Z");
    chart.classList.remove("is-drawn");
    void chart.getBoundingClientRect();
    chart.classList.add("is-drawn");
    growMeters(v);
  }
  function dashLog(sec) {
    var st = sec._qa;
    var list = st.log;
    if (!list || !st.pool.length) return;
    var src = st.pool[st.poolIdx++ % st.pool.length];
    var li = src.cloneNode(true);
    var now = new Date();
    var time = document.createElement("time");
    time.textContent = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    li.insertBefore(time, li.firstChild);
    li.classList.add("is-new");
    if (st.agent && li.getAttribute("data-a") !== st.agent) li.classList.add("is-hidden");
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 8) list.removeChild(list.lastChild);
  }
  function dashReviewSelect(sec, i) {
    var st = sec._qa;
    var items = $$(".qa-queue__item", st.dash);
    var it = items[i];
    if (!it) return;
    st.reviewIdx = i;
    items.forEach(function (x, k) {
      x.classList.toggle("is-on", k === i);
      x.setAttribute("aria-selected", k === i ? "true" : "false");
    });
    var r = st.views.review;
    $("[data-review-title]", r).textContent = it.getAttribute("data-title");
    $("[data-review-when]", r).textContent = it.getAttribute("data-when");
    var img = $("[data-review-img]", r);
    if (img && img.getAttribute("src") !== it.getAttribute("data-img")) img.setAttribute("src", it.getAttribute("data-img"));
    var player = $("[data-player]", r);
    player.setAttribute("data-kind", it.getAttribute("data-kind"));
    player.classList.remove("is-playing");
    var capBtn = $(".qa-seg .is-on[data-dash-act='cap']", r);
    $("[data-review-cap]", r).textContent = it.getAttribute("data-" + (capBtn ? capBtn.getAttribute("data-p") : "yt"));
    var rev = $("[data-revise]", r);
    if (rev) rev.hidden = true;
  }
  function dashApprove(sec) {
    var st = sec._qa;
    var items = $$(".qa-queue__item", st.dash);
    var it = items[st.reviewIdx || 0];
    if (!it || it.classList.contains("is-done")) return;
    var ok = $("[data-dash-approve]", st.dash);
    if (ok) {
      ok.style.setProperty("--press", "0.94");
      setTimeout(function () {
        ok.style.setProperty("--press", "1");
      }, 160);
    }
    it.classList.add("is-done");
    it.disabled = true;
    st.open = Math.max(0, st.open - 1);
    $$("[data-dash-badge]", st.dash).forEach(function (b) {
      b.textContent = st.open;
      b.hidden = st.open === 0;
    });
    var plats = $$(".qa-review__row .qa-toggle.is-on", st.dash).length;
    dashToast(st, "Freigegeben & eingeplant: " + it.getAttribute("data-when") + " · " + plats + (plats === 1 ? " Plattform" : " Plattformen"));
    // „Nachthimmel“ erscheint im Kalender am Donnerstag
    if (it.getAttribute("data-i") === "0") {
      var day = $("[data-dash-newday]", st.dash);
      var tpl = $("[data-dash-newevt]", st.dash);
      if (day && tpl && !$(".qa-evt", day)) day.appendChild(tpl.content.cloneNode(true));
    }
    var next = items.filter(function (x) {
      return !x.classList.contains("is-done");
    })[0];
    setTimeout(function () {
      if (next) dashReviewSelect(sec, items.indexOf(next));
      else {
        $("[data-review]", st.dash).hidden = true;
        $("[data-review-empty]", st.dash).hidden = false;
      }
    }, 700);
  }
  function dashResetDemo(sec) {
    var st = sec._qa;
    st.open = 3;
    $$(".qa-queue__item", st.dash).forEach(function (x) {
      x.classList.remove("is-done");
      x.disabled = false;
    });
    $$("[data-dash-badge]", st.dash).forEach(function (b) {
      b.textContent = "3";
      b.hidden = false;
    });
    var day = $("[data-dash-newday]", st.dash);
    if (day)
      $$(".qa-evt", day).forEach(function (e) {
        e.remove();
      });
    $("[data-review]", st.dash).hidden = false;
    $("[data-review-empty]", st.dash).hidden = true;
    dashReviewSelect(sec, 0);
    var msgs = $("[data-chat-msgs]", st.dash);
    if (msgs)
      while (msgs.children.length > 1) msgs.removeChild(msgs.lastChild);
  }
  function dashAsk(sec, btn) {
    var st = sec._qa;
    if (st.asking) return;
    st.asking = true;
    var chips = $$(".qa-chat__chips button", st.dash);
    chips.forEach(function (c) {
      c.disabled = true;
    });
    var msgs = $("[data-chat-msgs]", st.dash);
    var add = function (cls, text) {
      var m = document.createElement("p");
      m.className = "qa-msg " + cls;
      if (text) m.textContent = text;
      msgs.appendChild(m);
      msgs.scrollTop = msgs.scrollHeight;
      return m;
    };
    add("qa-msg--me", btn.textContent.trim());
    var typing = add("qa-msg--typing");
    typing.innerHTML = "<i></i><i></i><i></i>";
    var answer = btn.getAttribute("data-a") || "";
    var done = function () {
      st.asking = false;
      chips.forEach(function (c) {
        c.disabled = false;
      });
      if (btn.hasAttribute("data-job")) {
        btn.removeAttribute("data-job");
        var jobs = $("[data-dash-jobs]", st.dash);
        var tpl = $("[data-dash-newjob]", st.dash);
        if (jobs && tpl) jobs.insertBefore(tpl.content.cloneNode(true), jobs.firstChild);
        var count = $(".qa-dash__count", st.dash);
        if (count) count.textContent = String((parseInt(count.textContent, 10) || 0) + 1);
        dashToast(st, "Neuer Auftrag in der Pipeline: „Schwarze Löcher – kurz erklärt“");
      }
    };
    setTimeout(function () {
      typing.className = "qa-msg qa-msg--bot";
      typing.textContent = "";
      if (reduce()) {
        typing.textContent = answer;
        done();
        return;
      }
      var i = 0;
      var type = function () {
        i = Math.min(answer.length, i + 3);
        typing.textContent = answer.slice(0, i);
        msgs.scrollTop = msgs.scrollHeight;
        if (i < answer.length) setTimeout(type, 16);
        else done();
      };
      type();
    }, reduce() ? 0 : 750);
  }
  function dashAct(sec, act, el) {
    var st = sec._qa;
    var r = st.views.review;
    switch (act) {
      case "tour-stop":
        dashStopTour(sec);
        break;
      case "chat-open":
        st.chat.hidden = false;
        break;
      case "chat-close":
        st.chat.hidden = true;
        break;
      case "ask":
        dashAsk(sec, el);
        break;
      case "open-review":
        dashShow(sec, "review");
        dashReviewSelect(sec, parseInt(el.getAttribute("data-i"), 10) || 0);
        break;
      case "review-item":
        dashReviewSelect(sec, parseInt(el.getAttribute("data-i"), 10) || 0);
        break;
      case "play":
        var player = el.closest("[data-player]");
        player.classList.toggle("is-playing");
        clearTimeout(st.playT);
        if (player.classList.contains("is-playing"))
          st.playT = setTimeout(function () {
            player.classList.remove("is-playing");
          }, 6000);
        break;
      case "version":
        $$("[data-dash-act='version']", r).forEach(function (b) {
          b.classList.toggle("is-on", b === el);
        });
        if (el.getAttribute("data-v") === "1") dashToast(st, "Version 1: Der Hook war zu lang – Version 2 ist die überarbeitete Fassung.");
        break;
      case "cap":
        $$("[data-dash-act='cap']", r).forEach(function (b) {
          b.classList.toggle("is-on", b === el);
        });
        var cur = $$(".qa-queue__item", st.dash)[st.reviewIdx || 0];
        if (cur) $("[data-review-cap]", r).textContent = cur.getAttribute("data-" + el.getAttribute("data-p"));
        break;
      case "plat":
        el.classList.toggle("is-on");
        el.setAttribute("aria-pressed", el.classList.contains("is-on") ? "true" : "false");
        break;
      case "revise":
        var box = $("[data-revise]", r);
        box.hidden = !box.hidden;
        break;
      case "revise-send":
        $("[data-revise]", r).hidden = true;
        dashToast(st, "Wird überarbeitet – Version 3 kommt gleich zur Freigabe.");
        break;
      case "approve":
        dashApprove(sec);
        break;
      case "sys-toggle":
        var on = el.getAttribute("aria-checked") !== "true";
        el.setAttribute("aria-checked", on ? "true" : "false");
        var card = el.closest("[data-sys]");
        card.classList.toggle("is-active", on);
        var state = $("[data-sys-state]", card);
        if (state) state.textContent = on ? "aktiv · plant die nächsten Videos" : "pausiert";
        dashToast(st, on ? "System aktiviert – der Loop plant die nächsten Videos." : "System pausiert – es wird nichts Neues produziert.");
        break;
      case "toast":
        dashToast(st, el.getAttribute("data-msg"));
        break;
      case "evt":
        $$(".qa-evt", st.views.calendar).forEach(function (x) {
          x.classList.toggle("is-sel", x === el);
        });
        $("[data-cal-detail]", st.dash).textContent = el.getAttribute("data-info");
        break;
      case "range":
        $$("[data-dash-act='range']", st.views.analytics).forEach(function (b) {
          b.classList.toggle("is-on", b === el);
        });
        dashAnalytics(sec, el);
        break;
      case "agent":
        var same = st.agent === el.getAttribute("data-a");
        st.agent = same ? null : el.getAttribute("data-a");
        $$(".qa-agent", st.dash).forEach(function (x) {
          x.classList.toggle("is-sel", !same && x === el);
        });
        $$("li", st.log).forEach(function (li) {
          li.classList.toggle("is-hidden", !!st.agent && li.getAttribute("data-a") !== st.agent);
        });
        var f = $("[data-log-filter]", st.dash);
        if (f) f.textContent = st.agent ? "· nur " + st.agent : "";
        break;
      case "connect":
        var conn = el.closest("[data-conn]");
        conn.classList.add("is-busy");
        el.textContent = "Verbinde …";
        setTimeout(function () {
          conn.classList.remove("is-busy");
          conn.classList.add("is-on");
          var em = document.createElement("em");
          em.textContent = "verbunden (Vorschau)";
          el.replaceWith(em);
          var sub = $("[data-conn-sub]", conn);
          if (sub) sub.textContent = "Konto verbunden · Posts erlaubt";
          dashToast(st, "TikTok verbunden – Shorts erscheinen ab jetzt auch dort.");
        }, 1200);
        break;
    }
  }
  /* Automatische Tour, bis jemand selbst klickt */
  var DASH_TOUR = [
    ["overview", 2600],
    ["review", 3400],
    ["calendar", 2600],
    ["analytics", 3200],
    ["production", 2800],
    ["agents", 3000],
    ["chat", 5600],
    ["systems", 2400],
  ];
  function dashCursor(st, el, click) {
    var c = st.cursor;
    if (!c || !el) return;
    // Ziel im scrollbaren Inhaltsbereich sichtbar machen, ohne die Seite zu bewegen
    if (st.main.contains(el)) {
      var mr = st.main.getBoundingClientRect();
      var er = el.getBoundingClientRect();
      if (er.bottom > mr.bottom - 10) st.main.scrollTop += er.bottom - mr.bottom + 30;
      if (er.top < mr.top) st.main.scrollTop -= mr.top - er.top + 30;
    }
    var ar = st.app.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    c.style.setProperty("--cx", (r.left - ar.left + Math.min(r.width * 0.5, 60)).toFixed(0) + "px");
    c.style.setProperty("--cy", (r.top - ar.top + r.height * 0.6).toFixed(0) + "px");
    c.classList.add("is-on");
    if (click)
      setTimeout(function () {
        c.classList.remove("is-click");
        void c.offsetWidth;
        c.classList.add("is-click");
      }, 850);
  }
  function dashTourStep(sec) {
    var st = sec._qa;
    if (!st.tour) return;
    if (!st.visible || document.hidden) {
      st.tourT = setTimeout(function () {
        dashTourStep(sec);
      }, 800);
      return;
    }
    var i = st.tourIdx++ % DASH_TOUR.length;
    if (i === 0 && st.tourIdx > 1) dashResetDemo(sec);
    var step = DASH_TOUR[i];
    var later = function (fn, ms) {
      st.timers.push(
        setTimeout(function () {
          if (st.tour) fn();
        }, ms),
      );
    };
    if (step[0] === "chat") {
      dashCursor(st, $(".qa-dash__ask", st.dash), true);
      later(function () {
        st.chat.hidden = false;
        later(function () {
          var q = $$(".qa-chat__chips button", st.dash)[0];
          dashCursor(st, q, true);
          later(function () {
            dashAsk(sec, q);
          }, 900);
        }, 500);
        later(function () {
          st.chat.hidden = true;
        }, step[1] - 400);
      }, 900);
    } else {
      var nav = $$(".qa-dash__nav", st.dash).filter(function (n) {
        return n.getAttribute("data-dash-go") === step[0];
      })[0];
      dashCursor(st, nav, true);
      later(function () {
        dashShow(sec, step[0]);
        if (step[0] === "review") {
          dashReviewSelect(sec, 0);
          later(function () {
            dashCursor(st, $("[data-dash-approve]", st.dash), true);
            later(function () {
              dashApprove(sec);
            }, 950);
          }, 700);
        }
      }, 900);
    }
    st.tourT = setTimeout(function () {
      dashTourStep(sec);
    }, step[1] + 900);
  }
  function dashStopTour(sec) {
    var st = sec._qa;
    if (!st || !st.tour) return;
    st.tour = false;
    clearTimeout(st.tourT);
    st.timers.forEach(clearTimeout);
    st.timers = [];
    if (st.cursor) st.cursor.classList.remove("is-on");
    if (st.pill) st.pill.hidden = true;
  }
  function initDash(scope) {
    $$("[data-qa-dash]", scope).forEach(function (sec) {
      if (sec._qa) return;
      var dash = $("[data-dash]", sec);
      if (!dash) return;
      var views = {};
      $$("[data-dash-view]", dash).forEach(function (v) {
        views[v.getAttribute("data-dash-view")] = v;
      });
      var pool = $("[data-log-pool]", dash);
      var st = {
        dash: dash,
        app: $(".qa-dash__app", dash),
        main: $("[data-dash-main]", dash),
        side: $(".qa-dash__side", dash),
        views: views,
        crumb: $("[data-dash-crumb]", dash),
        toast: $("[data-dash-toast]", dash),
        cursor: $("[data-dash-cursor]", dash),
        chat: $("[data-dash-chat]", dash),
        pill: $("[data-dash-tourpill]", dash),
        log: $("[data-log]", dash),
        pool: pool ? $$("li", pool.content) : [],
        poolIdx: 0,
        open: 3,
        reviewIdx: 0,
        tour: sec.getAttribute("data-tour") !== "false" && !reduce() && !(window.Shopify && window.Shopify.designMode),
        tourIdx: 0,
        timers: [],
        visible: false,
        started: false,
      };
      sec._qa = st;
      st.show = function (name) {
        dashShow(sec, name);
      };
      dashes.push(sec);
      dash.addEventListener("click", function (e) {
        var go = e.target.closest("[data-dash-go]");
        if (go && dash.contains(go)) {
          e.preventDefault();
          dashShow(sec, go.getAttribute("data-dash-go"));
          if (st.chat && window.innerWidth < 760) st.chat.hidden = true;
          return;
        }
        var act = e.target.closest("[data-dash-act]");
        if (act && dash.contains(act)) dashAct(sec, act.getAttribute("data-dash-act"), act);
      });
      // echte Bedienung beendet die Tour (die Tour selbst löst nur programmatische Klicks aus)
      var stop = function (e) {
        if (e.isTrusted) dashStopTour(sec);
      };
      dash.addEventListener("pointerdown", stop, true);
      dash.addEventListener("keydown", stop, true);
      if (st.pill && st.tour) st.pill.hidden = false;
      dashShow(sec, "overview");
      var start = function () {
        if (st.started) return;
        st.started = true;
        dashEnter(sec, st.view);
        if (st.tour) st.tourT = setTimeout(function () {
          dashTourStep(sec);
        }, 1400);
      };
      if ("IntersectionObserver" in window) {
        st.io = new IntersectionObserver(
          function (en) {
            st.visible = en[0].isIntersecting;
            if (st.visible) start();
          },
          { threshold: 0.3 },
        );
        st.io.observe(dash);
      } else {
        st.visible = true;
        start();
      }
    });
  }
  function updateTilt(el, vh) {
    if (reduce()) return;
    var r = el.getBoundingClientRect();
    var v = clamp((vh - r.top) / (vh * 0.7), 0, 1);
    el.style.setProperty("--v", (1 - Math.pow(1 - v, 3)).toFixed(3));
  }

  /* --------------------------------------------------------- Roter Faden */
  var thread = null;
  function buildThread() {
    var svg = $("[data-qa-thread]");
    var main = $("#MainContent");
    var cont = main ? $(".qa-container", main) : null;
    if (!svg || !main || !cont || reduce()) {
      if (svg) svg.style.display = "none";
      thread = null;
      return;
    }
    var mr = main.getBoundingClientRect();
    var cr = cont.getBoundingClientRect();
    // Der Faden läuft nur im freien Rand links neben dem Inhalt – er kreuzt nie Text oder Karten
    var free = cr.left - mr.left + parseFloat(getComputedStyle(cont).paddingLeft || 0);
    if (free < 56) {
      svg.style.display = "none";
      thread = null;
      return;
    }
    svg.style.display = "";
    var anchors = $$("[data-thread-anchor]", main).filter(function (a) {
      return a.offsetParent !== null;
    });
    if (anchors.length < 2) return;
    var base = free / 2;
    var amp = Math.min(free * 0.3, 40);
    var pts = anchors.map(function (a, i) {
      var r = a.getBoundingClientRect();
      var last = i === anchors.length - 1;
      return { x: last ? base : base + (i % 2 === 0 ? -amp : amp), y: r.top - mr.top + r.height / 2 };
    });
    pts.sort(function (a, b) {
      return a.y - b.y;
    });
    var d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1];
      var b = pts[i];
      var my = (a.y + b.y) / 2;
      d += " C " + a.x.toFixed(1) + " " + my.toFixed(1) + ", " + b.x.toFixed(1) + " " + my.toFixed(1) + ", " + b.x.toFixed(1) + " " + b.y.toFixed(1);
    }
    svg.setAttribute("viewBox", "0 0 " + mr.width.toFixed(0) + " " + main.scrollHeight);
    svg.style.height = main.scrollHeight + "px";
    var paths = $$("path", svg);
    paths.forEach(function (p) {
      p.setAttribute("d", d);
    });
    var line = paths[paths.length - 1];
    var len = line.getTotalLength();
    // Tabelle: y-Position → Pfadlänge (für flüssiges Nachzeichnen passend zur Scrollposition)
    var lut = [];
    var steps = 400;
    for (var k = 0; k <= steps; k++) {
      var pt = line.getPointAtLength((len * k) / steps);
      lut.push(pt.y);
    }
    line.style.strokeDasharray = len.toFixed(1);
    thread = { svg: svg, line: line, len: len, lut: lut, top: mr.top + scrollY, last: -1 };
  }
  function updateThread(vh) {
    if (!thread) return;
    var y = scrollY + vh * 0.62 - thread.top;
    var lut = thread.lut;
    var k = 0;
    while (k < lut.length - 1 && lut[k + 1] <= y) k++;
    var frac = k / (lut.length - 1);
    if (Math.abs(frac - thread.last) < 0.0005) return;
    thread.last = frac;
    thread.line.style.strokeDashoffset = (thread.len * (1 - frac)).toFixed(1);
  }

  /* ------------------------------------------------ Scroll-Schleife (rAF) */
  var ticking = false;
  var lastY = scrollY;
  var header = null;
  var progress = null;
  var sticky = null;
  var marquees = [];
  var knots = [];
  var pricingEl = null;
  function frame() {
    ticking = false;
    var vh = innerHeight;
    var y = scrollY;
    var velocity = y - lastY;
    lastY = y;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (progress) {
      var h = document.documentElement.scrollHeight - vh;
      progress.style.setProperty("--scroll", h > 0 ? (y / h).toFixed(4) : 0);
    }
    heroes.forEach(function (hero) {
      if (reduce()) return;
      var t = clamp(y / (vh * 0.55), 0, 1);
      hero.style.setProperty("--hero-tilt", (1 - t).toFixed(3));
      hero.style.setProperty("--hero-tilt-inv", t.toFixed(3));
      $$("[data-parallax]", hero).forEach(function (el) {
        el.style.setProperty("--py", (y * parseFloat(el.getAttribute("data-parallax"))).toFixed(1));
      });
    });
    phoneGroups.forEach(function (s) {
      updatePhones(s, vh);
    });
    dashes.forEach(function (s) {
      if (s._qa) updateTilt(s._qa.dash, vh);
    });
    knots.forEach(function (k) {
      updateTilt(k, vh);
    });
    if (sticky) {
      var heroEl = heroes[0];
      var past = heroEl ? heroEl.getBoundingClientRect().bottom < 0 : y > vh;
      var pricing = pricingEl && document.documentElement.contains(pricingEl) ? pricingEl : (pricingEl = $("[data-qa-pricing]"));
      var atPricing = pricing ? pricing.getBoundingClientRect().top < vh && pricing.getBoundingClientRect().bottom > 0 : false;
      var on = past && !atPricing;
      sticky.classList.toggle("is-on", on);
      sticky.setAttribute("aria-hidden", on ? "false" : "true");
      var link = $("a", sticky);
      if (link) link.tabIndex = on ? 0 : -1;
    }
    if (!reduce()) {
      marquees.forEach(function (m) {
        var anim = m._anim;
        if (!anim) return;
        var target = clamp(1 + Math.abs(velocity) / 18, 1, 5);
        m._rate = (m._rate || 1) + (target - (m._rate || 1)) * 0.15;
        anim.playbackRate = m._rate;
      });
    }
    updateThread(vh);
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      buildThread();
      onScroll();
    }, 150);
  });
  // Marquee-Tempo beruhigt sich, wenn nicht gescrollt wird
  setInterval(function () {
    if (ticking) return;
    for (var i = 0; i < marquees.length; i++) {
      if ((marquees[i]._rate || 1) > 1.02) {
        onScroll();
        return;
      }
    }
  }, 120);

  /* ----------------------------------------------- Kippen & Magnet-Buttons */
  function initPointerFx(scope) {
    if (!window.matchMedia("(pointer: fine)").matches || reduce()) return;
    $$("[data-tilt]", scope).forEach(function (el) {
      if (el._qaTilt) return;
      el._qaTilt = true;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + "deg");
        el.style.setProperty("--rx", (((e.clientY - r.top) / r.height - 0.5) * -8).toFixed(2) + "deg");
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });
    $$("[data-magnetic]", scope).forEach(function (el) {
      if (el._qaMag) return;
      el._qaMag = true;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.translate = ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1) + "px";
      });
      el.addEventListener("pointerleave", function () {
        el.style.translate = "";
      });
    });
  }

  /* --------------------------------------------------------------- Warenkorb */
  var drawerLast = null;
  function drawer() {
    return $("[data-cart-drawer]");
  }
  function openDrawer() {
    var d = drawer();
    if (!d) return false;
    drawerLast = document.activeElement;
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
    document.body.classList.add("qa-lock");
    var panel = $(".qa-drawer__panel", d);
    setTimeout(function () {
      if (panel) panel.focus();
    }, 60);
    return true;
  }
  function closeDrawer() {
    var d = drawer();
    if (!d || !d.classList.contains("is-open")) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
    document.body.classList.remove("qa-lock");
    if (drawerLast && drawerLast.focus) drawerLast.focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var opener = t.closest("[data-cart-open]");
    if (opener && document.body.getAttribute("data-cart-type") !== "page" && drawer()) {
      e.preventDefault();
      openDrawer();
      return;
    }
    if (t.closest("[data-cart-close]")) {
      e.preventDefault();
      closeDrawer();
      return;
    }
    var cont = t.closest("[data-cart-close-link]");
    if (cont) {
      // Gleiche Seite ohne Sprungmarke: nur schließen statt neu laden; mit Sprungmarke springt der Browser selbst
      var target = new URL(cont.getAttribute("href") || location.href, location.href);
      if (target.pathname === location.pathname && !target.hash) e.preventDefault();
      closeDrawer();
    }
  });
  function setCount(n) {
    $$("[data-cart-count]").forEach(function (el) {
      el.textContent = n;
      el.setAttribute("data-count", n);
      el.classList.remove("is-bump");
      void el.offsetWidth;
      el.classList.add("is-bump");
      var btn = el.closest("[data-cart-open]");
      if (btn) btn.setAttribute("aria-label", btn.getAttribute("aria-label").replace(/\(\d+\)/, "(" + n + ")"));
    });
  }
  function sectionIds() {
    var ids = [];
    if (drawer()) ids.push("cart-drawer");
    var page = $("[data-qa-cart-page]");
    if (page && page.getAttribute("data-section-id")) ids.push(page.getAttribute("data-section-id"));
    return ids;
  }
  function renderSections(sections) {
    if (!sections) return;
    Object.keys(sections).forEach(function (id) {
      var html = sections[id];
      if (!html) return;
      var doc = new DOMParser().parseFromString(html, "text/html");
      if (id === "cart-drawer") {
        var fresh = $("[data-cart-drawer]", doc);
        var cur = drawer();
        if (fresh && cur) {
          var wasOpen = cur.classList.contains("is-open");
          cur.innerHTML = fresh.innerHTML;
          if (wasOpen) cur.classList.add("is-open");
        }
      } else {
        var freshPage = $("[data-qa-cart-page]", doc);
        var curPage = $("[data-qa-cart-page]");
        if (freshPage && curPage) curPage.innerHTML = freshPage.innerHTML;
      }
    });
  }
  function cartChange(line, quantity, el) {
    if (el) el.classList.add("is-busy");
    return fetch(ROUTES.cartChange + ".js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ line: line, quantity: quantity, sections: sectionIds(), sections_url: location.pathname }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("change");
        return r.json();
      })
      .then(function (cart) {
        renderSections(cart.sections);
        setCount(cart.item_count);
      })
      .catch(function () {
        if (el) el.classList.remove("is-busy");
        toast(STR.error || "Fehler");
      });
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var lineEl = t.closest("[data-line]");
    if (!lineEl) return;
    var line = parseInt(lineEl.getAttribute("data-line"), 10);
    var step = t.closest("[data-qty-step]");
    if (step) {
      e.preventDefault();
      var input = $("[data-qty-input]", lineEl);
      var q = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(step.getAttribute("data-qty-step"), 10));
      input.value = q;
      cartChange(line, q, lineEl);
    } else if (t.closest("[data-remove]")) {
      e.preventDefault();
      cartChange(line, 0, lineEl);
    }
  });
  document.addEventListener("change", function (e) {
    var input = e.target.closest && e.target.closest("[data-line] [data-qty-input]");
    if (input) {
      var lineEl = input.closest("[data-line]");
      cartChange(parseInt(lineEl.getAttribute("data-line"), 10), Math.max(0, parseInt(input.value, 10) || 0), lineEl);
    }
    var sort = e.target.closest && e.target.closest("[data-sort-select]");
    if (sort) {
      var u = new URL(location.href);
      u.searchParams.set("sort_by", sort.value);
      u.searchParams.delete("page");
      location.href = u.toString();
    }
  });

  /* Hinzufügen (Produktformular und Schnellkauf in den Preisen) */
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form.matches || !form.matches("[data-product-form], [data-quick-add]")) return;
    var submitter = e.submitter;
    var direct = submitter && submitter.hasAttribute("data-direct-checkout");
    e.preventDefault();
    var btn = direct ? submitter : $("[type=submit]", form);
    if (btn) {
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");
    }
    var err = $("[data-form-error]", form);
    if (err) err.hidden = true;
    var fd = new FormData(form);
    fd.delete("return_to");
    if (!fd.get("selling_plan")) fd.delete("selling_plan");
    var ids = direct ? [] : sectionIds();
    if (ids.length) {
      fd.append("sections", ids.join(","));
      fd.append("sections_url", location.pathname);
    }
    fetch(ROUTES.cartAdd + ".js", { method: "POST", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }, body: fd })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || j.status) throw new Error(j.description || j.message || "add");
          return j;
        });
      })
      .then(function (res) {
        if (direct) {
          location.href = "/checkout";
          return;
        }
        renderSections(res.sections);
        return fetch(ROUTES.cart + ".js", { headers: { Accept: "application/json" } })
          .then(function (r) {
            return r.json();
          })
          .then(function (cart) {
            setCount(cart.item_count);
            if (document.body.getAttribute("data-cart-type") === "page" || !drawer()) {
              toast(STR.added || "Im Warenkorb");
            } else openDrawer();
          });
      })
      .catch(function (error) {
        if (err) {
          err.textContent = error.message && error.message !== "add" ? error.message : STR.error;
          err.hidden = false;
        } else toast(STR.error || "Fehler");
      })
      .finally(function () {
        if (btn) {
          btn.classList.remove("is-loading");
          btn.removeAttribute("aria-busy");
        }
      });
  });

  /* ---------------------------------------------------------------- Produkt */
  function money(cents) {
    var cur = (window.Shopify && Shopify.currency && Shopify.currency.active) || "EUR";
    try {
      return new Intl.NumberFormat(root.lang || "de", { style: "currency", currency: cur }).format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(2) + " " + cur;
    }
  }
  function initProduct(scope) {
    $$("[data-qa-product]", scope).forEach(function (sec) {
      if (sec._qa) return;
      var jsonEl = sec.parentNode ? $("[data-product-json]", sec.parentNode) : null;
      var product;
      try {
        product = JSON.parse(jsonEl.textContent);
      } catch (e) {
        return;
      }
      sec._qa = true;
      var form = $("[data-product-form]", sec);
      var idInput = $("[data-variant-id]", sec);
      var current = product.variants.filter(function (v) {
        return String(v.id) === idInput.value;
      })[0];
      var update = function () {
        var plan = $("[data-plan-option]:checked", sec);
        var planId = plan ? plan.value : "";
        var price = current.price;
        var compare = current.compare_at_price;
        (current.selling_plan_allocations || []).forEach(function (a) {
          var el = $('[data-plan-price="' + a.selling_plan_id + '"]', sec);
          if (el) el.textContent = money(a.price);
          if (String(a.selling_plan_id) === planId) {
            price = a.price;
            compare = a.compare_at_price;
          }
        });
        var once = $('[data-plan-price=""]', sec);
        if (once) once.textContent = money(current.price);
        $("[data-price-now]", sec).textContent = money(price);
        var was = $("[data-price-was]", sec);
        if (was) was.textContent = compare > price ? money(compare) : "";
        var unit = $("[data-price-unit]", sec);
        if (unit) unit.textContent = plan && plan.value ? plan.closest(".qa-option").querySelector(".qa-option__title").textContent : "";
        var add = $("[data-add]", sec);
        var direct = $("[data-direct-checkout]", sec);
        [add, direct].forEach(function (b) {
          if (b) b.disabled = !current.available;
        });
        var label = $("[data-add-label]", sec);
        if (label) label.textContent = current.available ? label.getAttribute("data-available") || label.textContent : label.getAttribute("data-soldout") || label.textContent;
      };
      sec.addEventListener("change", function (e) {
        if (e.target.matches("[data-option-index]")) {
          var opts = [];
          $$("fieldset", sec).forEach(function (fs) {
            var c = $("[data-option-index]:checked", fs);
            if (c) opts[parseInt(c.getAttribute("data-option-index"), 10)] = c.value;
          });
          var match = product.variants.filter(function (v) {
            return v.options.every(function (o, i) {
              return opts[i] === undefined || opts[i] === o;
            });
          })[0];
          if (match) {
            current = match;
            idInput.value = match.id;
            var u = new URL(location.href);
            u.searchParams.set("variant", match.id);
            history.replaceState(null, "", u.toString());
            if (match.featured_media && match.featured_media.preview_image) {
              var main = $("[data-gallery-main] img", sec);
              if (main) {
                main.srcset = "";
                main.src = match.featured_media.preview_image.src;
              }
            }
          }
          update();
        }
        if (e.target.matches("[data-plan-option]")) update();
      });
      $$("[data-media-src]", sec).forEach(function (b) {
        b.addEventListener("click", function () {
          var main = $("[data-gallery-main] img", sec);
          if (main) {
            main.srcset = "";
            main.src = b.getAttribute("data-media-src");
          }
          $$("[data-media-src]", sec).forEach(function (x) {
            x.setAttribute("aria-current", x === b ? "true" : "false");
          });
        });
      });
      $$("[data-qty-step]", form).forEach(function (b) {
        if (b.closest("[data-line]")) return;
        b.addEventListener("click", function () {
          var input = $("[data-qty-input]", form);
          input.value = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute("data-qty-step"), 10));
        });
      });
      update();
    });
  }

  /* ---------------------------------------------------------------- Anmelden */
  // Solange keine App-Adresse eingetragen ist: nichts senden, ehrlich sagen, wann es losgeht.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var pw = t.closest("[data-pw-toggle]");
    if (pw) {
      var input = $("[data-pw]", pw.parentNode);
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      pw.setAttribute("aria-pressed", show ? "true" : "false");
      return;
    }
    var n = t.closest("[data-login-notice-open]");
    if (n) {
      var box = $("[data-login-notice]", n.closest("form"));
      if (box) box.hidden = false;
    }
  });
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form.matches || !form.matches("[data-login-form]")) return;
    e.preventDefault();
    var box = $("[data-login-notice]", form);
    if (box) {
      box.hidden = false;
      box.style.animation = "none";
      void box.offsetWidth;
      box.style.animation = "";
    }
  });

  /* ------------------------------------------------------------------ Suche */
  var searchTimer;
  var searchCtrl;
  var searchLast = null;
  function searchOverlay() {
    return $("[data-search-overlay]");
  }
  function openSearch(term) {
    var o = searchOverlay();
    if (!o) return false;
    searchLast = document.activeElement;
    o.hidden = false;
    requestAnimationFrame(function () {
      o.classList.add("is-open");
    });
    document.body.classList.add("qa-lock");
    var input = $("[data-search-input]", o);
    setTimeout(function () {
      input.focus();
      if (term) {
        input.value = term;
        runSearch(term);
      }
    }, 40);
    return true;
  }
  function closeSearch() {
    var o = searchOverlay();
    if (!o || o.hidden) return;
    o.classList.remove("is-open");
    document.body.classList.remove("qa-lock");
    setTimeout(function () {
      o.hidden = true;
    }, 220);
    if (searchLast && searchLast.focus) searchLast.focus();
  }
  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function markTerm(text, q) {
    var safe = escapeHtml(text);
    var i = safe.toLowerCase().indexOf(escapeHtml(q).toLowerCase());
    if (!q || i < 0) return safe;
    return safe.slice(0, i) + "<mark>" + safe.slice(i, i + q.length) + "</mark>" + safe.slice(i + q.length);
  }
  function runSearch(q) {
    var o = searchOverlay();
    if (!o) return;
    var start = $("[data-search-start]", o);
    var box = $("[data-search-results]", o);
    q = (q || "").trim();
    if (q.length < 2) {
      start.hidden = false;
      box.innerHTML = "";
      return;
    }
    start.hidden = true;
    box.innerHTML = '<p class="qa-search__none">' + escapeHtml(STR.searchLoading || "…") + "</p>";
    if (searchCtrl && searchCtrl.abort) searchCtrl.abort();
    searchCtrl = "AbortController" in window ? new AbortController() : null;
    var url =
      (ROUTES.predictiveSearch || "/search/suggest") +
      ".json?q=" +
      encodeURIComponent(q) +
      "&resources[type]=product,page,article&resources[limit]=6&resources[options][unavailable_products]=last";
    fetch(url, { headers: { Accept: "application/json" }, signal: searchCtrl ? searchCtrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error("suggest");
        return r.json();
      })
      .then(function (data) {
        var res = (data && data.resources && data.resources.results) || {};
        var types = STR.searchTypes || {};
        var html = "";
        var i = 0;
        var products = res.products || [];
        var others = (res.pages || []).map(function (p) {
          return { title: p.title, url: p.url, type: types.page || "Seite" };
        });
        (res.articles || []).forEach(function (a) {
          others.push({ title: a.title, url: a.url, type: types.article || "Artikel", image: a.image });
        });
        if (products.length) {
          html += '<p class="qa-search__group">' + escapeHtml(types.product || "Produkte") + "</p>";
          products.forEach(function (p) {
            var img = p.featured_image && p.featured_image.url ? p.featured_image.url : p.image;
            var price = p.price != null ? money(Math.round(parseFloat(p.price) * 100)) : "";
            html +=
              '<a class="qa-search__hit" style="--i:' +
              i++ +
              '" href="' +
              escapeHtml(p.url) +
              '">' +
              (img ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy" width="48" height="48">' : '<span class="qa-search__ph">' + ($(".qa-logo__mark") ? $(".qa-logo__mark").outerHTML : "") + "</span>") +
              "<span><b>" +
              markTerm(p.title, q) +
              "</b><small>" +
              escapeHtml(price) +
              "</small></span></a>";
          });
        }
        if (others.length) {
          html += '<p class="qa-search__group">' + escapeHtml((types.page || "Seiten") + " & " + (types.article || "Artikel")) + "</p>";
          others.forEach(function (p) {
            html +=
              '<a class="qa-search__hit" style="--i:' +
              i++ +
              '" href="' +
              escapeHtml(p.url) +
              '"><span class="qa-search__ph">' +
              ($(".qa-search__form > svg") ? $(".qa-search__form > svg").outerHTML : "") +
              "</span><span><b>" +
              markTerm(p.title, q) +
              "</b><small>" +
              escapeHtml(p.type) +
              "</small></span></a>";
          });
        }
        if (!html) html = '<p class="qa-search__none">' + escapeHtml(STR.searchNone || "") + "</p>";
        var all = (STR.searchAll || "%s").replace("%s", q);
        html +=
          '<a class="qa-search__all" href="' +
          escapeHtml((ROUTES.search || "/search") + "?q=" + encodeURIComponent(q) + "&options[prefix]=last") +
          '"><span>' +
          escapeHtml(all) +
          '</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>';
        box.innerHTML = html;
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        // Ohne Vorschläge: direkt zur Suchseite anbieten
        box.innerHTML =
          '<a class="qa-search__all" href="' +
          escapeHtml((ROUTES.search || "/search") + "?q=" + encodeURIComponent(q)) +
          '"><span>' +
          escapeHtml((STR.searchAll || "%s").replace("%s", q)) +
          "</span></a>";
      });
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-search-open]")) {
      if (openSearch()) e.preventDefault();
      return;
    }
    if (t.closest("[data-search-close]")) {
      closeSearch();
      return;
    }
    var term = t.closest("[data-search-term]");
    if (term) {
      var input = $("[data-search-input]", searchOverlay());
      input.value = term.textContent.trim();
      input.focus();
      runSearch(input.value);
    }
  });
  document.addEventListener("input", function (e) {
    if (!e.target.matches || !e.target.matches("[data-search-input]")) return;
    clearTimeout(searchTimer);
    var v = e.target.value;
    searchTimer = setTimeout(function () {
      runSearch(v);
    }, 180);
  });

  /* ---------------------------------------------------------- Initialisierung */
  function init(scope) {
    scope = scope || document;
    header = $("[data-qa-header]");
    progress = $(".qa-progress");
    sticky = $("[data-sticky-cta]");
    initReveal(scope);
    initHero(scope);
    initPipes(scope);
    initPlatforms(scope);
    initDash(scope);
    initProduct(scope);
    initPointerFx(scope);
    $$("[data-qa-marquee]", scope).forEach(function (m) {
      var track = $(".qa-marquee__track", m);
      if (track && track.getAnimations) m._anim = track.getAnimations()[0];
      if (marquees.indexOf(m) < 0) marquees.push(m);
    });
    $$(".qa-knot", scope).forEach(function (k) {
      if (knots.indexOf(k) < 0) knots.push(k);
    });
    applyTheme(root.getAttribute("data-theme-pref") || "system");
    requestAnimationFrame(function () {
      buildThread();
      onScroll();
    });
  }
  function prune() {
    var alive = function (el) {
      return document.documentElement.contains(el);
    };
    heroes = heroes.filter(function (h) {
      if (alive(h)) return true;
      if (h._cleanup) h._cleanup();
      return false;
    });
    pipes = pipes.filter(function (p) {
      if (alive(p)) return true;
      if (p._qa && p._qa.io) p._qa.io.disconnect();
      return false;
    });
    phoneGroups = phoneGroups.filter(alive);
    dashes = dashes.filter(function (s) {
      if (alive(s)) return true;
      if (s._qa) {
        dashStopTour(s);
        clearInterval(s._qa.viewTimer);
        if (s._qa.io) s._qa.io.disconnect();
      }
      return false;
    });
    marquees = marquees.filter(alive);
    knots = knots.filter(alive);
  }

  window.QA_THEME = { init: init };

  document.addEventListener("shopify:section:load", function (e) {
    prune();
    init(e.target);
  });
  document.addEventListener("shopify:section:unload", function () {
    setTimeout(function () {
      prune();
      buildThread();
    }, 0);
  });
  document.addEventListener("shopify:block:select", function (e) {
    var el = e.target;
    if (el.tagName === "DETAILS") el.open = true;
    if (el.hasAttribute && el.hasAttribute("data-reveal")) el.classList.add("is-visible");
    // Schritt im Editor ausgewählt: anzeigen und anhalten, damit man in Ruhe bearbeiten kann
    var pipe = el.closest && el.closest("[data-qa-pipe]");
    if (pipe && pipe._qa && el.hasAttribute("data-step")) {
      pipeSetPlaying(pipe, false);
      pipeGo(pipe, parseInt(el.getAttribute("data-step"), 10));
    }
  });
  document.addEventListener("shopify:section:select", function (e) {
    // Im Editor ausgewählt: Tour anhalten, Übersicht zeigen
    var dash = e.target.querySelector && e.target.querySelector("[data-qa-dash]");
    if (dash && dash._qa) {
      dashStopTour(dash);
      dashShow(dash, "overview");
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () {
    init(document);
  });
  else init(document);
  window.addEventListener("load", function () {
    buildThread();
    onScroll();
  });
})();
