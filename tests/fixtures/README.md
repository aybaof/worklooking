# Test fixtures

Small, checked-in sample assets used by integration tests.

Present fixtures (Tier 4):

- `sample.pdf` — a tiny 1-page PDF containing the text
  `WorkLooking sample PDF fixture` (for `readPdf`, exercised via the `read_pdf`
  tool in `electron/main.integration.test.ts`).
- `sample.png` — a 400×300 PNG (for `processImage` in
  `electron/utils/image-processor.test.ts`; the size forces a real resize down
  to the 200px cap).
- `not-an-image.txt` — plain text, to assert `processImage` error handling.

Keep fixtures minimal; do not commit real personal data.
