import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import { chromium, devices } from "@playwright/test";

const PORT = 3210;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = ".ui-test-artifacts";

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

async function newPage(browser, viewport) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    viewport,
    permissions: ["microphone"],
    reducedMotion: "reduce"
  });

  await context.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/api/transcribe")) {
        return Promise.resolve(
          new Response(JSON.stringify({ text: "матка есть" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );
      }

      return originalFetch(input, init);
    };

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
  });

  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  return { context, page, runtimeErrors };
}

test("mobile gift flow is usable without layout or runtime regressions", async () => {
  await withServer(async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const browser = await chromium.launch();
    const { context, page, runtimeErrors } = await newPage(browser, { width: 390, height: 844 });

    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });

      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);
      await page.screenshot({ path: `${ARTIFACT_DIR}/mobile-home.png`, fullPage: true });

      await page.getByRole("button", { name: "Следующий осмотр" }).click();
      await page.getByRole("button", { name: "Диктовать" }).click();
      await page.getByRole("button", { name: "Остановить" }).click();
      const nextTextarea = page.locator("label.entry-field").filter({ hasText: "Следующий осмотр" }).locator("textarea");
      await waitForValue(nextTextarea, /матка есть/);

      await page.getByLabel("Сделано").fill("Осмотрел рамки");
      await page.getByRole("button", { name: "Сохранить запись" }).click();
      await waitForText(page.locator("section[aria-labelledby='history-title'] .section-head span"), "1");
      await assert.equal(await page.getByText("Осмотрел рамки").isVisible(), true);

      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Журнал" }).click();
      await assert.equal(await page.getByText("Осмотрел рамки").isVisible(), true);
      await assert.equal(await page.getByText("матка есть").isVisible(), true);

      await page.getByRole("button", { name: "Пасека" }).click();
      await page.getByLabel("Название нового улья").fill("9");
      await page.getByRole("button", { name: "Добавить" }).click();
      await assert.equal(await selectedHiveLabel(page), "Улей 9");

      await page.getByLabel("Название нового улья").fill("9");
      await page.getByRole("button", { name: "Добавить" }).click();
      await assert.equal(await page.getByText("Улей с таким номером уже есть.").isVisible(), true);

      await page.getByLabel("Переименовать выбранный улей").fill("Северный 9");
      await page.getByRole("button", { name: "Переименовать" }).click();
      await assert.equal(await selectedHiveLabel(page), "Улей Северный 9");
      await assertNoHorizontalOverflow(page);

      page.once("dialog", async (dialog) => {
        assert.match(dialog.message(), /Удалить улей Северный 9/);
        await dialog.dismiss();
      });
      await page.getByRole("button", { name: "Удалить улей Северный 9" }).click();
      await assert.equal(await page.getByRole("button", { name: "Северный 9", exact: true }).isVisible(), true);

      await page.keyboard.press("Tab");
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      assert.match(focusedTag ?? "", /BUTTON|INPUT|TEXTAREA/);

      await page.screenshot({ path: `${ARTIFACT_DIR}/mobile-after-flow.png`, fullPage: true });
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
    const { context, page, runtimeErrors } = await newPage(browser, { width: 1440, height: 960 });

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

async function selectedHiveLabel(page) {
  return page.getByRole("combobox", { name: "Выбранный улей" }).evaluate((select) =>
    select instanceof HTMLSelectElement ? select.selectedOptions[0]?.textContent?.trim() : ""
  );
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
