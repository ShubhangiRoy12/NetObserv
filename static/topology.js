
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
  const radiusX = width * 0.34;
  const radiusY = height * 0.34;

  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;

  return {
    x: centerX + Math.cos(angle) * radiusX,
    y: centerY + Math.sin(angle) * radiusY
  };
}

function buildPositionMap(nodes) {
  const positions = {};
  nodes.forEach((node, index) => {
    positions[node.id] = getNodePosition(index, nodes.length);
  });
  return positions;
}

function renderEdges(edges, positions) {
  edges.forEach(edge => {
    const source = positions[edge.source];
    const target = positions[edge.target];
    if (!source || !target) return;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const line = document.createElement("div");
    line.className = "edge";
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
    el.className = `node ${riskClass(node.risk_level)}`;
    el.style.left = `${pos.x - 48}px`;
    el.style.top = `${pos.y - 27}px`;
    el.innerHTML = `
      <div>${node.label}</div>
      <small>${node.risk_level}</small>
    `;

    el.addEventListener("click", () => showNodeDetails(node));
    topologyCanvas.appendChild(el);
  });
}

function showNodeDetails(node) {
  nodeDetails.innerHTML = `
    <div class="detail-card">
      <h4>${node.label}</h4>
      <div class="detail-grid">
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
  const positions = buildPositionMap(nodes);

  renderEdges(edges, positions);
  renderNodes(nodes, positions);
  renderRiskList(nodes);
  updateStats(nodes, edges);

  topologyStatus.textContent = "Live";
  topologyStatus.className = "status-badge low";
  lastUpdated.textContent = formatDateTime(data.timestamp);

  if (nodes.length) {
    const highestRiskNode = [...nodes].sort((a, b) => b.risk_score - a.risk_score)[0];
    showNodeDetails(highestRiskNode);
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