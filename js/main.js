"use strict";

initTheme();
initNavigation();
initScrollHeader();
if (document.querySelector("#events-timeline")) initEvents();
if (document.querySelector("#resource-grid")) initResources();

function initTheme() {
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;
  const root = document.documentElement;
  const sync = theme => {
    root.setAttribute("data-theme", theme);
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  };
  sync(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  toggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    sync(next);
    try { localStorage.setItem("theme", next); } catch {}
  });
}

function initNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  if (!toggle || !nav) return;
  toggle.hidden = false;
  function closeMenu() {
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      toggle.focus();
    }
  });
  nav.addEventListener("click", event => {
    if (event.target.closest("a")) closeMenu();
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", closeMenu);
}

function initScrollHeader() {
  const header = document.querySelector("header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function validInstagramUrl(value) {
  try {
    const url = new URL(value);
    const valid = url.protocol === "https:" && url.hostname === "www.instagram.com" && /^\/(p|reel)\/[\w-]+\/?$/.test(url.pathname);
    return valid ? url.href : null;
  } catch {
    return null;
  }
}

function createInstagramFallback(url) {
  const link = createEl("a", "", "View post on Instagram");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function createInstagramQuote(url) {
  const quote = document.createElement("blockquote");
  quote.className = "instagram-media";
  quote.dataset.instgrmPermalink = url;
  quote.dataset.instgrmVersion = "14";
  quote.append(createInstagramFallback(url));
  return quote;
}

let instagramScript;
function loadInstagramEmbeds(panels) {
  if (!panels.length) return;
  const fallback = ({ panel, url }) => panel.replaceChildren(createInstagramFallback(url));
  // Instagram adds inline widths; keep sizing in the site's CSS.
  if ("MutationObserver" in window) {
    panels.forEach(({ panel }) => {
      const normalize = () => {
        panel.querySelectorAll(".instagram-media").forEach(embed => {
          ["width", "min-width", "max-width", "margin"].forEach(name => {
            if (embed.style.getPropertyValue(name)) embed.style.removeProperty(name);
          });
        });
      };
      normalize();
      new MutationObserver(normalize).observe(panel, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["style"]
      });
    });
  }
  const timeout = setTimeout(() => {
    panels.forEach(post => {
      const frame = post.panel.querySelector("iframe.instagram-media");
      if (!frame || frame.offsetHeight < 50) fallback(post);
    });
  }, 30000);
  if (!instagramScript) {
    instagramScript = new Promise((resolve, reject) => {
      if (window.instgrm) { resolve(); return; }
      let script = document.querySelector('script[src="https://www.instagram.com/embed.js"]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://www.instagram.com/embed.js";
        script.async = true;
        document.body.append(script);
      }
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
    });
  }
  instagramScript.then(() => {
    try { window.instgrm.Embeds.process(); }
    catch { clearTimeout(timeout); panels.forEach(fallback); }
  }, () => { clearTimeout(timeout); panels.forEach(fallback); });
}

function observeTimeline(items) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach(item => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      obs.unobserve(entry.target);
    }
  }, { threshold: 0.1, rootMargin: "0px 0px -32px 0px" });
  items.forEach(item => observer.observe(item));
}

async function initEvents() {
  const timeline = document.querySelector("#events-timeline");
  const statusEl = document.querySelector("#events-status");
  if (!timeline) return;

  const embedPanels = [...document.querySelectorAll(".embed-panel blockquote.instagram-media")]
    .map(quote => ({ panel: quote.parentElement, url: validInstagramUrl(quote.dataset.instgrmPermalink) }))
    .filter(post => post.url);
  try {
    const response = await fetch("data/events.json");
    if (!response.ok) throw new Error("events");
    const events = await response.json();
    if (!Array.isArray(events)) throw new Error("events");

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const upcoming = events
      .filter(ev => typeof ev.isoDate === "string" && ev.isoDate >= todayIso)
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    const past = events
      .filter(ev => typeof ev.isoDate === "string" && ev.isoDate < todayIso)
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));

    const timelineItems = [];

    const buildEntry = ev => {
      const item = createEl("li", "timeline-item reveal");
      if (ev.id) item.id = ev.id;
      item.append(createEl("h3", "", ev.title));

      const meta = createEl("ul", "event-meta");
      if (ev.date) meta.append(createEl("li", "", `Date: ${ev.date}`));
      if (ev.time) meta.append(createEl("li", "", `Time: ${ev.time}`));
      if (ev.location) meta.append(createEl("li", "", `Location: ${ev.location}`));
      if (ev.speaker) meta.append(createEl("li", "", `Speaker: ${ev.speaker}`));
      if (ev.cohost) meta.append(createEl("li", "", `Co-hosted with: ${ev.cohost}`));
      if (meta.children.length) item.append(meta);

      if (ev.description) item.append(createEl("p", "", ev.description));

      if (ev.poster && ev.poster.src) {
        const img = createEl("img", "timeline-poster");
        img.src = ev.poster.src;
        img.alt = ev.poster.alt || ev.title;
        if (ev.poster.width) img.width = ev.poster.width;
        if (ev.poster.height) img.height = ev.poster.height;
        img.loading = "lazy";
        item.append(img);
      }

      if (ev.link && ev.link.url) {
        const link = createEl("a", "button", ev.link.label || "Learn more");
        link.href = ev.link.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
      }

      const posts = Array.isArray(ev.instagram) ? ev.instagram.map(validInstagramUrl).filter(Boolean) : [];
      if (posts.length) {
        const embeds = createEl("div", "timeline-embeds");
        posts.forEach(url => {
          const panel = createEl("div", "embed-panel");
          panel.append(createInstagramQuote(url));
          embeds.append(panel);
          embedPanels.push({ panel, url });
        });
        item.append(embeds);
      }

      timelineItems.push(item);
      return item;
    };

    const appendGroup = (heading, groupEvents) => {
      if (!groupEvents.length) return;
      timeline.append(createEl("h3", "timeline-divider", heading));
      const list = createEl("ol", "timeline-list");
      groupEvents.forEach(ev => list.append(buildEntry(ev)));
      timeline.append(list);
    };

    appendGroup("Upcoming", upcoming);
    appendGroup("Past", past);

    if (statusEl) statusEl.hidden = true;
    observeTimeline(timelineItems);

    if (window.location.hash) {
      let id = window.location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch {}
      const target = document.getElementById(id);
      if (target) target.scrollIntoView();
    }
  } catch {
    if (statusEl) statusEl.textContent = "Events could not load. Please reload the page.";
  } finally {
    loadInstagramEmbeds(embedPanels);
  }
}

async function initResources() {
  const grid = document.querySelector("#resource-grid");
  const filters = document.querySelector(".resource-filters");
  const countEl = document.querySelector(".resource-count");
  if (!grid || !filters || !countEl) return;

  try {
    const response = await fetch("data/resources.json");
    if (!response.ok) throw new Error("resources");
    const resources = await response.json();
    if (!Array.isArray(resources)) throw new Error("resources");

    const sections = new Map();
    const cards = resources.map(item => {
      if (!sections.has(item.category)) {
        const section = createEl("section", "resource-section");
        section.append(createEl("h2", "", item.category));
        const list = createEl("div", "resource-grid");
        section.append(list);
        grid.append(section);
        sections.set(item.category, { section, list });
      }
      const link = createEl("a", "resource-card");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.dataset.category = item.category;

      link.append(createEl("span", "resource-org", item.organization));
      link.append(createEl("h3", "", item.name));
      link.append(createEl("p", "", item.description));
      link.append(createEl("span", "resource-url", `${item.url} ↗`));
      sections.get(item.category).list.append(link);
      return link;
    });

    const buttons = [...filters.querySelectorAll("button")];
    filters.hidden = false;

    function show(category) {
      let total = 0;
      cards.forEach(card => {
        const visible = category === "All" || card.dataset.category === category;
        card.hidden = !visible;
        if (visible) total++;
      });
      sections.forEach(({ section }, name) => {
        section.hidden = category !== "All" && name !== category;
      });
      buttons.forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.filter === category)));
      countEl.textContent = `${total} ${total === 1 ? "resource" : "resources"}`;
    }

    buttons.forEach(btn => btn.addEventListener("click", () => show(btn.dataset.filter)));
    show("All");
  } catch {
    countEl.textContent = "Resources could not load. Please reload the page to try again.";
  }
}
