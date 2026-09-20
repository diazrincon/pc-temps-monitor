/**
 * Collector service: polls LibreHardwareMonitor, parses telemetry,
 * persists to SQLite, and emits events to active dashboard clients.
 */

const EventEmitter = require('node:events');
const { parseLhmTree } = require('./parser.js');
const { getMockTelemetry } = require('./mock.js');
const { insertMetric, cleanupOldRecords } = require('./db.js');

class TelemetryCollector extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.timer = null;
    this.cleanupTimer = null;
    this.current = null;
    this.isLive = false;
    this.lastSuccessfulPoll = null;
  }

  async poll() {
    let telemetry = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.lhm.timeoutMs || 3500);

      const response = await fetch(this.config.lhm.url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (response.ok) {
        const tree = await response.json();
        telemetry = parseLhmTree(tree);
        telemetry.isMock = false;
        
        if (!this.isLive) {
          console.log(`[Collector] [LIVE] Connected to LibreHardwareMonitor at ${this.config.lhm.url}`);
          this.isLive = true;
        }
        this.lastSuccessfulPoll = new Date();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      if (this.isLive) {
        console.warn(`[Collector] [FALLBACK] Lost connection to LHM (${err.message}). Using simulated telemetry.`);
        this.isLive = false;
      }
      telemetry = getMockTelemetry();
    }

    // Save in database
    try {
      insertMetric(telemetry);
    } catch (dbErr) {
      console.error('[Collector] Error saving metric to SQLite:', dbErr.message);
    }

    this.current = telemetry;
    this.emit('telemetry', telemetry);
    return telemetry;
  }

  start() {
    if (this.timer) return;
    const intervalMs = this.config.lhm.pollIntervalMs || 5000;
    console.log(`[Collector] Starting telemetry collector (polling every ${intervalMs}ms)...`);
    
    // Initial immediate poll
    this.poll();

    this.timer = setInterval(() => {
      this.poll();
    }, intervalMs);

    // Periodic database retention cleanup
    const cleanupMs = (this.config.retention.cleanupIntervalMinutes || 60) * 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      try {
        const hours = this.config.retention.rawRetentionHours || 24;
        cleanupOldRecords(hours);
      } catch (err) {
        console.error('[Collector] Error running database cleanup:', err.message);
      }
    }, cleanupMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getCurrent() {
    return this.current || getMockTelemetry();
  }
}

module.exports = {
  TelemetryCollector
};
