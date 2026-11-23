# AeroPulse Pro ⚡

> Modern, lightweight, automated PC temperature and fan telemetry monitoring dashboard for Windows, integrating with LibreHardwareMonitor.

![AeroPulse Pro](https://img.shields.io/badge/version-v1.3.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v24+-68a063.svg)
![Backend](https://img.shields.io/badge/Fastify-v5-black.svg)
![Database](https://img.shields.io/badge/SQLite-WAL-003b57.svg)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![CI](https://github.com/diazrincon/pc-temps-monitor/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/diazrincon/pc-temps-monitor/actions/workflows/ci.yml)
[![gitmoji](https://img.shields.io/badge/gitmoji-%20😜%20😍-FFDD67.svg)](https://gitmoji.dev)

---

## 🌟 Highlights

- **Real-Time Telemetry**: Instant CPU, GPU, and Case fan readings updated every 5 seconds.
- **🧪 Thermal Study & Benchmark Recorder**:
  - Record benchmark or gaming sessions over flexible durations (`10 min`, `30 min`, `1 hr`, or `Unlimited`).
  - Persistent study sessions stored in SQLite with full telemetry time series.
  - Automatic statistical analysis: Min, Avg, Max, P95 (95th percentile), GPU thermal delta (Hotspot vs Core), and throttling incident counters.
  - **🌀 Fans & Acoustic Speeds (RPM)**: Complete breakdown for CPU Cooler, GPU dual fans, and Case Intake/Exhaust fans with Min, Avg, Max, P95, acoustic classifications (`SILENCIOSO`, `MODERADO`, `ALTO FLUJO`, `0dB STOP`), and dynamic Airflow balance diagnosis.
  - Automated **Thermal Health Grade** (`A+`, `A`, `B`, `C`) evaluating cooling performance.
  - **PDF Export**: Print-ready A4/Letter formatted report without web navigation chrome.
  - **LLM Diagnostic Prompt**: One-click prompt generator tailored for ChatGPT, Claude, or Gemini containing exact hardware specs, stats tables, and targeted engineering questions.
- **Hardware-Specific Mapping**:
  - **CPU**: Intel Core / AMD Ryzen Package & Core Temps, load %, package power (W).
  - **GPU**: NVIDIA RTX 3060 Core & Hot Spot temps, dual-fan RPM, fan %, board power (W), 0dB idle fan detection.
  - **Chassis & Airflow**: Motherboard NCT6687D fan headers (120mm Intake & Exhaust), dynamic airflow pressure balance calculation.
- **High-Performance Architecture**:
  - Fastify server (~25MB RAM).
  - Native Node 24 `node:sqlite` in WAL mode for persistent metrics.
  - Automatic 24h data retention with periodic cleanup.
  - Server-Sent Events (SSE) for low-latency browser streaming.
- **Fail-Safe Operation**: If LibreHardwareMonitor is closed or offline, the dashboard seamlessly transitions to realistic simulated telemetry with visual status pills (`SIMULATED (LHM OFFLINE)` vs `LIVE (LHM CONNECTED)`).
- **Windows Boot Automation**: PowerShell scripts to register a background task in Windows Task Scheduler on dedicated port `8367`.

---

## 🚀 Quick Start

### 1. Requirements
- Windows 10 or 11
- [Node.js](https://nodejs.org/) v24+
- [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) v0.9.5+ (downloaded separately, see below)

### 2. Download LibreHardwareMonitor

> LibreHardwareMonitor binaries are **not** included in this repository (third-party project, licensed under MPL-2.0).

**Option A — Manual download**

1. Go to the [LibreHardwareMonitor releases page](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases/latest).
2. Download one of the assets:
   - `LibreHardwareMonitor.NET.10.zip` — requires the [.NET 10 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/10.0) (recommended).
   - `LibreHardwareMonitor.zip` — .NET Framework 4.7.2 build (preinstalled on Windows 10/11).
3. Extract it into a `LibreHardwareMonitor/` folder in the project root (ignored by Git), or anywhere you like.

**Option B — PowerShell**

```powershell
# Downloads the latest .NET 10 build into .\LibreHardwareMonitor
$release = Invoke-RestMethod https://api.github.com/repos/LibreHardwareMonitor/LibreHardwareMonitor/releases/latest
$asset   = $release.assets | Where-Object name -eq "LibreHardwareMonitor.NET.10.zip"
Invoke-WebRequest $asset.browser_download_url -OutFile "$env:TEMP\lhm.zip"
Expand-Archive "$env:TEMP\lhm.zip" -DestinationPath .\LibreHardwareMonitor -Force
Remove-Item "$env:TEMP\lhm.zip"
```

**Option C — winget**

```powershell
winget install LibreHardwareMonitor.LibreHardwareMonitor
```

*winget installs it as a portable app outside the project; point `LHM_PATH` to the installed `LibreHardwareMonitor.exe` (see below).*

`scripts/start-lhm.ps1` looks for the executable in this order:

1. `LHM_PATH` environment variable
2. `.\LibreHardwareMonitor.NET.10\LibreHardwareMonitor.exe`
3. `.\LibreHardwareMonitor\LibreHardwareMonitor.exe`
4. `C:\Program Files\LibreHardwareMonitor\LibreHardwareMonitor.exe`

If you installed it elsewhere, set `LHM_PATH`:

```powershell
[System.Environment]::SetEnvironmentVariable("LHM_PATH", "D:\Tools\LibreHardwareMonitor\LibreHardwareMonitor.exe", "User")
```

### 3. Install dependencies
```powershell
npm install
```

### 4. Launch LibreHardwareMonitor
LibreHardwareMonitor requires Administrator rights to access motherboard and GPU sensors.
```powershell
.\scripts\start-lhm.ps1
```
Then enable **Options → Remote Web Server → Run** (default port `8085`).

### 5. Start the Dashboard
```powershell
.\scripts\start-dashboard.ps1
# or
npm start
```
Open your browser at: **[http://localhost:8367](http://localhost:8367)**

### Configuration
Edit [`config.json`](config.json) to change the port, LHM endpoint, polling interval, retention, temperature thresholds, and the hardware labels shown in reports.

---

## 🔄 Windows Autostart (Run on Boot)

To run the monitoring service silently in the background on Windows logon:

### Option A: User Startup Registry (Recommended - No Admin/UAC Required)
```powershell
# Enable autostart:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\register-startup.ps1

# Disable autostart:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\unregister-startup.ps1
```

### Option B: Windows Task Scheduler (Requires Administrator Rights)
```powershell
# Register scheduled task:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\register-task.ps1

# Unregister scheduled task:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\unregister-task.ps1
```

---

## 🧪 Development

```powershell
npm run dev   # auto-restart on changes
npm test      # parser & benchmark unit tests
```

Without LibreHardwareMonitor running, the dashboard falls back to simulated telemetry, so UI work does not require real sensors.

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. In short:

- **Gitflow**: branch `feature/*` from `develop`; `release/*` and `hotfix/*` merge into `main` (tagged) and back into `develop`.
- **Gitmoji** commits: `✨ feat(study): add CSV export`.
- Do not commit LibreHardwareMonitor binaries.

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md). See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## 📄 License

[MIT](LICENSE) © José Díaz Rincón

LibreHardwareMonitor is a separate project licensed under the [MPL-2.0](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/blob/master/LICENSE).
