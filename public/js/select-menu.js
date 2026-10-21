// Replaces the browser's native <select> popup with an animated list.
// The <select> itself stays in the page (layout, styling, value and change events are untouched);
// only the popup is intercepted, so every existing change handler keeps working.
let pop = null;
let owner = null;
let active = -1;
let typed = "";
let typedTimer;

const options = (select) =>
  [...select.options].filter((o) => !o.disabled && !o.hidden);

function close() {
  if (!pop) return;
  const el = pop;
  el.classList.remove("open");
  owner?.setAttribute("aria-expanded", "false");
  setTimeout(() => el.remove(), 200);
  pop = owner = null;
}

function highlight(index) {
  const items = [...pop.children];
  active = Math.max(0, Math.min(items.length - 1, index));
  items.forEach((li, i) => li.classList.toggle("active", i === active));
  items[active]?.scrollIntoView({ block: "nearest" });
}

function choose(index) {
  const select = owner,
    option = options(select)[index];
  close();
  if (!option || select.value === option.value) return;
  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function open(select) {
  if (pop && owner === select) return close();
  close();
  const list = options(select),
    rect = select.getBoundingClientRect(),
    below = window.innerHeight - rect.bottom - 14,
    above = rect.top - 14,
    up = below < 180 && above > below;
  pop = document.createElement("ul");
  pop.className = "sm-pop";
  pop.setAttribute("role", "listbox");
  pop.style.minWidth = `${rect.width}px`;
  pop.style.left = `${Math.min(rect.left, window.innerWidth - rect.width - 8)}px`;
  pop.style.maxHeight = `${Math.max(120, Math.min(320, up ? above : below))}px`;
  if (up) {
    pop.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    pop.classList.add("up");
  } else pop.style.top = `${rect.bottom + 6}px`;
  list.forEach((o, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.textContent = o.textContent.trim();
    li.style.setProperty("--i", Math.min(i, 12));
    if (o.value === select.value) li.classList.add("selected");
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      owner && choose(i);
    });
    li.addEventListener("mousemove", () => highlight(i));
    pop.append(li);
  });
  // Inside a modal dialog only its own descendants are interactive.
  (select.closest("dialog") || document.body).append(pop);
  owner = select;
  select.setAttribute("aria-expanded", "true");
  highlight(Math.max(0, list.findIndex((o) => o.value === select.value)));
  requestAnimationFrame(() => pop?.classList.add("open"));
}

function onKey(e) {
  const select = e.target;
  if (!(select instanceof HTMLSelectElement) || select.multiple) return;
  if (pop && owner === select) {
    const k = e.key;
    if (k === "Escape" || k === "Tab") return close();
    if (k === "ArrowDown") highlight(active + 1);
    else if (k === "ArrowUp") highlight(active - 1);
    else if (k === "Home") highlight(0);
    else if (k === "End") highlight(Infinity);
    else if (k === "Enter" || k === " ") choose(active);
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey) {
      typed += k.toLowerCase();
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => (typed = ""), 600);
      const i = options(select).findIndex((o) =>
        o.textContent.trim().toLowerCase().startsWith(typed),
      );
      if (i >= 0) highlight(i);
    } else return;
    e.preventDefault();
    return;
  }
  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
    e.preventDefault();
    open(select);
  }
}

export function initSelectMenus() {
  if (typeof document === "undefined" || typeof HTMLSelectElement === "undefined")
    return;
  document.addEventListener(
    "mousedown",
    (e) => {
      const select = e.target instanceof Element && e.target.closest("select");
      if (select && !select.multiple && !select.disabled) {
        e.preventDefault();
        select.focus();
        open(select);
      } else if (pop && !pop.contains(e.target)) close();
    },
    true,
  );
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", close);
  window.addEventListener("scroll", (e) => !pop?.contains(e.target) && close(), true);
  // A re-render can remove the select while its list is open.
  new MutationObserver(() => owner && !owner.isConnected && close()).observe(
    document.body,
    { childList: true, subtree: true },
  );
}
