# AeroPulse Pro ⚡

> Modern, lightweight, automated PC temperature and fan telemetry monitoring dashboard for Windows, integrating with LibreHardwareMonitor.

![AeroPulse Pro](https://img.shields.io/badge/version-v1.2.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v24+-68a063.svg)
![Backend](https://img.shields.io/badge/Fastify-v5-black.svg)
![Database](https://img.shields.io/badge/SQLite-WAL-003b57.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 🌟 Highlights

- **Real-Time Telemetry**: Instant CPU, GPU, and Case fan readings updated every 5 seconds.
- **🧪 Thermal Study Recorder**:
  - Record benchmark or gaming sessions over flexible durations (`10 min`, `30 min`, `1 hr`, or `Unlimited`).
  - Persistent study sessions stored in SQLite with full telemetry time series.
  - Automatic statistical analysis: Min, Avg, Max, P95 (95th percentile), GPU thermal delta (Hotspot vs Core), and throttling incident counters.
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

### 1. Requirements & Configuration
- Windows 10 or 11
- Node.js v24+
- [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)

Set the `LHM_PATH` environment variable pointing to your `LibreHardwareMonitor.exe`:
```powershell
# Set permanently for your user account:
[System.Environment]::SetEnvironmentVariable("LHM_PATH", "D:\Tools\LibreHardwareMonitor\LibreHardwareMonitor.exe", "User")
```
*(Or keep a local `LibreHardwareMonitor.NET.10/` folder in the project root, which is automatically ignored by Git).*

### 2. Installation
```powershell
# Install dependencies
npm install
```

### 3. Launch LibreHardwareMonitor
LibreHardwareMonitor requires Administrator rights to access motherboard and GPU sensors.
```powershell
.\scripts\start-lhm.ps1
```
*Note: Ensure `Options -> Remote Web Server -> Run` is active (port 8085).*

### 4. Start the Dashboard
```powershell
.\scripts\start-dashboard.ps1
# or
npm start
```
Open your browser at: **[http://localhost:8367](http://localhost:8367)**

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

## 🌿 Gitflow Workflow

This repository follows standard **Gitflow** branching practices:
- `main`: Production-ready, tagged releases (`v1.0.0`).
- `develop`: Ongoing development and feature integration.
- `feature/*`: Specific feature branches branched from and merged back into `develop`.
- `release/*`: Release candidate branches for stabilization, merged into `main` (with tag) and `develop`.
- `hotfix/*`: Critical bug fixes branched from `main` and merged into both `main` and `develop`.

---

## 📄 License
MIT License.
