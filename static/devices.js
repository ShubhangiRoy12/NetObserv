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
  if (type === "Router") return "router";
  if (type === "Switch") return "switch";
  if (type === "Server") return "server";
  return "neutral";
}

function renderDevices(devices) {
  if (!devices.length) {
    deviceTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">No devices found.</td>
      </tr>
    `;
    return;
  }

  deviceTableBody.innerHTML = devices.map((device, index) => {
    const type = getDeviceType(device);

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${device}</td>
        <td><span class="type-badge ${getTypeClass(type)}">${type}</span></td>
        <td><span class="status-badge success">Active</span></td>
      </tr>
    `;
  }).join("");
}

function updateCounts(devices) {
  const routers = devices.filter(d => getDeviceType(d) === "Router").length;
  const switches = devices.filter(d => getDeviceType(d) === "Switch").length;
  const servers = devices.filter(d => getDeviceType(d) === "Server").length;

  totalDevicesEl.textContent = devices.length;
  deviceCountSideEl.textContent = devices.length;

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
    device.toLowerCase().includes(query)
  );

  renderDevices(filtered);
  updateCounts(filtered);
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    healthStatusEl.textContent = data.status;
    healthStatusEl.className = "status-badge success";
    healthTimeEl.textContent = `Updated: ${formatDateTime(data.timestamp)}`;
  } catch (error) {
    healthStatusEl.textContent = "offline";
    healthStatusEl.className = "status-badge neutral";
    healthTimeEl.textContent = "Backend not reachable";
  }
}

async function fetchDevices() {
  try {
    const res = await fetch(`${API_BASE}/devices`);
    const data = await res.json();

    allDevices = data.devices || [];
    renderDevices(allDevices);
    updateCounts(allDevices);
  } catch (error) {
    deviceTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Failed to load device list.</td>
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