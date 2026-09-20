const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseLhmTree, parseNumber } = require('../src/parser.js');

console.log('--- Running Parser Unit Tests ---');

// Test 1: parseNumber handles units and localized numbers
assert.strictEqual(parseNumber('54.2 °C'), 54.2);
assert.strictEqual(parseNumber('54,2 °C'), 54.2);
assert.strictEqual(parseNumber('1250 RPM'), 1250);
assert.strictEqual(parseNumber('45.0 %'), 45.0);
assert.strictEqual(parseNumber('112.4 W'), 112.4);
assert.strictEqual(parseNumber(null), null);
console.log('✓ parseNumber handles all unit formats');

// Test 2: Parse mock tree fixture
const mockTreePath = path.join(__dirname, 'mock-data.json');
const mockTree = JSON.parse(fs.readFileSync(mockTreePath, 'utf8'));

const metrics = parseLhmTree(mockTree);

// Verify CPU
assert.strictEqual(metrics.cpu.name, 'Intel Core i5-12600K');
assert.strictEqual(metrics.cpu.packageTemp, 54.0);
assert.strictEqual(metrics.cpu.maxCoreTemp, 52.0);
assert.strictEqual(metrics.cpu.loadTotal, 24.6);
assert.strictEqual(metrics.cpu.power, 48.5);
assert.strictEqual(metrics.cpu.cores.length, 4);
console.log('✓ CPU metrics correctly extracted:', metrics.cpu);

// Verify GPU
assert.strictEqual(metrics.gpu.name, 'NVIDIA GeForce RTX 3060');
assert.strictEqual(metrics.gpu.coreTemp, 51.5);
assert.strictEqual(metrics.gpu.hotspotTemp, 60.2);
assert.strictEqual(metrics.gpu.fan1Rpm, 1150);
assert.strictEqual(metrics.gpu.fan2Rpm, 1140);
assert.strictEqual(metrics.gpu.fanPercent, 40.0);
assert.strictEqual(metrics.gpu.coreLoad, 38.2);
assert.strictEqual(metrics.gpu.power, 112.4);
console.log('✓ GPU metrics correctly extracted:', metrics.gpu);

// Verify Fans
assert.strictEqual(metrics.fans.cpuFanRpm, 1050);
assert.strictEqual(metrics.fans.caseIntakeRpm, 880);
assert.strictEqual(metrics.fans.caseExhaustRpm, 910);
assert.strictEqual(metrics.fans.motherboardTemp, 34.0);
console.log('✓ Motherboard/Fan metrics correctly extracted:', metrics.fans);

console.log('\nAll parser tests PASSED successfully!');
