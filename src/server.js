/**
 * Fastify Web Server for PC Temperatures Monitoring Dashboard
 */

const path = require('node:path');
const fs = require('node:fs');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const fastifyCors = require('@fastify/cors');
const { TelemetryCollector } = require('./collector.js');
const { getHistory } = require('./db.js');

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
    isLive: collector.isLive
  };
});

// Historical Time-Series
app.get('/api/history', async (request, reply) => {
  const range = request.query.range || '1h';
  const data = getHistory(range);
  return {
    range,
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

// Server-Sent Events (SSE) Stream
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
    isLive: collector.isLive
  });
  reply.raw.write(`data: ${initialData}\n\n`);

  // Listener on new telemetry samples
  const onTelemetry = (telemetry) => {
    try {
      const payload = JSON.stringify({
        telemetry,
        thresholds: config.thresholds,
        hardwareMeta: config.hardwareMeta,
        isLive: collector.isLive
      });
      reply.raw.write(`data: ${payload}\n\n`);
    } catch (err) {
      // client likely closed
    }
  };

  collector.on('telemetry', onTelemetry);

  request.raw.on('close', () => {
    collector.off('telemetry', onTelemetry);
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
