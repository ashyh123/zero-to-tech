import { animate, cancelFrame, frame } from "motion";

const overlay = document.querySelector<HTMLElement>(".initial-loader");
if (overlay && document.documentElement.dataset.skipEntry === "true") {
  overlay.remove();
} else if (overlay) {
  const shell = document.querySelector<HTMLElement>(".site-shell")!;
  const track = overlay.querySelector<HTMLElement>("[data-reel-track]")!;
  const viewport = overlay.querySelector<HTMLElement>(".text-stream")!;
  const copy = track.firstElementChild as HTMLElement;
  const bar = overlay.querySelector<HTMLElement>('[role="progressbar"]')!;
  const fill = overlay.querySelector<HTMLElement>(".loading-fill")!;
  const percent = overlay.querySelector<HTMLElement>(".loading-percentage")!;
  const status = overlay.querySelector<HTMLElement>("[data-loading-status]")!;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const started = performance.now();
  const previousOverflow = document.body.style.overflow;
  const previousInert = shell.inert;
  shell.inert = true;
  document.body.style.overflow = "hidden";
  let distance = 0,
    y = 0,
    velocity = -2,
    targetVelocity = -2,
    direction = -1;
  let visible = true,
    finishing = false;
  let scrollTimer: ReturnType<typeof setTimeout>;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const delay = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const wrap = (value: number) =>
    distance ? (((value % distance) + distance) % distance) - distance : 0;
  const measure = () => {
    distance = copy.offsetHeight;
    const count = Math.max(
      2,
      Math.ceil(viewport.offsetHeight / (distance || 1)) + 2,
    );
    while (track.children.length < count) track.append(copy.cloneNode(true));
    while (track.children.length > count) track.lastElementChild!.remove();
    y = wrap(y);
  };
  const tick = ({ delta }: { delta: number }) => {
    if (!distance || !visible || document.hidden || media.matches) return;
    velocity += (targetVelocity - velocity) * 0.14;
    y = wrap(y + (velocity * Math.min(delta, 50)) / (1000 / 60));
    track.style.transform = `translateY(${y}px)`;
  };
  const resize = new ResizeObserver(measure);
  resize.observe(copy);
  resize.observe(viewport);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  intersection.observe(viewport);
  const motionChange = () => {
    cancelFrame(tick);
    if (media.matches) track.style.transform = "";
    else {
      measure();
      frame.update(tick, true);
    }
  };
  const applyScroll = (delta: number) => {
    if (!delta) return;
    direction = delta > 0 ? -1 : 1;
    targetVelocity =
      direction * Math.min(12, 2 + Math.pow(Math.abs(delta), 1.2) * 0.08);
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      targetVelocity = direction * 2;
    }, 120);
  };
  const wheel = (event: WheelEvent) => applyScroll(event.deltaY);
  let lastScroll = window.scrollY;
  const scroll = () => {
    applyScroll(window.scrollY - lastScroll);
    lastScroll = window.scrollY;
  };
  window.addEventListener("wheel", wheel, { passive: true });
  window.addEventListener("scroll", scroll, { passive: true });
  media.addEventListener("change", motionChange);
  motionChange();
  const progress = (value: number) => {
    const text =
      value >= 100
        ? "准备就绪"
        : value >= 75
          ? "正在准备内容"
          : "正在打开这段旅程";
    status.textContent = text;
    percent.firstChild!.textContent = String(value);
    fill.style.width = `${value}%`;
    bar.setAttribute("aria-valuenow", String(value));
    bar.setAttribute("aria-valuetext", `${text}，准备进度 ${value}%`);
  };
  const cleanup = () => {
    timers.forEach(clearTimeout);
    clearTimeout(scrollTimer);
    cancelFrame(tick);
    resize.disconnect();
    intersection.disconnect();
    media.removeEventListener("change", motionChange);
    window.removeEventListener("wheel", wheel);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("load", ready);
    window.removeEventListener("pagehide", dispose);
    shell.inert = previousInert;
    document.body.style.overflow = previousOverflow;
  };
  const dispose = () => {
    finishing = true;
    cleanup();
    overlay.remove();
  };
  const finish = () => {
    if (finishing) return;
    finishing = true;
    progress(100);
    delay(() => {
      shell.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      overlay.style.pointerEvents = "none";
      animate(
        overlay,
        { opacity: 0 },
        { duration: media.matches ? 0 : 0.32, ease: "easeOut" },
      ).then(() => {
        cleanup();
        overlay.remove();
      });
    }, 180);
  };
  const ready = () => {
    if (finishing) return;
    progress(75);
    Promise.resolve(document.fonts?.ready).then(() => {
      if (!finishing) {
        progress(92);
        const minimumDuration = media.matches ? 600 : 1800;
        delay(
          finish,
          Math.max(0, minimumDuration - (performance.now() - started)),
        );
      }
    });
  };
  progress(30);
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
  window.addEventListener("pagehide", dispose, { once: true });
  delay(finish, 5000);
}
