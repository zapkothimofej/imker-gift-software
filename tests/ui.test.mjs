import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import { chromium, devices } from "@playwright/test";

const PORT = 3210;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = ".ui-test-artifacts";
const IPHONE_14_PRO = devices["iPhone 14 Pro"];
const IPHONE_14_PRO_LANDSCAPE = devices["iPhone 14 Pro landscape"];
const DESKTOP = { viewport: { width: 1440, height: 960 } };

async function waitForServer(url, child, logs = [], timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child && child.exitCode !== null) {
      throw new Error(`Server exited before becoming ready:\n${logs.join("")}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Server did not become ready at ${url}:\n${logs.join("")}`);
}

async function withServer(run) {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    await waitForServer(BASE_URL);
    return run();
  }

  const child = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  try {
    await waitForServer(BASE_URL, child, logs);
    return await run();
  } finally {
    child.kill("SIGTERM");
  }
}

async function newPage(browser, profile = IPHONE_14_PRO, options = {}) {
  const { mockMediaRecorder = true, mockTranscription = true } = options;
  const context = await browser.newContext({
    ...profile,
    permissions: ["microphone"],
    reducedMotion: "reduce"
  });

  await context.addInitScript(({ mockMediaRecorder, mockTranscription }) => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (mockTranscription && url.includes("/api/transcribe")) {
        return Promise.resolve(
          new Response(JSON.stringify({ text: "матка есть" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );
      }

      return originalFetch(input, init);
    };

    if (!mockMediaRecorder) {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
      Object.defineProperty(window, "MediaRecorder", { configurable: true, value: undefined });
      return;
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }]
        })
      }
    });

    class FakeMediaRecorder {
      constructor() {
        this.mimeType = "audio/webm";
      }

      start() {}

      stop() {
        const event = new Event("dataavailable");
        Object.defineProperty(event, "data", {
          value: new Blob(["voice"], { type: "audio/webm" })
        });
        this.ondataavailable?.(event);
        this.onstop?.();
      }
    }

    window.MediaRecorder = FakeMediaRecorder;
  }, { mockMediaRecorder, mockTranscription });

  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  return { context, page, runtimeErrors };
}

test("iPhone 14 Pro portrait gift flow is usable without layout or runtime regressions", async () => {
  await withServer(async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const { context, page, runtimeErrors } = await newPage(browser, IPHONE_14_PRO);

    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });

      await assert.equal(await page.locator("h1").textContent(), "Новая запись");
      await assert.equal(await page.getByRole("combobox", { name: "Выбранный улей" }).count(), 1);
      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);
      await assert.equal(await page.getByRole("button", { name: "Сохранить запись" }).isDisabled(), true);
      await page.screenshot({ path: `${ARTIFACT_DIR}/iphone-14-pro-home.png`, fullPage: true });

      await page.getByRole("button", { name: "Следующий осмотр" }).click();
      await page.getByRole("button", { name: "Диктовать" }).click();
      await page.getByRole("button", { name: "Остановить" }).click();
      const nextTextarea = page.locator("label.entry-field").filter({ hasText: "Следующий осмотр" }).locator("textarea");
      await waitForValue(nextTextarea, /матка есть/);
      await assert.equal(await page.getByRole("button", { name: "Сохранить запись" }).isEnabled(), true);
      await page.getByRole("button", { name: "Сохранить запись" }).scrollIntoViewIfNeeded();
      await assertInViewport(page.getByRole("button", { name: "Сохранить запись" }));
      await assertNotCoveredByBottomNav(page.getByRole("button", { name: "Сохранить запись" }));

      await page.getByLabel("Сделано").fill("Осмотрел рамки");
      await page.getByRole("button", { name: "Сохранить запись" }).click();
      await waitForText(page.locator("section[aria-labelledby='history-title'] .section-head span"), "1");
      await assert.equal(await page.getByText("Осмотрел рамки").isVisible(), true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Журнал" }).click();
      await assert.equal(await page.locator("h1").textContent(), "Журнал");
      await assertPageAtTop(page);
      await assert.equal(await page.getByText("Осмотрел рамки").isVisible(), true);
      await assert.equal(await page.getByText("матка есть").isVisible(), true);
      await assert.equal(await page.getByText("Запись 1").isVisible(), true);
      await page.screenshot({ path: `${ARTIFACT_DIR}/iphone-14-pro-history.png`, fullPage: true });

      await page.getByRole("button", { name: "Пасека" }).click();
      await assert.equal(await page.locator("h1").textContent(), "Пасека");
      await assertPageAtTop(page);
      await assert.equal(await page.getByRole("combobox", { name: "Выбранный улей" }).count(), 0);
      await page.getByLabel("Название нового улья").fill("9");
      await page.getByRole("button", { name: "Добавить" }).click();
      await waitForValue(page.getByLabel("Переименовать выбранный улей"), /^9$/);
      await assert.equal(await page.getByRole("heading", { name: "Улей 9" }).isVisible(), true);

      await page.getByLabel("Название нового улья").fill("9");
      await page.getByRole("button", { name: "Добавить" }).click();
      await assert.equal(await page.getByText("Улей с таким номером уже есть.").isVisible(), true);

      await page.getByLabel("Переименовать выбранный улей").fill("Северный участок пасеки 9");
      await page.getByRole("button", { name: "Переименовать" }).click();
      await waitForValue(page.getByLabel("Переименовать выбранный улей"), /^Северный участок пасеки 9$/);
      await assertNoWrappedHiveTiles(page);
      await assertNoHorizontalOverflow(page);

      page.once("dialog", async (dialog) => {
        assert.match(dialog.message(), /Удалить улей Северный участок пасеки 9/);
        await dialog.dismiss();
      });
      await page.getByRole("button", { name: "Удалить улей Северный участок пасеки 9" }).click();
      await assert.equal(await page.getByRole("button", { name: "Северный участок пасеки 9", exact: true }).isVisible(), true);

      await page.keyboard.press("Tab");
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      assert.match(focusedTag ?? "", /BUTTON|INPUT|TEXTAREA/);

      await page.screenshot({ path: `${ARTIFACT_DIR}/iphone-14-pro-hives.png`, fullPage: true });
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

test("iPhone 14 Pro landscape keeps every primary view usable", async () => {
  await withServer(async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const { context, page, runtimeErrors } = await newPage(browser, IPHONE_14_PRO_LANDSCAPE);

    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });

      for (const label of ["Диктовка", "Журнал", "Пасека"]) {
        await page.getByRole("button", { name: label }).click();
        await assertNoHorizontalOverflow(page);
        await assertTouchTargets(page);
        await assertPageAtTop(page);
      }

      await page.screenshot({ path: `${ARTIFACT_DIR}/iphone-14-pro-landscape.png`, fullPage: true });
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

test("iPhone 14 Pro handles missing microphone support with manual entry", async () => {
  await withServer(async () => {
    const browser = await chromium.launch();
    const { context, page, runtimeErrors } = await newPage(browser, IPHONE_14_PRO, { mockMediaRecorder: false });

    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });

      await page.getByRole("button", { name: "Диктовать" }).click();
      await assert.equal(
        await page.getByText("Запись голоса не поддерживается в этом браузере. Используйте текстовое поле.").isVisible(),
        true
      );
      await page.getByLabel("Сделано").fill("Проверил семью без диктовки");
      await page.getByRole("button", { name: "Сохранить запись" }).click();
      await waitForText(page.locator("section[aria-labelledby='history-title'] .section-head span"), "1");
      await assert.equal(await page.getByText("Проверил семью без диктовки").isVisible(), true);
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

test("iPhone 14 Pro protects hive deletion edge cases", async () => {
  await withServer(async () => {
    const browser = await chromium.launch();
    const { context, page, runtimeErrors } = await newPage(browser, IPHONE_14_PRO);

    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.evaluate(() => {
        localStorage.setItem(
          "imker-pwa-state-v1",
          JSON.stringify({
            hives: [{ id: "hive-1", name: "1" }],
            notes: []
          })
        );
      });
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Пасека" }).click();

      page.on("dialog", (dialog) => {
        throw new Error(`Unexpected dialog for last hive deletion: ${dialog.message()}`);
      });
      await page.getByRole("button", { name: "Удалить улей 1" }).click();
      await assert.equal(await page.getByText("Нельзя удалить последний улей.").isVisible(), true);
      await assert.equal(await page.getByRole("button", { name: "1", exact: true }).isVisible(), true);
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

test("desktop layout keeps controls visible", async () => {
  await withServer(async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const { context, page, runtimeErrors } = await newPage(browser, DESKTOP);

    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);
      await page.screenshot({ path: `${ARTIFACT_DIR}/desktop-home.png`, fullPage: true });
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  assert.ok(
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `Horizontal overflow: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`
  );
}

async function waitForValue(locator, pattern, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (pattern.test(await locator.inputValue())) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.match(await locator.inputValue(), pattern);
}

async function waitForText(locator, expected, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if ((await locator.textContent()) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.equal(await locator.textContent(), expected);
}

async function assertTouchTargets(page) {
  const smallTargets = await page.locator("button, input, select, textarea").evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ??
            element.textContent?.trim() ??
            element.getAttribute("placeholder") ??
            element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((target) => target.width < 44 || target.height < 44)
  );

  assert.deepEqual(smallTargets, []);
}

async function assertInViewport(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, "Expected element to have a bounding box");

  const viewport = locator.page().viewportSize();
  assert.ok(viewport, "Expected viewport size");
  assert.ok(box.y >= 0 && box.y + box.height <= viewport.height, `Element is outside viewport: ${JSON.stringify(box)}`);
}

async function assertNotCoveredByBottomNav(locator) {
  const [box, navBox] = await Promise.all([
    locator.boundingBox(),
    locator.page().locator(".bottom-nav").boundingBox()
  ]);
  assert.ok(box, "Expected element to have a bounding box");
  assert.ok(navBox, "Expected bottom navigation to have a bounding box");
  assert.ok(box.y + box.height <= navBox.y, `Element overlaps bottom nav: ${JSON.stringify({ box, navBox })}`);
}

async function assertPageAtTop(page) {
  await page.waitForFunction(() => window.scrollY === 0);
  assert.equal(await page.evaluate(() => window.scrollY), 0);
}

async function assertNoWrappedHiveTiles(page) {
  const wrappingTiles = await page.locator("[data-hive-id] button span:first-child").evaluateAll((labels) =>
    labels
      .map((label) => {
        const style = window.getComputedStyle(label);
        return {
          label: label.textContent?.trim(),
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace
        };
      })
      .filter((button) => button.whiteSpace !== "nowrap" || button.overflow === "visible" || button.textOverflow !== "ellipsis")
  );

  assert.deepEqual(wrappingTiles, []);
}
