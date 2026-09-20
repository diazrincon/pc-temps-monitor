/**
 * Realistic Mock Telemetry Generator
 * Used as a fallback when LibreHardwareMonitor is offline or starting up.
 */

let baseLoad = 20;
let baseCpuTemp = 52.0;
let baseGpuTemp = 48.0;
let cycle = 0;

function getMockTelemetry() {
  cycle = (cycle + 1) % 100;
  // Create natural sinusoidal oscillation with random jitter
  const wave = Math.sin(cycle * 0.1);
  const jitter = (Math.random() - 0.5) * 1.5;

  const cpuLoad = Math.min(95, Math.max(8, Math.round((baseLoad + wave * 15 + Math.random() * 8) * 10) / 10));
  const cpuTemp = Math.min(88, Math.max(38, Math.round((baseCpuTemp + wave * 8 + (cpuLoad * 0.15) + jitter) * 10) / 10));
  const maxCoreTemp = Math.round((cpuTemp - 2 + Math.random() * 2) * 10) / 10;

  const gpuLoad = Math.min(99, Math.max(2, Math.round((baseLoad * 1.2 + wave * 22 + Math.random() * 10) * 10) / 10));
  const gpuTemp = Math.min(84, Math.max(40, Math.round((baseGpuTemp + wave * 9 + (gpuLoad * 0.18) + jitter) * 10) / 10));
  const gpuHotspot = Math.round((gpuTemp + 9.5 + Math.random() * 2.5) * 10) / 10;

  // GPU 0dB Fan Stop threshold (< 48°C)
  let gpuFanRpm = 0;
  let gpuFanPct = 0;
  if (gpuTemp >= 48) {
    gpuFanPct = Math.min(100, Math.round(35 + (gpuTemp - 48) * 2.5));
    gpuFanRpm = Math.round(900 + (gpuFanPct / 100) * 1100);
  }

  // CPU cooler fan curve (be quiet! Pure Rock Pro 3)
  const cpuFanRpm = Math.round(750 + (cpuTemp / 90) * 750);

  // Case fans (120mm intake & exhaust)
  const caseIntakeRpm = Math.round(700 + (cpuLoad * 0.4 + gpuLoad * 0.4) * 5);
  const caseExhaustRpm = Math.round(caseIntakeRpm * 1.05);

  return {
    timestamp: new Date().toISOString(),
    isMock: true,
    cpu: {
      name: 'Intel Core i5 / be quiet! Pure Rock Pro 3',
      packageTemp: cpuTemp,
      maxCoreTemp: maxCoreTemp,
      loadTotal: cpuLoad,
      power: Math.round((35 + (cpuLoad * 0.75)) * 10) / 10,
      cores: [
        { name: 'Core #1', temp: Math.round((cpuTemp - 1) * 10) / 10 },
        { name: 'Core #2', temp: Math.round((cpuTemp + 1) * 10) / 10 },
        { name: 'Core #3', temp: Math.round((cpuTemp - 0.5) * 10) / 10 },
        { name: 'Core #4', temp: Math.round((cpuTemp + 0.5) * 10) / 10 }
      ]
    },
    gpu: {
      name: 'NVIDIA GeForce RTX 3060 (Zotac Ventus)',
      coreTemp: gpuTemp,
      hotspotTemp: gpuHotspot,
      fan1Rpm: gpuFanRpm,
      fan2Rpm: gpuFanRpm > 0 ? gpuFanRpm - 15 : 0,
      fanPercent: gpuFanPct,
      coreLoad: gpuLoad,
      memoryLoad: Math.round((gpuLoad * 0.7) * 10) / 10,
      power: Math.round((45 + (gpuLoad * 1.25)) * 10) / 10
    },
    fans: {
      cpuFanRpm,
      caseIntakeRpm,
      caseExhaustRpm,
      motherboardTemp: 33.5,
      allFans: [
        { name: 'CPU Fan (Pure Rock Pro 3)', rpm: cpuFanRpm },
        { name: 'Fan #1 (120mm Intake)', rpm: caseIntakeRpm },
        { name: 'Fan #2 (120mm Exhaust)', rpm: caseExhaustRpm }
      ]
    }
  };
}

module.exports = {
  getMockTelemetry
};
