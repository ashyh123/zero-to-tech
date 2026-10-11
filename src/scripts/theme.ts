import { onPageChange } from "./page-lifecycle";
onPageChange((signal) => {
  const root = document.querySelector<HTMLElement>(".theme-switcher")!;
  const trigger = root.querySelector<HTMLButtonElement>(
    "[data-theme-trigger]",
  )!;
  const media = matchMedia("(prefers-color-scheme: dark)");
  let preference = document.documentElement.dataset.themePreference || "system";
  try {
    preference = localStorage.getItem("site-theme") || preference;
  } catch {}

  function apply(value: string | null) {
    preference = ["dark", "light"].includes(value || "") ? value! : "system";
    const theme =
      preference === "system" ? (media.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = theme;
    root.querySelectorAll<HTMLElement>("[data-theme-icon]").forEach((icon) => {
      icon.hidden = icon.dataset.themeIcon !== theme;
    });
    const label = theme === "dark" ? "切换为浅色模式" : "切换为深色模式";
    trigger.setAttribute("aria-label", label);
    trigger.title = label;
  }

  apply(preference);
  trigger.addEventListener(
    "click",
    () => {
      apply(
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      );
      try {
        localStorage.setItem("site-theme", preference);
      } catch {}
    },
    { signal },
  );
  media.addEventListener(
    "change",
    () => {
      if (preference === "system") apply("system");
    },
    { signal },
  );
  window.addEventListener(
    "storage",
    (event) => {
      if (event.key === "site-theme" || event.key === null)
        apply(event.newValue);
    },
    { signal },
  );
});
