<<<<<<< HEAD
const API_BASE = "";

const healthStatusEl = document.getElementById("healthStatus");
const healthTimeEl = document.getElementById("healthTime");
const lastUpdatedEl = document.getElementById("lastUpdated");

const avgFailureEl = document.getElementById("avgFailure");
const avgAnomalyEl = document.getElementById("avgAnomaly");
const avgLatencyEl = document.getElementById("avgLatency");
const highCriticalCountEl = document.getElementById("highCriticalCount");

const insightsListEl = document.getElementById("insightsList");
const topDevicesTableEl = document.getElementById("topDevicesTable");

const refreshBtn = document.getElementById("refreshBtn");
const sortSelect = document.getElementById("sortSelect");

let riskDistributionChart;
let failureProbabilityChart;
let latencyPacketLossChart;
let multiMetricChart;

let latestDevices = [];

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function getRiskClass(level) {
  const risk = String(level).toLowerCase();
  if (risk === "low") return "low";
  if (risk === "medium") return "medium";
  if (risk === "high") return "high";
  if (risk === "critical") return "critical";
  return "neutral";
}

function destroyCharts() {
  [riskDistributionChart, failureProbabilityChart, latencyPacketLossChart, multiMetricChart]
    .forEach(chart => {
      if (chart) chart.destroy();
    });
}

function chartTextColor() {
  return "#c8d4f0";
}

function chartGridColor() {
  return "rgba(255,255,255,0.08)";
}

function getSortedDevices(devices, mode) {
  const cloned = [...devices];

  if (mode === "failure") {
    return cloned.sort((a, b) => b.failure_probability - a.failure_probability);
  }
  if (mode === "anomaly") {
    return cloned.sort((a, b) => b.anomaly_score - a.anomaly_score);
  }
  if (mode === "latency") {
    return cloned.sort((a, b) => b.latency_ms - a.latency_ms);
  }
  return cloned.sort((a, b) => b.risk_score - a.risk_score);
}

function updateKPIs(devices) {
  if (!devices.length) {
    avgFailureEl.textContent = "0%";
    avgAnomalyEl.textContent = "0%";
    avgLatencyEl.textContent = "0 ms";
    highCriticalCountEl.textContent = "0";
    return;
  }

  const avgFailure =
    devices.reduce((sum, d) => sum + Number(d.failure_probability), 0) / devices.length;

  const avgAnomaly =
    devices.reduce((sum, d) => sum + Number(d.anomaly_score), 0) / devices.length;

  const avgLatency =
    devices.reduce((sum, d) => sum + Number(d.latency_ms), 0) / devices.length;

  const highCriticalCount = devices.filter(
    d => d.risk_level === "HIGH" || d.risk_level === "CRITICAL"
  ).length;

  avgFailureEl.textContent = formatPercent(avgFailure);
  avgAnomalyEl.textContent = formatPercent(avgAnomaly);
  avgLatencyEl.textContent = `${avgLatency.toFixed(1)} ms`;
  highCriticalCountEl.textContent = highCriticalCount;
}

function renderInsights(devices) {
  if (!devices.length) {
    insightsListEl.innerHTML = `<div class="empty-text">No insights available.</div>`;
    return;
  }

  const sortedByRisk = [...devices].sort((a, b) => b.risk_score - a.risk_score);
  const topRisk = sortedByRisk[0];

  const sortedByLatency = [...devices].sort((a, b) => b.latency_ms - a.latency_ms);
  const topLatency = sortedByLatency[0];

  const sortedByPacketLoss = [...devices].sort((a, b) => b.packet_loss - a.packet_loss);
  const topPacketLoss = sortedByPacketLoss[0];

  const criticalCount = devices.filter(d => d.risk_level === "CRITICAL").length;

  insightsListEl.innerHTML = `
    <div class="insight-card">
      <h4>Highest Risk Device</h4>
      <p>${topRisk.device_id} currently has the highest risk score at ${formatPercent(topRisk.risk_score)} with a ${topRisk.risk_level} classification.</p>
    </div>

    <div class="insight-card">
      <h4>Latency Watch</h4>
      <p>${topLatency.device_id} is showing the highest latency at ${Number(topLatency.latency_ms).toFixed(2)} ms, which may indicate congestion or unstable routing.</p>
    </div>

    <div class="insight-card">
      <h4>Packet Loss Concern</h4>
      <p>${topPacketLoss.device_id} has the highest packet loss at ${Number(topPacketLoss.packet_loss).toFixed(2)}%, which can directly impact service quality.</p>
    </div>

    <div class="insight-card">
      <h4>Critical Status Summary</h4>
      <p>${criticalCount} device(s) are currently in CRITICAL state in the latest stream snapshot.</p>
    </div>
  `;
}

function renderTopDevicesTable(devices) {
  const topDevices = [...devices]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 6);

  if (!topDevices.length) {
    topDevicesTableEl.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">No device data available.</td>
      </tr>
    `;
    return;
  }

  topDevicesTableEl.innerHTML = topDevices.map(device => `
    <tr>
      <td>${device.device_id}</td>
      <td><span class="risk-badge ${getRiskClass(device.risk_level)}">${device.risk_level}</span></td>
      <td>${formatPercent(device.failure_probability)}</td>
      <td>${formatPercent(device.anomaly_score)}</td>
    </tr>
  `).join("");
}

function renderCharts(devices) {
  destroyCharts();

  const riskCounts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  devices.forEach(device => {
    if (riskCounts[device.risk_level] !== undefined) {
      riskCounts[device.risk_level] += 1;
    }
  });

  riskDistributionChart = new Chart(document.getElementById("riskDistributionChart"), {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{
        data: [
          riskCounts.LOW,
          riskCounts.MEDIUM,
          riskCounts.HIGH,
          riskCounts.CRITICAL
        ],
        backgroundColor: ["#22c55e", "#f59e0b", "#fb923c", "#ef4444"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: chartTextColor()
          }
        }
      }
    }
  });

  const sortedBySelected = getSortedDevices(devices, sortSelect.value).slice(0, 8);

  failureProbabilityChart = new Chart(document.getElementById("failureProbabilityChart"), {
    type: "bar",
    data: {
      labels: sortedBySelected.map(d => d.device_id),
      datasets: [{
        label: "Failure Probability",
        data: sortedBySelected.map(d => Number((d.failure_probability * 100).toFixed(2))),
        backgroundColor: "#49a6ff",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: chartTextColor(),
            callback: value => `${value}%`
          },
          grid: { color: chartGridColor() }
        }
      },
      plugins: {
        legend: {
          labels: { color: chartTextColor() }
        }
      }
    }
  });

  latencyPacketLossChart = new Chart(document.getElementById("latencyPacketLossChart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Devices",
        data: devices.map(d => ({
          x: Number(d.latency_ms),
          y: Number(d.packet_loss)
        })),
        backgroundColor: "#38bdf8",
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "Latency (ms)",
            color: chartTextColor()
          },
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        },
        y: {
          title: {
            display: true,
            text: "Packet Loss (%)",
            color: chartTextColor()
          },
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        }
      },
      plugins: {
        legend: {
          labels: { color: chartTextColor() }
        }
      }
    }
  });

  const topMetrics = [...devices]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 6);

  multiMetricChart = new Chart(document.getElementById("multiMetricChart"), {
    type: "bar",
    data: {
      labels: topMetrics.map(d => d.device_id),
      datasets: [
        {
          label: "Anomaly Score %",
          data: topMetrics.map(d => Number((d.anomaly_score * 100).toFixed(2))),
          backgroundColor: "#a855f7",
          borderRadius: 8
        },
        {
          label: "Risk Score %",
          data: topMetrics.map(d => Number((d.risk_score * 100).toFixed(2))),
          backgroundColor: "#ef4444",
          borderRadius: 8
        },
        {
          label: "Bandwidth Util %",
          data: topMetrics.map(d => Number(d.bandwidth_util).toFixed(2)),
          backgroundColor: "#22c55e",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: chartTextColor(),
            callback: value => `${value}%`
          },
          grid: { color: chartGridColor() }
        }
      },
      plugins: {
        legend: {
          labels: { color: chartTextColor() }
        }
      }
    }
  });
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    healthStatusEl.textContent = data.status;
    healthStatusEl.className = "status-badge low";
    healthTimeEl.textContent = `Updated: ${formatDateTime(data.timestamp)}`;
  } catch (error) {
    healthStatusEl.textContent = "offline";
    healthStatusEl.className = "status-badge critical";
    healthTimeEl.textContent = "Backend not reachable";
  }
}

async function fetchAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/stream`);
    const data = await res.json();

    latestDevices = data.devices || [];

    updateKPIs(latestDevices);
    renderInsights(latestDevices);
    renderTopDevicesTable(latestDevices);
    renderCharts(latestDevices);

    lastUpdatedEl.textContent = formatDateTime(data.timestamp);
  } catch (error) {
    insightsListEl.innerHTML = `<div class="empty-text">Failed to load analytics data.</div>`;
    topDevicesTableEl.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Failed to load device analytics.</td>
      </tr>
    `;
  }
}

async function loadAnalyticsPage() {
  await Promise.all([fetchHealth(), fetchAnalytics()]);
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadAnalyticsPage);
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    if (latestDevices.length) {
      renderCharts(latestDevices);
    }
  });
}

loadAnalyticsPage();
=======
const API_BASE = "";

const healthStatusEl = document.getElementById("healthStatus");
const healthTimeEl = document.getElementById("healthTime");
const lastUpdatedEl = document.getElementById("lastUpdated");

const avgFailureEl = document.getElementById("avgFailure");
const avgAnomalyEl = document.getElementById("avgAnomaly");
const avgLatencyEl = document.getElementById("avgLatency");
const highCriticalCountEl = document.getElementById("highCriticalCount");

const insightsListEl = document.getElementById("insightsList");
const topDevicesTableEl = document.getElementById("topDevicesTable");

const refreshBtn = document.getElementById("refreshBtn");
const sortSelect = document.getElementById("sortSelect");

let riskDistributionChart;
let failureProbabilityChart;
let latencyPacketLossChart;
let multiMetricChart;

let latestDevices = [];

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function getRiskClass(level) {
  const risk = String(level).toLowerCase();
  if (risk === "low") return "low";
  if (risk === "medium") return "medium";
  if (risk === "high") return "high";
  if (risk === "critical") return "critical";
  return "neutral";
}

function destroyCharts() {
  [riskDistributionChart, failureProbabilityChart, latencyPacketLossChart, multiMetricChart]
    .forEach(chart => {
      if (chart) chart.destroy();
    });
}

function chartTextColor() {
  return "#c8d4f0";
}

function chartGridColor() {
  return "rgba(255,255,255,0.08)";
}

function getSortedDevices(devices, mode) {
  const cloned = [...devices];

  if (mode === "failure") {
    return cloned.sort((a, b) => b.failure_probability - a.failure_probability);
  }
  if (mode === "anomaly") {
    return cloned.sort((a, b) => b.anomaly_score - a.anomaly_score);
  }
  if (mode === "latency") {
    return cloned.sort((a, b) => b.latency_ms - a.latency_ms);
  }
  return cloned.sort((a, b) => b.risk_score - a.risk_score);
}

function updateKPIs(devices) {
  if (!devices.length) {
    avgFailureEl.textContent = "0%";
    avgAnomalyEl.textContent = "0%";
    avgLatencyEl.textContent = "0 ms";
    highCriticalCountEl.textContent = "0";
    return;
  }

  const avgFailure =
    devices.reduce((sum, d) => sum + Number(d.failure_probability), 0) / devices.length;

  const avgAnomaly =
    devices.reduce((sum, d) => sum + Number(d.anomaly_score), 0) / devices.length;

  const avgLatency =
    devices.reduce((sum, d) => sum + Number(d.latency_ms), 0) / devices.length;

  const highCriticalCount = devices.filter(
    d => d.risk_level === "HIGH" || d.risk_level === "CRITICAL"
  ).length;

  avgFailureEl.textContent = formatPercent(avgFailure);
  avgAnomalyEl.textContent = formatPercent(avgAnomaly);
  avgLatencyEl.textContent = `${avgLatency.toFixed(1)} ms`;
  highCriticalCountEl.textContent = highCriticalCount;
}

function renderInsights(devices) {
  if (!devices.length) {
    insightsListEl.innerHTML = `<div class="empty-text">No insights available.</div>`;
    return;
  }

  const sortedByRisk = [...devices].sort((a, b) => b.risk_score - a.risk_score);
  const topRisk = sortedByRisk[0];

  const sortedByLatency = [...devices].sort((a, b) => b.latency_ms - a.latency_ms);
  const topLatency = sortedByLatency[0];

  const sortedByPacketLoss = [...devices].sort((a, b) => b.packet_loss - a.packet_loss);
  const topPacketLoss = sortedByPacketLoss[0];

  const criticalCount = devices.filter(d => d.risk_level === "CRITICAL").length;

  insightsListEl.innerHTML = `
    <div class="insight-card">
      <h4>Highest Risk Device</h4>
      <p>${topRisk.device_id} currently has the highest risk score at ${formatPercent(topRisk.risk_score)} with a ${topRisk.risk_level} classification.</p>
    </div>

    <div class="insight-card">
      <h4>Latency Watch</h4>
      <p>${topLatency.device_id} is showing the highest latency at ${Number(topLatency.latency_ms).toFixed(2)} ms, which may indicate congestion or unstable routing.</p>
    </div>

    <div class="insight-card">
      <h4>Packet Loss Concern</h4>
      <p>${topPacketLoss.device_id} has the highest packet loss at ${Number(topPacketLoss.packet_loss).toFixed(2)}%, which can directly impact service quality.</p>
    </div>

    <div class="insight-card">
      <h4>Critical Status Summary</h4>
      <p>${criticalCount} device(s) are currently in CRITICAL state in the latest stream snapshot.</p>
    </div>
  `;
}

function renderTopDevicesTable(devices) {
  const topDevices = [...devices]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 6);

  if (!topDevices.length) {
    topDevicesTableEl.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">No device data available.</td>
      </tr>
    `;
    return;
  }

  topDevicesTableEl.innerHTML = topDevices.map(device => `
    <tr>
      <td>${device.device_id}</td>
      <td><span class="risk-badge ${getRiskClass(device.risk_level)}">${device.risk_level}</span></td>
      <td>${formatPercent(device.failure_probability)}</td>
      <td>${formatPercent(device.anomaly_score)}</td>
    </tr>
  `).join("");
}

function renderCharts(devices) {
  destroyCharts();

  const riskCounts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  devices.forEach(device => {
    if (riskCounts[device.risk_level] !== undefined) {
      riskCounts[device.risk_level] += 1;
    }
  });

  riskDistributionChart = new Chart(document.getElementById("riskDistributionChart"), {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{
        data: [
          riskCounts.LOW,
          riskCounts.MEDIUM,
          riskCounts.HIGH,
          riskCounts.CRITICAL
        ],
        backgroundColor: ["#22c55e", "#f59e0b", "#fb923c", "#ef4444"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: chartTextColor()
          }
        }
      }
    }
  });

  const sortedBySelected = getSortedDevices(devices, sortSelect.value).slice(0, 8);

  failureProbabilityChart = new Chart(document.getElementById("failureProbabilityChart"), {
    type: "bar",
    data: {
      labels: sortedBySelected.map(d => d.device_id),
      datasets: [{
        label: "Failure Probability",
        data: sortedBySelected.map(d => Number((d.failure_probability * 100).toFixed(2))),
        backgroundColor: "#49a6ff",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: chartTextColor(),
            callback: value => `${value}%`
          },
          grid: { color: chartGridColor() }
        }
      },
      plugins: {
        legend: {
          labels: { color: chartTextColor() }
        }
      }
    }
  });

  latencyPacketLossChart = new Chart(document.getElementById("latencyPacketLossChart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Devices",
        data: devices.map(d => ({
          x: Number(d.latency_ms),
          y: Number(d.packet_loss)
        })),
        backgroundColor: "#38bdf8",
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "Latency (ms)",
            color: chartTextColor()
          },
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        },
        y: {
          title: {
            display: true,
            text: "Packet Loss (%)",
            color: chartTextColor()
          },
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        }
      },
      plugins: {
        legend: {
          labels: { color: chartTextColor() }
        }
      }
    }
  });

  const topMetrics = [...devices]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 6);

  multiMetricChart = new Chart(document.getElementById("multiMetricChart"), {
    type: "bar",
    data: {
      labels: topMetrics.map(d => d.device_id),
      datasets: [
        {
          label: "Anomaly Score %",
          data: topMetrics.map(d => Number((d.anomaly_score * 100).toFixed(2))),
          backgroundColor: "#a855f7",
          borderRadius: 8
        },
        {
          label: "Risk Score %",
          data: topMetrics.map(d => Number((d.risk_score * 100).toFixed(2))),
          backgroundColor: "#ef4444",
          borderRadius: 8
        },
        {
          label: "Bandwidth Util %",
          data: topMetrics.map(d => Number(d.bandwidth_util).toFixed(2)),
          backgroundColor: "#22c55e",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: chartTextColor() },
          grid: { color: chartGridColor() }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: chartTextColor(),
            callback: value => `${value}%`
          },
          grid: { color: chartGridColor() }
        }
      },
      plugins: {
        legend: {
          labels: { color: chartTextColor() }
        }
      }
    }
  });
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    healthStatusEl.textContent = data.status;
    healthStatusEl.className = "status-badge low";
    healthTimeEl.textContent = `Updated: ${formatDateTime(data.timestamp)}`;
  } catch (error) {
    healthStatusEl.textContent = "offline";
    healthStatusEl.className = "status-badge critical";
    healthTimeEl.textContent = "Backend not reachable";
  }
}

async function fetchAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/stream`);
    const data = await res.json();

    latestDevices = data.devices || [];

    updateKPIs(latestDevices);
    renderInsights(latestDevices);
    renderTopDevicesTable(latestDevices);
    renderCharts(latestDevices);

    lastUpdatedEl.textContent = formatDateTime(data.timestamp);
  } catch (error) {
    insightsListEl.innerHTML = `<div class="empty-text">Failed to load analytics data.</div>`;
    topDevicesTableEl.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Failed to load device analytics.</td>
      </tr>
    `;
  }
}

async function loadAnalyticsPage() {
  await Promise.all([fetchHealth(), fetchAnalytics()]);
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadAnalyticsPage);
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    if (latestDevices.length) {
      renderCharts(latestDevices);
    }
  });
}

loadAnalyticsPage();
>>>>>>> 29145c1d3f19ab501e3bd754b1c5750b570409f8
setInterval(loadAnalyticsPage, 5000);