/**
 * Collector service: polls LibreHardwareMonitor, parses telemetry,
 * persists to SQLite, and emits events to active dashboard clients.
 * Supports active benchmark study recording sessions.
 */

const EventEmitter = require('node:events');
const { parseLhmTree } = require('./parser.js');
const { getMockTelemetry } = require('./mock.js');
const {
  insertMetric,
  cleanupOldRecords,
  createBenchmarkSession,
  addSessionSample,
  finishBenchmarkSession,
  getBenchmarkSession,
  getActiveBenchmarkSession,
  listBenchmarkSessions,
  getSessionSamples
} = require('./db.js');
const { summarizeBenchmark } = require('./benchmark.js');

class TelemetryCollector extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.timer = null;
    this.cleanupTimer = null;
    this.current = null;
    this.isLive = false;
    this.lastSuccessfulPoll = null;
    
    // Restore active session if server was restarted during recording
    try {
      const activeDb = getActiveBenchmarkSession();
      if (activeDb) {
        this.activeSession = {
          id: activeDb.id,
          title: activeDb.title,
          durationType: activeDb.duration_type,
          targetSeconds: activeDb.target_seconds,
          startTime: activeDb.start_time,
          sampleCount: activeDb.samples ? activeDb.samples.length : 0
        };
        console.log(`[Collector] Restored active session '${activeDb.title}' (${activeDb.id}) from database.`);
      } else {
        this.activeSession = null;
      }
    } catch (e) {
      this.activeSession = null;
    }
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

    // Save in general metrics database
    try {
      insertMetric(telemetry);
    } catch (dbErr) {
      console.error('[Collector] Error saving metric to SQLite:', dbErr.message);
    }

    // Record sample if there is an active benchmark study session
    if (this.activeSession) {
      try {
        addSessionSample(this.activeSession.id, telemetry);
        this.activeSession.sampleCount = (this.activeSession.sampleCount || 0) + 1;

        // Check if duration limit reached
        if (this.activeSession.targetSeconds) {
          const elapsed = (Date.now() - new Date(this.activeSession.startTime).getTime()) / 1000;
          if (elapsed >= this.activeSession.targetSeconds) {
            console.log(`[Collector] Benchmark session target time reached (${elapsed}s). Finishing session.`);
            this.stopBenchmarkSession();
          }
        }
      } catch (sessionErr) {
        console.error('[Collector] Error recording session sample:', sessionErr.message);
      }
    }

    this.current = telemetry;
    this.emit('telemetry', {
      telemetry,
      activeSession: this.getActiveSessionState()
    });
    return telemetry;
  }

  // --- BENCHMARK SESSION CONTROLS ---

  startBenchmarkSession({ title, durationType }) {
    if (this.activeSession) {
      throw new Error('Ya existe un estudio de benchmark en curso.');
    }

    let targetSeconds = null;
    if (durationType === '10m') targetSeconds = 10 * 60;
    else if (durationType === '30m') targetSeconds = 30 * 60;
    else if (durationType === '1h') targetSeconds = 60 * 60;
    else if (durationType === '1m') targetSeconds = 60; // useful for testing

    const id = `study_${Date.now()}`;
    const startTime = new Date().toISOString();
    const sessionTitle = title && title.trim() ? title.trim() : `Estudio Térmico #${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    createBenchmarkSession({
      id,
      title: sessionTitle,
      durationType: durationType || 'unlimited',
      targetSeconds,
      startTime
    });

    this.activeSession = {
      id,
      title: sessionTitle,
      durationType: durationType || 'unlimited',
      targetSeconds,
      startTime,
      sampleCount: 0
    };

    console.log(`[Collector] Started Benchmark Study '${sessionTitle}' [ID: ${id}, Target: ${durationType}]`);
    this.emit('session_started', this.activeSession);
    return this.activeSession;
  }

  stopBenchmarkSession() {
    let targetId = this.activeSession ? this.activeSession.id : null;
    if (!targetId) {
      const activeDb = getActiveBenchmarkSession();
      if (activeDb) targetId = activeDb.id;
    }

    if (!targetId) {
      const sessions = listBenchmarkSessions();
      if (sessions && sessions.length > 0) {
        return getBenchmarkSession(sessions[0].id);
      }
      return null;
    }

    const sessionData = getBenchmarkSession(targetId);
    if (!sessionData) {
      this.activeSession = null;
      return null;
    }

    const endTime = new Date().toISOString();
    sessionData.end_time = endTime;

    // Compute statistical summary
    const summary = summarizeBenchmark(
      sessionData,
      sessionData.samples || [],
      this.config.hardwareMeta,
      this.config.thresholds
    );

    finishBenchmarkSession(
      targetId,
      endTime,
      'completed',
      JSON.stringify(summary)
    );

    const completedSession = {
      ...sessionData,
      end_time: endTime,
      status: 'completed',
      summary
    };

    console.log(`[Collector] Finished Benchmark Study '${completedSession.title}'. Grade: ${summary.grade}`);
    this.activeSession = null;
    this.emit('session_finished', completedSession);
    return completedSession;
  }

  getActiveSessionState() {
    if (!this.activeSession) return null;
    const elapsedSeconds = Math.floor((Date.now() - new Date(this.activeSession.startTime).getTime()) / 1000);
    return {
      id: this.activeSession.id,
      title: this.activeSession.title,
      durationType: this.activeSession.durationType,
      targetSeconds: this.activeSession.targetSeconds,
      startTime: this.activeSession.startTime,
      sampleCount: this.activeSession.sampleCount || 0,
      elapsedSeconds
    };
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
