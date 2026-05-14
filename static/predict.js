const form = document.getElementById("predictionForm");
const sampleBtn = document.getElementById("sampleBtn");
const normalBtn = document.getElementById("normalBtn");
const riskyBtn = document.getElementById("riskyBtn");
const resetBtn = document.getElementById("resetBtn");

const apiStatusBadge = document.getElementById("apiStatusBadge");
const apiStatusText = document.getElementById("apiStatusText");

const riskBadge = document.getElementById("riskBadge");
const riskScoreValue = document.getElementById("riskScoreValue");
const riskProgressBar = document.getElementById("riskProgressBar");

const failureProbabilityValue = document.getElementById("failureProbabilityValue");
const xgbProbabilityValue = document.getElementById("xgbProbabilityValue");
const anomalyScoreValue = document.getElementById("anomalyScoreValue");
const anomalyFlagValue = document.getElementById("anomalyFlagValue");

const resultDevice = document.getElementById("resultDevice");
const resultTimestamp = document.getElementById("resultTimestamp");

const recommendationText = document.getElementById("recommendationText");
const insightLine1 = document.getElementById("insightLine1");
const insightLine2 = document.getElementById("insightLine2");
const insightLine3 = document.getElementById("insightLine3");

let predictionChart = null;

/* ========================= SAMPLE DATA ========================= */

const sampleData = {
  device_id: "Router-3",
  dur: 2.8,
  sbytes: 18000,
  dbytes: 900,
  sload: 350000,
  dload: 21000,
  spkts: 190,
  dpkts: 20,
  sinpkt: 780,
  dinpkt: 120,
  sjit: 210,
  djit: 30,
  smean: 860,
  dmean: 120
};

const normalData = {
  device_id: "Router-1",
  dur: 0.25,
  sbytes: 800,
  dbytes: 500,
  sload: 25000,
  dload: 12000,
  spkts: 18,
  dpkts: 14,
  sinpkt: 60,
  dinpkt: 42,
  sjit: 8,
  djit: 6,
  smean: 110,
  dmean: 95
};

const riskyData = {
  device_id: "Router-6",
  dur: 7.2,
  sbytes: 42000,
  dbytes: 600,
  sload: 820000,
  dload: 8000,
  spkts: 460,
  dpkts: 12,
  sinpkt: 1700,
  dinpkt: 80,
  sjit: 620,
  djit: 20,
  smean: 1800,
  dmean: 90
};

/* ========================= FORM ========================= */

function fillForm(data) {
  Object.entries(data).forEach(([key, value]) => {
    const input = document.getElementById(key);
    if (input) input.value = value;
  });
}

function formToPayload() {
  return {
    device_id: document.getElementById("device_id").value || "Unknown",
    dur: Number(document.getElementById("dur").value),
    sbytes: Number(document.getElementById("sbytes").value),
    dbytes: Number(document.getElementById("dbytes").value),
    sload: Number(document.getElementById("sload").value),
    dload: Number(document.getElementById("dload").value),
    spkts: Number(document.getElementById("spkts").value),
    dpkts: Number(document.getElementById("dpkts").value),
    sinpkt: Number(document.getElementById("sinpkt").value),
    dinpkt: Number(document.getElementById("dinpkt").value),
    sjit: Number(document.getElementById("sjit").value),
    djit: Number(document.getElementById("djit").value),
    smean: Number(document.getElementById("smean").value),
    dmean: Number(document.getElementById("dmean").value)
  };
}

/* ========================= HELPERS ========================= */

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

function getRiskClass(level) {
  const value = String(level || "").toUpperCase();
  if (value === "LOW") return "low";
  if (value === "MEDIUM") return "medium";
  if (value === "HIGH") return "high";
  if (value === "CRITICAL") return "critical";
  return "neutral";
}

/* ========================= CHART ========================= */

function renderChart(result) {
  const canvas = document.getElementById("predictionChart");
  if (!canvas) return;

  const level = String(result.risk_level || "").toUpperCase();

  let riskColor = "#64748b";
  if (level === "LOW") riskColor = "#22c55e";
  if (level === "MEDIUM") riskColor = "#f59e0b";
  if (level === "HIGH") riskColor = "#fb923c";
  if (level === "CRITICAL") riskColor = "#ef4444";

  const chartData = [
    Number(result.risk_score || 0) * 100,
    Number(result.failure_probability || 0) * 100,
    Number(result.xgb_probability || 0) * 100,
    Number(result.anomaly_score || 0) * 100
  ];

  if (predictionChart) predictionChart.destroy();

  predictionChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Risk", "Failure", "XGB", "Anomaly"],
      datasets: [{
        data: chartData,
        backgroundColor: [
          riskColor,
          "#38bdf8",
          "#818cf8",
          "#f472b6"
        ],
        borderRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (v) => v + "%"
          }
        }
      }
    }
  });
}

/* ========================= UI UPDATE ========================= */

function updateUI(result) {
  const riskClass = getRiskClass(result.risk_level);
  const riskPercent = Number(result.risk_score || 0) * 100;

  riskBadge.textContent = result.risk_level || "UNKNOWN";
  riskBadge.className = `status-badge ${riskClass}`;

  riskScoreValue.textContent = `${riskPercent.toFixed(1)}%`;
  riskProgressBar.style.width = `${riskPercent}%`;
  riskProgressBar.className = `progress-fill ${riskClass}-fill`;

  failureProbabilityValue.textContent = pct(result.failure_probability);
  xgbProbabilityValue.textContent = pct(result.xgb_probability);
  anomalyScoreValue.textContent = pct(result.anomaly_score);
  anomalyFlagValue.textContent = result.anomaly_flag ?? "--";

  resultDevice.textContent = result.device_id || "--";
  resultTimestamp.textContent = result.timestamp || "--";

  recommendationText.textContent =
    result.recommendation || "No recommendation available.";

  renderChart(result);
}

/* ========================= API ========================= */

async function checkHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();

    apiStatusBadge.textContent = data.status || "operational";
    apiStatusBadge.className = "status-badge low";
    apiStatusText.textContent = "Backend connected";
  } catch {
    apiStatusBadge.textContent = "offline";
    apiStatusBadge.className = "status-badge critical";
    apiStatusText.textContent = "Backend not reachable";
  }
}

async function runPrediction(payload) {
  try {
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = "Running...";
    btn.disabled = true;

    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    updateUI(result);

  } catch (err) {
    riskBadge.textContent = "ERROR";
    riskBadge.className = "status-badge critical";
    recommendationText.textContent = "Prediction failed.";
  } finally {
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = "Run Prediction";
    btn.disabled = false;
  }
}

/* ========================= EVENTS ========================= */

form.addEventListener("submit", (e) => {
  e.preventDefault();
  runPrediction(formToPayload());
});

sampleBtn.addEventListener("click", () => fillForm(sampleData));
normalBtn.addEventListener("click", () => fillForm(normalData));
riskyBtn.addEventListener("click", () => fillForm(riskyData));

resetBtn.addEventListener("click", () => {
  setTimeout(() => {
    riskBadge.textContent = "Awaiting Input";
    riskBadge.className = "status-badge neutral";
    riskScoreValue.textContent = "0%";
    riskProgressBar.style.width = "0%";
    failureProbabilityValue.textContent = "0%";
    xgbProbabilityValue.textContent = "0%";
    anomalyScoreValue.textContent = "0%";
    anomalyFlagValue.textContent = "--";
    resultDevice.textContent = "--";
    resultTimestamp.textContent = "--";
    recommendationText.textContent = "Run prediction to see insights.";

    if (predictionChart) {
      predictionChart.destroy();
      predictionChart = null;
    }
  }, 0);
});

/* ========================= INIT ========================= */

checkHealth();