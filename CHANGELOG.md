# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- Simulated telemetry fallback. When LibreHardwareMonitor is unreachable the dashboard shows an `LHM OFFLINE` state, clears all readings and stores nothing; previously stored simulated rows are purged on startup.

### Changed
- Starting a thermal study is rejected while LibreHardwareMonitor is offline.
- Charts use a real time axis fixed to the selected window, with visible gaps where no data exists.

### Fixed
- History ranges (15M/1H/6H/24H) returned every record of the current UTC day due to a timestamp format mismatch; each range now returns exactly its window, downsampled to 5s/15s/1m/5m buckets.
- 24h retention cleanup kept data since midnight of the previous day for the same reason.
- Live samples were mixed with aggregated history and capped at 120 points, distorting longer ranges.
- Switching ranges quickly could render a stale response.

## [1.4.0] - 2026-11-23

### Added
- MIT `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and `SECURITY.md`.
- GitHub issue/PR templates, CI workflow (Windows, Node 24) and Dependabot.
- `.editorconfig`, `.gitattributes` and a gitmoji commit template (`.gitmessage`).
- LibreHardwareMonitor download instructions (manual, PowerShell, winget) in the README.

### Changed
- Commit convention switched to Gitmoji (`<gitmoji> <type>(<scope>): <subject>`).
- `package.json` now declares repository, author, bugs, homepage and `engines`.

### Fixed
- Stop Study button is instantaneous, survives server restarts and no longer shows a blocking confirm dialog.

## [1.3.0] - 2026-09-20

### Added
- Fans & Acoustic Speeds (RPM) section in the thermal benchmark report.

### Fixed
- Study modal can be dismissed with the Cancel button, backdrop click or `Esc`.

## [1.2.0] - 2026-09-20

### Added
- Thermal study recorder with statistical reports, PDF export and LLM diagnostic prompt.

### Fixed
- Study header controls toggle according to recording state.

## [1.1.0] - 2026-09-20

### Added
- Dedicated port `8367`, silent background runner and autostart scripts (registry and Task Scheduler).

## [1.0.0] - 2026-09-20

### Added
- Initial release: real-time CPU/GPU/fan telemetry dashboard backed by LibreHardwareMonitor, Fastify and SQLite.

[Unreleased]: https://github.com/diazrincon/pc-temps-monitor/compare/v1.4.0...develop
[1.4.0]: https://github.com/diazrincon/pc-temps-monitor/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/diazrincon/pc-temps-monitor/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/diazrincon/pc-temps-monitor/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/diazrincon/pc-temps-monitor/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/diazrincon/pc-temps-monitor/releases/tag/v1.0.0
