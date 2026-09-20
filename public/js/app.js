/**
 * AeroPulse Dashboard Application Controller
 */

let currentRange = '1h';
let eventSource = null;
let pollTimer = null;
let lastUpdateDate = new Date();

// DOM Elements
const elements = {
  // Status
  connBadge: document.getElementById('connection-badge'),
  connStatusText: document.getElementById('connection-status-text'),
  alertBanner: document.getElementById('alert-banner'),
  alertTitle: document.getElementById('alert-title'),
  alertDesc: document.getElementById('alert-desc'),
  clockDisplay: document.getElementById('clock-display'),
  lastUpdated: document.getElementById('last-updated-text'),
  progressBar: document.getElementById('refresh-progress-bar'),

  // CPU
  cpuName: document.getElementById('cpu-name-sub'),
  cpuTemp: document.getElementById('val-cpu-temp'),
  cpuStatusPill: document.getElementById('cpu-status-pill'),
  cpuLoad: document.getElementById('val-cpu-load'),
  cpuRingBar: document.getElementById('cpu-ring-bar'),
  cpuMaxCore: document.getElementById('val-cpu-max-core'),
  cpuFanRpm: document.getElementById('val-cpu-fan-rpm'),
  cpuPower: document.getElementById('val-cpu-power'),
  cpuFill: document.getElementById('cpu-temp-fill'),

  // GPU Core
  gpuName: document.getElementById('gpu-name-sub'),
  headerGpuName: document.getElementById('header-gpu-name'),
  gpuTemp: document.getElementById('val-gpu-core-temp'),
  gpuStatusPill: document.getElementById('gpu-core-status-pill'),
  gpuLoad: document.getElementById('val-gpu-load'),
  gpuRingBar: document.getElementById('gpu-ring-bar'),
  gpuFansRpm: document.getElementById('val-gpu-fans-rpm'),
  gpuFanPct: document.getElementById('val-gpu-fan-pct'),
  gpuPower: document.getElementById('val-gpu-power'),
  gpuFill: document.getElementById('gpu-temp-fill'),

  // GPU Hotspot
  hotspotTemp: document.getElementById('val-gpu-hotspot-temp'),
  hotspotStatusPill: document.getElementById('gpu-hotspot-status-pill'),
  hotspotDelta: document.getElementById('val-hotspot-delta'),
  hotspotMemLoad: document.getElementById('val-gpu-mem-load'),
  hotspotFill: document.getElementById('gpu-hotspot-fill'),
  hotspotHealth: document.getElementById('val-hotspot-health'),

  // Fans & Airflow
  fanIntake: document.getElementById('val-fan-intake'),
  fanExhaust: document.getElementById('val-fan-exhaust'),
  fanIntakeSpin: document.getElementById('fan-intake-spin'),
  fanExhaustSpin: document.getElementById('fan-exhaust-spin'),
  moboTemp: document.getElementById('val-mobo-temp'),
  gpuFan1Rpm: document.getElementById('val-gpu-fan1-rpm'),
  gpuFan2Rpm: document.getElementById('val-gpu-fan2-rpm'),
  airflowIndicator: document.getElementById('airflow-indicator')
};

// Thresholds defaults
let thresholds = {
  cpu: { normal: 75, warm: 85 },
  gpuCore: { normal: 76, alert: 83 },
  gpuHotspot: { normal: 88, alert: 92 }
};

function updateClock() {
  const now = new Date();
  elements.clockDisplay.textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

function setRadialRing(element, percent) {
  if (!element) return;
  const circumference = 213.6;
  const offset = circumference - (percent / 100) * circumference;
  element.style.strokeDashoffset = Math.max(0, offset);
}

function updateTelemetryUI(data) {
  const t = data.telemetry;
  if (data.thresholds) thresholds = data.thresholds;
  lastUpdateDate = new Date();
  elements.lastUpdated.textContent = 'Updated: ' + lastUpdateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Reset CSS progress countdown animation
  if (elements.progressBar) {
    elements.progressBar.style.animation = 'none';
    elements.progressBar.offsetHeight; // trigger reflow
    elements.progressBar.style.animation = 'countdownBar 5s linear infinite';
  }

  // Connection Badge
  if (!t.isMock && data.isLive) {
    elements.connBadge.className = 'connection-badge live';
    elements.connStatusText.textContent = 'LIVE (LHM CONNECTED)';
  } else {
    elements.connBadge.className = 'connection-badge simulated';
    elements.connStatusText.textContent = 'SIMULATED (LHM OFFLINE)';
  }

  // --- CPU ---
  if (t.cpu.name && t.cpu.name !== 'Unknown CPU') {
    elements.cpuName.textContent = t.cpu.name;
  }
  const cpuT = t.cpu.packageTemp ?? 0;
  elements.cpuTemp.textContent = cpuT > 0 ? cpuT.toFixed(1) : '--';
  elements.cpuMaxCore.textContent = t.cpu.maxCoreTemp ? `${t.cpu.maxCoreTemp.toFixed(1)} °C` : '-- °C';
  elements.cpuFanRpm.textContent = t.fans.cpuFanRpm ? `${t.fans.cpuFanRpm} RPM` : '-- RPM';
  elements.cpuPower.textContent = t.cpu.power ? `${t.cpu.power.toFixed(1)} W` : '-- W';

  const cpuLoad = t.cpu.loadTotal ?? 0;
  elements.cpuLoad.textContent = `${Math.round(cpuLoad)}%`;
  setRadialRing(elements.cpuRingBar, cpuLoad);

  // CPU Threshold & Status
  elements.cpuFill.style.width = `${Math.min(100, (cpuT / 100) * 100)}%`;
  if (cpuT >= thresholds.cpu.warm) {
    elements.cpuStatusPill.className = 'metric-pill hot';
    elements.cpuStatusPill.textContent = 'HOT';
    elements.cpuTemp.style.color = '#fb7185';
  } else if (cpuT >= thresholds.cpu.normal) {
    elements.cpuStatusPill.className = 'metric-pill warm';
    elements.cpuStatusPill.textContent = 'WARM';
    elements.cpuTemp.style.color = '#fbbf24';
  } else {
    elements.cpuStatusPill.className = 'metric-pill';
    elements.cpuStatusPill.textContent = 'NORMAL';
    elements.cpuTemp.style.color = '#fff';
  }

  // --- GPU Core ---
  if (t.gpu.name && t.gpu.name !== 'Unknown GPU') {
    elements.gpuName.textContent = t.gpu.name;
    if (t.gpu.name.includes('3060')) elements.headerGpuName.textContent = 'RTX 3060';
  }
  const gpuT = t.gpu.coreTemp ?? 0;
  elements.gpuTemp.textContent = gpuT > 0 ? gpuT.toFixed(1) : '--';
  elements.gpuFansRpm.textContent = t.gpu.fan1Rpm ? `${t.gpu.fan1Rpm} RPM` : '0 RPM (0dB)';
  elements.gpuFanPct.textContent = t.gpu.fanPercent !== null ? `${Math.round(t.gpu.fanPercent)}%` : '--%';
  elements.gpuPower.textContent = t.gpu.power ? `${t.gpu.power.toFixed(1)} W` : '-- W';

  const gpuLoad = t.gpu.coreLoad ?? 0;
  elements.gpuLoad.textContent = `${Math.round(gpuLoad)}%`;
  setRadialRing(elements.gpuRingBar, gpuLoad);

  // GPU Core Threshold
  elements.gpuFill.style.width = `${Math.min(100, (gpuT / 100) * 100)}%`;
  if (gpuT >= thresholds.gpuCore.alert) {
    elements.gpuStatusPill.className = 'metric-pill hot';
    elements.gpuStatusPill.textContent = 'THROTTLE ALERT';
    elements.gpuTemp.style.color = '#fb7185';
  } else if (gpuT >= thresholds.gpuCore.normal) {
    elements.gpuStatusPill.className = 'metric-pill warm';
    elements.gpuStatusPill.textContent = 'ELEVATED';
    elements.gpuTemp.style.color = '#fbbf24';
  } else {
    elements.gpuStatusPill.className = 'metric-pill';
    elements.gpuStatusPill.textContent = 'NORMAL';
    elements.gpuTemp.style.color = '#fff';
  }

  // --- GPU Hotspot ---
  const hsT = t.gpu.hotspotTemp ?? 0;
  elements.hotspotTemp.textContent = hsT > 0 ? hsT.toFixed(1) : '--';
  const delta = (hsT > 0 && gpuT > 0) ? (hsT - gpuT).toFixed(1) : '--';
  elements.hotspotDelta.textContent = `+${delta} °C`;
  elements.hotspotMemLoad.textContent = t.gpu.memoryLoad ? `${t.gpu.memoryLoad.toFixed(0)} %` : '-- %';

  elements.hotspotFill.style.width = `${Math.min(100, (hsT / 110) * 100)}%`;
  if (hsT >= thresholds.gpuHotspot.alert) {
    elements.hotspotStatusPill.className = 'metric-pill hot';
    elements.hotspotStatusPill.textContent = 'HOTSPOT ALERT';
    elements.hotspotHealth.textContent = 'Critical Junction';
    elements.hotspotHealth.className = 'sub-val text-rose';
  } else if (hsT >= thresholds.gpuHotspot.normal) {
    elements.hotspotStatusPill.className = 'metric-pill warm';
    elements.hotspotStatusPill.textContent = 'WARM';
    elements.hotspotHealth.textContent = 'Elevated';
    elements.hotspotHealth.className = 'sub-val text-amber';
  } else {
    elements.hotspotStatusPill.className = 'metric-pill';
    elements.hotspotStatusPill.textContent = 'NORMAL';
    elements.hotspotHealth.textContent = 'Nominal';
    elements.hotspotHealth.className = 'sub-val text-emerald';
  }

  // --- Case Fans & Airflow ---
  const intakeRpm = t.fans.caseIntakeRpm ?? 0;
  const exhaustRpm = t.fans.caseExhaustRpm ?? 0;
  elements.fanIntake.textContent = intakeRpm > 0 ? `${intakeRpm} RPM` : '-- RPM';
  elements.fanExhaust.textContent = exhaustRpm > 0 ? `${exhaustRpm} RPM` : '-- RPM';
  elements.moboTemp.textContent = t.fans.motherboardTemp ? `${t.fans.motherboardTemp.toFixed(1)} °C` : '-- °C';
  elements.gpuFan1Rpm.textContent = t.gpu.fan1Rpm ? `${t.gpu.fan1Rpm} RPM` : '0 RPM';
  elements.gpuFan2Rpm.textContent = t.gpu.fan2Rpm ? `${t.gpu.fan2Rpm} RPM` : '0 RPM';

  // Toggle rotating fan animations based on activity
  if (intakeRpm > 200) {
    elements.fanIntakeSpin.classList.add('active');
  } else {
    elements.fanIntakeSpin.classList.remove('active');
  }
  if (exhaustRpm > 200) {
    elements.fanExhaustSpin.classList.add('active');
  } else {
    elements.fanExhaustSpin.classList.remove('active');
  }

  // Airflow Pressure Indicator (Intake vs Exhaust)
  if (intakeRpm > 0 && exhaustRpm > 0) {
    const ratio = intakeRpm / (intakeRpm + exhaustRpm);
    const indicatorPct = Math.min(85, Math.max(15, Math.round(ratio * 100)));
    elements.airflowIndicator.style.left = `${indicatorPct}%`;
  }

  // --- Global Alert Banner Check ---
  const isCpuHot = cpuT >= thresholds.cpu.warm;
  const isGpuHot = gpuT >= thresholds.gpuCore.alert;
  const isHotspotHot = hsT >= thresholds.gpuHotspot.alert;

  if (isCpuHot || isGpuHot || isHotspotHot) {
    elements.alertBanner.classList.remove('hidden');
    let alerts = [];
    if (isCpuHot) alerts.push(`CPU reached ${cpuT.toFixed(1)}°C (Limit: ${thresholds.cpu.warm}°C)`);
    if (isGpuHot) alerts.push(`GPU Core reached ${gpuT.toFixed(1)}°C (Limit: ${thresholds.gpuCore.alert}°C)`);
    if (isHotspotHot) alerts.push(`GPU Hotspot reached ${hsT.toFixed(1)}°C (Limit: ${thresholds.gpuHotspot.alert}°C)`);
    elements.alertTitle.textContent = 'High Thermal Warning';
    elements.alertDesc.textContent = alerts.join(' • ');
  } else {
    elements.alertBanner.classList.add('hidden');
  }

  // Push new live point to charts
  appendLivePoint(t);
}

// Fetch historical records for charts
async function loadHistory(range) {
  try {
    const res = await fetch(`/api/history?range=${range}`);
    if (res.ok) {
      const data = await res.json();
      updateChartsWithHistory(data.data || []);
    }
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

// Range Buttons Handling
function setupRangeButtons() {
  const buttons = document.querySelectorAll('.range-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.getAttribute('data-range');
      loadHistory(currentRange);
    });
  });
}

// Establish Server-Sent Events (SSE) stream
function setupEventStream() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/stream');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      updateTelemetryUI(data);
    } catch (e) {
      console.error('Error parsing SSE data', e);
    }
  };

  eventSource.onerror = () => {
    // If SSE drops, fallback to HTTP polling
    console.warn('SSE stream disconnected. Retrying in 5s...');
    if (elements.connBadge) {
      elements.connBadge.className = 'connection-badge offline';
      elements.connStatusText.textContent = 'RECONNECTING...';
    }
    setTimeout(setupEventStream, 5000);
  };
}

// Fallback polling if SSE is blocked in certain browser environments
async function pollOnce() {
  try {
    const res = await fetch('/api/current');
    if (res.ok) {
      const data = await res.json();
      updateTelemetryUI(data);
    }
  } catch (e) {
    // Ignore transient errors
  }
}

// App Initialization
window.addEventListener('DOMContentLoaded', async () => {
  initCharts();
  setupRangeButtons();
  
  // Load initial history
  await loadHistory(currentRange);

  // Connect SSE
  setupEventStream();

  // Initial immediate fetch
  pollOnce();
});
