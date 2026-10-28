let meteorPhases: { element: Element; time: number }[] = [];
let capturedAt = 0;

document.addEventListener("astro:before-swap", () => {
  capturedAt = performance.now();
  meteorPhases = Array.from(
    document.querySelectorAll("#site-meteors .meteor"),
    (element) => ({
      element,
      time: Number(element.getAnimations()[0]?.currentTime || 0),
    }),
  );
});
document.addEventListener("astro:after-swap", () => {
  // Atomic moves keep animations alive in modern browsers. Restore their phase
  // as well on browsers that restart CSS animations when a node is moved.
  const elapsed = performance.now() - capturedAt;
  meteorPhases.forEach(({ element, time }) => {
    const animation = element.getAnimations()[0];
    if (animation) animation.currentTime = time + elapsed;
  });
  meteorPhases = [];
});
