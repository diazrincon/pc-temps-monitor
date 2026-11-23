/**
 * Interactive Chart.js setup for Telemetry Timelines.
 *
 * The x axis is a real time axis (epoch ms on a linear scale) whose window is
 * always [now - range, now]. History arrives pre-aggregated in buckets from the
 * server; live samples are folded into the same bucket size client-side, so
 * every range keeps a consistent resolution. Gaps (LHM offline, PC off) are
 * rendered as breaks in the line instead of being compressed away.
 */

let chartTemps = null;
let chartFans = null;

// Current view state, set by setChartHistory()
const chartView = {
  windowMs: 60 * 60 * 1000,
  bucketMs: 15 * 1000,
  tickStepMs: 10 * 60 * 1000
};

// Tick spacing per window length
const TICK_STEPS = {
  [15 * 60]: 2 * 60 * 1000,
  [60 * 60]: 10 * 60 * 1000,
  [6 * 60 * 60]: 60 * 60 * 1000,
  [24 * 60 * 60]: 3 * 60 * 60 * 1000
};

// A gap longer than this many buckets breaks the line
const GAP_FACTOR = 3;

// Field extractors: history row -> value, live telemetry -> value
const TEMP_SERIES = [
  { row: r => r.cpu_temp, live: t => t.cpu.packageTemp },
  { row: r => r.gpu_core_temp, live: t => t.gpu.coreTemp },
  { row: r => r.gpu_hotspot_temp, live: t => t.gpu.hotspotTemp }
];
const FAN_SERIES = [
  { row: r => r.cpu_fan_rpm, live: t => t.fans.cpuFanRpm },
  { row: r => r.gpu_fan1_rpm, live: t => t.gpu.fan1Rpm },
  { row: r => r.case_intake_rpm, live: t => t.fans.caseIntakeRpm },
  { row: r => r.case_exhaust_rpm, live: t => t.fans.caseExhaustRpm }
];

function createGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

function formatTick(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTooltipTitle(items) {
  if (!items.length) return '';
  const d = new Date(items[0].parsed.x);
  const opts = chartView.bucketMs >= 60 * 1000
    ? { hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString([], opts);
}

function initCharts() {
  const ctxTemps = document.getElementById('chart-temps');
  const ctxFans = document.getElementById('chart-fans');

  if (!ctxTemps || !ctxFans) return;

  const cTemps = ctxTemps.getContext('2d');
  const cFans = ctxFans.getContext('2d');

  const xScale = () => ({
    type: 'linear',
    bounds: 'ticks',
    grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
    ticks: {
      color: '#64748b',
      font: { family: 'JetBrains Mono', size: 10 },
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: 8,
      stepSize: chartView.tickStepMs,
      callback: (v) => formatTick(v)
    }
  });

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    normalized: true,
    spanGaps: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 20, 32, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        titleFont: { family: 'Outfit', size: 12, weight: '600' },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        callbacks: { title: formatTooltipTitle }
      }
    }
  };

  const yScale = (extra) => ({
    grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
    ...extra,
    ticks: {
      color: '#64748b',
      font: { family: 'JetBrains Mono', size: 10 },
      ...extra.ticks
    }
  });

  // 1. Temperatures Chart
  chartTemps = new Chart(cTemps, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'CPU Package',
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: createGradient(cTemps, 'rgba(56, 189, 248, 0.25)', 'rgba(56, 189, 248, 0.0)'),
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'GPU Core',
          data: [],
          borderColor: '#a855f7',
          backgroundColor: createGradient(cTemps, 'rgba(168, 85, 247, 0.25)', 'rgba(168, 85, 247, 0.0)'),
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'GPU Hot Spot',
          data: [],
          borderColor: '#f43f5e',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 4],
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        x: xScale(),
        y: yScale({ min: 30, suggestedMax: 90, ticks: { callback: (v) => `${v}°C` } })
      }
    }
  });

  // 2. Fans Speeds Chart
  const fanDataset = (label, color) => ({
    label,
    data: [],
    borderColor: color,
    borderWidth: 1.8,
    fill: false,
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 4
  });

  chartFans = new Chart(cFans, {
    type: 'line',
    data: {
      datasets: [
        fanDataset('CPU Fan', '#38bdf8'),
        fanDataset('GPU Fan', '#a855f7'),
        fanDataset('Case Intake', '#10b981'),
        fanDataset('Case Exhaust', '#fbbf24')
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        x: xScale(),
        y: yScale({ min: 0, suggestedMax: 2000, ticks: { callback: (v) => `${v} RPM` } })
      }
    }
  });

  // Keep the window sliding even when no samples arrive (e.g. LHM offline)
  setInterval(() => refreshChartWindow(), 5000);
}

/**
 * Per-chart bookkeeping: for every point we keep how many samples were
 * averaged into it (per dataset), so live samples can be folded in.
 */
function resetSeries(chart, series, rows, bucketMs) {
  chart.$counts = [];
  chart.data.datasets.forEach(ds => { ds.data = []; });

  let prevTs = null;
  for (const r of rows) {
    if (prevTs !== null && r.ts - prevTs > bucketMs * GAP_FACTOR) {
      pushGap(chart, prevTs + bucketMs);
    }
    chart.data.datasets.forEach((ds, i) => {
      const v = series[i].row(r);
      ds.data.push({ x: r.ts, y: v ?? null });
    });
    chart.$counts.push(series.map(s => (s.row(r) == null ? 0 : (r.n || 1))));
    prevTs = r.ts;
  }
}

function pushGap(chart, x) {
  chart.data.datasets.forEach(ds => ds.data.push({ x, y: null }));
  chart.$counts.push(chart.data.datasets.map(() => 0));
}

function foldSample(chart, series, telemetry, bucketMs) {
  const ts = new Date(telemetry.timestamp).getTime();
  if (!Number.isFinite(ts)) return;
  const bucket = Math.floor(ts / bucketMs) * bucketMs;
  const first = chart.data.datasets[0].data;
  const last = first.length ? first[first.length - 1] : null;

  if (last && last.x === bucket) {
    // Same bucket: update running average
    const counts = chart.$counts[chart.$counts.length - 1];
    chart.data.datasets.forEach((ds, i) => {
      const v = series[i].live(telemetry);
      if (v == null) return;
      const p = ds.data[ds.data.length - 1];
      const n = counts[i];
      p.y = n > 0 ? Math.round(((p.y * n + v) / (n + 1)) * 10) / 10 : v;
      counts[i] = n + 1;
    });
    return;
  }

  if (last && bucket < last.x) return; // stale/out-of-order sample

  if (last && bucket - last.x > bucketMs * GAP_FACTOR) {
    pushGap(chart, last.x + bucketMs);
  }

  chart.data.datasets.forEach((ds, i) => {
    const v = series[i].live(telemetry);
    ds.data.push({ x: bucket, y: v ?? null });
  });
  chart.$counts.push(series.map(s => (s.live(telemetry) == null ? 0 : 1)));
}

function trimAndScale(chart, now) {
  const min = now - chartView.windowMs;
  const data0 = chart.data.datasets[0].data;
  let drop = 0;
  while (drop < data0.length && data0[drop].x < min) drop++;
  if (drop > 0) {
    chart.data.datasets.forEach(ds => ds.data.splice(0, drop));
    chart.$counts.splice(0, drop);
  }
  const x = chart.options.scales.x;
  x.min = min;
  x.max = now;
  x.ticks.stepSize = chartView.tickStepMs;
  chart.update('none');
}

function refreshChartWindow() {
  if (!chartTemps || !chartFans) return;
  const now = Date.now();
  trimAndScale(chartTemps, now);
  trimAndScale(chartFans, now);
}

/**
 * Replace chart contents with a server history payload
 * ({ windowSeconds, bucketSeconds, data: [{ ts, n, ... }] }).
 */
function setChartHistory(history) {
  if (!chartTemps || !chartFans) return;

  chartView.windowMs = history.windowSeconds * 1000;
  chartView.bucketMs = history.bucketSeconds * 1000;
  chartView.tickStepMs = TICK_STEPS[history.windowSeconds] || chartView.windowMs / 6;

  const rows = history.data || [];
  resetSeries(chartTemps, TEMP_SERIES, rows, chartView.bucketMs);
  resetSeries(chartFans, FAN_SERIES, rows, chartView.bucketMs);
  refreshChartWindow();
}

function appendLivePoint(telemetry) {
  if (!chartTemps || !chartFans || !telemetry) return;
  foldSample(chartTemps, TEMP_SERIES, telemetry, chartView.bucketMs);
  foldSample(chartFans, FAN_SERIES, telemetry, chartView.bucketMs);
  refreshChartWindow();
}
