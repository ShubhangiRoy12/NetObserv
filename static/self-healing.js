
const healingList = document.getElementById("healingList");
const actionLog = document.getElementById("actionLog");
const refreshBtn = document.getElementById("refreshBtn");

const actionableCountEl = document.getElementById("actionableCount");
const criticalCountEl = document.getElementById("criticalCount");
const executedCountEl = document.getElementById("executedCount");
const modeLabelEl = document.getElementById("modeLabel");
const lastRunTimeEl = document.getElementById("lastRunTime");

let executedActions = [];

function getRiskClass(level) {
  const risk = String(level || "").toLowerCase();
  if (risk === "low") return "low";
  if (risk === "medium") return "medium";
  if (risk === "high") return "high";
  if (risk === "critical") return "critical";
  return "medium";
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatDateTime(value = new Date()) {
  return new Date(value).toLocaleString();
}

function buildActions(device) {
  const actions = [];

  if (device.failureprobability >= 0.8) {
    actions.push("Reroute traffic");
    actions.push("Trigger failover");
  }

  if (device.anomalyflag === 1 || device.anomalyscore >= 0.6) {
    actions.push("Inspect logs");
    actions.push("Isolate device");
  }

  if (device.risklevel === "HIGH" || device.risklevel === "CRITICAL") {
    actions.push("Reduce system load");
    actions.push("Restart device");
  }

  return [...new Set(actions)];
}

function renderLog() {
  if (!executedActions.length) {
    actionLog.innerHTML = `<div class="empty-state">No actions executed yet.</div>`;
    return;
  }

  actionLog.innerHTML = executedActions.slice().reverse().map(item => `
    <div class="log-item">
      <div class="device-title">${item.device}</div>
      <div class="device-meta">${item.action}</div>
      <div class="device-meta">${item.time} · ${item.status}</div>
    </div>
  `).join("");

  executedCountEl.textContent = executedActions.length;
}

function executeAction(deviceId, actionName) {
  executedActions.push({
    device: deviceId,
    action: actionName,
    time: formatDateTime(),
    status: "Executed"
  });

  renderLog();
  modeLabelEl.textContent = "Operational";
  lastRunTimeEl.textContent = formatDateTime();
}

function renderHealing(devices) {
  const riskyDevices = devices.filter(
    device => device.risklevel === "HIGH" || device.risklevel === "CRITICAL"
  );

  actionableCountEl.textContent = riskyDevices.length;
  criticalCountEl.textContent = riskyDevices.filter(d => d.risklevel === "CRITICAL").length;

  if (!riskyDevices.length) {
    healingList.innerHTML = `<div class="empty-state">No remediation actions needed right now.</div>`;
    return;
  }

  healingList.innerHTML = riskyDevices.map(device => {
    const actions = buildActions(device);
    const tags = actions.map(action => `<span class="tag">${action}</span>`).join("");

    return `
      <div class="healing-item">
        <div class="healing-top">
          <div>
            <div class="device-title">${device.deviceid}</div>
            <div class="device-meta">
              Failure: ${formatPercent(device.failureprobability)} ·
              Anomaly: ${formatPercent(device.anomalyscore)}
            </div>
          </div>
          <span class="risk-badge ${getRiskClass(device.risklevel)}">${device.risklevel}</span>
        </div>

        <div class="device-meta">${device.recommendation}</div>

        <div class="action-tags">${tags}</div>

        <div class="row-actions">
          ${actions.map(action => `
            <button class="btn-action" data-device="${device.deviceid}" data-action="${action}">
              ${action}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".btn-action").forEach(button => {
    button.addEventListener("click", () => {
      executeAction(button.dataset.device, button.dataset.action);
    });
  });
}

async function loadHealingData() {
  try {
    const res = await fetch("/stream");
    const data = await res.json();
    const devices = data.devices || [];

    renderHealing(devices);
    lastRunTimeEl.textContent = formatDateTime(data.timestamp);
  } catch (error) {
    healingList.innerHTML = `<div class="empty-state">Unable to load recommendations.</div>`;
  }
}

refreshBtn.addEventListener("click", loadHealingData);

loadHealingData();
setInterval(loadHealingData, 7000);