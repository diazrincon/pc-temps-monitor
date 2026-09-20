/**
 * Interactive Chart.js setup for Telemetry Timelines
 */

let chartTemps = null;
let chartFans = null;

function createGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

function formatTimeLabel(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return isoString;
  }
}

function initCharts() {
  const ctxTemps = document.getElementById('chart-temps');
  const ctxFans = document.getElementById('chart-fans');

  if (!ctxTemps || !ctxFans) return;

  const cTemps = ctxTemps.getContext('2d');
  const cFans = ctxFans.getContext('2d');

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
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
        bodyFont: { family: 'JetBrains Mono', size: 11 }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
          drawBorder: false
        },
        ticks: {
          color: '#64748b',
          font: { family: 'JetBrains Mono', size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
          drawBorder: false
        },
        ticks: {
          color: '#64748b',
          font: { family: 'JetBrains Mono', size: 10 }
        }
      }
    }
  };

  // 1. Temperatures Chart
  chartTemps = new Chart(cTemps, {
    type: 'line',
    data: {
      labels: [],
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
        ...commonOptions.scales,
        y: {
          ...commonOptions.scales.y,
          min: 30,
          suggestedMax: 90,
          ticks: {
            ...commonOptions.scales.y.ticks,
            callback: (v) => `${v}°C`
          }
        }
      }
    }
  });

  // 2. Fans Speeds Chart
  chartFans = new Chart(cFans, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'CPU Fan',
          data: [],
          borderColor: '#38bdf8',
          borderWidth: 1.8,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        },
        {
          label: 'GPU Fan',
          data: [],
          borderColor: '#a855f7',
          borderWidth: 1.8,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        },
        {
          label: 'Case Intake',
          data: [],
          borderColor: '#10b981',
          borderWidth: 1.8,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        },
        {
          label: 'Case Exhaust',
          data: [],
          borderColor: '#fbbf24',
          borderWidth: 1.8,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: {
          ...commonOptions.scales.y,
          min: 0,
          suggestedMax: 2000,
          ticks: {
            ...commonOptions.scales.y.ticks,
            callback: (v) => `${v} RPM`
          }
        }
      }
    }
  });
}

function updateChartsWithHistory(historyRecords) {
  if (!chartTemps || !chartFans) return;

  const labels = historyRecords.map(r => formatTimeLabel(r.timestamp));
  const cpuTemps = historyRecords.map(r => r.cpu_temp);
  const gpuCoreTemps = historyRecords.map(r => r.gpu_core_temp);
  const gpuHotspotTemps = historyRecords.map(r => r.gpu_hotspot_temp);

  const cpuFans = historyRecords.map(r => r.cpu_fan_rpm);
  const gpuFans = historyRecords.map(r => r.gpu_fan1_rpm);
  const intakeFans = historyRecords.map(r => r.case_intake_rpm);
  const exhaustFans = historyRecords.map(r => r.case_exhaust_rpm);

  chartTemps.data.labels = labels;
  chartTemps.data.datasets[0].data = cpuTemps;
  chartTemps.data.datasets[1].data = gpuCoreTemps;
  chartTemps.data.datasets[2].data = gpuHotspotTemps;
  chartTemps.update('none');

  chartFans.data.labels = labels;
  chartFans.data.datasets[0].data = cpuFans;
  chartFans.data.datasets[1].data = gpuFans;
  chartFans.data.datasets[2].data = intakeFans;
  chartFans.data.datasets[3].data = exhaustFans;
  chartFans.update('none');
}

function appendLivePoint(telemetry) {
  if (!chartTemps || !chartFans) return;

  const timeLabel = formatTimeLabel(telemetry.timestamp);

  // Keep a maximum of 120 points on live scroll
  const maxPoints = 120;

  function pushAndShift(chart, label, datasetValues) {
    chart.data.labels.push(label);
    datasetValues.forEach((val, i) => {
      chart.data.datasets[i].data.push(val);
    });

    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(ds => ds.data.shift());
    }
    chart.update('none');
  }

  pushAndShift(chartTemps, timeLabel, [
    telemetry.cpu.packageTemp,
    telemetry.gpu.coreTemp,
    telemetry.gpu.hotspotTemp
  ]);

  pushAndShift(chartFans, timeLabel, [
    telemetry.fans.cpuFanRpm,
    telemetry.gpu.fan1Rpm,
    telemetry.fans.caseIntakeRpm,
    telemetry.fans.caseExhaustRpm
  ]);
}
