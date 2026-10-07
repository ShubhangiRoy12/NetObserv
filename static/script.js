const API_BASE = "";

const tableBody = document.getElementById("deviceTableBody");
const alertList = document.getElementById("alertList");
const topologyStrip = document.getElementById("topologyStrip");
const totalDevicesEl = document.getElementById("totalDevices");
const criticalDevicesEl = document.getElementById("criticalDevices");
const avgRiskEl = document.getElementById("avgRisk");
const avgPacketLossEl = document.getElementById("avgPacketLoss");
const lowCountEl = document.getElementById("lowCount");
const mediumCountEl = document.getElementById("mediumCount");
const highCountEl = document.getElementById("highCount");
const criticalCountEl = document.getElementById("criticalCount");
const healthStatusEl = document.getElementById("healthStatus");
const healthTimeEl = document.getElementById("healthTime");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");
const inferenceModeEl = document.getElementById("inferenceMode");
const selectedModelEl = document.getElementById("selectedModel");
const decisionThresholdEl = document.getElementById("decisionThreshold");
const heroModelEl = document.getElementById("heroModel");
const metricAccuracyEl = document.getElementById("metricAccuracy");
const metricF1El = document.getElementById("metricF1");
const metricRocEl = document.getElementById("metricRoc");
const metricFnrEl = document.getElementById("metricFnr");

let riskChart;
let failureChart;
let anomalyChart;

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatSimplePercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

function formatMs(value) {
  return `${Number(value).toFixed(2)} ms`;
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function readableMode(mode) {
  if (!mode) return "--";
  return String(mode).replaceAll("_", " ");
}

function getRiskClass(level) {
  const risk = String(level).toLowerCase();
  if (["low", "medium", "high", "critical"].includes(risk)) return risk;
  return "neutral";
}

function destroyCharts() {
  if (riskChart) riskChart.destroy();
  if (failureChart) failureChart.destroy();
  if (anomalyChart) anomalyChart.destroy();
}

function chartBaseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
  };
}

function initCharts() {
  destroyCharts();

  const textColor = "#475569";
  const gridColor = "#e5eaf2";

  riskChart = new Chart(document.getElementById("riskChart"), {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ["#16a34a", "#d97706", "#ea580c", "#dc2626"],
        borderColor: "#ffffff",
        borderWidth: 4,
        hoverOffset: 3
      }]
    },
    options: {
      ...chartBaseOptions(),
      cutout: "68%",
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            color: textColor,
            padding: 16,
            boxWidth: 10,
            usePointStyle: true,
            pointStyle: "circle"
          }
        }
      }
    }
  });

  failureChart = new Chart(document.getElementById("failureChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Failure %",
        data: [],
        backgroundColor: "#2563eb",
        borderRadius: 6,
        maxBarThickness: 32
      }]
    },
    options: {
      ...chartBaseOptions(),
      scales: {
        x: { ticks: { color: textColor, maxRotation: 0, minRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, max: 100, ticks: { color: textColor, callback: value => `${value}%` }, grid: { color: gridColor } }
      }
    }
  });

  anomalyChart = new Chart(document.getElementById("anomalyChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Anomaly %",
        data: [],
        borderColor: "#0891b2",
        backgroundColor: "rgba(8, 145, 178, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 4
      }]
    },
    options: {
      ...chartBaseOptions(),
      scales: {
        x: { ticks: { color: textColor, maxRotation: 0, minRotation: 0 }, grid: { color: "#f1f5f9" } },
        y: { beginAtZero: true, max: 100, ticks: { color: textColor, callback: value => `${value}%` }, grid: { color: gridColor } }
      }
    }
  });
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    healthStatusEl.textContent = data.status || "operational";
    healthStatusEl.className = "status-pill low";
    healthTimeEl.textContent = `Updated ${formatDateTime(data.timestamp)}`;
    inferenceModeEl.textContent = readableMode(data.inference_mode);
    selectedModelEl.textContent = data.selected_model || "--";
    heroModelEl.textContent = data.selected_model || "--";
    decisionThresholdEl.textContent = data.decision_threshold ? formatPercent(data.decision_threshold) : "--";
  } catch (error) {
    healthStatusEl.textContent = "offline";
    healthStatusEl.className = "status-pill critical";
    healthTimeEl.textContent = "Backend not reachable";
    inferenceModeEl.textContent = "--";
    selectedModelEl.textContent = "--";
    decisionThresholdEl.textContent = "--";
  }
}

function renderTable(devices) {
  if (!devices.length) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-cell">No device data available.</td></tr>`;
    return;
  }

  tableBody.innerHTML = devices.map(device => `
    <tr>
      <td><strong>${device.device_id}</strong></td>
      <td><span class="risk-badge ${getRiskClass(device.risk_level)}">${device.risk_level}</span></td>
      <td>${formatPercent(device.risk_score)}</td>
      <td>${formatPercent(device.failure_probability)}</td>
      <td>${formatPercent(device.anomaly_score)}</td>
      <td>${formatMs(device.latency_ms)}</td>
      <td>${formatSimplePercent(device.packet_loss)}</td>
      <td>${formatSimplePercent(device.bandwidth_util)}</td>
    </tr>
  `).join("");
}


function renderTopology(devices) {
  if (!topologyStrip) return;
  const ordered = [...devices].sort((a, b) => {
    const rank = { Router: 0, Switch: 1, Server: 2 };
    const getRank = device => rank[String(device.device_id).split("-")[0]] ?? 3;
    return getRank(a) - getRank(b) || String(a.device_id).localeCompare(String(b.device_id));
  });

  topologyStrip.innerHTML = ordered.map(device => `
    <div class="topology-node ${getRiskClass(device.risk_level)}">
      <strong>${device.device_id}</strong>
      <span>${device.risk_level} · ${formatPercent(device.risk_score)}</span>
    </div>
  `).join("");
}
function renderAlerts(devices) {
  const risky = devices
    .filter(d => d.risk_level === "CRITICAL" || d.risk_level === "HIGH")
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score));

  if (!risky.length) {
    alertList.innerHTML = `<div class="empty-alert">No high-priority alerts right now.</div>`;
    return;
  }

  alertList.innerHTML = risky.slice(0, 6).map(device => `
    <div class="alert-item">
      <h4>${device.device_id} - ${device.risk_level}</h4>
      <p>${device.recommendation}</p>
    </div>
  `).join("");
}

function updateStats(devices) {
  const total = devices.length;
  const low = devices.filter(d => d.risk_level === "LOW").length;
  const medium = devices.filter(d => d.risk_level === "MEDIUM").length;
  const high = devices.filter(d => d.risk_level === "HIGH").length;
  const critical = devices.filter(d => d.risk_level === "CRITICAL").length;
  const avgRisk = total ? devices.reduce((sum, d) => sum + Number(d.risk_score), 0) / total : 0;
  const avgPacketLoss = total ? devices.reduce((sum, d) => sum + Number(d.packet_loss), 0) / total : 0;

  totalDevicesEl.textContent = total;
  criticalDevicesEl.textContent = critical;
  avgRiskEl.textContent = formatPercent(avgRisk);
  avgPacketLossEl.textContent = formatSimplePercent(avgPacketLoss);
  lowCountEl.textContent = low;
  mediumCountEl.textContent = medium;
  highCountEl.textContent = high;
  criticalCountEl.textContent = critical;
}

function updateCharts(devices) {
  const low = devices.filter(d => d.risk_level === "LOW").length;
  const medium = devices.filter(d => d.risk_level === "MEDIUM").length;
  const high = devices.filter(d => d.risk_level === "HIGH").length;
  const critical = devices.filter(d => d.risk_level === "CRITICAL").length;
  riskChart.data.datasets[0].data = [low, medium, high, critical];
  riskChart.update();

  const topFailure = [...devices].sort((a, b) => Number(b.failure_probability) - Number(a.failure_probability)).slice(0, 6);
  failureChart.data.labels = topFailure.map(d => d.device_id);
  failureChart.data.datasets[0].data = topFailure.map(d => Number((Number(d.failure_probability) * 100).toFixed(1)));
  failureChart.update();

  const topAnomaly = [...devices].sort((a, b) => Number(b.anomaly_score) - Number(a.anomaly_score)).slice(0, 8);
  anomalyChart.data.labels = topAnomaly.map(d => d.device_id);
  anomalyChart.data.datasets[0].data = topAnomaly.map(d => Number((Number(d.anomaly_score) * 100).toFixed(1)));
  anomalyChart.update();
}


async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE}/model-metrics`);
    const data = await res.json();
    metricAccuracyEl.textContent = formatPercent(data.accuracy);
    metricF1El.textContent = formatPercent(data.f1);
    metricRocEl.textContent = formatPercent(data.roc_auc);
    metricFnrEl.textContent = formatPercent(data.false_negative_rate);
  } catch (error) {
    metricAccuracyEl.textContent = "--";
    metricF1El.textContent = "--";
    metricRocEl.textContent = "--";
    metricFnrEl.textContent = "--";
  }
}
async function fetchStream() {
  try {
    const res = await fetch(`${API_BASE}/stream`);
    const data = await res.json();
    const devices = data.devices || [];
    renderTable(devices);
    renderAlerts(devices);
    updateStats(devices);
    updateCharts(devices);
    lastUpdatedEl.textContent = formatDateTime(data.timestamp);
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-cell">Failed to load stream data.</td></tr>`;
    alertList.innerHTML = `<div class="empty-alert">Could not fetch alerts.</div>`;
    lastUpdatedEl.textContent = "Refresh failed";
  }
}

async function loadDashboard() {
  await Promise.all([fetchHealth(), fetchMetrics(), fetchStream()]);
}

refreshBtn.addEventListener("click", loadDashboard);
initCharts();
loadDashboard();
setInterval(loadDashboard, 5000);

window.addEventListener("resize", () => {
  clearTimeout(window.__chartResizeTimer);
  window.__chartResizeTimer = setTimeout(() => {
    initCharts();
    loadDashboard();
  }, 250);
});



