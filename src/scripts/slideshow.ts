// Crossfading slideshow used by the start page hero and photo carousel.
// Markup contract (all inside [data-slideshow]):
//   [data-slide]          one per slide, carries data-caption / data-meta
//   [data-slide-to="i"]   buttons jumping to slide i (bars, thumbnails)
//   [data-slide-prev|next|toggle], [data-slide-caption|meta|no]

const pad = (n: number) => String(n).padStart(2, "0");

export function initSlideshows() {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const root of document.querySelectorAll<HTMLElement>("[data-slideshow]")) {
    if (root.dataset.ready) continue;
    root.dataset.ready = "1";

    const slides = [...root.querySelectorAll<HTMLElement>("[data-slide]")];
    if (slides.length === 0) continue;
    const pickers = [...root.querySelectorAll<HTMLElement>("[data-slide-to]")];
    const toggle = root.querySelector<HTMLElement>("[data-slide-toggle]");
    const interval = Number(root.dataset.interval ?? 6000);
    let index = 0;
    // Autoplay stays off for people who asked their OS for less motion.
    let playing = !reducedMotion && slides.length > 1;

    const show = (i: number) => {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle("is-active", j === index));
      pickers.forEach((p) => p.setAttribute("aria-current", String(Number(p.dataset.slideTo) === index)));
      const active = slides[index];
      root.querySelectorAll("[data-slide-caption]").forEach((el) => (el.textContent = active.dataset.caption ?? ""));
      root.querySelectorAll("[data-slide-meta]").forEach((el) => (el.textContent = active.dataset.meta ?? ""));
      root.querySelectorAll("[data-slide-no]").forEach((el) => (el.textContent = pad(index + 1)));
    };

    const setPlaying = (value: boolean) => {
      playing = value;
      toggle?.setAttribute("aria-pressed", String(!playing));
      toggle?.setAttribute("aria-label", playing ? "Diashow pausieren" : "Diashow abspielen");
    };

    root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const picker = t.closest<HTMLElement>("[data-slide-to]");
      if (picker) return show(Number(picker.dataset.slideTo));
      if (t.closest("[data-slide-prev]")) return show(index - 1);
      if (t.closest("[data-slide-next]")) return show(index + 1);
      if (t.closest("[data-slide-toggle]")) return setPlaying(!playing);
    });

    // Pausing while hovered or focused keeps captions readable.
    let hovering = false;
    root.addEventListener("pointerenter", () => (hovering = true));
    root.addEventListener("pointerleave", () => (hovering = false));
    setInterval(() => {
      if (playing && !hovering && !document.hidden) show(index + 1);
    }, interval);

    setPlaying(playing);
    show(0);
  }
}
