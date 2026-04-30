(function () {
  const state = {
    lang: detectLanguage(),
    formulas: { categories: [], items: [] },
    formula: null,
    params: {}
  };

  function detectLanguage() {
    const saved = localStorage.getItem("portal-lang");
    if (saved) return saved;
    const lang = navigator.language || "en";
    if (/^zh-(tw|hk|mo)$/i.test(lang)) return "zh-TW";
    if (/^zh/i.test(lang)) return "zh-CN";
    return "en";
  }

  function localized(value) {
    if (!value || typeof value === "string") return value || "";
    return value[state.lang] || value.en || value["zh-TW"] || "";
  }

  function getFormulaId() {
    return new URLSearchParams(window.location.search).get("id") || "second-order-damping";
  }

  function getCategoryLabel(categoryId) {
    const category = (state.formulas.categories || []).find((item) => item.id === categoryId);
    return localized(category?.label) || categoryId || "Formula Lab";
  }

  function renderMath(root = document.body) {
    if (typeof renderMathInElement !== "function") return;
    renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderHero() {
    const formula = state.formula;
    document.title = `${localized(formula.title)} | Josh Huang`;
    setText("formula-category", getCategoryLabel(formula.category));
    setText("formula-title", localized(formula.title));
    setText("formula-description", localized(formula.description));

    const tags = document.getElementById("formula-tags");
    if (!tags) return;
    tags.innerHTML = "";
    [formula.status, ...(formula.tags || [])].filter(Boolean).forEach((tag) => {
      const item = document.createElement("span");
      item.textContent = tag;
      tags.append(item);
    });
  }

  function renderSections() {
    const target = document.getElementById("formula-sections");
    if (!target) return;
    target.innerHTML = "";

    const sections = state.formula.sections || [];
    if (!sections.length) {
      const empty = document.createElement("article");
      empty.className = "formula-section-card panel";
      empty.innerHTML = `
        <p class="eyebrow">Coming Soon</p>
        <h2>${localized(state.formula.title)}</h2>
        <p>${localized(state.formula.summary) || localized(state.formula.description)}</p>
      `;
      target.append(empty);
      return;
    }

    sections.forEach((section) => {
      const card = document.createElement("article");
      card.className = "formula-section-card panel";
      card.innerHTML = `
        <p class="eyebrow">${section.eyebrow || "Formula"}</p>
        <h2>${localized(section.title)}</h2>
        <p>${localized(section.body)}</p>
        ${section.math ? `<div class="formula-math-block">$$${section.math}$$</div>` : ""}
        <div class="formula-step-list"></div>
      `;

      const steps = card.querySelector(".formula-step-list");
      (section.steps || []).forEach((step, index) => {
        const item = document.createElement("div");
        item.className = "formula-step";
        item.innerHTML = `
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${localized(step.label)}</strong>
            <div class="formula-math-block">$$${step.math || ""}$$</div>
          </div>
        `;
        steps.append(item);
      });

      target.append(card);
    });

    renderMath(target);
  }

  function secondOrderStepResponse(params) {
    const zeta = Number(params.zeta);
    const wn = Number(params.wn);
    const started = performance.now();
    const x = [];
    const y = [];
    const maxTime = 5;
    const dt = 0.02;
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const phase = Math.acos(zeta);

    for (let time = 0; time <= maxTime; time += dt) {
      const envelope = Math.exp(-zeta * wn * time);
      const value = 1 - (1 / Math.sqrt(1 - zeta * zeta)) * envelope * Math.sin(wd * time + phase);
      x.push(Number(time.toFixed(2)));
      y.push(value);
    }

    const overshoot = Math.exp(-(zeta * Math.PI) / Math.sqrt(1 - zeta * zeta)) * 100;
    return {
      x,
      y,
      metrics: {
        overshoot: `${overshoot.toFixed(1)}%`,
        latency: `${Math.max(1, Math.round(performance.now() - started))} ms`
      }
    };
  }

  const handlers = {
    secondOrderStepResponse
  };

  function renderPlot(result) {
    const plot = document.getElementById("formula-plot");
    if (!plot) return;

    if (typeof Plotly === "undefined") {
      plot.innerHTML = `<p class="formula-fallback">Plotly CDN unavailable. Formula text and controls are still available.</p>`;
      return;
    }

    Plotly.react(
      plot,
      [
        {
          x: result.x,
          y: result.y,
          type: "scatter",
          mode: "lines",
          line: { color: "#FFD900", width: 2, shape: "spline" },
          fill: "tozeroy",
          fillcolor: "rgba(255, 217, 0, 0.06)",
          name: "response"
        },
        {
          x: [0, 5],
          y: [1, 1],
          type: "scatter",
          mode: "lines",
          line: { color: "#E5622B", width: 1, dash: "dash" },
          name: "target"
        }
      ],
      {
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        margin: { t: 12, r: 12, b: 44, l: 48 },
        xaxis: {
          title: { text: "t (s)", font: { color: "#aeb6b9" } },
          gridcolor: "rgba(214,216,217,0.16)",
          zerolinecolor: "rgba(214,216,217,0.22)",
          tickfont: { color: "#aeb6b9" }
        },
        yaxis: {
          title: { text: "y(t)", font: { color: "#aeb6b9" } },
          gridcolor: "rgba(214,216,217,0.16)",
          zerolinecolor: "rgba(214,216,217,0.22)",
          tickfont: { color: "#aeb6b9" },
          range: [0, 2]
        },
        showlegend: false,
        font: { family: "inherit" }
      },
      { responsive: true, displayModeBar: false }
    );
  }

  function updateInteractive() {
    const interactive = state.formula.interactive;
    const handler = handlers[interactive.handler];
    if (!handler) return;

    const result = handler(state.params);
    renderPlot(result);

    Object.entries(result.metrics || {}).forEach(([key, value]) => {
      const node = document.querySelector(`[data-metric-value="${key}"]`);
      if (node) node.textContent = value;
    });
  }

  function renderInteractive() {
    const target = document.getElementById("formula-interactive");
    const interactive = state.formula.interactive || {};
    if (!target) return;

    if (!interactive.enabled) {
      target.innerHTML = `
        <p class="eyebrow">Status</p>
        <h2>Coming soon</h2>
        <p>${localized(state.formula.summary) || "This formula module is prepared for a future interactive implementation."}</p>
      `;
      return;
    }

    state.params = {};
    (interactive.parameters || []).forEach((param) => {
      state.params[param.id] = Number(param.default);
    });

    target.innerHTML = `
      <div class="formula-plot-head">
        <p class="eyebrow">WebMatlab</p>
        <h2>${localized(interactive.plotTitle) || "Interactive plot"}</h2>
      </div>
      <div class="formula-plot" id="formula-plot"></div>
      <div class="formula-controls"></div>
      <div class="formula-metrics"></div>
    `;

    const controls = target.querySelector(".formula-controls");
    (interactive.parameters || []).forEach((param) => {
      const row = document.createElement("label");
      row.className = "formula-range";
      row.innerHTML = `
        <span>
          <strong>${localized(param.label)}</strong>
          <small>$${param.symbol || param.id}$</small>
        </span>
        <output>${Number(param.default).toFixed(String(param.step).includes(".") ? 2 : 0)}${param.unit ? ` ${param.unit}` : ""}</output>
        <input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}" data-param="${param.id}" />
      `;
      const output = row.querySelector("output");
      row.querySelector("input").addEventListener("input", (event) => {
        const value = Number(event.target.value);
        state.params[param.id] = value;
        output.textContent = `${value.toFixed(String(param.step).includes(".") ? 2 : 0)}${param.unit ? ` ${param.unit}` : ""}`;
        updateInteractive();
      });
      controls.append(row);
    });

    const metrics = target.querySelector(".formula-metrics");
    (interactive.metrics || []).forEach((metric) => {
      const item = document.createElement("div");
      item.innerHTML = `
        <span>${localized(metric.label)}</span>
        <strong data-metric-value="${metric.id}">--</strong>
      `;
      metrics.append(item);
    });

    renderMath(target);
    updateInteractive();
  }

  function renderMissing() {
    setText("formula-category", "Formula Lab");
    setText("formula-title", "Formula not found");
    setText("formula-description", "The requested formula id is not registered in data/formulas.json.");
    const detail = document.getElementById("formula-detail");
    if (detail) {
      detail.innerHTML = `<article class="panel formula-section-card"><a class="button primary" href="/formulas.html">Back to formula list</a></article>`;
    }
  }

  async function init() {
    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", () => {
        window.setTimeout(() => {
          state.lang = detectLanguage();
          if (!state.formula) return;
          renderHero();
          renderSections();
          renderInteractive();
        }, 0);
      });
    });

    try {
      const loaded = await window.PortalData.load();
      state.formulas = loaded.formulas || state.formulas;
      state.formula = (state.formulas.items || []).find((item) => item.id === getFormulaId());
    } catch (error) {
      console.warn(error);
    }

    state.lang = detectLanguage();
    if (!state.formula) {
      renderMissing();
      return;
    }

    renderHero();
    renderSections();
    renderInteractive();
  }

  init();
})();
