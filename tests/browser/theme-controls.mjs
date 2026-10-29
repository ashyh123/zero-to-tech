import assert from "node:assert/strict";

// Run against the built site using an Ego Page; no browser is launched here.
export async function verifyThemeControls(page, baseURL) {
  const results = [];
  await page.goto(baseURL);
  for (const width of [1440, 390, 320]) {
    const mobile = width <= 700;
    await page.cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile,
    });
    await page.cdp("Emulation.setTouchEmulationEnabled", {
      enabled: mobile,
      maxTouchPoints: 1,
    });
    const geometry = await page.evaluate(() => {
      const button = document.querySelector("[data-theme-trigger]");
      const icon = button.querySelector("[data-theme-icon]:not([hidden]) svg");
      const b = button.getBoundingClientRect();
      const i = icon.getBoundingClientRect();
      const brand = document.querySelector(".wordmark").getBoundingClientRect();
      const menu = document
        .querySelector(".mobile-menu-toggle")
        .getBoundingClientRect();
      return {
        width: b.width,
        height: b.height,
        offsetX: i.x + i.width / 2 - b.x - b.width / 2,
        offsetY: i.y + i.height / 2 - b.y - b.height / 2,
        rowOffsetY: brand.y + brand.height / 2 - b.y - b.height / 2,
        overlapsMenu:
          menu.width > 0 && b.right > menu.left && b.left < menu.right,
      };
    });
    assert.ok(
      Math.abs(geometry.offsetX) < 0.6 && Math.abs(geometry.offsetY) < 0.6,
      `Icon must be centered at ${width}px: ${JSON.stringify(geometry)}`,
    );
    assert.ok(
      Math.abs(geometry.rowOffsetY) < 0.6,
      "Header controls must align with the brand",
    );
    if (mobile) {
      assert.ok(
        geometry.width >= 44 && geometry.height >= 44,
        "Touch target must be at least 44px",
      );
      assert.equal(
        geometry.overlapsMenu,
        false,
        "Theme and menu targets must not overlap",
      );
    }
    for (const edge of [false, true]) {
      const before = await page.evaluate(
        () => document.documentElement.dataset.theme,
      );
      if (mobile) {
        const point = await page.evaluate((edge) => {
          const b = document
            .querySelector("[data-theme-trigger]")
            .getBoundingClientRect();
          return {
            x: edge ? b.left + 3 : b.left + b.width / 2,
            y: b.top + b.height / 2,
          };
        }, edge);
        await page.cdp("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [point],
        });
        await page.cdp("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await page.click("[data-theme-trigger]");
      }
      const expected = before === "dark" ? "light" : "dark";
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        expected,
        { timeout: 2000 },
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem("site-theme")),
        expected,
      );
    }
    results.push({ width, centered: true, switches: true });
  }
  // Opening the mobile menu and swapping pages must preserve the control.
  await page.click(".mobile-menu-toggle");
  await page.click('#site-navigation-panel a[href="/works"]');
  await page.waitForURL(new URL("works", baseURL).href);
  const before = await page.evaluate(
    () => document.documentElement.dataset.theme,
  );
  const point = await page.evaluate(() => {
    const b = document
      .querySelector("[data-theme-trigger]")
      .getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.cdp("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await page.cdp("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const expected = before === "dark" ? "light" : "dark";
  await page.waitForFunction(
    (theme) => document.documentElement.dataset.theme === theme,
    expected,
    { timeout: 2000 },
  );
  await page.reload();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    expected,
  );
  return { viewports: results, afterNavigation: true, afterReload: true };
}
