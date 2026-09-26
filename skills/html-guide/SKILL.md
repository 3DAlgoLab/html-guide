---
name: html-guide
description: 'Turn any study material — a lecture PDF, paper, article, doc page, or video transcript — into one self-contained interactive HTML study guide: chunk-by-chunk lessons, each ending with an interactive multiple-choice quiz that gives instant per-option feedback. Use when the user wants a rich interactive HTML document to learn or teach content (lectures, papers, docs, videos) with built-in comprehension checks, or says "explain-diff style but for this lecture/doc", "make an interactive study guide", "make flashcards/quizzes HTML for this content".'
---

# Interactive HTML Guide

## Purpose

Convert study content into a **single offline HTML file** that teaches chunk by chunk and quizzes understanding in every chunk. Everything is inline — no CDNs, fonts, images, or network access — so the file works anywhere, forever.

## Setup

No install needed. Source tools (used as needed):

- PDF → text: `pdftotext -layout file.pdf out.txt`
- Video transcript: use the `youtube-transcript` skill
- Others: read the markdown / article / doc directly

Validation needs `node` (≥18, has global `fetch` + `WebSocket`) and a headless Chrome/Chromium (`CHROME` env to override the binary).

## Workflow

1. **Collect content** and split it into 10–16 logical chunks. One chunk = one cohesive idea with a mini-lesson (definition, claim, example, or code block).
2. **Copy `references/template.html`** to `/tmp/YYYY-MM-DD-<slug>.html` and fill it:
   - title + hero + TOC anchors
   - a `<div class="chunk" id="chunk-N">` block per chunk with your lesson text
   - one entry per chunk in the `QUIZZES` array (schema is documented in the template)
3. **Write the quizzes** — the hard rules:
   - 3–5 medium-difficulty multiple-choice questions per chunk. Medium = not answerable by word-matching; the reader must grasp the claim, see a consequence, or catch a subtle detail.
   - Distractors must be **plausible misinterpretations** (often drawn from the reader's actual misconceptions), comparable length to the correct option, never silly.
   - Mark `c: true` on whichever option is correct — the engine places it at a rotating position `(chunkIndex + qIdx) % 4`, which **by construction** guarantees: ≥3 distinct letters per chunk, no two adjacent questions share a letter, and balanced letter tallies. Do not try to hand-order options.
   - Every option carries a `why` string = the reasoning/misconception, and each question a `good` string = the correct reasoning shown on a right answer.
4. **Use the template's building blocks** for the lesson: `def` / `tip` / `warn` / `obs` callouts, semantic HTML diagrams (`flow`/`node` rows, `stack`/`layer`, `matrix` grids, `pipe` timeline, `table`). Never use ASCII art. Keep the CSS and <script> from the template unchanged.
5. **Quizzes render collapsed by default** — the engine wraps each chunk's quiz in a `<details>` block (`Quiz — <chunk title>`, click to expand). The lesson text stays primary; the reader opens a quiz when ready to be tested. No `open` attribute is added, so they start closed.
6. **Save outside the repo** (default `/tmp/...`). Report the absolute path as a clickable local-file link.
7. **Validate before handoff** — `node references/validate.mjs <file.html> [expected-chunk-count]` asserts: no page exceptions, quizzes mount, options = 4×questions, wrong/correct feedback both appear, questions lock independently, no horizontal overflow at 390px/320px, score element present. It exits non-zero on failure.
8. Optionally: `node --check` the extracted `<script>` and a quick tag-balance pass (HTMLParser).

## Rules

- One self-contained file; inline CSS + JS only. No external assets, no network.
- `pre`/`code` blocks must keep `white-space: pre` (the template CSS already does).
- Quiz correctness must not depend on color alone — wrong answers also get a border and a disabled state, and feedback text spells out the reasoning.
- Escape any user-derived or code-derived text for HTML and JS contexts.
- Do not claim behavior the source doesn't support; separate verified/observed facts from interpretation (use the `obs` callout for things actually run/measured).
- Keep the quiz engine and CSS identical to the template unless fixing a real bug — surface any engine change to the user instead of silently diverging.
- Speak to the reader's level; explain jargon on first use; keep the page readable on phones (template is responsive).

## Examples

- Stanford CS336 Lecture 7 (parallelism) → `/tmp/2026-08-21-explanation-cs336-lecture07-parallelism.html`: 15 sections, 14 quizzes / 53 questions, verified with headless Chrome (quizzes mount, feedback paths work, zero overflow at 320px).
- Validation: `node references/validate.mjs /tmp/2026-08-21-explanation-cs336-lecture07-parallelism.html 14` (path relative to this skill's directory) → all checks pass.
