"use strict";

initTheme();
initNavigation();
initScrollHeader();
if (document.querySelector("#events-container")) initEvents();
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

async function initEvents() {
  const upcomingGrid = document.querySelector("#events-upcoming");
  const pastGrid = document.querySelector("#events-past");
  const plannedGrid = document.querySelector("#events-planned");
  const statusEl = document.querySelector("#events-status");
  try {
    const response = await fetch("data/events.json");
    if (!response.ok) throw new Error("events");
    const events = await response.json();
    if (!Array.isArray(events)) throw new Error("events");

    const appendCard = (container, ev) => {
      if (!container) return;
      const card = createEl("article", "card");
      if (ev.id) card.id = ev.id;
      card.append(createEl("span", "tag", ev.status));
      card.append(createEl("h3", "", ev.title));

      const meta = createEl("ul", "event-meta");
      if (ev.date) meta.append(createEl("li", "", `Date: ${ev.date}`));
      if (ev.time) meta.append(createEl("li", "", `Time: ${ev.time}`));
      if (ev.location) meta.append(createEl("li", "", `Location: ${ev.location}`));
      if (ev.speaker) meta.append(createEl("li", "", `Speaker: ${ev.speaker}`));
      if (ev.cohost) meta.append(createEl("li", "", `Co-hosted with: ${ev.cohost}`));
      if (meta.children.length) card.append(meta);

      if (ev.description) card.append(createEl("p", "", ev.description));
      container.append(card);
    };

    events.forEach(ev => {
      if (ev.status === "Upcoming") appendCard(upcomingGrid, ev);
      else if (ev.status === "Past") appendCard(pastGrid, ev);
      else appendCard(plannedGrid, ev);
    });

    if (statusEl) statusEl.hidden = true;
    if (window.location.hash) {
      let id = window.location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch {}
      const target = document.getElementById(id);
      if (target) target.scrollIntoView();
    }
  } catch {
    if (statusEl) statusEl.textContent = "Events could not load. Please reload the page or follow UBC AIMS on Instagram for announcements.";
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
