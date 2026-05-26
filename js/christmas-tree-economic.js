const DATA_URL = "/data/christmas-tree-economic.json";
const WEEK_COUNT = 52;
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const QUARTER_COLORS = {
  Q1: "#3b82f6",
  Q2: "#22c55e",
  Q3: "#facc15",
  Q4: "#ef4444"
};

const state = {
  data: null,
  records: [],
  years: [],
  maxValue: 1,
  mode: "v0",
  activeYear: 2024,
  activeWeek: 10,
  activeQuarter: "Q2",
  sliceType: "quarter",
  showRibbon: true,
  showEvents: true,
  isBusy: false,
  THREE: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  root: null,
  overlay: null,
  labels: null,
  raycaster: null,
  mouse: null,
  hitTargets: [],
  rafStarted: false
};

const els = {
  wrap: document.querySelector("[data-canvas-wrap]"),
  loading: document.querySelector("[data-loading]"),
  fallback: document.querySelector("[data-fallback]"),
  tooltip: document.querySelector("[data-tooltip]"),
  flipKicker: document.querySelector("[data-flip-kicker]"),
  modeButtons: [...document.querySelectorAll("[data-mode-button]")],
  cameraButtons: [...document.querySelectorAll("[data-camera-button]")],
  ribbonToggle: document.querySelector("[data-toggle-ribbon]"),
  eventsToggle: document.querySelector("[data-toggle-events]"),
  yearCard: document.querySelector("[data-year-card]"),
  yearPrev: document.querySelector("[data-year-prev]"),
  yearNext: document.querySelector("[data-year-next]"),
  quarterSelect: document.querySelector("[data-quarter-select]"),
  weekSelect: document.querySelector("[data-week-select]"),
  sameWeek: document.querySelector("[data-same-week]"),
  sameQuarter: document.querySelector("[data-same-quarter]"),
  events: document.querySelector("[data-events]"),
  suggestions: document.querySelector("[data-suggestions]"),
  timeline: document.querySelector("[data-timeline]"),
  scaleLabel: document.querySelector("[data-scale-label]"),
  transitionPhase: document.querySelector("[data-transition-phase]")
};

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function quarterForWeek(week) {
  if (week <= 13) return "Q1";
  if (week <= 26) return "Q2";
  if (week <= 39) return "Q3";
  return "Q4";
}

function quarterStart(quarter) {
  return { Q1: 1, Q2: 14, Q3: 27, Q4: 40 }[quarter] || 1;
}

function quarterDepth(quarter) {
  return { Q1: -3.0, Q2: -1.0, Q3: 1.0, Q4: 3.0 }[quarter] || 0;
}

function weekDate(year, week) {
  const date = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  return date.toISOString().slice(0, 10);
}

function normalizeData(data) {
  return data.series.flatMap((entry) =>
    entry.values.slice(0, WEEK_COUNT).map((value, index) => {
      const week = index + 1;
      return {
        id: `${entry.year}-W${String(week).padStart(2, "0")}`,
        year: entry.year,
        week,
        date: weekDate(entry.year, week),
        quarter: quarterForWeek(week),
        value: Number(value)
      };
    })
  );
}

function formatValue(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(2)} 億 TWD`;
  return `${Math.round(value).toLocaleString("zh-TW")} 萬 TWD`;
}

function recordsForYear(year) {
  return state.records.filter((record) => record.year === year);
}

function recordsForQuarter(quarter) {
  return state.records.filter((record) => record.quarter === quarter);
}

function recordsForYearQuarter(year, quarter) {
  return state.records.filter((record) => record.year === year && record.quarter === quarter);
}

function v0Position(record) {
  const T = state.THREE;
  const yearIndex = state.years.indexOf(record.year);
  const absolute = yearIndex * WEEK_COUNT + record.week - 1;
  const x = absolute * 0.12 - ((state.years.length * WEEK_COUNT) * 0.12) / 2;
  const angle = -((record.week - 1) / WEEK_COUNT) * Math.PI * 2;
  const radius = 0.62 + (record.value / state.maxValue) * 5.8;
  return new T.Vector3(x, Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function v1Position(record, year = state.activeYear) {
  const T = state.THREE;
  const x = (record.week - 26.5) * 0.34;
  const y = (record.value / state.maxValue) * 10;
  const z = (record.year - year) * 1.8;
  return new T.Vector3(x, y, z);
}

function v2WeekPosition(record, selectedWeek = state.activeWeek) {
  const T = state.THREE;
  const yearIndex = state.years.indexOf(record.year);
  const x = (yearIndex - (state.years.length - 1) / 2) * 2.15;
  const y = (record.value / state.maxValue) * 10;
  const z = quarterDepth(quarterForWeek(selectedWeek));
  return new T.Vector3(x, y, z);
}

function v2QuarterPosition(record, quarter = state.activeQuarter) {
  const T = state.THREE;
  const yearIndex = state.years.indexOf(record.year);
  const segmentWidth = 2.72;
  const weekStep = 1.9 / 12;
  const weekOffset = record.week - quarterStart(quarter);
  const x = (yearIndex - (state.years.length - 1) / 2) * segmentWidth + (weekOffset - 6) * weekStep;
  const y = (record.value / state.maxValue) * 10;
  const z = quarterDepth(quarter);
  return new T.Vector3(x, y, z);
}

function material(color, opacity = 1) {
  return new state.THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function meshMaterial(color, opacity = 0.2) {
  return new state.THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: state.THREE.DoubleSide,
    depthWrite: false
  });
}

function setOpacity(group, opacity) {
  if (!group) return;
  group.traverse((object) => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((mat) => {
      mat.transparent = true;
      mat.opacity = opacity * (mat.userData.baseOpacity ?? 1);
    });
  });
}

function addLine(group, points, color, opacity = 1) {
  const line = new state.THREE.Line(
    new state.THREE.BufferGeometry().setFromPoints(points),
    material(color, opacity)
  );
  line.material.userData.baseOpacity = opacity;
  group.add(line);
  return line;
}

function addDashedLine(group, points, color, opacity = 1) {
  const line = new state.THREE.Line(
    new state.THREE.BufferGeometry().setFromPoints(points),
    new state.THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.25, gapSize: 0.18 })
  );
  line.computeLineDistances();
  line.material.userData.baseOpacity = opacity;
  group.add(line);
  return line;
}

function addPoint(group, position, color, record, radius = 0.055) {
  const point = new state.THREE.Mesh(
    new state.THREE.SphereGeometry(radius, 12, 10),
    new state.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
  );
  point.material.userData.baseOpacity = 1;
  point.position.copy(position);
  point.userData.record = record;
  point.userData.hit = true;
  group.add(point);
  state.hitTargets.push(point);
  return point;
}

function addRibbon(group, records, getPosition, color, opacity = 0.18) {
  if (!records.length) return null;
  const vertices = [];
  for (let index = 0; index < records.length - 1; index += 1) {
    const p1 = getPosition(records[index]);
    const p2 = getPosition(records[index + 1]);
    const b1 = new state.THREE.Vector3(p1.x, 0, p1.z);
    const b2 = new state.THREE.Vector3(p2.x, 0, p2.z);
    vertices.push(b1.x, b1.y, b1.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    vertices.push(b1.x, b1.y, b1.z, p2.x, p2.y, p2.z, b2.x, b2.y, b2.z);
  }
  const geometry = new state.THREE.BufferGeometry();
  geometry.setAttribute("position", new state.THREE.Float32BufferAttribute(vertices, 3));
  const mesh = new state.THREE.Mesh(geometry, meshMaterial(color, opacity));
  mesh.material.userData.baseOpacity = opacity;
  group.add(mesh);
  return mesh;
}

function makeTextSprite(text, color = "#e5edf8", size = 0.65) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "800 42px Inter, sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const sprite = new state.THREE.Sprite(new state.THREE.SpriteMaterial({
    map: new state.THREE.CanvasTexture(canvas),
    transparent: true
  }));
  sprite.material.userData.baseOpacity = 1;
  sprite.scale.set(size * 3.4, size * 0.85, 1);
  return sprite;
}

function addLabel(group, text, position, color = "#e5edf8", size = 0.55) {
  const label = makeTextSprite(text, color, size);
  label.position.copy(position);
  group.add(label);
  return label;
}

function addV0Guides(group) {
  const start = v0Position(state.records[0]).x + 3.6;
  const maxRadius = 6.4;
  addLine(group, [new state.THREE.Vector3(-22, 0, 0), new state.THREE.Vector3(22, 0, 0)], "#94a3b8", 0.55);
  [0.25, 0.5, 0.75, 1].forEach((step) => {
    const curve = new state.THREE.EllipseCurve(0, 0, maxRadius * step, maxRadius * step, 0, Math.PI * 2);
    addLine(group, curve.getPoints(96).map((point) => new state.THREE.Vector3(start, point.x, point.y)), "#94a3b8", 0.44);
    addLabel(group, formatValue(state.maxValue * step), new state.THREE.Vector3(start, maxRadius * step + 0.35, 0), "#cbd5e1", 0.42);
  });
}

function renderV0(group = state.root, options = {}) {
  const dim = options.dim ?? false;
  addV0Guides(group);
  const records = state.records;
  for (let index = 0; index < records.length - 1; index += 1) {
    const current = records[index];
    const next = records[index + 1];
    const opacity = dim && current.year !== state.activeYear ? 0.12 : 1;
    addLine(group, [v0Position(current), v0Position(next)], QUARTER_COLORS[current.quarter], opacity);
    if (state.showRibbon && opacity > 0.2) addRibbon(group, [current, next], v0Position, QUARTER_COLORS[current.quarter], 0.12);
  }
  state.years.forEach((year) => {
    const yearRecords = recordsForYear(year);
    addLabel(group, String(year), v0Position(yearRecords[0]).add(new state.THREE.Vector3(0, -7, 0)), "#e5edf8", 0.45);
  });
  records.filter((record) => record.week % 2 === 1).forEach((record) => {
    const opacity = dim && record.year !== state.activeYear ? 0.12 : 1;
    const point = addPoint(group, v0Position(record), QUARTER_COLORS[record.quarter], record, 0.045);
    point.material.opacity = opacity;
  });
  addEventMarkers(group);
}

function renderV1(group = state.root, year = state.activeYear) {
  [year - 1, year, year + 1].filter((item) => state.years.includes(item)).forEach((targetYear) => {
    const records = recordsForYear(targetYear);
    const opacity = targetYear === year ? 1 : 0.25;
    for (let index = 0; index < records.length - 1; index += 1) {
      addLine(group, [v1Position(records[index], year), v1Position(records[index + 1], year)], QUARTER_COLORS[records[index].quarter], opacity);
    }
    if (targetYear === year && state.showRibbon) {
      QUARTERS.forEach((quarter) => addRibbon(group, recordsForYearQuarter(targetYear, quarter), (record) => v1Position(record, year), QUARTER_COLORS[quarter], 0.16));
      records.forEach((record) => addPoint(group, v1Position(record, year), QUARTER_COLORS[record.quarter], record, 0.06));
    }
    addLabel(group, String(targetYear), new state.THREE.Vector3(-9.7, 0.6, (targetYear - year) * 1.8), targetYear === year ? "#e5edf8" : "#94a3b8", 0.5);
  });
  addLine(group, [new state.THREE.Vector3(-9, 0, 0), new state.THREE.Vector3(9, 0, 0)], "#94a3b8", 0.55);
  addLine(group, [new state.THREE.Vector3(-9, 0, 0), new state.THREE.Vector3(-9, 10.5, 0)], "#94a3b8", 0.55);
}

function v2QuarterTotalPoint(year, quarter, total, totals) {
  const segmentWidth = 2.72;
  const yearIndex = state.years.indexOf(year);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const normalized = max === min ? 0.5 : (total - min) / (max - min);
  return new state.THREE.Vector3((yearIndex - (state.years.length - 1) / 2) * segmentWidth, 10.9 + normalized * 2.1, quarterDepth(quarter));
}

function addV2Guides(group) {
  const z = quarterDepth(state.activeQuarter) - 3.6;
  [1000, 2000, 3000].forEach((value) => {
    const y = (value / state.maxValue) * 10;
    addLine(group, [new state.THREE.Vector3(-9.4, y, z), new state.THREE.Vector3(9.4, y, z)], "#334155", 0.52);
    addLabel(group, `${value}${value === 2000 ? " (基準面)" : value === 3000 ? " (主數據)" : ""}`, new state.THREE.Vector3(-10.3, y, z), "#94a3b8", 0.45);
  });
}

function renderV2Week(group = state.root, selectedWeek = state.activeWeek) {
  const records = state.years.map((year) => state.records.find((record) => record.year === year && record.week === selectedWeek)).filter(Boolean);
  const color = QUARTER_COLORS[quarterForWeek(selectedWeek)];
  addLine(group, records.map((record) => v2WeekPosition(record, selectedWeek)), color, 1);
  records.forEach((record) => addPoint(group, v2WeekPosition(record, selectedWeek), color, record, 0.08));
}

function renderV2Quarter(group = state.root, selectedQuarter = state.activeQuarter) {
  addV2Guides(group);
  QUARTERS.forEach((quarter) => {
    const active = quarter === selectedQuarter;
    const color = QUARTER_COLORS[quarter];
    const totals = state.years.map((year) => recordsForYearQuarter(year, quarter).reduce((sum, record) => sum + record.value, 0));
    state.years.forEach((year) => {
      const records = recordsForYearQuarter(year, quarter);
      const opacity = active ? 1 : 0.12;
      const points = records.map((record) => v2QuarterPosition(record, quarter));
      addLine(group, points, color, opacity);
      if (active && state.showRibbon) addRibbon(group, records, (record) => v2QuarterPosition(record, quarter), color, 0.22);
      if (active) {
        const mid = records[6];
        addPoint(group, v2QuarterPosition(mid, quarter), color, mid, 0.07);
      }
    });
    const totalPoints = state.years.map((year, index) => {
      const total = totals[index];
      return v2QuarterTotalPoint(year, quarter, total, totals);
    });
    if (active) {
      addDashedLine(group, totalPoints, "#4ade80", 0.95);
      state.years.forEach((year, index) => {
        addLabel(group, `${year} ${quarter}: ${(totals[index] / 1000).toFixed(1)}k`, totalPoints[index].clone().add(new state.THREE.Vector3(0, 0.35, 0)), "#ffffff", 0.38);
      });
    } else {
      addLine(group, totalPoints, color, 0.12);
    }
  });
}

function renderV2(group = state.root) {
  if (state.sliceType === "week") renderV2Week(group, state.activeWeek);
  else renderV2Quarter(group, state.activeQuarter);
  addEventMarkers(group);
}

function addEventMarkers(group = state.root) {
  if (!state.showEvents) return;
  state.data.events.forEach((event) => {
    const record = state.records.find((item) => item.year === event.year && item.week === event.weekStart);
    if (!record) return;
    const position = state.mode === "v1" ? v1Position(record) : state.mode === "v2" ? (state.sliceType === "week" ? v2WeekPosition(record) : v2QuarterPosition(record, record.quarter)) : v0Position(record);
    addPoint(group, position, event.impactLevel === "high" ? "#fb7185" : "#f59e0b", { ...record, eventTitle: event.title }, event.impactLevel === "high" ? 0.14 : 0.11);
  });
}

function clearGroup(group) {
  if (!group) return;
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => mat.dispose?.());
    }
  });
  state.scene.remove(group);
}

function resetRoot() {
  clearGroup(state.root);
  clearGroup(state.overlay);
  clearGroup(state.labels);
  state.root = new state.THREE.Group();
  state.overlay = new state.THREE.Group();
  state.labels = new state.THREE.Group();
  state.scene.add(state.root, state.overlay, state.labels);
  state.hitTargets = [];
}

function renderCurrent() {
  resetRoot();
  if (state.mode === "v0") renderV0(state.root);
  if (state.mode === "v1") renderV1(state.root, state.activeYear);
  if (state.mode === "v2") renderV2(state.root);
  updateUi();
  applyCamera(state.mode === "v0" ? "side" : state.mode === "v1" ? "free" : "side");
}

function buildStaticRootForCurrent() {
  const group = new state.THREE.Group();
  state.scene.add(group);
  const previousRoot = state.root;
  const previousOverlay = state.overlay;
  const previousTargets = state.hitTargets;
  state.root = group;
  state.overlay = new state.THREE.Group();
  state.hitTargets = [];
  if (state.mode === "v0") renderV0(group);
  if (state.mode === "v1") renderV1(group, state.activeYear);
  if (state.mode === "v2") renderV2(group);
  state.root = previousRoot;
  state.overlay = previousOverlay;
  state.hitTargets = previousTargets;
  return group;
}

async function softenCommit() {
  const finalRoot = buildStaticRootForCurrent();
  setOpacity(finalRoot, 0);
  const start = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const raw = Math.min((now - start) / 460, 1);
      const progress = easeInOut(raw);
      setOpacity(finalRoot, progress);
      setOpacity(state.root, 0.22 * (1 - progress));
      setOpacity(state.overlay, 1 - progress);
      if (raw < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  clearGroup(state.root);
  clearGroup(state.overlay);
  state.root = finalRoot;
  state.overlay = new state.THREE.Group();
  state.scene.add(state.overlay);
  state.hitTargets = [];
  state.root.traverse((object) => {
    if (object.userData?.hit) state.hitTargets.push(object);
  });
}

function dynamicLine(group, records, color, opacity = 1) {
  const geometry = new state.THREE.BufferGeometry();
  geometry.setAttribute("position", new state.THREE.BufferAttribute(new Float32Array(records.length * 3), 3));
  const line = new state.THREE.Line(geometry, material(color, opacity));
  line.userData.records = records;
  group.add(line);
  return line;
}

function updateDynamicLine(line, resolver) {
  const position = line.geometry.getAttribute("position");
  line.userData.records.forEach((record, index) => {
    const point = resolver(record);
    position.setXYZ(index, point.x, point.y, point.z);
  });
  position.needsUpdate = true;
}

function dynamicRibbon(group, records, color, opacity = 0.18) {
  const mesh = new state.THREE.Mesh(new state.THREE.BufferGeometry(), meshMaterial(color, opacity));
  mesh.userData.records = records;
  group.add(mesh);
  return mesh;
}

function updateDynamicRibbon(mesh, resolver) {
  const vertices = [];
  const records = mesh.userData.records;
  for (let index = 0; index < records.length - 1; index += 1) {
    const p1 = resolver(records[index]);
    const p2 = resolver(records[index + 1]);
    const b1 = new state.THREE.Vector3(p1.x, 0, p1.z);
    const b2 = new state.THREE.Vector3(p2.x, 0, p2.z);
    vertices.push(b1.x, b1.y, b1.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    vertices.push(b1.x, b1.y, b1.z, p2.x, p2.y, p2.z, b2.x, b2.y, b2.z);
  }
  mesh.geometry.dispose();
  mesh.geometry = new state.THREE.BufferGeometry();
  mesh.geometry.setAttribute("position", new state.THREE.Float32BufferAttribute(vertices, 3));
}

function transitionItems(type, payload) {
  if (type === "year") return recordsForYear(payload.year ?? state.activeYear);
  if (type === "week") return state.records.filter((record) => record.week === (payload.week ?? state.activeWeek));
  if (type === "event") {
    const event = payload.event;
    const start = Math.max(1, Number(event.weekStart) - 4);
    const end = Math.min(WEEK_COUNT, Number(event.weekEnd || event.weekStart) + 4);
    return state.records.filter((record) => record.week >= start && record.week <= end);
  }
  return recordsForQuarter(payload.quarter ?? state.activeQuarter);
}

function sourcePosition(record, fromMode, payload) {
  if (fromMode === "v1") return v1Position(record, state.activeYear);
  if (fromMode === "v2") return state.sliceType === "week" ? v2WeekPosition(record, state.activeWeek) : v2QuarterPosition(record, state.activeQuarter);
  return v0Position(record);
}

function targetPosition(record, toMode, type, payload) {
  if (toMode === "v1") return v1Position(record, payload.year ?? record.year);
  if (toMode === "v2" && type === "week") return v2WeekPosition(record, payload.week ?? state.activeWeek);
  if (toMode === "v2") return v2QuarterPosition(record, payload.quarter ?? state.activeQuarter);
  return v0Position(record);
}

function bridgePosition(record, fromMode, type, payload) {
  const point = sourcePosition(record, fromMode, payload).clone();
  point.y += type === "week" ? 1.4 : 0.9;
  point.z += type === "quarter" ? 3.0 : 2.2;
  return point;
}

function phaseFor(type, progress) {
  if (progress < 0.2) return type === "year" ? "Highlighting year" : type === "quarter" ? "Highlighting quarter" : "Highlighting week";
  if (progress < 0.48) return type === "year" ? "Cutting year ring" : type === "quarter" ? "Extracting quarter slice" : "Extracting same-week points";
  if (progress < 0.82) return type === "year" ? "Unrolling weeks" : type === "quarter" ? "Arranging yearly panels" : "Arranging years";
  return "Committing analysis view";
}

async function runCinematic(toMode, type, payload = {}) {
  if (state.isBusy) return;
  state.isBusy = true;
  lockUi(true);
  const fromMode = state.mode;
  const records = transitionItems(type, payload);
  const color = type === "year" ? "#f8fafc" : type === "event" ? "#f59e0b" : QUARTER_COLORS[payload.quarter || quarterForWeek(payload.week || state.activeWeek)];

  resetRoot();
  renderV0(state.root, { dim: true });
  setOpacity(state.root, 0.22);
  const lineGroups = [];
  const ribbonGroups = [];
  if (type === "quarter" || type === "event") {
    state.years.forEach((year) => {
      const yearRecords = records.filter((record) => record.year === year);
      if (!yearRecords.length) return;
      lineGroups.push(dynamicLine(state.overlay, yearRecords, color, 1));
      ribbonGroups.push(dynamicRibbon(state.overlay, yearRecords, color, 0.2));
    });
  } else {
    lineGroups.push(dynamicLine(state.overlay, records, color, 1));
  }
  const points = records.filter((record) => type !== "year" || record.week % 4 === 1).map((record) => addPoint(state.overlay, sourcePosition(record, fromMode, payload), QUARTER_COLORS[record.quarter] || color, record, 0.075));

  const start = performance.now();
  const duration = type === "year" ? 3000 : 2600;
  await new Promise((resolve) => {
    function frame(now) {
      const raw = Math.min((now - start) / duration, 1);
      const progress = easeInOut(raw);
      els.scaleLabel.textContent = `Transition: ${phaseFor(type, raw)}`;
      if (els.transitionPhase) els.transitionPhase.textContent = phaseFor(type, raw);

      const resolver = (record) => {
        const from = sourcePosition(record, fromMode, payload);
        const bridge = bridgePosition(record, fromMode, type, payload);
        const to = targetPosition(record, toMode, type, payload);
        if (progress < 0.34) return from.lerp(bridge, progress / 0.34);
        return bridge.lerp(to, (progress - 0.34) / 0.66);
      };
      lineGroups.forEach((line) => updateDynamicLine(line, resolver));
      ribbonGroups.forEach((mesh) => updateDynamicRibbon(mesh, resolver));
      points.forEach((point) => point.position.copy(resolver(point.userData.record)));
      setOpacity(state.overlay, Math.min(1, 0.2 + raw * 1.2));

      if (raw < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });

  if (toMode === "v1") {
    state.activeYear = payload.year ?? payload.activeYear ?? state.activeYear;
  }
  if (toMode === "v2") {
    if (type === "week" || type === "event") {
      state.activeWeek = payload.week ?? payload.event?.weekStart ?? state.activeWeek;
      state.activeQuarter = quarterForWeek(state.activeWeek);
      state.sliceType = "week";
    } else {
      state.activeQuarter = payload.quarter ?? state.activeQuarter;
      state.sliceType = "quarter";
    }
  }
  state.mode = toMode;
  updateUi();
  await softenCommit();
  applyCamera(state.mode === "v0" ? "side" : state.mode === "v1" ? "free" : "side");
  lockUi(false);
  state.isBusy = false;
  if (els.transitionPhase) els.transitionPhase.textContent = "Idle";
}

async function runPageFlip(payload = {}) {
  if (state.isBusy) return;
  state.isBusy = true;
  lockUi(true);
  const oldRoot = state.root;
  const oldYear = state.activeYear;
  const oldQuarter = state.activeQuarter;
  const nextYear = payload.year ?? state.activeYear;
  const nextQuarter = payload.quarter ?? state.activeQuarter;
  const direction = state.mode === "v1"
    ? Math.sign(state.years.indexOf(nextYear) - state.years.indexOf(oldYear)) || 1
    : Math.sign(QUARTERS.indexOf(nextQuarter) - QUARTERS.indexOf(oldQuarter)) || 1;

  state.root = new state.THREE.Group();
  state.scene.add(state.root);
  state.hitTargets = [];
  if (state.mode === "v1") {
    state.activeYear = nextYear;
    renderV1(state.root, nextYear);
  } else {
    state.activeQuarter = nextQuarter;
    state.sliceType = "quarter";
    renderV2Quarter(state.root, nextQuarter);
  }
  state.root.position.x = direction * 5.8;
  setOpacity(state.root, 0);

  const start = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const raw = Math.min((now - start) / 980, 1);
      const progress = easeInOut(raw);
      const phase = state.mode === "v1" ? "Flipping year" : "Flipping quarter";
      if (els.transitionPhase) els.transitionPhase.textContent = phase;
      els.scaleLabel.textContent = `Transition: ${phase}`;
      state.root.position.x = direction * 5.8 * (1 - progress);
      setOpacity(state.root, progress);
      if (oldRoot) {
        oldRoot.position.x = -direction * 5.8 * progress;
        setOpacity(oldRoot, 1 - progress);
      }
      if (raw < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  clearGroup(oldRoot);
  lockUi(false);
  updateUi();
  state.isBusy = false;
  if (els.transitionPhase) els.transitionPhase.textContent = "Idle";
}

function lockUi(locked) {
  [
    ...els.modeButtons,
    ...els.cameraButtons,
    els.ribbonToggle,
    els.eventsToggle,
    els.yearPrev,
    els.yearNext,
    els.quarterSelect,
    els.weekSelect,
    els.sameWeek,
    els.sameQuarter
  ].forEach((element) => {
    if (element) element.disabled = locked;
  });
}

function applyCamera(mode) {
  const target = new state.THREE.Vector3(0, 0, 0);
  if (mode === "base") {
    target.set(v0Position(state.records[0]).x + 3.6, 0, 0);
    state.camera.position.set(target.x - 22, 0.2, 0.1);
  } else if (mode === "free") {
    state.camera.position.set(15, 12, 22);
  } else {
    state.camera.position.set(0, 7, 28);
  }
  state.controls.target.copy(target);
  state.controls.update();
  els.cameraButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.cameraButton === mode));
}

function updateUi() {
  els.modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.modeButton === state.mode));
  if (els.flipKicker) els.flipKicker.textContent = state.mode === "v2" ? "Active Quarter" : "Active Year";
  els.yearCard.textContent = state.mode === "v2" ? state.activeQuarter : state.activeYear;
  els.quarterSelect.value = state.activeQuarter;
  els.weekSelect.value = String(state.activeWeek);
  els.timeline.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.year) === state.activeYear));
  els.scaleLabel.textContent = `Scale Disk: max ${formatValue(state.maxValue)}`;
}

function showTooltip(record, event) {
  const eventText = record.eventTitle || "";
  els.tooltip.innerHTML = `
    <strong>${record.year} W${String(record.week).padStart(2, "0")} ${record.quarter}</strong>
    <span>${escapeHtml(record.date)} | ${formatValue(record.value)}</span>
    ${eventText ? `<span>Event: ${escapeHtml(eventText)}</span>` : ""}
  `;
  const rect = els.wrap.getBoundingClientRect();
  els.tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, rect.width - 270)}px`;
  els.tooltip.style.top = `${Math.max(event.clientY - rect.top + 14, 10)}px`;
  els.tooltip.hidden = false;
}

function pick(event) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.mouse, state.camera);
  return state.raycaster.intersectObjects(state.hitTargets, false)[0]?.object?.userData?.record || null;
}

function onPointerMove(event) {
  const record = pick(event);
  if (!record) {
    els.tooltip.hidden = true;
    return;
  }
  showTooltip(record, event);
}

function onPointerClick(event) {
  const record = pick(event);
  if (!record || state.isBusy) return;
  if (state.mode === "v0") runCinematic("v1", "year", { year: record.year });
  else if (state.mode === "v1") runCinematic("v2", "week", { week: record.week });
  else runCinematic("v1", "year", { year: record.year });
}

function onResize() {
  const rect = els.wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  state.camera.aspect = rect.width / rect.height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(rect.width, rect.height, false);
}

function animate() {
  requestAnimationFrame(animate);
  state.controls.update();
  state.renderer.render(state.scene, state.camera);
}

function buildStaticUi() {
  for (let week = 1; week <= WEEK_COUNT; week += 1) {
    const option = document.createElement("option");
    option.value = String(week);
    option.textContent = `W${String(week).padStart(2, "0")}`;
    els.weekSelect.append(option);
  }
  state.years.forEach((year) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.year = String(year);
    button.textContent = String(year);
    button.addEventListener("click", () => {
      if (state.mode === "v1") runPageFlip({ year });
      else runCinematic("v1", "year", { year });
    });
    els.timeline.append(button);
  });
  els.events.innerHTML = "";
  state.data.events.forEach((event) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cte-event";
    button.innerHTML = `<strong>${escapeHtml(event.title)}</strong><span>${event.year} W${String(event.weekStart).padStart(2, "0")} | ${escapeHtml(event.category)}</span>`;
    button.addEventListener("click", () => runCinematic("v2", "event", { event }));
    els.events.append(button);
  });
}

function bindEvents() {
  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.modeButton;
      if (target === state.mode) return;
      if (target === "v0") runCinematic("v0", state.mode === "v1" ? "year" : state.sliceType === "week" ? "week" : "quarter", { year: state.activeYear, week: state.activeWeek, quarter: state.activeQuarter });
      if (target === "v1") runCinematic("v1", "year", { year: state.activeYear });
      if (target === "v2") runCinematic("v2", state.sliceType === "week" ? "week" : "quarter", { week: state.activeWeek, quarter: state.activeQuarter });
    });
  });
  els.cameraButtons.forEach((button) => button.addEventListener("click", () => applyCamera(button.dataset.cameraButton)));
  els.ribbonToggle.addEventListener("change", () => {
    state.showRibbon = els.ribbonToggle.checked;
    renderCurrent();
  });
  els.eventsToggle.addEventListener("change", () => {
    state.showEvents = els.eventsToggle.checked;
    renderCurrent();
  });
  els.yearPrev.addEventListener("click", () => {
    if (state.mode === "v2") {
      const index = Math.max(0, QUARTERS.indexOf(state.activeQuarter) - 1);
      runPageFlip({ quarter: QUARTERS[index] });
      return;
    }
    const index = Math.max(0, state.years.indexOf(state.activeYear) - 1);
    if (state.mode === "v1") runPageFlip({ year: state.years[index] });
    else runCinematic("v1", "year", { year: state.years[index] });
  });
  els.yearNext.addEventListener("click", () => {
    if (state.mode === "v2") {
      const index = Math.min(QUARTERS.length - 1, QUARTERS.indexOf(state.activeQuarter) + 1);
      runPageFlip({ quarter: QUARTERS[index] });
      return;
    }
    const index = Math.min(state.years.length - 1, state.years.indexOf(state.activeYear) + 1);
    if (state.mode === "v1") runPageFlip({ year: state.years[index] });
    else runCinematic("v1", "year", { year: state.years[index] });
  });
  els.quarterSelect.addEventListener("change", () => {
    const quarter = els.quarterSelect.value;
    if (state.mode === "v2" && state.sliceType === "quarter") runPageFlip({ quarter });
    else runCinematic("v2", "quarter", { quarter });
  });
  els.weekSelect.addEventListener("change", () => {
    state.activeWeek = Number(els.weekSelect.value);
  });
  els.sameWeek.addEventListener("click", () => runCinematic("v2", "week", { week: Number(els.weekSelect.value) }));
  els.sameQuarter.addEventListener("click", () => {
    const quarter = els.quarterSelect.value;
    if (state.mode === "v2" && state.sliceType === "quarter") runPageFlip({ quarter });
    else runCinematic("v2", "quarter", { quarter });
  });
  els.suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-suggest]");
    if (!button) return;
    if (button.dataset.suggest === "v1") runCinematic("v1", "year", { year: state.activeYear });
    if (button.dataset.suggest === "v2") runCinematic("v2", "quarter", { quarter: state.activeQuarter });
    if (button.dataset.suggest === "range") runCinematic("v2", "week", { week: state.activeWeek });
  });
  els.wrap.addEventListener("pointermove", onPointerMove);
  els.wrap.addEventListener("click", onPointerClick);
  window.addEventListener("resize", onResize);
}

async function initThree() {
  const [THREE, controlsModule] = await Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js")
  ]);
  state.THREE = THREE;
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color("#070b14");
  state.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  els.wrap.append(state.renderer.domElement);
  state.controls = new controlsModule.OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.08;
  state.raycaster = new THREE.Raycaster();
  state.mouse = new THREE.Vector2();
  state.scene.add(new THREE.AmbientLight("#ffffff", 0.58));
  const light = new THREE.DirectionalLight("#ffffff", 1.2);
  light.position.set(8, 16, 12);
  state.scene.add(light);
  onResize();
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load Christmas Tree economic data.");
    state.data = await response.json();
    state.records = normalizeData(state.data);
    state.years = [...new Set(state.records.map((record) => record.year))].sort((a, b) => a - b);
    state.maxValue = Math.max(...state.records.map((record) => record.value));
    state.activeYear = state.years.includes(2024) ? 2024 : state.years[state.years.length - 1];
    await initThree();
    buildStaticUi();
    bindEvents();
    renderCurrent();
    els.loading.hidden = true;
    if (!state.rafStarted) {
      state.rafStarted = true;
      requestAnimationFrame(animate);
    }
  } catch (error) {
    els.loading.hidden = true;
    els.fallback.hidden = false;
    els.fallback.querySelector("span").textContent = error.message || "Three.js CDN could not be loaded.";
  }
}

init();
