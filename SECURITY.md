# Security Policy

## Supported versions

Only the latest release on `main` receives security fixes.

| Version | Supported |
| ------- | --------- |
| 1.4.x   | ✅        |
| < 1.4   | ❌        |

## Reporting a vulnerability

**Please do not open public issues for security problems.**

Report vulnerabilities privately using GitHub's
[private vulnerability reporting](https://github.com/diazrincon/pc-temps-monitor/security/advisories/new).
Include steps to reproduce, affected version, and potential impact.

You can expect an initial response within 7 days. Once the issue is confirmed,
a fix will be released as a `hotfix/*` and credited in the changelog (unless you
prefer to remain anonymous).

## Scope notes

- The dashboard binds to `127.0.0.1` by default. Exposing it to a network
  (changing `server.host` in `config.json`) is at your own risk.
- LibreHardwareMonitor is a third-party project; report issues with it
  [upstream](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/security).
