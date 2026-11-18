"use strict";

if (typeof document !== "undefined") {
  initTheme();
  initNavigation();
  initScrollHeader();
  if (document.querySelector("#events-timeline")) initEvents();
  if (document.querySelector("#resource-grid")) initResources();
}

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

function parseIsoDate(isoDate) {
  if (typeof isoDate !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthYear(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatFullDate(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate || "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function appendUniqueText(list, value) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed && !list.includes(trimmed)) list.push(trimmed);
}

function groupTimelineEvents(events) {
  const groups = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const iso = typeof ev.isoDate === "string" ? ev.isoDate.trim() : "";
    const normTitle = typeof ev.title === "string" ? ev.title.trim().toLowerCase() : "";

    const matchingIndices = [];
    groups.forEach((group, idx) => {
      if ((iso && group.dates.has(iso)) || (normTitle && group.titles.has(normTitle))) {
        matchingIndices.push(idx);
      }
    });

    let target;
    if (!matchingIndices.length) {
      target = {
        dates: new Set(),
        titles: new Set(),
        items: []
      };
      groups.push(target);
    } else {
      target = groups[matchingIndices[0]];
      for (let i = matchingIndices.length - 1; i >= 1; i--) {
        const extra = groups.splice(matchingIndices[i], 1)[0];
        extra.dates.forEach(d => target.dates.add(d));
        extra.titles.forEach(t => target.titles.add(t));
        target.items.push(...extra.items);
      }
    }

    if (iso) target.dates.add(iso);
    if (normTitle) target.titles.add(normTitle);
    target.items.push(ev);
  }

  return groups.map(group => {
    const first = group.items[0];
    const times = [];
    const locations = [];
    const speakers = [];
    const cohosts = [];
    const descriptions = [];
    const links = [];
    const linkUrls = new Set();
    const posters = [];
    const posterSrcs = new Set();
    const instagram = [];
    const instaUrls = new Set();

    for (const ev of group.items) {
      appendUniqueText(times, ev.time);
      appendUniqueText(locations, ev.location);
      appendUniqueText(speakers, ev.speaker);
      appendUniqueText(cohosts, ev.cohost);
      appendUniqueText(descriptions, ev.description);

      if (ev.link && ev.link.url && !linkUrls.has(ev.link.url)) {
        linkUrls.add(ev.link.url);
        links.push({ url: ev.link.url, label: ev.link.label || "Learn more" });
      }
      if (ev.poster && ev.poster.src && !posterSrcs.has(ev.poster.src)) {
        posterSrcs.add(ev.poster.src);
        posters.push(ev.poster);
      }
      if (Array.isArray(ev.instagram)) {
        for (const raw of ev.instagram) {
          const url = validInstagramUrl(raw);
          if (url && !instaUrls.has(url)) {
            instaUrls.add(url);
            instagram.push(url);
          }
        }
      }
    }

    return {
      id: first.id || "",
      title: first.title || "",
      isoDate: first.isoDate || "",
      date: first.date || "",
      time: times.join(", "),
      location: locations.join(", "),
      speaker: speakers.join(", "),
      cohost: cohosts.join(", "),
      description: descriptions.join(" "),
      links,
      posters,
      instagram,
      sourceItems: group.items.map(ev => ev.id || ev.title)
    };
  });
}

function setupTimelineScrubber(scrubber, entries) {
  if (!scrubber || !entries.length) return;
  const linksById = new Map();
  let lastYear = "";

  entries.forEach(entry => {
    const date = parseIsoDate(entry.isoDate);
    const year = date ? String(date.getFullYear()) : "";
    const monthLabel = date
      ? new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)
      : entry.label;

    if (year && year !== lastYear) {
      scrubber.append(createEl("span", "scrubber-year", year));
      lastYear = year;
    }

    const link = createEl("a", "scrubber-link", monthLabel);
    link.href = `#${entry.id}`;
    link.setAttribute("aria-label", entry.label);
    scrubber.append(link);
    linksById.set(entry.id, link);
  });

  scrubber.hidden = false;

  const setActive = activeId => {
    linksById.forEach((link, id) => {
      const active = id === activeId;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  setActive(entries[0].id);

  scrubber.addEventListener("click", event => {
    const link = event.target.closest("a.scrubber-link");
    if (!link) return;
    const targetId = link.getAttribute("href").slice(1);
    if (linksById.has(targetId)) setActive(targetId);
  });

  if ("IntersectionObserver" in window) {
    const sectionToId = new Map(entries.map(entry => [entry.section, entry.id]));
    const observer = new IntersectionObserver(obsEntries => {
      for (const obsEntry of obsEntries) {
        if (!obsEntry.isIntersecting) continue;
        const id = sectionToId.get(obsEntry.target);
        if (id) setActive(id);
      }
    }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });

    entries.forEach(entry => observer.observe(entry.section));
  }
}

async function initEvents() {
  const timeline = document.querySelector("#events-timeline");
  const statusEl = document.querySelector("#events-status");
  const scrubber = document.querySelector("#timeline-scrubber");
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

    const upcoming = groupTimelineEvents(
      events
        .filter(ev => typeof ev.isoDate === "string" && ev.isoDate >= todayIso)
        .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    );

    const past = groupTimelineEvents(
      events
        .filter(ev => typeof ev.isoDate === "string" && ev.isoDate < todayIso)
        .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
    );

    const timelineItems = [];
    const scrubberEntries = [];

    const buildEntry = ev => {
      const mediaCount = ev.posters.length + ev.instagram.length;
      const hasMedia = mediaCount > 0;
      const itemClass = !hasMedia
        ? "timeline-item timeline-item--no-media reveal"
        : mediaCount > 1
          ? "timeline-item timeline-item--multi-media reveal"
          : "timeline-item reveal";
      const item = createEl("li", itemClass);
      if (ev.id) item.id = ev.id;

      const textCol = createEl("div", "timeline-text");
      const timeEl = createEl("time", "timeline-date", formatFullDate(ev.isoDate));
      if (ev.isoDate) timeEl.dateTime = ev.isoDate;
      textCol.append(timeEl);

      textCol.append(createEl("h5", "timeline-title", ev.title));

      const meta = createEl("ul", "event-meta");
      if (ev.date) meta.append(createEl("li", "", `Date: ${ev.date}`));
      if (ev.time) meta.append(createEl("li", "", `Time: ${ev.time}`));
      if (ev.location) meta.append(createEl("li", "", `Location: ${ev.location}`));
      if (ev.speaker) meta.append(createEl("li", "", `Speaker: ${ev.speaker}`));
      if (ev.cohost) meta.append(createEl("li", "", `Co-hosted with: ${ev.cohost}`));
      if (meta.children.length) textCol.append(meta);

      if (ev.description) textCol.append(createEl("p", "", ev.description));

      if (ev.links.length) {
        const linksWrap = createEl("div", "timeline-links");
        ev.links.forEach(itemLink => {
          const link = createEl("a", "button", itemLink.label);
          link.href = itemLink.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          linksWrap.append(link);
        });
        textCol.append(linksWrap);
      }

      item.append(textCol);

      if (hasMedia) {
        const mediaCol = createEl("div", "timeline-media");
        ev.posters.forEach(poster => {
          const img = createEl("img", "timeline-poster");
          img.src = poster.src;
          img.alt = poster.alt || ev.title;
          if (poster.width) img.width = poster.width;
          if (poster.height) img.height = poster.height;
          img.loading = "lazy";
          mediaCol.append(img);
        });

        if (ev.instagram.length) {
          const embeds = createEl("div", "timeline-embeds");
          ev.instagram.forEach(url => {
            const panel = createEl("div", "embed-panel");
            panel.append(createInstagramQuote(url));
            embeds.append(panel);
            embedPanels.push({ panel, url });
          });
          mediaCol.append(embeds);
        }
        item.append(mediaCol);
      }

      timelineItems.push(item);
      return item;
    };

    const appendGroup = (heading, groupEvents) => {
      if (!groupEvents.length) return;
      timeline.append(createEl("h3", "timeline-divider", heading));

      const monthGroups = [];
      const monthMap = new Map();
      groupEvents.forEach(ev => {
        const label = formatMonthYear(ev.isoDate) || "Other";
        if (!monthMap.has(label)) {
          const bucket = { label, events: [] };
          monthMap.set(label, bucket);
          monthGroups.push(bucket);
        }
        monthMap.get(label).events.push(ev);
      });

      monthGroups.forEach(group => {
        const slug = `${heading}-${group.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const anchorId = `month-${slug}`;
        const section = createEl("div", "timeline-month-group");
        const header = createEl("h4", "timeline-month-header", group.label);
        header.id = anchorId;
        section.append(header);
        const list = createEl("ol", "timeline-list");
        group.events.forEach(ev => list.append(buildEntry(ev)));
        section.append(list);
        timeline.append(section);
        scrubberEntries.push({
          id: anchorId,
          isoDate: group.events[0] ? group.events[0].isoDate : "",
          label: group.label,
          section
        });
      });
    };

    appendGroup("Upcoming", upcoming);
    appendGroup("Past", past);

    if (statusEl) statusEl.hidden = true;
    setupTimelineScrubber(scrubber, scrubberEntries);
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { groupTimelineEvents, formatMonthYear, formatFullDate };
}
