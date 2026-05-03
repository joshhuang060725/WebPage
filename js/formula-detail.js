(function () {
  const state = {
    lang: detectLanguage(),
    formulas: { categories: [], items: [] },
    formula: null,
    plotParams: {}
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
    if (node) node.textContent = value || "";
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

  function sinc(value) {
    if (Math.abs(value) < 1e-8) return 1;
    return Math.sin(Math.PI * value) / (Math.PI * value);
  }

  function rectangularPulseTransform(params) {
    const started = performance.now();
    const width = Math.max(0.05, Number(params.width ?? params.duration ?? params.T ?? params.parameter ?? 1));
    const amplitude = Math.max(0.05, Number(params.amplitude ?? params.A ?? 1));
    const maxFrequency = Math.max(2 / width, Number(params.maxFrequency ?? params.fMax ?? 8));
    const samples = 420;
    const frequency = [];
    const spectrum = [];
    const magnitude = [];

    for (let index = 0; index <= samples; index += 1) {
      const f = -maxFrequency + (2 * maxFrequency * index) / samples;
      const value = amplitude * width * sinc(f * width);
      frequency.push(Number(f.toFixed(4)));
      spectrum.push(value);
      magnitude.push(Math.abs(value));
    }

    return {
      traces: [
        {
          x: frequency,
          y: spectrum,
          type: "scatter",
          mode: "lines",
          line: { color: "#FFD900", width: 2 },
          name: "X(f)"
        },
        {
          x: frequency,
          y: magnitude,
          type: "scatter",
          mode: "lines",
          line: { color: "#2AAACE", width: 1.5, dash: "dot" },
          name: "|X(f)|"
        }
      ],
      layout: {
        xaxis: { title: "f (Hz)" },
        yaxis: { title: "Amplitude", autorange: true },
        showlegend: true
      },
      metrics: {
        dcGain: (amplitude * width).toFixed(3),
        firstZero: `${(1 / width).toFixed(3)} Hz`,
        latency: `${Math.max(1, Math.round(performance.now() - started))} ms`
      }
    };
  }

  function expressionPlot(params, element) {
    const started = performance.now();
    const config = element.expressionConfig || {};
    const variable = config.xVariable || "x";
    const baseScope = { ...params, pi: Math.PI, e: Math.E, sinc };
    const xMin = evaluateNumber(config.xMin ?? -10, baseScope, -10);
    const xMax = evaluateNumber(config.xMax ?? 10, baseScope, 10);
    const samples = Math.max(40, Math.min(2000, Number(config.samples ?? 420)));
    const expressions = Array.isArray(config.expressions) && config.expressions.length
      ? config.expressions
      : [{ label: "y", expression: "sin(x)" }];
    const x = [];
    const compiled = expressions.map((item) => ({
      ...item,
      compiled: compileExpression(item.expression || "0")
    }));
    const series = compiled.map(() => []);

    for (let index = 0; index <= samples; index += 1) {
      const value = xMin + ((xMax - xMin) * index) / samples;
      const scope = { ...params, [variable]: value, pi: Math.PI, e: Math.E, sinc };
      x.push(Number(value.toFixed(6)));
      compiled.forEach((item, seriesIndex) => {
        const y = item.compiled(scope);
        series[seriesIndex].push(Number.isFinite(y) ? y : null);
      });
    }

    return {
      traces: expressions.map((item, index) => ({
        x,
        y: series[index],
        type: "scatter",
        mode: "lines",
        line: { width: 2 },
        name: item.label || item.expression || `y${index + 1}`
      })),
      layout: {
        xaxis: { title: variable },
        yaxis: { title: config.yLabel || "y", autorange: true },
        showlegend: expressions.length > 1
      },
      metrics: {
        expressions: String(expressions.length),
        samples: String(samples + 1),
        latency: `${Math.max(1, Math.round(performance.now() - started))} ms`
      }
    };
  }

  const handlers = {
    secondOrderStepResponse,
    rectangularPulseTransform,
    expressionPlot
  };

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

  function renderElement(element, sectionId) {
    const node = document.createElement(element.type === "plot" ? "div" : "section");
    node.className = `formula-element formula-element-${element.type || "unknown"}`;

    if (element.type === "text") {
      node.textContent = localized(element.content);
      return node;
    }

    if (element.type === "math") {
      node.className += " formula-math-block";
      node.textContent = `$$${localized(element.content)}$$`;
      return node;
    }

    if (element.type === "image") {
      const figure = document.createElement("figure");
      figure.className = "formula-image";
      const image = document.createElement("img");
      image.src = element.url || "";
      image.alt = localized(element.caption) || "Formula reference";
      image.loading = "lazy";
      figure.append(image);
      if (localized(element.caption)) {
        const caption = document.createElement("figcaption");
        caption.textContent = localized(element.caption);
        figure.append(caption);
      }
      return figure;
    }

    if (element.type === "plot") {
      return renderPlotElement(element, sectionId);
    }

    node.textContent = `Unsupported formula element: ${element.type}`;
    return node;
  }

  function renderPlotElement(element, sectionId) {
    const elementId = element.id || element.handler || "plot";
    const plotId = `plot-${sectionId}-${elementId}`.replace(/[^a-z0-9_-]/gi, "-");
    const paramsKey = `${sectionId}:${elementId}`;
    const wrapper = document.createElement("section");
    wrapper.className = "formula-plot-module";
    wrapper.innerHTML = `
      <div>
        <p class="eyebrow">Interactive Module</p>
        <h3>${localized(element.caption) || element.handler || "Plot"}</h3>
      </div>
      <div class="formula-plot" id="${plotId}"></div>
      <div class="formula-controls"></div>
      <div class="formula-metrics"></div>
    `;

    state.plotParams[paramsKey] = {};
    (element.parameters || []).forEach((param) => {
      state.plotParams[paramsKey][param.id] = Number(param.default);
    });

    const controls = wrapper.querySelector(".formula-controls");
    (element.parameters || []).forEach((param) => {
      const row = document.createElement("label");
      row.className = "formula-range";
      const decimals = String(param.step).includes(".") ? 2 : 0;
      row.innerHTML = `
        <span>
          <strong>${localized(param.label)}</strong>
          <small>$${param.symbol || param.id}$</small>
        </span>
        <output>${Number(param.default).toFixed(decimals)}${param.unit ? ` ${param.unit}` : ""}</output>
        <input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.default}" />
      `;
      const output = row.querySelector("output");
      row.querySelector("input").addEventListener("input", (event) => {
        const value = Number(event.target.value);
        state.plotParams[paramsKey][param.id] = value;
        output.textContent = `${value.toFixed(decimals)}${param.unit ? ` ${param.unit}` : ""}`;
        updatePlotElement(element, paramsKey, plotId, wrapper);
      });
      controls.append(row);
    });

    const metrics = wrapper.querySelector(".formula-metrics");
    (element.metrics || []).forEach((metric) => {
      const item = document.createElement("div");
      item.innerHTML = `
        <span>${localized(metric.label)}</span>
        <strong data-metric-value="${metric.id}">--</strong>
      `;
      metrics.append(item);
    });

    window.setTimeout(() => updatePlotElement(element, paramsKey, plotId, wrapper), 0);
    return wrapper;
  }

  function updatePlotElement(element, paramsKey, plotId, root) {
    const handler = handlers[element.handler];
    const plot = document.getElementById(plotId);
    if (!plot || !handler) return;

    const result = handler(state.plotParams[paramsKey] || {}, element);
    if (typeof Plotly === "undefined") {
      plot.innerHTML = `<p class="formula-fallback">Plotly CDN unavailable. Formula text and controls are still available.</p>`;
      return;
    }

    const traces = result.traces || [
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
    ];
    const baseLayout = {
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
      font: { family: "inherit", color: "#aeb6b9" }
    };
    const layout = mergePlotLayout(baseLayout, result.layout || {});

    Plotly.react(
      plot,
      traces,
      layout,
      { responsive: true, displayModeBar: false }
    );

    if (metricsContainerIsEmpty(root) && result.metrics) {
      const target = root.querySelector(".formula-metrics");
      Object.keys(result.metrics).forEach((key) => {
        const item = document.createElement("div");
        item.innerHTML = `
          <span>${key}</span>
          <strong data-metric-value="${key}">--</strong>
        `;
        target?.append(item);
      });
    }

    Object.entries(result.metrics || {}).forEach(([key, value]) => {
      const node = root.querySelector(`[data-metric-value="${key}"]`);
      if (node) node.textContent = value;
    });
  }

  function metricsContainerIsEmpty(root) {
    return !root.querySelector("[data-metric-value]");
  }

  function evaluateNumber(value, scope, fallback) {
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;
    const computed = compileExpression(String(value || fallback))(scope);
    return Number.isFinite(computed) ? computed : fallback;
  }

  function compileExpression(expression) {
    if (window.math?.compile) {
      const compiled = window.math.compile(expression);
      return (scope) => Number(compiled.evaluate(scope));
    }

    const safe = String(expression || "0")
      .replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|exp|log|pow|min|max|floor|ceil|round)\s*\(/g, "Math.$1(")
      .replace(/\bPI\b|\bpi\b/g, "Math.PI")
      .replace(/\be\b/g, "Math.E");
    if (!/^[\w\s+\-*/%^().,?:<>=!&|[\]]+$/.test(safe)) {
      return () => NaN;
    }
    return (scope) => {
      const names = Object.keys(scope).filter((key) => /^[A-Za-z_]\w*$/.test(key));
      const values = names.map((key) => scope[key]);
      try {
        return Number(Function(...names, `"use strict"; return (${safe.replace(/\^/g, "**")});`)(...values));
      } catch {
        return NaN;
      }
    };
  }

  function mergePlotLayout(base, override) {
    const next = { ...base, ...override };
    next.xaxis = { ...(base.xaxis || {}), ...(override.xaxis || {}) };
    next.yaxis = { ...(base.yaxis || {}), ...(override.yaxis || {}) };
    if (typeof next.xaxis.title === "string") {
      next.xaxis.title = { text: next.xaxis.title, font: { color: "#aeb6b9" } };
    }
    if (typeof next.yaxis.title === "string") {
      next.yaxis.title = { text: next.yaxis.title, font: { color: "#aeb6b9" } };
    }
    return next;
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
        <p class="eyebrow">${state.formula.status === "open" ? "Open" : "Wait"}</p>
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
        <div class="formula-element-list"></div>
      `;

      const list = card.querySelector(".formula-element-list");
      (section.elements || []).forEach((element) => {
        list.append(renderElement(element, section.id));
      });
      target.append(card);
    });

    renderMath(target);
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
  }

  init();
})();
