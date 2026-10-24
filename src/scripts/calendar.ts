// Client behaviour for <Calendar>. All markup is rendered at build time.

const pad = (n: number) => String(n).padStart(2, "0");
export const localKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function longLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

/** Categories switched off on the Termine page (shared with the list view). */
export const hiddenCategories = new Set<string>();
const isVisible = (el: Element) => !hiddenCategories.has((el as HTMLElement).dataset.cat ?? "");

export function initCalendars() {
  for (const root of document.querySelectorAll<HTMLElement>("[data-calendar]")) {
    if (root.dataset.ready) continue;
    root.dataset.ready = "1";
    setup(root);
  }
}

function setup(root: HTMLElement) {
  const today = localKey();
  const months = [...root.querySelectorAll<HTMLElement>("[data-month]")];
  const title = root.querySelector<HTMLElement>("[data-cal-title]")!;
  const selLabel = root.querySelector<HTMLElement>("[data-sel-label]")!;
  const empty = root.querySelector<HTMLElement>("[data-panel-empty]")!;
  const compact = root.classList.contains("compact");
  let monthIndex = Math.max(0, months.findIndex((m) => m.dataset.month === today.slice(0, 7)));
  let selected = today;

  for (const cell of root.querySelectorAll<HTMLElement>(`[data-day="${today}"]`)) {
    cell.classList.add("today");
    cell.setAttribute("aria-label", `${cell.getAttribute("aria-label")}, heute`);
  }

  const showMonth = (i: number) => {
    monthIndex = Math.min(months.length - 1, Math.max(0, i));
    months.forEach((m, j) => (m.hidden = j !== monthIndex));
    title.textContent = months[monthIndex].dataset.label!;
  };

  const renderPanel = () => {
    selLabel.textContent = `${selected === today ? "Heute · " : ""}${longLabel(selected)}`;
    let any = false;
    for (const panel of root.querySelectorAll<HTMLElement>("[data-panel]")) {
      const active = panel.dataset.panel === selected;
      const entries = [...panel.querySelectorAll<HTMLElement>(".entry")];
      entries.forEach((e) => (e.hidden = !isVisible(e)));
      const visible = entries.filter((e) => !e.hidden);
      panel.hidden = !active || visible.length === 0;
      if (active && visible.length) any = true;
    }
    empty.hidden = any;
  };

  const setDetails = (button: HTMLElement, open: boolean) => {
    button.setAttribute("aria-expanded", String(open));
    document.getElementById(button.getAttribute("aria-controls")!)!.hidden = !open;
    button.querySelector<HTMLElement>("[data-label-closed]")!.hidden = open;
    button.querySelector<HTMLElement>("[data-label-open]")!.hidden = !open;
  };

  const renderUpcoming = () => {
    const now = Date.now();
    let shown = 0;
    for (const item of root.querySelectorAll<HTMLElement>("[data-upcoming]")) {
      const show =
        shown < 3 && new Date(item.dataset.end!).getTime() >= now && item.dataset.upcoming !== selected;
      item.hidden = !show;
      if (show) shown++;
    }
  };

  const select = (key: string) => {
    selected = key;
    for (const cell of root.querySelectorAll<HTMLElement>("[data-day]")) {
      cell.setAttribute("aria-pressed", String(cell.dataset.day === key));
    }
    renderPanel();
    if (compact) {
      // Like the design: the first event of the chosen day opens right away.
      const toggles = root.querySelectorAll<HTMLElement>(`[data-panel="${key}"] [data-details-toggle]`);
      toggles.forEach((t, i) => setDetails(t, i === 0));
      renderUpcoming();
    }
  };

  const jumpTo = (key: string) => {
    const i = months.findIndex((m) => m.dataset.month === key.slice(0, 7));
    if (i >= 0) showMonth(i);
    select(key);
  };

  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const day = target.closest<HTMLElement>("[data-day]");
    if (day) return select(day.dataset.day!);
    const toggle = target.closest<HTMLElement>("[data-details-toggle]");
    if (toggle) return setDetails(toggle, toggle.getAttribute("aria-expanded") !== "true");
    const upcoming = target.closest<HTMLElement>("[data-upcoming]");
    if (upcoming) return jumpTo(upcoming.dataset.upcoming!);
    if (target.closest("[data-cal-prev]")) return showMonth(monthIndex - 1);
    if (target.closest("[data-cal-next]")) return showMonth(monthIndex + 1);
    if (target.closest("[data-cal-today]")) return jumpTo(today);
  });

  document.addEventListener("calendar:filter", renderPanel);
  showMonth(monthIndex);
  select(selected);
}
