# Test fixtures

Small, checked-in sample assets used by integration tests.

Add these when implementing Tier 4:

- `sample.pdf` — a tiny 1-page PDF with known text (for `readPdf`). Keep it small.
- `sample.png` — a small real PNG (for `processImage` / `IMAGE_SELECT_AND_OPTIMIZE`).
- `not-an-image.txt` — plain text, to assert `processImage` error handling.

Keep fixtures minimal; do not commit real personal data.
