
const topologyCanvas = document.getElementById("topologyCanvas");
const topologyStatus = document.getElementById("topologyStatus");
const lastUpdated = document.getElementById("lastUpdated");
const totalNodes = document.getElementById("totalNodes");
const totalLinks = document.getElementById("totalLinks");
const criticalNodes = document.getElementById("criticalNodes");
const avgRisk = document.getElementById("avgRisk");
const nodeDetails = document.getElementById("nodeDetails");
const riskList = document.getElementById("riskList");
const refreshBtn = document.getElementById("refreshBtn");

let currentTopology = null;
let selectedNodeId = null;
const NODE_WIDTH = 104;
const NODE_HEIGHT = 58;
const HUB_SIZE = 68;

function riskClass(level) {
  const l = String(level).toLowerCase();
  if (l === "critical") return "critical";
  if (l === "high") return "high";
  if (l === "medium") return "medium";
  return "low";
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function getNodePosition(index, total) {
  const width = topologyCanvas.clientWidth || 900;
  const height = topologyCanvas.clientHeight || 560;
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = Math.max(220, width * 0.31);
  const radiusY = Math.max(170, height * 0.29);
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;

  return {
    x: centerX + Math.cos(angle) * radiusX,
    y: centerY + Math.sin(angle) * radiusY
  };
}

function buildPositionMap(nodes) {
  const positions = {};
  const sorted = [...nodes].sort((a, b) => {
    const order = { router: 0, switch: 1, server: 2 };
    return (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.id.localeCompare(b.id);
  });

  sorted.forEach((node, index) => {
    positions[node.id] = getNodePosition(index, sorted.length);
  });

  if (sorted.length) {
    positions.__hub = {
      x: (topologyCanvas.clientWidth || 900) / 2,
      y: (topologyCanvas.clientHeight || 560) / 2
    };
  }

  return positions;
}

function renderEdges(edges, positions) {
  if (positions.__hub) {
    const hub = document.createElement("div");
    hub.className = "topology-hub";
    hub.style.left = `${positions.__hub.x - HUB_SIZE / 2}px`;
    hub.style.top = `${positions.__hub.y - HUB_SIZE / 2}px`;
    hub.innerHTML = `<strong>CORE</strong><span>Backbone</span>`;
    topologyCanvas.appendChild(hub);
  }

  edges.forEach(edge => {
    const source = positions[edge.source];
    const target = positions[edge.target];
    if (!source || !target) return;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const line = document.createElement("div");
    line.className = "topology-edge";
    line.style.width = `${length}px`;
    line.style.left = `${source.x}px`;
    line.style.top = `${source.y}px`;
    line.style.transform = `rotate(${angle}deg)`;

    topologyCanvas.appendChild(line);
  });
}

function renderNodes(nodes, positions) {
  nodes.forEach(node => {
    const pos = positions[node.id];
    if (!pos) return;

    const el = document.createElement("div");
    const selectedClass = selectedNodeId === node.id ? "selected" : "";
    el.className = `topology-node ${node.type} ${riskClass(node.risk_level)} ${selectedClass}`;
    el.style.left = `${pos.x - NODE_WIDTH / 2}px`;
    el.style.top = `${pos.y - NODE_HEIGHT / 2}px`;
    el.innerHTML = `
      <span class="node-icon">${node.type === "router" ? "R" : node.type === "switch" ? "S" : "DB"}</span>
      <div>
        <strong>${node.label}</strong>
        <small>${node.risk_level} · ${formatPercent(node.failure_probability)}</small>
      </div>
    `;

    el.addEventListener("click", () => {
      selectedNodeId = node.id;
      renderTopology(currentTopology);
      showNodeDetails(node);
    });
    topologyCanvas.appendChild(el);
  });
}

function showNodeDetails(node) {
  nodeDetails.innerHTML = `
    <div class="detail-card">
      <h4>${node.label}</h4>
      <div class="detail-grid">
        <div class="detail-row">
          <span>Layer</span>
          <strong>${node.type}</strong>
        </div>
        <div class="detail-row">
          <span>Risk Level</span>
          <strong><span class="risk-pill ${riskClass(node.risk_level)}">${node.risk_level}</span></strong>
        </div>
        <div class="detail-row">
          <span>Risk Score</span>
          <strong>${formatPercent(node.risk_score)}</strong>
        </div>
        <div class="detail-row">
          <span>Failure Probability</span>
          <strong>${formatPercent(node.failure_probability)}</strong>
        </div>
        <div class="detail-row">
          <span>Anomaly Score</span>
          <strong>${formatPercent(node.anomaly_score)}</strong>
        </div>
        <div class="detail-row">
          <span>Action</span>
          <strong>${node.risk_level === "CRITICAL" ? "Failover" : node.risk_level === "HIGH" ? "Isolate" : node.risk_level === "MEDIUM" ? "Watch" : "Monitor"}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderRiskList(nodes) {
  const risky = nodes
    .filter(node => ["HIGH", "CRITICAL"].includes(node.risk_level))
    .sort((a, b) => b.risk_score - a.risk_score);

  if (!risky.length) {
    riskList.innerHTML = `<p class="empty-text">No high-risk nodes right now.</p>`;
    return;
  }

  riskList.innerHTML = risky.map(node => `
    <div class="risk-item">
      <div class="detail-row">
        <strong>${node.label}</strong>
        <span class="risk-pill ${riskClass(node.risk_level)}">${node.risk_level}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-row">
          <span>Risk Score</span>
          <strong>${formatPercent(node.risk_score)}</strong>
        </div>
        <div class="detail-row">
          <span>Failure</span>
          <strong>${formatPercent(node.failure_probability)}</strong>
        </div>
      </div>
    </div>
  `).join("");
}

function updateStats(nodes, edges) {
  totalNodes.textContent = nodes.length;
  totalLinks.textContent = edges.length;
  criticalNodes.textContent = nodes.filter(n => n.risk_level === "CRITICAL").length;

  const avg = nodes.length
    ? nodes.reduce((sum, node) => sum + Number(node.risk_score || 0), 0) / nodes.length
    : 0;

  avgRisk.textContent = formatPercent(avg);
}

function renderTopology(data) {
  currentTopology = data;
  topologyCanvas.innerHTML = "";

  const nodes = data.nodes || [];
  const edges = data.edges || [];
  if (!selectedNodeId && nodes.length) {
    selectedNodeId = [...nodes].sort((a, b) => b.risk_score - a.risk_score)[0].id;
  }
  const positions = buildPositionMap(nodes);

  topologyCanvas.insertAdjacentHTML("beforeend", `
    <div class="graph-orbit orbit-one"></div>
    <div class="graph-orbit orbit-two"></div>
  `);
  renderEdges(edges, positions);
  renderNodes(nodes, positions);
  renderRiskList(nodes);
  updateStats(nodes, edges);

  topologyStatus.textContent = "Live";
  topologyStatus.className = "status-badge low";
  lastUpdated.textContent = formatDateTime(data.timestamp);

  if (nodes.length) {
    const selected = nodes.find(node => node.id === selectedNodeId) || [...nodes].sort((a, b) => b.risk_score - a.risk_score)[0];
    showNodeDetails(selected);
  }
}

async function loadTopology() {
  try {
    const res = await fetch("/topology-data");
    const data = await res.json();
    renderTopology(data);
  } catch (error) {
    topologyStatus.textContent = "Offline";
    topologyStatus.className = "status-badge critical";
    lastUpdated.textContent = "Failed to load topology";
    topologyCanvas.innerHTML = `<div style="padding:20px;color:#99a8c8;">Topology data could not be loaded.</div>`;
  }
}

refreshBtn.addEventListener("click", loadTopology);

loadTopology();
setInterval(loadTopology, 5000);
