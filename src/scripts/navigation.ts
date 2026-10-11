import { onPageChange } from "./page-lifecycle";
onPageChange((signal) => {
  const header = document.querySelector<HTMLElement>("[data-scroll-header]");
  if (header) {
    let lastY = Math.max(0, window.scrollY);
    let direction = 0;
    let travel = 0;
    let pending = false;

    function reveal() {
      header!.dataset.hidden = "false";
      header!.classList.remove(
        "tw:-translate-y-full",
        "tw:pointer-events-none",
      );
    }

    function update() {
      pending = false;
      // Ignore elastic overscroll, including the bottom bounce on touch devices.
      const maximum = Math.max(
        0,
        document.documentElement.scrollHeight - innerHeight,
      );
      const y = Math.min(maximum, Math.max(0, window.scrollY));
      const delta = y - lastY;
      lastY = y;
      const awayFromTop = y > 8;
      header!.dataset.floating = String(awayFromTop);

      const menuOpen =
        header!
          .querySelector(".mobile-menu-toggle")
          ?.getAttribute("aria-expanded") === "true";
      const keyboardFocus = header!.querySelector(":focus-visible");
      if (y <= header!.offsetHeight || menuOpen || keyboardFocus) {
        reveal();
        travel = 0;
        direction = 0;
        return;
      }
      if (!delta) return;
      const nextDirection = Math.sign(delta);
      travel =
        nextDirection === direction
          ? travel + Math.abs(delta)
          : Math.abs(delta);
      direction = nextDirection;
      // Small scroll fluctuations should not make the navigation flicker.
      if (travel < (direction > 0 ? 24 : 10)) return;
      const hidden = direction > 0;
      header!.dataset.hidden = String(hidden);
      header!.classList.toggle("tw:-translate-y-full", hidden);
      header!.classList.toggle("tw:pointer-events-none", hidden);
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!pending) {
          pending = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true, signal },
    );
    window.addEventListener("resize", update, { signal });
    // Keyboard users can always reach the navigation, even when it is tucked away.
    header.addEventListener("focusin", reveal, { signal });
    window.addEventListener(
      "pageshow",
      () => {
        lastY = Math.max(0, window.scrollY);
        reveal();
      },
      { signal },
    );
    update();
  }
});
