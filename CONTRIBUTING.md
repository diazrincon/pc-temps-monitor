# Contributing to AeroPulse Pro

Thanks for your interest in improving this project! This guide explains how to
set up your environment, the branching model, and the commit conventions.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

1. Fork the repository and clone your fork.
2. Install [Node.js](https://nodejs.org/) **v24+** (the project uses the native `node:sqlite` module).
3. Install dependencies and run the tests:

   ```powershell
   npm ci
   npm test
   ```

4. Download LibreHardwareMonitor as described in the [README](README.md#2-download-librehardwaremonitor).
   The dashboard only shows real sensor data; without LHM it stays in the `LHM OFFLINE` state.
   Unit tests use `tests/mock-data.json` and do not need LHM.

> **Never commit LibreHardwareMonitor binaries** (`*.exe`, `*.dll`, `*.zip`, …).
> They are ignored by `.gitignore`; keep it that way.

## Branching model (Gitflow)

| Branch       | Purpose                                                    | Branches from | Merges into          |
| ------------ | ---------------------------------------------------------- | ------------- | -------------------- |
| `main`       | Production-ready code. Every commit is a tagged release.  | —             | —                    |
| `develop`    | Integration branch for the next release.                   | `main`        | —                    |
| `feature/*`  | New features and non-urgent fixes (`feature/csv-export`).  | `develop`     | `develop`            |
| `release/*`  | Release stabilization (`release/v1.5.0`).                  | `develop`     | `main` **and** `develop` |
| `hotfix/*`   | Urgent production fixes (`hotfix/v1.4.1`).                 | `main`        | `main` **and** `develop` |

Rules:

- Open pull requests against **`develop`** (except `release/*` and `hotfix/*`).
- Merge with `--no-ff` so each feature remains visible in history.
- Never commit directly to `main`.
- Tag releases on `main` using [Semantic Versioning](https://semver.org/): `vMAJOR.MINOR.PATCH`.
- After merging a release/hotfix into `main`, always back-merge into `develop`.

## Commit messages (Gitmoji)

We use [Gitmoji](https://gitmoji.dev) combined with a Conventional Commits type:

```
<gitmoji> <type>(<scope>): <subject>
```

Examples:

```
✨ feat(study): add CSV export for thermal sessions
🐛 fix(parser): handle missing GPU hotspot sensor
📝 docs(readme): add LibreHardwareMonitor download steps
♻️ refactor(collector): extract polling loop
```

| Gitmoji | Type       | Use for                               |
| ------- | ---------- | ------------------------------------- |
| ✨      | `feat`     | New feature                           |
| 🐛      | `fix`      | Bug fix                               |
| 🚑️      | `fix`      | Critical hotfix                       |
| 📝      | `docs`     | Documentation                         |
| 🎨      | `style`    | Code structure/format                 |
| ♻️      | `refactor` | Refactoring                           |
| ⚡️      | `perf`     | Performance                           |
| ✅      | `test`     | Add/update tests                      |
| 🔧      | `chore`    | Configuration files                   |
| 👷      | `ci`       | CI build system                       |
| ⬆️      | `deps`     | Upgrade dependencies                  |
| 🔥      | `chore`    | Remove code or files                  |
| 🙈      | `chore`    | `.gitignore` changes                  |
| 🔖      | `release`  | Release / version tags                |
| 🔀      | —          | Merge branches                        |

Guidelines:

- Subject in imperative mood, lowercase, no trailing period, ≤ 72 chars.
- Use the body to explain **what** and **why**, not how.
- Reference issues in the footer: `Closes #12`.

Enable the bundled commit template locally:

```powershell
git config commit.template .gitmessage
```

Optionally use the interactive CLI: `npx gitmoji-cli -c`.

## Pull requests

- Keep PRs focused on a single concern.
- Make sure `npm test` passes; CI runs it on every PR.
- Update `README.md` and `CHANGELOG.md` (under **Unreleased**) when behavior changes.
- Fill in the pull request template.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/diazrincon/pc-temps-monitor/issues/new/choose).
For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
