/**
 * SQLite Database Store for PC Telemetry
 * Built using Node.js 24 native node:sqlite with WAL mode.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'metrics.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrent read/write
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    is_mock INTEGER NOT NULL,
    cpu_temp REAL,
    cpu_load REAL,
    cpu_power REAL,
    gpu_core_temp REAL,
    gpu_hotspot_temp REAL,
    gpu_fan1_rpm INTEGER,
    gpu_fan2_rpm INTEGER,
    gpu_fan_pct REAL,
    gpu_load REAL,
    gpu_power REAL,
    cpu_fan_rpm INTEGER,
    case_intake_rpm INTEGER,
    case_exhaust_rpm INTEGER,
    mobo_temp REAL
  );

  CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
`);

const insertStmt = db.prepare(`
  INSERT INTO metrics (
    timestamp, is_mock, cpu_temp, cpu_load, cpu_power,
    gpu_core_temp, gpu_hotspot_temp, gpu_fan1_rpm, gpu_fan2_rpm, gpu_fan_pct,
    gpu_load, gpu_power, cpu_fan_rpm, case_intake_rpm, case_exhaust_rpm, mobo_temp
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?
  )
`);

function insertMetric(m) {
  insertStmt.run(
    m.timestamp,
    m.isMock ? 1 : 0,
    m.cpu.packageTemp ?? null,
    m.cpu.loadTotal ?? null,
    m.cpu.power ?? null,
    m.gpu.coreTemp ?? null,
    m.gpu.hotspotTemp ?? null,
    m.gpu.fan1Rpm ?? null,
    m.gpu.fan2Rpm ?? null,
    m.gpu.fanPercent ?? null,
    m.gpu.coreLoad ?? null,
    m.gpu.power ?? null,
    m.fans.cpuFanRpm ?? null,
    m.fans.caseIntakeRpm ?? null,
    m.fans.caseExhaustRpm ?? null,
    m.fans.motherboardTemp ?? null
  );
}

function getLatestMetric() {
  const row = db.prepare('SELECT * FROM metrics ORDER BY id DESC LIMIT 1').get();
  return row || null;
}

/**
 * Fetch time-series historical data with downsampling based on range
 * @param {'15m' | '1h' | '6h' | '24h'} range 
 */
function getHistory(range = '1h') {
  let timeModifier = '-1 hour';
  let sampleInterval = 1; // sample every N rows or group by time

  switch (range) {
    case '15m':
      timeModifier = '-15 minutes';
      // Raw or very light downsampling
      return db.prepare(`
        SELECT timestamp, is_mock, cpu_temp, cpu_load, gpu_core_temp, gpu_hotspot_temp,
               gpu_fan1_rpm, cpu_fan_rpm, case_intake_rpm, case_exhaust_rpm
        FROM metrics
        WHERE timestamp >= datetime('now', '${timeModifier}')
        ORDER BY id ASC
      `).all();

    case '1h':
      timeModifier = '-1 hour';
      // Group by 15-second slices
      return db.prepare(`
        SELECT 
          strftime('%Y-%m-%dT%H:%M:', timestamp) || 
          substr('00' || (cast(strftime('%S', timestamp) as integer) / 15 * 15), -2, 2) || 'Z' as timestamp,
          max(is_mock) as is_mock,
          round(avg(cpu_temp), 1) as cpu_temp,
          round(avg(cpu_load), 1) as cpu_load,
          round(avg(gpu_core_temp), 1) as gpu_core_temp,
          round(avg(gpu_hotspot_temp), 1) as gpu_hotspot_temp,
          round(avg(gpu_fan1_rpm)) as gpu_fan1_rpm,
          round(avg(cpu_fan_rpm)) as cpu_fan_rpm,
          round(avg(case_intake_rpm)) as case_intake_rpm,
          round(avg(case_exhaust_rpm)) as case_exhaust_rpm
        FROM metrics
        WHERE timestamp >= datetime('now', '${timeModifier}')
        GROUP BY 1
        ORDER BY 1 ASC
      `).all();

    case '6h':
      timeModifier = '-6 hours';
      // Group by 1-minute slices
      return db.prepare(`
        SELECT 
          strftime('%Y-%m-%dT%H:%M:00Z', timestamp) as timestamp,
          max(is_mock) as is_mock,
          round(avg(cpu_temp), 1) as cpu_temp,
          round(avg(cpu_load), 1) as cpu_load,
          round(avg(gpu_core_temp), 1) as gpu_core_temp,
          round(avg(gpu_hotspot_temp), 1) as gpu_hotspot_temp,
          round(avg(gpu_fan1_rpm)) as gpu_fan1_rpm,
          round(avg(cpu_fan_rpm)) as cpu_fan_rpm,
          round(avg(case_intake_rpm)) as case_intake_rpm,
          round(avg(case_exhaust_rpm)) as case_exhaust_rpm
        FROM metrics
        WHERE timestamp >= datetime('now', '${timeModifier}')
        GROUP BY 1
        ORDER BY 1 ASC
      `).all();

    case '24h':
      timeModifier = '-24 hours';
      // Group by 5-minute slices
      return db.prepare(`
        SELECT 
          strftime('%Y-%m-%dT%H:', timestamp) || 
          substr('00' || (cast(strftime('%M', timestamp) as integer) / 5 * 5), -2, 2) || ':00Z' as timestamp,
          max(is_mock) as is_mock,
          round(avg(cpu_temp), 1) as cpu_temp,
          round(avg(cpu_load), 1) as cpu_load,
          round(avg(gpu_core_temp), 1) as gpu_core_temp,
          round(avg(gpu_hotspot_temp), 1) as gpu_hotspot_temp,
          round(avg(gpu_fan1_rpm)) as gpu_fan1_rpm,
          round(avg(cpu_fan_rpm)) as cpu_fan_rpm,
          round(avg(case_intake_rpm)) as case_intake_rpm,
          round(avg(case_exhaust_rpm)) as case_exhaust_rpm
        FROM metrics
        WHERE timestamp >= datetime('now', '${timeModifier}')
        GROUP BY 1
        ORDER BY 1 ASC
      `).all();

    default:
      return getHistory('1h');
  }
}

/**
 * Remove records older than retentionHours
 */
function cleanupOldRecords(retentionHours = 24) {
  const result = db.prepare(`
    DELETE FROM metrics WHERE timestamp < datetime('now', '-' || ? || ' hours')
  `).run(retentionHours);
  return result;
}

module.exports = {
  db,
  insertMetric,
  getLatestMetric,
  getHistory,
  cleanupOldRecords
};
