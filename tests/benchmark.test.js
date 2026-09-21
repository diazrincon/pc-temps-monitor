const assert = require('node:assert');
const { calculatePercentile, computeSeriesStats, summarizeBenchmark, generateLlmPrompt } = require('../src/benchmark.js');

console.log('--- Running Benchmark Unit Tests ---');

// Test 1: calculatePercentile
const nums = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const p95 = calculatePercentile(nums, 95);
assert.ok(p95 >= 90 && p95 <= 100, `P95 was ${p95}`);
console.log('✓ calculatePercentile works properly:', p95);

// Test 2: computeSeriesStats
const stats = computeSeriesStats([50, 60, 70, 80]);
assert.strictEqual(stats.min, 50);
assert.strictEqual(stats.max, 80);
assert.strictEqual(stats.avg, 65);
console.log('✓ computeSeriesStats works properly:', stats);

// Test 3: summarizeBenchmark
const fakeSession = {
  id: 'study_test_1',
  title: 'Test Cyberpunk Benchmark',
  duration_type: '10m',
  target_seconds: 600,
  start_time: new Date(Date.now() - 600000).toISOString(),
  end_time: new Date().toISOString()
};

const fakeSamples = [
  { cpu_temp: 55, cpu_load: 30, cpu_power: 50, cpu_fan_rpm: 800, gpu_core_temp: 50, gpu_hotspot_temp: 61, gpu_load: 40, gpu_power: 100, gpu_fan1_rpm: 0, case_intake_rpm: 1200, case_exhaust_rpm: 1250, mobo_temp: 40 },
  { cpu_temp: 65, cpu_load: 60, cpu_power: 75, cpu_fan_rpm: 950, gpu_core_temp: 62, gpu_hotspot_temp: 74, gpu_load: 85, gpu_power: 150, gpu_fan1_rpm: 1200, case_intake_rpm: 1400, case_exhaust_rpm: 1450, mobo_temp: 43 },
  { cpu_temp: 72, cpu_load: 80, cpu_power: 90, cpu_fan_rpm: 1100, gpu_core_temp: 68, gpu_hotspot_temp: 80, gpu_load: 99, gpu_power: 170, gpu_fan1_rpm: 1500, case_intake_rpm: 1500, case_exhaust_rpm: 1550, mobo_temp: 45 }
];

const summary = summarizeBenchmark(fakeSession, fakeSamples);
assert.strictEqual(summary.sampleCount, 3);
assert.strictEqual(summary.cpu.temp.max, 72);
assert.strictEqual(summary.gpu.coreTemp.max, 68);
assert.strictEqual(summary.gpu.hotspotTemp.max, 80);
assert.strictEqual(summary.incidents.totalThrottleEvents, 0);
assert.ok(summary.grade === 'A+' || summary.grade === 'A');
assert.ok(summary.fans.acoustics);
assert.strictEqual(summary.fans.acoustics.cpuFan.tag, 'MODERADO');
assert.ok(summary.fans.acoustics.airflowBalance);
console.log('✓ summarizeBenchmark computed KPIs & Acoustics properly. Grade:', summary.grade);

// Test 4: generateLlmPrompt
const prompt = generateLlmPrompt(fakeSession, summary, {
  cpu: '11th Gen Intel Core i5-11400',
  cpuCooler: 'be quiet! Pure Rock Pro 3 Black',
  gpu: 'NVIDIA GeForce RTX 3060'
});

assert.ok(prompt.includes('Pure Rock Pro 3'));
assert.ok(prompt.includes('RTX 3060'));
assert.ok(prompt.includes('Prompt de Consulta para el LLM'));
console.log('✓ generateLlmPrompt generates markdown prompt properly');

console.log('\nAll benchmark unit tests PASSED successfully!');
