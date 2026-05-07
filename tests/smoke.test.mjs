import { access, readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const requiredFiles = [
  "README.md",
  "docs/QUESTIONS.md",
  "docs/ANSWER-TEMPLATE.md",
  "docs/PRD-DRAFT.md",
  "docs/DECISIONS.md"
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

