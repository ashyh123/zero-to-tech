import { onPageChange } from "./page-lifecycle";
onPageChange((signal) => {
  const button = document.querySelector<HTMLButtonElement>(
    ".mobile-menu-toggle",
  );
  const panel = document.querySelector<HTMLElement>("#site-navigation-panel");
  function setOpen(open: boolean) {
    button?.setAttribute("aria-expanded", String(open));
    button?.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
    panel?.classList.toggle("tw:mobile:hidden", !open);
    button
      ?.querySelector("path")
      ?.setAttribute(
        "d",
        open ? "m6 6 12 12M6 18 18 6" : "M4 7h16M4 12h16M4 17h16",
      );
  }
  button?.addEventListener(
    "click",
    () => setOpen(button.getAttribute("aria-expanded") !== "true"),
    { signal },
  );
  panel
    ?.querySelectorAll("a")
    .forEach((link) =>
      link.addEventListener("click", () => setOpen(false), { signal }),
    );
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        button?.getAttribute("aria-expanded") === "true"
      ) {
        setOpen(false);
        button.focus();
      }
    },
    { signal },
  );
});
