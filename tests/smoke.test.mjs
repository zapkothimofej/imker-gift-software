import { access, readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const requiredFiles = [
  "README.md",
  "app/page.tsx",
  "app/components/hive-selector.tsx",
  "app/api/transcribe/route.ts",
  "docs/QUESTIONS.md",
  "docs/ANSWER-TEMPLATE.md",
  "docs/PRD-DRAFT.md",
  "docs/DECISIONS.md",
  "public/manifest.webmanifest",
  "public/sw.js"
];

test("project scaffold files exist", async () => {
  await Promise.all(requiredFiles.map((file) => access(file)));
});

test("questions document contains at least 50 questions", async () => {
  const content = await readFile("docs/QUESTIONS.md", "utf8");
  const questionCount = content
    .split("\n")
    .filter((line) => /^\d+\.\s/.test(line.trim())).length;

  assert.ok(questionCount >= 50, `Expected at least 50 questions, got ${questionCount}`);
});

test("pwa is configured for Russian phone usage", async () => {
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
  const page = await readFile("app/page.tsx", "utf8");

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "ru");
  assert.match(page, /Говорить/);
  assert.match(page, /Сделано/);
  assert.match(page, /В следующий раз/);
});

test("hive management prevents duplicates and supports deletion", async () => {
  const hook = await readFile("app/hooks/use-hive-manager.ts", "utf8");
  const selector = await readFile("app/components/hive-selector.tsx", "utf8");

  assert.match(hook, /alreadyExists/);
  assert.match(hook, /Улей с таким номером уже есть/);
  assert.match(hook, /function removeHive/);
  assert.match(hook, /function renameHive/);
  assert.match(selector, /Удалить улей/);
  assert.match(selector, /Переименовать/);
  assert.match(hook, /Нельзя удалить последний улей/);
});

test("transcription route proxies ElevenLabs without exposing a fixed key", async () => {
  const route = await readFile("app/api/transcribe/route.ts", "utf8");

  assert.match(route, /ELEVENLABS_API_KEY/);
  assert.match(route, /scribe_v2/);
  assert.match(route, /language_code/);
  assert.doesNotMatch(route, /sk_[A-Za-z0-9]/);
});
