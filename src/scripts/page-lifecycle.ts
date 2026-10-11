// Astro keeps modules alive during navigation; attach handlers to each new page
// and release listeners belonging to the previous page.
export function onPageChange(initialize: (signal: AbortSignal) => void) {
  let controller: AbortController;
  const run = () => {
    controller?.abort();
    controller = new AbortController();
    initialize(controller.signal);
  };
  document.addEventListener("astro:before-swap", () => controller?.abort());
  document.addEventListener("astro:after-swap", run);
  run();
}
