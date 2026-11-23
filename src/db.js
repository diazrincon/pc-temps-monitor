/**
 * SQLite Database Store for PC Telemetry & Benchmark Studies
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
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
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

  CREATE TABLE IF NOT EXISTS benchmark_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    duration_type TEXT NOT NULL,
    target_seconds INTEGER,
    start_time TEXT NOT NULL,
    end_time TEXT,
    status TEXT NOT NULL,
    summary_json TEXT
  );

  CREATE TABLE IF NOT EXISTS session_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
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
    mobo_temp REAL,
    FOREIGN KEY (session_id) REFERENCES benchmark_sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_session_samples_session ON session_samples(session_id);
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
 * Supported history ranges: window length and bucket size (downsampling).
 * Bucket sizes keep every range at <= ~300 points.
 */
const HISTORY_RANGES = {
  '15m': { windowSeconds: 15 * 60, bucketSeconds: 5 },
  '1h': { windowSeconds: 60 * 60, bucketSeconds: 15 },
  '6h': { windowSeconds: 6 * 60 * 60, bucketSeconds: 60 },
  '24h': { windowSeconds: 24 * 60 * 60, bucketSeconds: 300 }
};

// Timestamps are stored as ISO-8601 strings (`2026-01-01T12:00:00.000Z`).
// Cutoffs MUST use the same format so lexicographic comparison is correct
// (SQLite's `datetime()` returns `2026-01-01 12:00:00`, and 'T' > ' ').
const ISO_NOW_OFFSET = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)";

const historyStmt = db.prepare(`
  SELECT
    (CAST(strftime('%s', timestamp) AS INTEGER) / CAST(:bucket AS INTEGER)) * CAST(:bucket AS INTEGER) * 1000 AS ts,
    count(*) AS n,
    round(avg(cpu_temp), 1) AS cpu_temp,
    round(avg(cpu_load), 1) AS cpu_load,
    round(avg(gpu_core_temp), 1) AS gpu_core_temp,
    round(avg(gpu_hotspot_temp), 1) AS gpu_hotspot_temp,
    round(avg(gpu_fan1_rpm)) AS gpu_fan1_rpm,
    round(avg(cpu_fan_rpm)) AS cpu_fan_rpm,
    round(avg(case_intake_rpm)) AS case_intake_rpm,
    round(avg(case_exhaust_rpm)) AS case_exhaust_rpm
  FROM metrics
  WHERE timestamp >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', :offset)
  GROUP BY ts
  ORDER BY ts ASC
`);

/**
 * Fetch downsampled time-series history for a range.
 * Each row has `ts` (bucket start, epoch ms) and `n` (samples in bucket).
 * @param {'15m' | '1h' | '6h' | '24h'} range
 */
function getHistory(range = '1h') {
  const cfg = HISTORY_RANGES[range] || HISTORY_RANGES['1h'];
  const data = historyStmt.all({
    bucket: cfg.bucketSeconds,
    offset: `-${cfg.windowSeconds} seconds`
  });
  return { ...cfg, data };
}

/**
 * Remove records older than retentionHours
 */
function cleanupOldRecords(retentionHours = 24) {
  return db.prepare(`DELETE FROM metrics WHERE timestamp < ${ISO_NOW_OFFSET}`)
    .run(`-${Number(retentionHours)} hours`);
}

// --- BENCHMARK SESSIONS & SAMPLES ---

const insertSessionStmt = db.prepare(`
  INSERT INTO benchmark_sessions (
    id, title, duration_type, target_seconds, start_time, status, summary_json
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?
  )
`);

function createBenchmarkSession({ id, title, durationType, targetSeconds, startTime }) {
  insertSessionStmt.run(
    id,
    title,
    durationType,
    targetSeconds,
    startTime,
    'recording',
    null
  );
  return { id, title, durationType, targetSeconds, startTime, status: 'recording' };
}

const insertSessionSampleStmt = db.prepare(`
  INSERT INTO session_samples (
    session_id, timestamp, cpu_temp, cpu_load, cpu_power,
    gpu_core_temp, gpu_hotspot_temp, gpu_fan1_rpm, gpu_fan2_rpm, gpu_fan_pct,
    gpu_load, gpu_power, cpu_fan_rpm, case_intake_rpm, case_exhaust_rpm, mobo_temp
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?
  )
`);

function addSessionSample(sessionId, m) {
  insertSessionSampleStmt.run(
    sessionId,
    m.timestamp,
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

function finishBenchmarkSession(id, endTime, status, summaryJson) {
  db.prepare(`
    UPDATE benchmark_sessions
    SET end_time = ?, status = ?, summary_json = ?
    WHERE id = ?
  `).run(endTime, status, summaryJson, id);
}

function getBenchmarkSession(id) {
  const session = db.prepare('SELECT * FROM benchmark_sessions WHERE id = ?').get(id);
  if (!session) return null;
  const samples = db.prepare('SELECT * FROM session_samples WHERE session_id = ? ORDER BY id ASC').all(id);
  return {
    ...session,
    summary: session.summary_json ? JSON.parse(session.summary_json) : null,
    samples
  };
}

function listBenchmarkSessions() {
  const rows = db.prepare(`
    SELECT id, title, duration_type, target_seconds, start_time, end_time, status, summary_json
    FROM benchmark_sessions
    ORDER BY start_time DESC
  `).all();
  return rows.map(r => ({
    ...r,
    summary: r.summary_json ? JSON.parse(r.summary_json) : null
  }));
}

function deleteBenchmarkSession(id) {
  db.prepare('DELETE FROM session_samples WHERE session_id = ?').run(id);
  const res = db.prepare('DELETE FROM benchmark_sessions WHERE id = ?').run(id);
  return res;
}

function getActiveBenchmarkSession() {
  const row = db.prepare(`SELECT * FROM benchmark_sessions WHERE status = 'recording' ORDER BY start_time DESC LIMIT 1`).get();
  if (!row) return null;
  const samples = db.prepare('SELECT * FROM session_samples WHERE session_id = ? ORDER BY id ASC').all(row.id);
  return {
    ...row,
    summary: row.summary_json ? JSON.parse(row.summary_json) : null,
    samples
  };
}

module.exports = {
  db,
  insertMetric,
  getLatestMetric,
  HISTORY_RANGES,
  getHistory,
  cleanupOldRecords,
  createBenchmarkSession,
  addSessionSample,
  finishBenchmarkSession,
  getBenchmarkSession,
  getActiveBenchmarkSession,
  listBenchmarkSessions,
  deleteBenchmarkSession
};
