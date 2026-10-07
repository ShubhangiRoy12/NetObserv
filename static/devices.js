
const API_BASE = "";

const healthStatusEl = document.getElementById("healthStatus");
const healthTimeEl = document.getElementById("healthTime");

const deviceCountSideEl = document.getElementById("deviceCountSide");
const totalDevicesEl = document.getElementById("totalDevices");
const routerCountEl = document.getElementById("routerCount");
const switchCountEl = document.getElementById("switchCount");
const serverCountEl = document.getElementById("serverCount");

const routerCountSideEl = document.getElementById("routerCountSide");
const switchCountSideEl = document.getElementById("switchCountSide");
const serverCountSideEl = document.getElementById("serverCountSide");

const deviceTableBody = document.getElementById("deviceTableBody");
const searchInput = document.getElementById("searchInput");
const refreshBtn = document.getElementById("refreshBtn");

let allDevices = [];

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function getDeviceType(deviceName) {
  const name = deviceName.toLowerCase();

  if (name.startsWith("router")) return "Router";
  if (name.startsWith("switch")) return "Switch";
  if (name.startsWith("server")) return "Server";
  return "Unknown";
}

function getTypeClass(type) {
  if (type === "Router") return "type-router";
  if (type === "Switch") return "type-switch";
  if (type === "Server") return "type-server";
  return "neutral";
}

function getRiskClass(riskLevel) {
  const risk = String(riskLevel || "LOW").toLowerCase();
  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${(number * 100).toFixed(1)}%`;
}

function formatPacketLoss(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)}%`;
}

function formatLatency(value) {
  const number = Number(value || 0);
  return `${number.toFixed(0)} ms`;
}

function getRecommendation(device) {
  if (device.risk_level === "CRITICAL") return "Reroute traffic or trigger failover";
  if (device.risk_level === "HIGH") return "Inspect logs and isolate device";
  if (device.risk_level === "MEDIUM") return "Watch closely and reduce load";
  return "Normal monitoring";
}

function renderDevices(devices) {
  if (!devices.length) {
    deviceTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">No devices found.</td>
      </tr>
    `;
    return;
  }

  deviceTableBody.innerHTML = devices.map((device) => {
    const type = getDeviceType(device.device_id);
    const riskClass = getRiskClass(device.risk_level);

    return `
      <tr>
        <td><strong>${device.device_id}</strong></td>
        <td><span class="type-badge ${getTypeClass(type)}">${type}</span></td>
        <td><span class="status-pill ${riskClass}">${device.risk_level || "LOW"}</span></td>
        <td>${formatPercent(device.failure_probability)}</td>
        <td>${formatLatency(device.latency_ms)}</td>
        <td>${formatPacketLoss(device.packet_loss)}</td>
        <td>${getRecommendation(device)}</td>
      </tr>
    `;
  }).join("");
}

function updateCounts(devices) {
  const routers = devices.filter(d => getDeviceType(d.device_id) === "Router").length;
  const switches = devices.filter(d => getDeviceType(d.device_id) === "Switch").length;
  const servers = devices.filter(d => getDeviceType(d.device_id) === "Server").length;

  totalDevicesEl.textContent = devices.length;
  deviceCountSideEl.textContent = `${devices.length} devices`;

  routerCountEl.textContent = routers;
  switchCountEl.textContent = switches;
  serverCountEl.textContent = servers;

  routerCountSideEl.textContent = routers;
  switchCountSideEl.textContent = switches;
  serverCountSideEl.textContent = servers;
}

function filterDevices() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allDevices.filter(device =>
    device.device_id.toLowerCase().includes(query)
  );

  renderDevices(filtered);
  updateCounts(filtered);
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    healthStatusEl.textContent = data.status;
    healthStatusEl.className = "status-pill low";
    healthTimeEl.textContent = `Updated: ${formatDateTime(data.timestamp)}`;
  } catch (error) {
    healthStatusEl.textContent = "offline";
    healthStatusEl.className = "status-pill critical";
    healthTimeEl.textContent = "Backend not reachable";
  }
}

async function fetchDevices() {
  try {
    const res = await fetch(`${API_BASE}/stream`);
    const data = await res.json();

    allDevices = data.devices || [];
    renderDevices(allDevices);
    updateCounts(allDevices);
  } catch (error) {
    deviceTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Failed to load live device telemetry.</td>
      </tr>
    `;
  }
}

async function loadPage() {
  await Promise.all([fetchHealth(), fetchDevices()]);
}

searchInput.addEventListener("input", filterDevices);
refreshBtn.addEventListener("click", loadPage);
loadPage();
