/**
 * AeroPulse Pro - Thermal Study & Benchmark Report Controller
 */

let studyChartInstance = null;
let currentViewingSession = null;

// Initialize Report Controller
function initReportController() {
  const btnNewStudy = document.getElementById('btn-new-study');
  const btnStopStudy = document.getElementById('btn-stop-study');
  const btnHistory = document.getElementById('btn-history');

  const modalStart = document.getElementById('modal-start-study');
  const modalReport = document.getElementById('modal-report');
  const modalHistory = document.getElementById('modal-history');

  const btnConfirmStart = document.getElementById('btn-confirm-start');
  const btnCancelStart = document.getElementById('btn-cancel-start');
  const btnCloseReport = document.getElementById('btn-close-report');
  const btnCloseHistory = document.getElementById('btn-close-history');

  const btnCopyLlm = document.getElementById('btn-copy-llm');
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  const btnDownloadJson = document.getElementById('btn-download-json');

  // Open Start Modal
  if (btnNewStudy) {
    btnNewStudy.addEventListener('click', () => {
      document.getElementById('study-title-input').value = `Estudio Térmico - ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      modalStart.classList.add('active');
    });
  }

  // Cancel Start Modal
  if (btnCancelStart) {
    btnCancelStart.addEventListener('click', () => {
      modalStart.classList.remove('active');
    });
  }

  // Duration Pills selection
  const durationPills = document.querySelectorAll('.duration-pill');
  durationPills.forEach(pill => {
    pill.addEventListener('click', () => {
      durationPills.forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    });
  });

  // Confirm Start Study
  if (btnConfirmStart) {
    btnConfirmStart.addEventListener('click', async () => {
      const title = document.getElementById('study-title-input').value;
      const selectedPill = document.querySelector('.duration-pill.selected');
      const durationType = selectedPill ? selectedPill.getAttribute('data-duration') : '10m';

      try {
        const res = await fetch('/api/sessions/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, durationType })
        });
        const data = await res.json();
        if (data.success) {
          modalStart.classList.remove('active');
          updateRecordingUI(data.session);
        } else {
          alert('Error al iniciar: ' + data.error);
        }
      } catch (err) {
        alert('Error de conexión: ' + err.message);
      }
    });
  }

  // Stop Active Study
  if (btnStopStudy) {
    btnStopStudy.addEventListener('click', async () => {
      if (!confirm('¿Deseas finalizar la sesión de monitoreo y generar el reporte ahora?')) {
        return;
      }
      try {
        const res = await fetch('/api/sessions/stop', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          stopRecordingUI();
          openReportModal(data.session);
        } else {
          alert('Error al finalizar: ' + data.error);
        }
      } catch (err) {
        alert('Error de red: ' + err.message);
      }
    });
  }

  // Open History Modal
  if (btnHistory) {
    btnHistory.addEventListener('click', () => {
      loadHistoryModal();
    });
  }

  // Close Buttons
  if (btnCloseReport) btnCloseReport.addEventListener('click', () => modalReport.classList.remove('active'));
  if (btnCloseHistory) btnCloseHistory.addEventListener('click', () => modalHistory.classList.remove('active'));

  // Copy LLM Prompt
  if (btnCopyLlm) {
    btnCopyLlm.addEventListener('click', async () => {
      if (!currentViewingSession) return;
      try {
        const res = await fetch(`/api/sessions/${currentViewingSession.id}/llm`);
        const data = await res.json();
        if (data.prompt) {
          await navigator.clipboard.writeText(data.prompt);
          const origText = btnCopyLlm.innerHTML;
          btnCopyLlm.innerHTML = '✓ ¡Copiado al Portapapeles!';
          btnCopyLlm.classList.add('copied');
          setTimeout(() => {
            btnCopyLlm.innerHTML = origText;
            btnCopyLlm.classList.remove('copied');
          }, 3000);
        }
      } catch (e) {
        alert('No se pudo copiar automáticamente: ' + e.message);
      }
    });
  }

  // Print / Save as PDF
  if (btnPrintPdf) {
    btnPrintPdf.addEventListener('click', () => {
      window.print();
    });
  }

  // Download raw JSON
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      if (!currentViewingSession) return;
      const jsonStr = JSON.stringify(currentViewingSession, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AeroPulse_${currentViewingSession.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Ensure initial visibility: check if a session is currently active
  fetch('/api/sessions/active')
    .then(r => r.json())
    .then(data => {
      if (data && data.activeSession) {
        updateRecordingUI(data.activeSession);
      } else {
        stopRecordingUI();
      }
    })
    .catch(() => {
      stopRecordingUI();
    });
}

// Update UI when recording is active
let tickerTimer = null;

function updateRecordingUI(session) {
  const btnNew = document.getElementById('btn-new-study');
  const recBadge = document.getElementById('recording-badge');
  const btnStop = document.getElementById('btn-stop-study');
  const recTitle = document.getElementById('rec-title');
  const recTimer = document.getElementById('rec-timer');

  if (btnNew) btnNew.classList.add('hidden');
  if (recBadge) recBadge.classList.remove('hidden');
  if (btnStop) btnStop.classList.remove('hidden');

  if (recTitle) recTitle.textContent = session.title;

  if (tickerTimer) clearInterval(tickerTimer);

  function tick() {
    const elapsedSec = Math.floor((Date.now() - new Date(session.startTime || session.start_time).getTime()) / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    if (session.targetSeconds) {
      const tm = Math.floor(session.targetSeconds / 60);
      const ts = session.targetSeconds % 60;
      recTimer.textContent = `${timeStr} / ${String(tm).padStart(2, '0')}:${String(ts).padStart(2, '0')}`;
    } else {
      recTimer.textContent = `${timeStr} (Ilimitado)`;
    }
  }

  tick();
  tickerTimer = setInterval(tick, 1000);
}

function stopRecordingUI() {
  const btnNew = document.getElementById('btn-new-study');
  const recBadge = document.getElementById('recording-badge');
  const btnStop = document.getElementById('btn-stop-study');

  if (btnNew) btnNew.classList.remove('hidden');
  if (recBadge) recBadge.classList.add('hidden');
  if (btnStop) btnStop.classList.add('hidden');

  if (tickerTimer) {
    clearInterval(tickerTimer);
    tickerTimer = null;
  }
}

// Open and Render Report Modal
async function openReportModal(sessionOrId) {
  let session = null;
  if (typeof sessionOrId === 'string') {
    const res = await fetch(`/api/sessions/${sessionOrId}`);
    const data = await res.json();
    session = data.session;
  } else {
    session = sessionOrId;
  }

  if (!session || !session.summary) {
    alert('Resumen del estudio no disponible.');
    return;
  }

  currentViewingSession = session;
  const s = session.summary;
  const modalReport = document.getElementById('modal-report');

  // Fill Header & Meta
  document.getElementById('rep-title').textContent = session.title;
  document.getElementById('rep-date').textContent = new Date(session.start_time).toLocaleString();
  document.getElementById('rep-duration').textContent = s.formattedDuration;
  document.getElementById('rep-samples').textContent = `${s.sampleCount} muestras`;

  // Grade Badge
  const repGrade = document.getElementById('rep-grade');
  const repGradeDesc = document.getElementById('rep-grade-desc');
  repGrade.className = `report-grade-badge badge-${s.gradeBadge || 'cyan'}`;
  repGrade.textContent = `Calificación Térmica: ${s.grade}`;
  repGradeDesc.textContent = s.gradeDescription;

  // KPI Numbers
  document.getElementById('rep-cpu-max').textContent = `${s.cpu.temp.max.toFixed(1)} °C`;
  document.getElementById('rep-cpu-avg').textContent = `Avg: ${s.cpu.temp.avg.toFixed(1)} °C | P95: ${s.cpu.temp.p95.toFixed(1)} °C`;

  document.getElementById('rep-gpu-max').textContent = `${s.gpu.coreTemp.max.toFixed(1)} °C`;
  document.getElementById('rep-gpu-avg').textContent = `Avg: ${s.gpu.coreTemp.avg.toFixed(1)} °C | P95: ${s.gpu.coreTemp.p95.toFixed(1)} °C`;

  document.getElementById('rep-hotspot-max').textContent = `${s.gpu.hotspotTemp.max.toFixed(1)} °C`;
  document.getElementById('rep-hotspot-avg').textContent = `Delta: +${s.gpu.delta.avg.toFixed(1)} °C | P95: ${s.gpu.hotspotTemp.p95.toFixed(1)} °C`;

  document.getElementById('rep-fans-summary').textContent = `Intake: ${s.fans.intakeRpm.avg} RPM | Exhaust: ${s.fans.exhaustRpm.avg} RPM`;

  // Fans & Acoustic Speeds (RPM) Breakdown
  const ac = s.fans.acoustics || {
    cpuFan: { tag: s.cpu.fanRpm.avg < 950 ? 'SILENCIOSO' : 'MODERADO', badge: s.cpu.fanRpm.avg < 950 ? 'quiet' : 'moderate' },
    gpuFan: { tag: s.gpu.fanRpm.avg === 0 ? '0dB STOP' : 'ACTIVO', badge: s.gpu.fanRpm.avg === 0 ? 'zerodb' : 'moderate' },
    intakeFan: { tag: s.fans.intakeRpm.avg > 1350 ? 'ALTO FLUJO' : 'MODERADO', badge: s.fans.intakeRpm.avg > 1350 ? 'high' : 'moderate' },
    exhaustFan: { tag: s.fans.exhaustRpm.avg > 1350 ? 'ALTO FLUJO' : 'MODERADO', badge: s.fans.exhaustRpm.avg > 1350 ? 'high' : 'moderate' },
    airflowBalance: 'Equilibrado',
    airflowBadge: 'badge-cyan',
    airflowSummaryText: 'Flujo de aire continuo y balanceado en el chasis.'
  };

  const repAirflowBadge = document.getElementById('rep-airflow-badge');
  if (repAirflowBadge) {
    repAirflowBadge.className = `report-airflow-pill ${ac.airflowBadge || 'badge-cyan'}`;
    document.getElementById('rep-airflow-balance-text').textContent = ac.airflowBalance || 'Equilibrado';
  }

  // CPU Cooler
  const elCpuTag = document.getElementById('rep-cpu-fan-tag');
  if (elCpuTag) {
    elCpuTag.className = `fan-acoustic-tag ${ac.cpuFan.badge}`;
    elCpuTag.textContent = ac.cpuFan.tag;
    document.getElementById('rep-cpu-fan-avg').textContent = s.cpu.fanRpm.avg || 0;
    document.getElementById('rep-cpu-fan-min').textContent = `Min: ${s.cpu.fanRpm.min || 0}`;
    document.getElementById('rep-cpu-fan-max').textContent = `Max: ${s.cpu.fanRpm.max || 0}`;
    document.getElementById('rep-cpu-fan-p95').textContent = `P95: ${s.cpu.fanRpm.p95 || 0}`;
  }

  // GPU Fans
  const elGpuTag = document.getElementById('rep-gpu-fan-tag');
  if (elGpuTag) {
    elGpuTag.className = `fan-acoustic-tag ${ac.gpuFan.badge}`;
    elGpuTag.textContent = ac.gpuFan.tag;
    document.getElementById('rep-gpu-fan-avg').textContent = s.gpu.fanRpm.avg || 0;
    document.getElementById('rep-gpu-fan-min').textContent = `Min: ${s.gpu.fanRpm.min || 0}`;
    document.getElementById('rep-gpu-fan-max').textContent = `Max: ${s.gpu.fanRpm.max || 0}`;
    document.getElementById('rep-gpu-fan-p95').textContent = `P95: ${s.gpu.fanRpm.p95 || 0}`;
  }

  // Case Intake
  const elIntakeTag = document.getElementById('rep-intake-fan-tag');
  if (elIntakeTag) {
    elIntakeTag.className = `fan-acoustic-tag ${ac.intakeFan.badge}`;
    elIntakeTag.textContent = ac.intakeFan.tag;
    document.getElementById('rep-intake-fan-avg').textContent = s.fans.intakeRpm.avg || 0;
    document.getElementById('rep-intake-fan-min').textContent = `Min: ${s.fans.intakeRpm.min || 0}`;
    document.getElementById('rep-intake-fan-max').textContent = `Max: ${s.fans.intakeRpm.max || 0}`;
    document.getElementById('rep-intake-fan-p95').textContent = `P95: ${s.fans.intakeRpm.p95 || 0}`;
  }

  // Case Exhaust
  const elExhaustTag = document.getElementById('rep-exhaust-fan-tag');
  if (elExhaustTag) {
    elExhaustTag.className = `fan-acoustic-tag ${ac.exhaustFan.badge}`;
    elExhaustTag.textContent = ac.exhaustFan.tag;
    document.getElementById('rep-exhaust-fan-avg').textContent = s.fans.exhaustRpm.avg || 0;
    document.getElementById('rep-exhaust-fan-min').textContent = `Min: ${s.fans.exhaustRpm.min || 0}`;
    document.getElementById('rep-exhaust-fan-max').textContent = `Max: ${s.fans.exhaustRpm.max || 0}`;
    document.getElementById('rep-exhaust-fan-p95').textContent = `P95: ${s.fans.exhaustRpm.p95 || 0}`;
  }

  const elAcousticText = document.getElementById('rep-acoustic-text');
  if (elAcousticText) {
    elAcousticText.textContent = ac.airflowSummaryText;
  }

  // Throttling warning
  const repThrottleAlert = document.getElementById('rep-throttle-alert');
  if (s.incidents.totalThrottleEvents > 0) {
    repThrottleAlert.classList.remove('hidden');
    repThrottleAlert.textContent = `⚠️ Se detectaron ${s.incidents.totalThrottleEvents} eventos en el límite térmico durante este estudio.`;
  } else {
    repThrottleAlert.classList.add('hidden');
  }

  // Render Session Chart
  renderStudyChart(session.samples || []);

  modalReport.classList.add('active');
}

function renderStudyChart(samples) {
  const canvas = document.getElementById('chart-study-session');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (studyChartInstance) {
    studyChartInstance.destroy();
  }

  const labels = samples.map((s, i) => {
    try {
      return new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return `#${i}`;
    }
  });

  const cpuTemps = samples.map(s => s.cpu_temp);
  const gpuCoreTemps = samples.map(s => s.gpu_core_temp);
  const gpuHotspotTemps = samples.map(s => s.gpu_hotspot_temp);
  const cpuFans = samples.map(s => s.cpu_fan_rpm);
  const intakeFans = samples.map(s => s.case_intake_rpm);

  studyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'CPU Package (°C)',
          data: cpuTemps,
          borderColor: '#38bdf8',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25
        },
        {
          label: 'GPU Core (°C)',
          data: gpuCoreTemps,
          borderColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25
        },
        {
          label: 'GPU Hot Spot (°C)',
          data: gpuHotspotTemps,
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', callback: (v) => `${v}°C`, font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

// Load previous sessions into History Modal
async function loadHistoryModal() {
  const modalHistory = document.getElementById('modal-history');
  const listContainer = document.getElementById('history-sessions-list');
  listContainer.innerHTML = '<div class="loading-state">Cargando estudios...</div>';
  modalHistory.classList.add('active');

  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No hay estudios registrados aún. ¡Inicia uno para grabar tu primer benchmark!</div>';
      return;
    }

    listContainer.innerHTML = '';
    sessions.forEach(s => {
      const summary = s.summary;
      const item = document.createElement('div');
      item.className = 'history-item';

      const gradeClass = summary ? `badge-${summary.gradeBadge || 'cyan'}` : 'badge-cyan';
      const gradeText = summary ? summary.grade : '--';
      const maxCpu = summary ? `${summary.cpu.temp.max}°C` : '--';
      const maxGpu = summary ? `${summary.gpu.coreTemp.max}°C` : '--';

      item.innerHTML = `
        <div class="hist-left">
          <span class="report-grade-badge ${gradeClass} mini">${gradeText}</span>
          <div>
            <div class="hist-title">${s.title}</div>
            <div class="hist-meta">${new Date(s.start_time).toLocaleString()} &bull; ${summary ? summary.formattedDuration : s.duration_type}</div>
          </div>
        </div>
        <div class="hist-kpis">
          <span>Max CPU: <strong>${maxCpu}</strong></span>
          <span>Max GPU: <strong>${maxGpu}</strong></span>
        </div>
        <div class="hist-actions">
          <button class="btn-view-report" data-id="${s.id}">Ver Reporte</button>
          <button class="btn-delete-report" data-id="${s.id}" title="Eliminar">🗑️</button>
        </div>
      `;

      item.querySelector('.btn-view-report').addEventListener('click', () => {
        modalHistory.classList.remove('active');
        openReportModal(s.id);
      });

      item.querySelector('.btn-delete-report').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar definitivamente el estudio "${s.title}"?`)) {
          await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
          loadHistoryModal();
        }
      });

      listContainer.appendChild(item);
    });
  } catch (err) {
    listContainer.innerHTML = `<div class="error-state">Error cargando historial: ${err.message}</div>`;
  }
}

// Export functions to global scope
window.initReportController = initReportController;
window.updateRecordingUI = updateRecordingUI;
window.stopRecordingUI = stopRecordingUI;
window.openReportModal = openReportModal;
