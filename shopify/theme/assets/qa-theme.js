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
          { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
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
      var status = $("[data-qa-status]", hero);
      var steps = status ? (status.getAttribute("data-steps") || "").split("|").filter(Boolean) : [];
      var idx = 0;
      if (steps.length && !reduce()) {
        hero._timer = setInterval(function () {
          idx = (idx + 1) % steps.length;
          status.style.opacity = "0";
          setTimeout(function () {
            status.textContent = steps[idx];
            status.style.opacity = "1";
          }, 180);
        }, 1700);
        status.style.transition = "opacity .18s";
      }
      var move = function (e) {
        var r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        hero.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      };
      if (window.matchMedia("(pointer: fine)").matches && !reduce()) hero.addEventListener("pointermove", move, { passive: true });
      hero._cleanup = function () {
        clearInterval(hero._timer);
        hero.removeEventListener("pointermove", move);
      };
      heroes.push(hero);
    });
  }

  /* -------------------------------------------------------------- Pipeline */
  var pipes = [];
  function initPipes(scope) {
    $$("[data-qa-pipe]", scope).forEach(function (pipe) {
      if (pipe._qa) return;
      pipe._qa = {
        track: $(".qa-pipe__track", pipe),
        steps: $$("[data-step]", pipe),
        scenes: $$("[data-scene]", pipe),
        stage: $("[data-pipe-stage]", pipe),
        hint: $("[data-pipe-hint]", pipe),
        active: -1,
      };
      pipes.push(pipe);
    });
  }
  function updatePipe(pipe, vh) {
    var s = pipe._qa;
    if (!s || !s.track) return;
    var r = s.track.getBoundingClientRect();
    var total = r.height - vh;
    if (r.bottom < -vh || r.top > vh * 2) return;
    var p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    var n = s.steps.length || 1;
    var raw = p * n;
    var idx = Math.min(n - 1, Math.floor(raw));
    var sp = clamp(raw - idx, 0, 1);
    if (p >= 1) sp = 1;
    pipe.style.setProperty("--p", p.toFixed(4));
    if (s.stage) {
      s.stage.style.setProperty("--sp", sp.toFixed(4));
      var press = 1 - 0.06 * Math.max(0, 1 - Math.abs(sp - 0.55) * 12);
      s.stage.style.setProperty("--press", press.toFixed(3));
    }
    if (idx !== s.active) {
      s.active = idx;
      s.steps.forEach(function (el, i) {
        el.classList.toggle("is-active", i === idx);
        el.classList.toggle("is-done", i < idx);
      });
      s.scenes.forEach(function (el, i) {
        el.classList.toggle("is-active", i === idx);
        el.classList.toggle("is-past", i < idx);
      });
    }
    if (s.hint) s.hint.style.opacity = p > 0.02 ? "0" : "1";
  }
  function scrollPipeTo(pipe, index) {
    var s = pipe._qa;
    if (!s) return;
    var r = s.track.getBoundingClientRect();
    var total = r.height - innerHeight;
    var y = scrollY + r.top + total * ((index + 0.5) / (s.steps.length || 1));
    window.scrollTo({ top: y, behavior: reduce() ? "auto" : "smooth" });
  }

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
  var dashes = [];
  function initDash(scope) {
    $$("[data-qa-dash]", scope).forEach(function (sec) {
      if (sec._qa) return;
      var dash = $("[data-dash]", sec);
      if (!dash) return;
      var st = { dash: dash, tabs: $$("[data-dash-tab]", sec), views: $$("[data-dash-view]", sec), auto: true, timers: [], started: false };
      sec._qa = st;
      dashes.push(sec);
      var show = function (name, byUser) {
        if (byUser) {
          st.auto = false;
          st.timers.forEach(clearTimeout);
        }
        st.tabs.forEach(function (t) {
          var on = t.getAttribute("data-dash-tab") === name;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
        });
        st.views.forEach(function (v) {
          var on = v.getAttribute("data-dash-view") === name;
          v.classList.toggle("is-on", on);
          if (on) v.removeAttribute("hidden");
          else v.setAttribute("hidden", "");
        });
        $$("[data-dash-nav]", sec).forEach(function (n) {
          n.classList.toggle("is-on", n.getAttribute("data-dash-nav") === name);
        });
      };
      st.show = show;
      st.tabs.forEach(function (t, i) {
        t.addEventListener("click", function () {
          show(t.getAttribute("data-dash-tab"), true);
        });
        t.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          var n = st.tabs[(i + (e.key === "ArrowRight" ? 1 : st.tabs.length - 1)) % st.tabs.length];
          n.focus();
          show(n.getAttribute("data-dash-tab"), true);
        });
      });
      show("overview");
      var start = function () {
        if (st.started) return;
        st.started = true;
        countUp(sec);
        $$(".qa-meter__bar span", sec).forEach(function (b) {
          b.style.setProperty("--v", "0");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              b.style.setProperty("--v", "1");
            });
          });
        });
        if (!reduce()) cycle(sec);
      };
      if ("IntersectionObserver" in window) {
        // Bleibt aktiv: Der automatische Ablauf pausiert, solange das Dashboard nicht zu sehen ist
        st.io = new IntersectionObserver(
          function (en) {
            st.visible = en[0].isIntersecting;
            if (st.visible) start();
          },
          { threshold: 0.35 },
        );
        st.io.observe(dash);
      } else {
        st.visible = true;
        start();
      }
    });
  }
  function countUp(sec) {
    $$("[data-count]", sec).forEach(function (el) {
      var to = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (reduce()) return;
      var t0 = performance.now();
      var tick = function (t) {
        var k = clamp((t - t0) / 1100, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  function cycle(sec) {
    var st = sec._qa;
    var later = function (fn, ms) {
      st.timers.push(setTimeout(fn, ms));
    };
    var cursor = $("[data-dash-cursor]", sec);
    var approve = $("[data-dash-approve]", sec);
    var toastEl = $("[data-dash-toast]", sec);
    var newDay = $("[data-dash-newday]", sec);
    var tpl = $("[data-dash-newevt]", sec);
    var badge = $("[data-dash-badge]", sec);
    var run = function () {
      if (!st.auto) return;
      if (!st.visible || document.hidden) {
        later(run, 800);
        return;
      }
      st.show("overview");
      later(function () {
        if (!st.auto) return;
        st.show("review");
        if (cursor) {
          cursor.style.transition = "none";
          cursor.style.opacity = "1";
          cursor.style.transform = "translate(-140px, 90px)";
          requestAnimationFrame(function () {
            cursor.style.transition = "transform 1.1s cubic-bezier(.22,1,.36,1)";
            cursor.style.transform = "translate(0, 0)";
          });
        }
        later(function () {
          if (approve) {
            approve.style.transition = "transform .15s";
            approve.style.setProperty("--press", "0.94");
            later(function () {
              approve.style.setProperty("--press", "1");
            }, 160);
          }
          if (toastEl) toastEl.classList.add("is-on");
          if (badge) badge.textContent = "2";
        }, 1500);
        later(function () {
          if (!st.auto) return;
          if (toastEl) toastEl.classList.remove("is-on");
          if (cursor) cursor.style.opacity = "0";
          st.show("calendar");
          if (newDay && tpl && !newDay.querySelector(".qa-evt")) newDay.appendChild(tpl.content.cloneNode(true));
        }, 3000);
        later(function () {
          if (!st.auto) return;
          if (newDay) $$(".qa-evt", newDay).forEach(function (e) {
            e.remove();
          });
          if (badge) badge.textContent = "3";
          run();
        }, 7200);
      }, 3600);
    };
    run();
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
    pipes.forEach(function (p) {
      updatePipe(p, vh);
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
    pipes = pipes.filter(alive);
    phoneGroups = phoneGroups.filter(alive);
    dashes = dashes.filter(function (s) {
      if (alive(s)) return true;
      if (s._qa) {
        s._qa.auto = false;
        s._qa.timers.forEach(clearTimeout);
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
    var step = el.closest && el.closest("[data-qa-pipe]");
    if (step && el.hasAttribute("data-step")) scrollPipeTo(step, parseInt(el.getAttribute("data-step"), 10));
  });
  document.addEventListener("shopify:section:select", function (e) {
    var dash = e.target.querySelector && e.target.querySelector("[data-qa-dash]");
    if (dash && dash._qa && dash._qa.show) dash._qa.show("overview");
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
