# WorkLooking

WorkLooking Agent - AI-powered resume and job application assistant. It's an
Electron + TypeScript desktop app for tailoring resumes and managing job
applications, with an in-app AI assistant.

## Documentation

- [`AGENTS.md`](AGENTS.md) — dev workflow index (architecture, IPC, state,
  build, conventions, the shipped AI agent, resume themes).
- [`docs/build.md`](docs/build.md) — build, packaging, testing, and release
  automation details.

## Releasing

Releases are built and published automatically by GitHub Actions
(`.github/workflows/release.yml`) for Windows, Linux, and macOS whenever a
version tag is pushed. See [`docs/build.md`](docs/build.md#release-automation)
for the full technical detail — this section is the short maintainer runbook.

### 1. Bump the version first

Before tagging, bump `package.json`'s `version` field and commit it. The
workflow's `validate-version` job compares the pushed tag to
`package.json.version` and **fails the entire release** if they don't match
— nothing gets built or published.

### 2. Trigger a release

Push a git tag matching `vX.Y.Z`:

```bash
git tag v1.2.0
git push origin v1.2.0
```

This tag push is the **only** trigger — there is no manual `workflow_dispatch`
and no release on ordinary pushes to `main`.

### 3. What happens automatically

1. `validate-version` checks the tag against `package.json.version`. Any
   mismatch stops the whole release here.
2. A 3-OS build matrix (Windows, Linux, macOS) then runs, each job gated by
   `npm run typecheck` and `npm test` before it's allowed to build.
3. On success, each job runs `electron-forge publish`, which uploads its
   platform installer to a GitHub Release for that tag.

### 4. What to expect

- A GitHub Release is created as a **prerelease** (not a draft), per the
  `publisher-github` config in `forge.config.js`.
- Artifacts: a Windows Squirrel installer (`.exe`), a macOS `.zip`, and Linux
  `.deb`/`.rpm` packages.
- Builds are **unsigned** — there is no code signing or notarization. Expect
  OS security warnings (e.g. Windows SmartScreen, macOS Gatekeeper) when
  installing; this is expected, not a bug.

### 5. Failure behavior

- If `validate-version` fails, no platform builds run at all.
- If one platform's typecheck/test/build fails, the **other platforms still
  complete and publish** (the matrix uses `fail-fast: false`). A release can
  therefore end up with only 2 of 3 platforms — always check the Actions run
  and the Releases page after tagging to confirm all platforms succeeded.
