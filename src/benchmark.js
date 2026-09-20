/**
 * Statistical Analysis & LLM Prompt Generator for Benchmark Studies
 */

function calculatePercentile(numbers, p) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 10) / 10;
}

function computeSeriesStats(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) {
    return { min: 0, max: 0, avg: 0, p95: 0, count: 0 };
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const sum = valid.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / valid.length) * 10) / 10;
  const p95 = calculatePercentile(valid, 95);
  return { min, max, avg, p95, count: valid.length };
}

/**
 * Summarizes session telemetry into KPIs, diagnosis, and thermal rating
 */
function summarizeBenchmark(session, samples, hardwareMeta = {}, thresholds = {}) {
  const defaultThresholds = {
    cpu: { normal: 75, warm: 85 },
    gpuCore: { normal: 76, alert: 83 },
    gpuHotspot: { normal: 88, alert: 92 }
  };
  const t = { ...defaultThresholds, ...thresholds };

  const count = samples.length;
  const startTime = new Date(session.start_time);
  const endTime = session.end_time ? new Date(session.end_time) : new Date();
  const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const formattedDuration = `${minutes}m ${seconds}s`;

  // Series
  const cpuTemps = samples.map(s => s.cpu_temp);
  const cpuLoads = samples.map(s => s.cpu_load);
  const cpuPowers = samples.map(s => s.cpu_power);
  const cpuFans = samples.map(s => s.cpu_fan_rpm);

  const gpuCoreTemps = samples.map(s => s.gpu_core_temp);
  const gpuHotspotTemps = samples.map(s => s.gpu_hotspot_temp);
  const gpuLoads = samples.map(s => s.gpu_load);
  const gpuPowers = samples.map(s => s.gpu_power);
  const gpuFans = samples.map(s => s.gpu_fan1_rpm);

  const intakeFans = samples.map(s => s.case_intake_rpm);
  const exhaustFans = samples.map(s => s.case_exhaust_rpm);
  const moboTemps = samples.map(s => s.mobo_temp);

  // Compute stats
  const cpuStats = computeSeriesStats(cpuTemps);
  const cpuLoadStats = computeSeriesStats(cpuLoads);
  const cpuPowerStats = computeSeriesStats(cpuPowers);
  const cpuFanStats = computeSeriesStats(cpuFans);

  const gpuCoreStats = computeSeriesStats(gpuCoreTemps);
  const gpuHotspotStats = computeSeriesStats(gpuHotspotTemps);
  const gpuLoadStats = computeSeriesStats(gpuLoads);
  const gpuPowerStats = computeSeriesStats(gpuPowers);
  const gpuFanStats = computeSeriesStats(gpuFans);

  const intakeStats = computeSeriesStats(intakeFans);
  const exhaustStats = computeSeriesStats(exhaustFans);
  const moboStats = computeSeriesStats(moboTemps);

  // Deltas (GPU Hotspot - GPU Core)
  const deltas = samples
    .filter(s => s.gpu_hotspot_temp && s.gpu_core_temp)
    .map(s => Math.round((s.gpu_hotspot_temp - s.gpu_core_temp) * 10) / 10);
  const deltaStats = computeSeriesStats(deltas);

  // Throttling / threshold incidents
  let cpuThrottleCount = 0;
  let gpuThrottleCount = 0;
  let gpuHotspotAlertCount = 0;

  samples.forEach(s => {
    if (s.cpu_temp && s.cpu_temp >= t.cpu.warm) cpuThrottleCount++;
    if (s.gpu_core_temp && s.gpu_core_temp >= t.gpuCore.alert) gpuThrottleCount++;
    if (s.gpu_hotspot_temp && s.gpu_hotspot_temp >= t.gpuHotspot.alert) gpuHotspotAlertCount++;
  });

  // Health Rating
  let grade = 'A+';
  let gradeBadge = 'emerald';
  let gradeDescription = 'Excelente: Temperaturas contenidas con amplio margen térmico.';

  if (cpuThrottleCount > 0 || gpuThrottleCount > 0 || gpuHotspotAlertCount > 0) {
    grade = 'C';
    gradeBadge = 'rose';
    gradeDescription = 'Alerta de Estrés Térmico: Se registraron temperaturas en el límite de estrangulamiento térmico (Thermal Throttling).';
  } else if (cpuStats.max >= 80 || gpuCoreStats.max >= 78 || gpuHotspotStats.max >= 88) {
    grade = 'B';
    gradeBadge = 'amber';
    gradeDescription = 'Aceptable con Carga Alta: Temperaturas elevadas en picos de demanda. Monitorear ventilación.';
  } else if (cpuStats.max <= 74 && gpuCoreStats.max <= 72 && gpuHotspotStats.max <= 82) {
    grade = 'A+';
    gradeBadge = 'emerald';
    gradeDescription = 'Óptimo: Gran eficiencia del disipador Pure Rock Pro 3 y la RTX 3060.';
  } else {
    grade = 'A';
    gradeBadge = 'cyan';
    gradeDescription = 'Bueno: Funcionamiento normal y seguro para gaming y productividad.';
  }

  return {
    sampleCount: count,
    durationSeconds,
    formattedDuration,
    grade,
    gradeBadge,
    gradeDescription,
    cpu: {
      temp: cpuStats,
      load: cpuLoadStats,
      power: cpuPowerStats,
      fanRpm: cpuFanStats
    },
    gpu: {
      coreTemp: gpuCoreStats,
      hotspotTemp: gpuHotspotStats,
      delta: deltaStats,
      load: gpuLoadStats,
      power: gpuPowerStats,
      fanRpm: gpuFanStats
    },
    fans: {
      intakeRpm: intakeStats,
      exhaustRpm: exhaustStats,
      moboTemp: moboStats
    },
    incidents: {
      cpuThrottleCount,
      gpuThrottleCount,
      gpuHotspotAlertCount,
      totalThrottleEvents: cpuThrottleCount + gpuThrottleCount + gpuHotspotAlertCount
    }
  };
}

/**
 * Generates an exportable Markdown prompt tailored for LLM consultation
 */
function generateLlmPrompt(session, summary, hardwareMeta = {}) {
  const s = summary;
  const hwCpu = hardwareMeta.cpu || '11th Gen Intel Core i5-11400';
  const hwCooler = hardwareMeta.cpuCooler || 'be quiet! Pure Rock Pro 3 Black';
  const hwGpu = hardwareMeta.gpu || 'NVIDIA GeForce RTX 3060 (Zotac Ventus Dual Fan)';
  const hwFans = hardwareMeta.fans || '120mm Intake & Exhaust Fans (NCT6687D)';

  return `# 🧪 Reporte de Estudio Térmico de PC - ${session.title || 'Sesión de Benchmark'}

## 1. Especificaciones de Hardware
- **Procesador (CPU)**: ${hwCpu}
- **Disipador CPU**: ${hwCooler}
- **Tarjeta Gráfica (GPU)**: ${hwGpu}
- **Ventilación de Chasis**: ${hwFans}
- **Duración del Estudio**: ${s.formattedDuration} (${s.sampleCount} muestras tomadas cada 5s)
- **Fecha**: ${new Date(session.start_time).toLocaleString()}

---

## 2. Resumen Estadístico de Temperaturas

| Componente | Mínimo | Promedio | P95 (Percentil 95) | Máximo Pico | Límite Seguro |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **CPU Package** | ${s.cpu.temp.min}°C | ${s.cpu.temp.avg}°C | ${s.cpu.temp.p95}°C | **${s.cpu.temp.max}°C** | < 80°C |
| **GPU Core** | ${s.gpu.coreTemp.min}°C | ${s.gpu.coreTemp.avg}°C | ${s.gpu.coreTemp.p95}°C | **${s.gpu.coreTemp.max}°C** | < 76°C |
| **GPU Hot Spot** | ${s.gpu.hotspotTemp.min}°C | ${s.gpu.hotspotTemp.avg}°C | ${s.gpu.hotspotTemp.p95}°C | **${s.gpu.hotspotTemp.max}°C** | < 90°C |
| **Delta GPU (Hotspot - Core)** | ${s.gpu.delta.min}°C | ${s.gpu.delta.avg}°C | - | **${s.gpu.delta.max}°C** | < 15°C |
| **Placa Base / VRM** | ${s.fans.moboTemp.min}°C | ${s.fans.moboTemp.avg}°C | - | **${s.fans.moboTemp.max}°C** | < 60°C |

---

## 3. Carga, Consumo Eléctrico y Ventiladores

| Métrica | Promedio | Máximo Registrado |
| :--- | :---: | :---: |
| **Carga CPU (%)** | ${s.cpu.load.avg}% | ${s.cpu.load.max}% |
| **Potencia CPU (W)** | ${s.cpu.power.avg} W | ${s.cpu.power.max} W |
| **Ventilador CPU Cooler (RPM)** | ${s.cpu.fanRpm.avg} RPM | ${s.cpu.fanRpm.max} RPM |
| **Carga GPU (%)** | ${s.gpu.load.avg}% | ${s.gpu.load.max}% |
| **Potencia GPU (W)** | ${s.gpu.power.avg} W | ${s.gpu.power.max} W |
| **Ventiladores GPU (RPM)** | ${s.gpu.fanRpm.avg} RPM | ${s.gpu.fanRpm.max} RPM |
| **Ventilador Entrada (Intake)** | ${s.fans.intakeRpm.avg} RPM | ${s.fans.intakeRpm.max} RPM |
| **Ventilador Salida (Exhaust)** | ${s.fans.exhaustRpm.avg} RPM | ${s.fans.exhaustRpm.max} RPM |

---

## 4. Diagnóstico Automático
- **Calificación Térmica**: **${s.grade}** (${s.gradeDescription})
- **Eventos de Estrangulamiento (Throttling)**: ${s.incidents.totalThrottleEvents} detectados.
- **Delta Térmico GPU**: ${s.gpu.delta.avg}°C promedio (Valores normales: 10–14°C. >18–20°C indica pasta térmica degradada).

---

## 5. Prompt de Consulta para el LLM:

> "Actúa como un ingeniero especialista en termodinámica de hardware de PC, curvas de ventilación y disipación térmica.
> 
> Revisa los datos anteriores registrados durante una sesión de uso/benchmark en mi equipo:
> 1. Evalúa el rendimiento de mi disipador **${hwCooler}** disipando el procesador **${hwCpu}**. ¿Hay suficiente margen térmico para mantener frecuencias Boost estables?
> 2. Evalúa las temperaturas de la tarjeta gráfica **${hwGpu}** (Core vs Hot Spot). ¿El delta de temperatura entre el núcleo y el punto caliente sugiere buen estado de la pasta y almohadillas térmicas?
> 3. Analiza la acústica y velocidad de los ventiladores de caja (Intake: ${s.fans.intakeRpm.avg} RPM vs Exhaust: ${s.fans.exhaustRpm.avg} RPM). ¿Recomiendas optimizar la curva PWM en la BIOS para reducir ruido sin comprometer temperaturas?
> 4. Concluye con un resumen de 3 recomendaciones concretas."
`;
}

module.exports = {
  calculatePercentile,
  computeSeriesStats,
  summarizeBenchmark,
  generateLlmPrompt
};
