# pi-html-guide

A [pi](https://pi.dev) package for the **html-guide** skill: turn any learning material — lecture PDFs, papers, articles, doc pages, video transcripts — into a **single self-contained interactive HTML study guide**: chunk-by-chunk lessons, each ending with a multiple-choice quiz that gives instant per-option feedback. No CDNs, no fonts, no network: the file works offline, forever.

## Install

```bash
pi install git:github.com/3DAlgoLab/html-guide
```

Verify with `pi list`.


## Usage

Just ask pi:

- "Make an interactive study guide from this lecture PDF"
- "Turn this YouTube transcript into an interactive HTML guide"
- "html-guide style, but for this paper"

The skill splits the source into 10–16 logical chunks, fills its bundled `references/template.html` with the lesson content and a per-chunk quiz, and saves the result as a single file at `/tmp/YYYY-MM-DD-<slug>.html` (reported as a clickable local-file link).

What you get in the output:

- One chunk = one cohesive idea (definition, claim, example, or code), with callouts (`def`/`tip`/`warn`/`obs`) and semantic HTML diagrams instead of ASCII art.
- Each chunk ends with a collapsed multiple-choice quiz (3–5 questions). Every option carries reasoning for why it is right or wrong, shown on click; questions lock independently and a per-chunk score tracks progress.
- A table of contents, responsive layout (no overflow at 320px), and zero network dependencies — the file works offline.

Before handoff the skill validates the output with `node references/validate.mjs <file.html> [expected-chunk-count]`: quiz mounting, both feedback paths, option counts, and responsive overflow at 390px/320px. It exits non-zero on failure.
## Requirements

- pi
- `node` ≥ 18 — only needed for the optional verification step
- headless Chrome/Chromium for verification (`CHROME` env var overrides the binary)
- `pdftotext` (poppler-utils) — only for PDF sources

## Package layout

```
skills/html-guide/
├── SKILL.md              # skill definition: workflow + quiz authoring rules
└── references/
    ├── template.html     # self-contained template (CSS + quiz engine)
    └── validate.mjs      # headless-Chrome smoke test for generated pages
```

## Notes on the reference engine

- Quiz option positions rotate deterministically (`(chunkIndex+qIdx)%4`) — balanced letters, no two adjacent questions share a letter; authors only mark `c: true`.
- Author strings are HTML-escaped when injected into feedback (`esc()`), with explicit `pi-lens-ignore: no-inner-html-js` comments documenting the intentional markup injection. Keep the engine and CSS identical to the template unless fixing a real bug, and surface any engine change to users.
