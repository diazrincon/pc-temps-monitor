/**
 * Fastify Web Server for PC Temperatures Monitoring Dashboard
 * Includes Thermal Study / Benchmark Session Management & Report APIs
 */

const path = require('node:path');
const fs = require('node:fs');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const fastifyCors = require('@fastify/cors');
const { TelemetryCollector } = require('./collector.js');
const {
  HISTORY_RANGES,
  getHistory,
  getBenchmarkSession,
  listBenchmarkSessions,
  deleteBenchmarkSession
} = require('./db.js');
const { generateLlmPrompt } = require('./benchmark.js');

// Load configuration
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = Fastify({ logger: false });

// Register CORS
app.register(fastifyCors, {
  origin: true
});

// Register Static file serving from public/
app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/'
});

// Initialize Collector
const collector = new TelemetryCollector(config);

// --- API ROUTES ---

// Current Telemetry
app.get('/api/current', async (request, reply) => {
  return {
    telemetry: collector.getCurrent(),
    thresholds: config.thresholds,
    hardwareMeta: config.hardwareMeta,
    isLive: collector.isLive,
    lhmError: collector.lastError || null,
    activeSession: collector.getActiveSessionState()
  };
});

// Historical Time-Series (downsampled)
app.get('/api/history', async (request, reply) => {
  const range = request.query.range || '1h';
  if (!HISTORY_RANGES[range]) {
    reply.status(400);
    return { error: `Invalid range '${range}'. Use one of: ${Object.keys(HISTORY_RANGES).join(', ')}` };
  }
  const { windowSeconds, bucketSeconds, data } = getHistory(range);
  return {
    range,
    windowSeconds,
    bucketSeconds,
    serverTime: Date.now(),
    count: data.length,
    data
  };
});

// Configuration & Thresholds
app.get('/api/config', async (request, reply) => {
  return {
    thresholds: config.thresholds,
    hardwareMeta: config.hardwareMeta,
    pollIntervalMs: config.lhm.pollIntervalMs
  };
});

// --- BENCHMARK STUDY ROUTES ---

// Start Benchmark Study
app.post('/api/sessions/start', async (request, reply) => {
  try {
    const body = request.body || {};
    const session = collector.startBenchmarkSession({
      title: body.title,
      durationType: body.durationType || 'unlimited'
    });
    return { success: true, session };
  } catch (err) {
    reply.status(400);
    return { success: false, error: err.message };
  }
});

// Stop Current Benchmark Study
app.post('/api/sessions/stop', async (request, reply) => {
  try {
    const session = collector.stopBenchmarkSession();
    if (!session) {
      reply.status(404);
      return { success: false, error: 'No hay ninguna sesión activa en curso.' };
    }
    return { success: true, session };
  } catch (err) {
    reply.status(500);
    return { success: false, error: err.message };
  }
});

// Active Session Status
app.get('/api/sessions/active', async (request, reply) => {
  return {
    activeSession: collector.getActiveSessionState()
  };
});

// List All Completed Sessions
app.get('/api/sessions', async (request, reply) => {
  const sessions = listBenchmarkSessions();
  return { sessions };
});

// Get Specific Session with Samples and Summary
app.get('/api/sessions/:id', async (request, reply) => {
  const session = getBenchmarkSession(request.params.id);
  if (!session) {
    reply.status(404);
    return { error: 'Sesión no encontrada.' };
  }
  return { session };
});

// Get LLM Prompt for Session
app.get('/api/sessions/:id/llm', async (request, reply) => {
  const session = getBenchmarkSession(request.params.id);
  if (!session || !session.summary) {
    reply.status(404);
    return { error: 'Sesión o resumen no disponible.' };
  }
  const prompt = generateLlmPrompt(session, session.summary, config.hardwareMeta);
  return {
    sessionId: session.id,
    title: session.title,
    prompt
  };
});

// Delete a Session
app.delete('/api/sessions/:id', async (request, reply) => {
  deleteBenchmarkSession(request.params.id);
  return { success: true };
});

// --- Server-Sent Events (SSE) Stream ---
app.get('/api/stream', (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial state
  const initialData = JSON.stringify({
    telemetry: collector.getCurrent(),
    thresholds: config.thresholds,
    hardwareMeta: config.hardwareMeta,
    isLive: collector.isLive,
    lhmError: collector.lastError || null,
    activeSession: collector.getActiveSessionState()
  });
  reply.raw.write(`data: ${initialData}\n\n`);

  // Listener on new telemetry samples
  const onTelemetry = (data) => {
    try {
      const payload = JSON.stringify({
        telemetry: data.telemetry,
        activeSession: data.activeSession,
        lhmError: data.lhmError,
        thresholds: config.thresholds,
        hardwareMeta: config.hardwareMeta,
        isLive: collector.isLive
      });
      reply.raw.write(`data: ${payload}\n\n`);
    } catch (err) {
      // client likely closed
    }
  };

  const onSessionFinished = (completedSession) => {
    try {
      const payload = JSON.stringify({
        event: 'session_completed',
        session: completedSession
      });
      reply.raw.write(`data: ${payload}\n\n`);
    } catch (err) {}
  };

  collector.on('telemetry', onTelemetry);
  collector.on('session_finished', onSessionFinished);

  request.raw.on('close', () => {
    collector.off('telemetry', onTelemetry);
    collector.off('session_finished', onSessionFinished);
  });
});

// --- SERVER STARTUP ---
const start = async () => {
  try {
    collector.start();
    const port = parseInt(process.env.PORT, 10) || config.server.port || 8367;
    const host = config.server.host || '127.0.0.1';

    await app.listen({ port, host });
    console.log(`\n======================================================`);
    console.log(`🚀 PC Temperature Monitor Dashboard is RUNNING!`);
    console.log(`🌐 Web Interface: http://localhost:${port}`);
    console.log(`📡 LHM Endpoint:  ${config.lhm.url}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
