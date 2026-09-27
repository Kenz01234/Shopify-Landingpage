/*
 * Quest Agent – Landing-Section (ohne Abhängigkeiten).
 * - Loop-Demo: Konfiguration → Produktion → Video/Short → Freigabe (wartet) → Kalender
 * - Einblenden beim Scrollen
 * - Theme-Editor: shopify:section:load/unload/select, shopify:block:select
 * Es wird nichts veröffentlicht; alles ist eine Beispielanimation.
 */
(function () {
  "use strict";

  // Der Theme-Editor führt das Skript einer neu geladenen Section erneut aus. Listener nur einmal registrieren,
  // bei jeder weiteren Ausführung nur neu initialisieren (je Section genau eine Instanz).
  if (window.QuestAgentLanding) {
    window.QuestAgentLanding.init();
    return;
  }

  var instances = new Map();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PHASES = [
    { key: "config", ms: 1300, label: "Dein System wird eingerichtet" },
    { key: "loop", ms: 800, label: "Daraus entsteht dein Quest-Loop" },
    { key: "s0", ms: 950, label: "Recherche & Rohmaterial" },
    { key: "s1", ms: 950, label: "Skript wird geschrieben" },
    { key: "s2", ms: 950, label: "KI-Stimme spricht das Skript" },
    { key: "s3", ms: 950, label: "Video wird geschnitten" },
    { key: "s4", ms: 900, label: "Shorts entstehen" },
    { key: "s5", ms: 900, label: "Automatische Prüfung" },
    { key: "review", ms: 0, label: "Wartet auf deine Freigabe" },
    { key: "scheduled", ms: 0, label: "Freigegeben und eingeplant (Demo)" },
  ];

  function Loop(root) {
    this.root = root;
    this.stage = root.querySelector("[data-qa-stage]");
    this.phase = 0;
    this.playing = true;
    this.timer = null;
    this.visible = false;
    this.handlers = [];
    if (this.stage) this.bind();
    this.revealInit();
    var self = this;
    requestAnimationFrame(function () {
      root.classList.add("qa-ready");
      self.root.classList.remove("qa-no-js");
    });
  }

  Loop.prototype.on = function (el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, fn);
    this.handlers.push([el, ev, fn]);
  };

  Loop.prototype.bind = function () {
    var self = this;
    var q = function (s) {
      return self.stage.querySelector(s);
    };
    this.els = {
      status: q("[data-qa-status]"),
      toggle: q("[data-qa-toggle]"),
      restart: q("[data-qa-restart]"),
      steps: Array.prototype.slice.call(this.stage.querySelectorAll("[data-qa-step]")),
      progress: q("[data-qa-progress]"),
      video: q("[data-qa-video]"),
      short: q("[data-qa-short]"),
      approval: q("[data-qa-approval]"),
      calendar: q("[data-qa-calendar]"),
      waiting: q("[data-qa-waiting]"),
      approve: q("[data-qa-approve]"),
      changes: q("[data-qa-changes]"),
    };
    this.on(this.els.toggle, "click", function () {
      self.playing = !self.playing;
      self.els.toggle.setAttribute("aria-label", self.playing ? "Animation pausieren" : "Animation fortsetzen");
      self.els.toggle.textContent = self.playing ? "❚❚" : "▶";
      self.schedule();
    });
    this.on(this.els.restart, "click", function () {
      self.go(0, true);
    });
    this.on(this.els.approve, "click", function () {
      self.go(PHASES.length - 1, true);
    });
    this.on(this.els.changes, "click", function () {
      self.go(3, true);
    });
    var discover = this.root.querySelector("[data-qa-discover]");
    this.on(discover, "click", function () {
      self.stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      self.stage.focus({ preventScroll: true });
      self.go(0, true);
    });
    if ("IntersectionObserver" in window) {
      this.io = new IntersectionObserver(
        function (entries) {
          self.visible = entries[0].isIntersecting;
          self.schedule();
        },
        { threshold: 0.15 },
      );
      this.io.observe(this.stage);
    } else {
      this.visible = true;
    }
    this.render();
    this.schedule();
  };

  Loop.prototype.go = function (i, play) {
    this.phase = Math.max(0, Math.min(PHASES.length - 1, i));
    if (play) this.playing = true;
    this.render();
    this.schedule();
  };

  Loop.prototype.schedule = function () {
    clearTimeout(this.timer);
    var p = PHASES[this.phase];
    if (!this.playing || !this.visible || !p.ms) return;
    var self = this;
    this.timer = setTimeout(function () {
      self.go(self.phase + 1);
    }, reduce ? p.ms * 1.4 : p.ms);
  };

  Loop.prototype.render = function () {
    var e = this.els;
    var p = this.phase;
    if (e.status) e.status.textContent = PHASES[p].label;
    e.steps.forEach(function (li, i) {
      var sp = i + 2;
      li.classList.toggle("is-done", p > sp);
      li.classList.toggle("is-active", p === sp);
    });
    if (e.progress) e.progress.style.width = Math.min(100, Math.max(0, ((p - 1) / 7) * 100)) + "%";
    if (e.video) e.video.classList.toggle("is-ready", p >= 6);
    if (e.short) e.short.classList.toggle("is-ready", p >= 7);
    var review = PHASES[p].key === "review";
    var scheduled = PHASES[p].key === "scheduled";
    if (e.approval) e.approval.hidden = !review;
    if (e.calendar) e.calendar.hidden = !scheduled;
    if (e.waiting) e.waiting.hidden = review || scheduled;
  };

  Loop.prototype.revealInit = function () {
    var items = this.root.querySelectorAll(".qa-reveal");
    if (!("IntersectionObserver" in window) || reduce) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    this.revealIo = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            obs.unobserve(en.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    var io = this.revealIo;
    items.forEach(function (el, i) {
      el.style.transitionDelay = (i % 6) * 60 + "ms";
      io.observe(el);
    });
  };

  Loop.prototype.showBlock = function (el) {
    if (el && el.classList.contains("qa-reveal")) el.classList.add("is-visible");
    if (el && el.tagName === "DETAILS") el.open = true;
  };

  Loop.prototype.destroy = function () {
    clearTimeout(this.timer);
    if (this.io) this.io.disconnect();
    if (this.revealIo) this.revealIo.disconnect();
    this.handlers.forEach(function (h) {
      h[0].removeEventListener(h[1], h[2]);
    });
    this.handlers = [];
  };

  function init(scope) {
    (scope || document).querySelectorAll("[data-qa-root]").forEach(function (root) {
      var id = root.getAttribute("data-section-id");
      if (instances.has(id)) instances.get(id).destroy();
      instances.set(id, new Loop(root));
    });
  }

  function byEvent(e) {
    return e && e.detail && e.detail.sectionId ? instances.get(e.detail.sectionId) : null;
  }

  document.addEventListener("shopify:section:load", function (e) {
    init(e.target);
  });
  document.addEventListener("shopify:section:unload", function (e) {
    var inst = byEvent(e);
    if (inst) {
      inst.destroy();
      instances.delete(e.detail.sectionId);
    }
  });
  document.addEventListener("shopify:section:select", function (e) {
    var inst = byEvent(e);
    if (inst) inst.go(0, true);
  });
  document.addEventListener("shopify:block:select", function (e) {
    var inst = byEvent(e);
    if (inst) inst.showBlock(e.target);
  });

  window.QuestAgentLanding = { init: init };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
