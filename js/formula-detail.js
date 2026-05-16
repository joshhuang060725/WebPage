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

  const copy = {
    en: {
      interactive: "Interactive Module",
      unsupported: "Unsupported formula element",
      fallback: "Plotly CDN unavailable. Formula text and controls are still available.",
      missingTitle: "Formula not found",
      missingDescription: "The requested formula id is not registered in data/formulas.json.",
      back: "Back to formula list"
    },
    "zh-TW": {
      interactive: "互動模組",
      unsupported: "不支援的公式元素",
      fallback: "Plotly CDN 無法載入；公式文字與控制項仍可使用。",
      missingTitle: "找不到公式",
      missingDescription: "指定的公式 id 尚未登錄在 data/formulas.json。",
      back: "返回公式列表"
    },
    "zh-CN": {
      interactive: "互动模块",
      unsupported: "不支持的公式元素",
      fallback: "Plotly CDN 无法载入；公式文字与控制项仍可使用。",
      missingTitle: "找不到公式",
      missingDescription: "指定的公式 id 尚未登记在 data/formulas.json。",
      back: "返回公式列表"
    }
  };
  function t(key) {
    return copy[state.lang]?.[key] || copy.en[key] || key;
  }

  function getFormulaId() {
    return new URLSearchParams(window.location.search).get("id") || "euler-phasors";
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

  function paragraph(className, value) {
    const node = document.createElement("p");
    node.className = className;
    node.textContent = value || "";
    return node;
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

  function phasorSine(params) {
    const started = performance.now();
    const frequency = Number(params.frequency || 1);
    const phase = (Number(params.phase || 0) * Math.PI) / 180;
    const samples = 360;
    const time = [];
    const wave = [];
    const maxTime = 2;
    for (let index = 0; index <= samples; index += 1) {
      const tValue = (maxTime * index) / samples;
      time.push(Number(tValue.toFixed(4)));
      wave.push(Math.cos(2 * Math.PI * frequency * tValue + phase));
    }
    const radius = [0, Math.cos(phase)];
    const imag = [0, Math.sin(phase)];
    return {
      traces: [
        { x: time, y: wave, type: "scatter", mode: "lines", name: "cos(2πft+φ)", line: { color: "#FFD900", width: 2 } },
        { x: radius, y: imag, type: "scatter", mode: "lines+markers", name: "phasor", xaxis: "x2", yaxis: "y2", line: { color: "#2AAACE", width: 3 } }
      ],
      layout: {
        grid: { rows: 1, columns: 2, pattern: "independent" },
        xaxis: { title: "t (s)" },
        yaxis: { title: "projection", range: [-1.2, 1.2] },
        xaxis2: { title: "real", range: [-1.2, 1.2] },
        yaxis2: { title: "imag", range: [-1.2, 1.2], scaleanchor: "x2" },
        showlegend: true
      },
      metrics: {
        period: `${(1 / frequency).toFixed(3)} s`,
        latency: `${Math.max(1, Math.round(performance.now() - started))} ms`
      }
    };
  }

  function poleZeroResponse(params) {
    const started = performance.now();
    const sigma = Number(params.sigma || -1);
    const omega = Number(params.omega || 5);
    const time = [];
    const response = [];
    for (let index = 0; index <= 320; index += 1) {
      const tValue = (6 * index) / 320;
      time.push(Number(tValue.toFixed(4)));
      response.push(Math.exp(sigma * tValue) * Math.cos(omega * tValue));
    }
    return {
      traces: [
        { x: time, y: response, type: "scatter", mode: "lines", name: "h(t)", line: { color: "#FFD900", width: 2 } },
        { x: [sigma, sigma], y: [omega, -omega], type: "scatter", mode: "markers", name: "poles", xaxis: "x2", yaxis: "y2", marker: { color: "#E5622B", size: 11, symbol: "x" } }
      ],
      layout: {
        grid: { rows: 1, columns: 2, pattern: "independent" },
        xaxis: { title: "t (s)" },
        yaxis: { title: "response" },
        xaxis2: { title: "Re(s)", zeroline: true },
        yaxis2: { title: "Im(s)", zeroline: true },
        showlegend: true
      },
      metrics: {
        stability: sigma < 0 ? (state.lang === "en" ? "stable" : state.lang === "zh-CN" ? "稳定" : "穩定") : (state.lang === "en" ? "unstable" : state.lang === "zh-CN" ? "不稳定" : "不穩定"),
        latency: `${Math.max(1, Math.round(performance.now() - started))} ms`
      }
    };
  }

  function secondOrderBode(params) {
    const started = performance.now();
    const fc = Number(params.fc || 1000);
    const q = Number(params.q || 0.707);
    const x = [];
    const mag = [];
    const phase = [];
    for (let index = 0; index <= 420; index += 1) {
      const f = fc / 100 + (fc * 100 - fc / 100) * (index / 420);
      const w = f / fc;
      const real = 1 - w * w;
      const imag = w / q;
      const abs = 1 / Math.sqrt(real * real + imag * imag);
      x.push(Number(f.toFixed(3)));
      mag.push(20 * Math.log10(abs));
      phase.push((-Math.atan2(imag, real) * 180) / Math.PI);
    }
    const peak = Math.max(...mag);
    return {
      traces: [
        { x, y: mag, type: "scatter", mode: "lines", name: "magnitude (dB)", line: { color: "#FFD900", width: 2 } },
        { x, y: phase, type: "scatter", mode: "lines", name: "phase (deg)", yaxis: "y2", line: { color: "#2AAACE", width: 2 } }
      ],
      layout: { xaxis: { title: "f (Hz)", type: "log" }, yaxis: { title: "Magnitude (dB)" }, yaxis2: { title: "Phase (deg)", overlaying: "y", side: "right" }, showlegend: true },
      metrics: { peak: `${peak.toFixed(2)} dB`, latency: `${Math.max(1, Math.round(performance.now() - started))} ms` }
    };
  }

  function samplingAliasing(params) {
    const fin = Number(params.fin || 18);
    const fs = Number(params.fs || 30);
    const t = [];
    const continuous = [];
    const sampleT = [];
    const sampleY = [];
    const maxTime = 1;
    for (let index = 0; index <= 500; index += 1) {
      const value = (maxTime * index) / 500;
      t.push(value);
      continuous.push(Math.sin(2 * Math.PI * fin * value));
    }
    for (let n = 0; n <= fs * maxTime; n += 1) {
      const value = n / fs;
      sampleT.push(value);
      sampleY.push(Math.sin(2 * Math.PI * fin * value));
    }
    const alias = Math.abs(fin - Math.round(fin / fs) * fs);
    return {
      traces: [
        { x: t, y: continuous, type: "scatter", mode: "lines", name: "input", line: { color: "#FFD900", width: 1.5 } },
        { x: sampleT, y: sampleY, type: "scatter", mode: "markers", name: "samples", marker: { color: "#E5622B", size: 7 } }
      ],
      layout: { xaxis: { title: "t (s)" }, yaxis: { title: "x(t)", range: [-1.2, 1.2] }, showlegend: true },
      metrics: {
        alias: `${alias.toFixed(2)} Hz`,
        nyquist: fs > 2 * fin ? "OK" : state.lang === "en" ? "Aliasing risk" : state.lang === "zh-CN" ? "混叠风险" : "混疊風險"
      }
    };
  }

  function smithReflection(params) {
    const r = Number(params.r || 75);
    const xValue = Number(params.x || 25);
    const z0 = 50;
    const zr = r / z0;
    const zi = xValue / z0;
    const denomR = zr + 1;
    const denomI = zi;
    const numR = zr - 1;
    const numI = zi;
    const denom = denomR * denomR + denomI * denomI;
    const gammaR = (numR * denomR + numI * denomI) / denom;
    const gammaI = (numI * denomR - numR * denomI) / denom;
    const mag = Math.sqrt(gammaR * gammaR + gammaI * gammaI);
    const circleX = [];
    const circleY = [];
    for (let i = 0; i <= 180; i += 1) {
      const a = (2 * Math.PI * i) / 180;
      circleX.push(Math.cos(a));
      circleY.push(Math.sin(a));
    }
    return {
      traces: [
        { x: circleX, y: circleY, type: "scatter", mode: "lines", name: "unit circle", line: { color: "rgba(214,216,217,0.35)", width: 1 } },
        { x: [0, gammaR], y: [0, gammaI], type: "scatter", mode: "lines+markers", name: "Gamma", marker: { color: "#FFD900", size: 10 }, line: { color: "#FFD900", width: 2 } }
      ],
      layout: { xaxis: { title: "Re(Gamma)", range: [-1.1, 1.1] }, yaxis: { title: "Im(Gamma)", range: [-1.1, 1.1], scaleanchor: "x" }, showlegend: true },
      metrics: { gamma: mag.toFixed(3), vswr: mag >= 1 ? "infinite" : ((1 + mag) / (1 - mag)).toFixed(2) }
    };
  }

  function windowSpectrum(params) {
    const length = Math.max(32, Math.round(Number(params.length || 128)));
    const offset = Number(params.offset || 0.25);
    const bins = [];
    const rect = [];
    const hann = [];
    for (let i = -160; i <= 160; i += 1) {
      const f = i / 16;
      const a = Math.PI * (f - offset);
      const rectValue = Math.abs(Math.sin(length * a) / Math.max(1e-6, Math.sin(a)));
      const normalizedRect = rectValue / length;
      const hannValue = normalizedRect * Math.abs(0.5 + 0.5 * Math.cos(Math.min(Math.PI, Math.abs(a))));
      bins.push(f);
      rect.push(20 * Math.log10(Math.max(1e-5, normalizedRect)));
      hann.push(20 * Math.log10(Math.max(1e-5, hannValue)));
    }
    return {
      traces: [
        { x: bins, y: rect, type: "scatter", mode: "lines", name: "rectangular", line: { color: "#FFD900", width: 1.8 } },
        { x: bins, y: hann, type: "scatter", mode: "lines", name: "hann", line: { color: "#2AAACE", width: 1.8 } }
      ],
      layout: { xaxis: { title: "bin offset" }, yaxis: { title: "relative level (dB)", range: [-100, 5] }, showlegend: true },
      metrics: { rectLeakage: `${Math.max(...rect.filter((_, i) => Math.abs(bins[i]) > 1)).toFixed(1)} dB`, hannLeakage: `${Math.max(...hann.filter((_, i) => Math.abs(bins[i]) > 1)).toFixed(1)} dB` }
    };
  }

  function gaussianKernel(params) {
    const sigma = Number(params.sigma || 1.2);
    const size = Math.max(3, Math.round(Number(params.size || 7)) | 1);
    const half = Math.floor(size / 2);
    const x = [];
    const y = [];
    const z = [];
    let sum = 0;
    for (let row = -half; row <= half; row += 1) {
      y.push(row);
      const values = [];
      for (let col = -half; col <= half; col += 1) {
        if (row === -half) x.push(col);
        const value = Math.exp(-(col * col + row * row) / (2 * sigma * sigma));
        values.push(value);
        sum += value;
      }
      z.push(values);
    }
    const normalized = z.map((row) => row.map((value) => value / sum));
    return {
      traces: [{ x, y, z: normalized, type: "surface", colorscale: "Viridis", showscale: false, name: "kernel" }],
      layout: { scene: { xaxis: { title: "x" }, yaxis: { title: "y" }, zaxis: { title: "weight" } } },
      metrics: { sum: "1.000", center: normalized[half][half].toFixed(4) }
    };
  }

  function histogramEqualization(params) {
    const started = performance.now();
    const levels = Math.max(16, Math.round(Number(params.levels || 128)));
    const contrast = Number(params.contrast || 0.8);
    const x = [];
    const hist = [];
    const cdf = [];
    let sum = 0;
    for (let i = 0; i < levels; i += 1) {
      const n = i / (levels - 1);
      const value = Math.exp(-Math.pow((n - 0.45) / Math.max(0.05, contrast * 0.22), 2));
      x.push(i);
      hist.push(value);
      sum += value;
    }
    let running = 0;
    hist.forEach((value) => {
      running += value / sum;
      cdf.push((levels - 1) * running);
    });
    return {
      traces: [
        { x, y: hist, type: "bar", name: "input histogram", marker: { color: "rgba(255,217,0,0.55)" } },
        { x, y: cdf, type: "scatter", mode: "lines", name: "CDF mapping", yaxis: "y2", line: { color: "#2AAACE", width: 2 } }
      ],
      layout: { xaxis: { title: "gray level" }, yaxis: { title: "count" }, yaxis2: { title: "mapped level", overlaying: "y", side: "right" }, showlegend: true },
      metrics: { levels: String(levels), latency: `${Math.max(1, Math.round(performance.now() - started))} ms` }
    };
  }

  function pidStepResponse(params) {
    const kp = Number(params.kp || 2);
    const ki = Number(params.ki || 0.8);
    const kd = Number(params.kd || 0.5);
    const zeta = Math.max(0.12, Math.min(1.6, 0.9 + kd * 0.18 - kp * 0.035));
    const wn = Math.max(0.5, 1.2 + kp * 0.55 + ki * 0.2);
    const result = secondOrderStepResponse({ zeta: Math.min(0.99, zeta), wn });
    result.metrics.settling = `${(4 / (Math.max(0.05, Math.min(0.99, zeta)) * wn)).toFixed(2)} s`;
    return result;
  }

  function kalmanEstimate(params) {
    const started = performance.now();
    const q = Number(params.q || 0.05);
    const r = Number(params.r || 1);
    const x = [];
    const truth = [];
    const measured = [];
    const estimate = [];
    let est = 0;
    let p = 1;
    let finalGain = 0;
    for (let k = 0; k <= 80; k += 1) {
      const tValue = k / 8;
      const actual = Math.sin(tValue * 0.8) + 0.025 * k;
      const noise = Math.sin(k * 1.73) * Math.sqrt(r) * 0.45;
      const z = actual + noise;
      p += q;
      const gain = p / (p + r);
      est = est + gain * (z - est);
      p = (1 - gain) * p;
      finalGain = gain;
      x.push(tValue);
      truth.push(actual);
      measured.push(z);
      estimate.push(est);
    }
    return {
      traces: [
        { x, y: truth, type: "scatter", mode: "lines", name: "truth", line: { color: "#D6D8D9", width: 1 } },
        { x, y: measured, type: "scatter", mode: "markers", name: "measurement", marker: { color: "rgba(229,98,43,0.65)", size: 6 } },
        { x, y: estimate, type: "scatter", mode: "lines", name: "estimate", line: { color: "#FFD900", width: 2 } }
      ],
      layout: { xaxis: { title: "time" }, yaxis: { title: "state" }, showlegend: true },
      metrics: { finalGain: finalGain.toFixed(3), latency: `${Math.max(1, Math.round(performance.now() - started))} ms` }
    };
  }

  function stateSpacePhase(params) {
    const a0 = Number(params.a0 || 2);
    const a1 = Number(params.a1 || 0.8);
    const traces = [];
    [[1, 0], [0, 1], [-1, 0.6], [0.4, -1]].forEach((initial, idx) => {
      let x1 = initial[0];
      let x2 = initial[1];
      const xs = [];
      const ys = [];
      for (let k = 0; k < 240; k += 1) {
        xs.push(x1);
        ys.push(x2);
        const dx1 = x2;
        const dx2 = -a0 * x1 - a1 * x2;
        x1 += dx1 * 0.035;
        x2 += dx2 * 0.035;
      }
      traces.push({ x: xs, y: ys, type: "scatter", mode: "lines", name: `trajectory ${idx + 1}` });
    });
    const discriminant = a1 * a1 - 4 * a0;
    return {
      traces,
      layout: { xaxis: { title: "x1" }, yaxis: { title: "x2" }, showlegend: false },
      metrics: { eigen: discriminant < 0 ? "complex pair" : "real pair" }
    };
  }

  const handlers = {
    secondOrderStepResponse,
    rectangularPulseTransform,
    expressionPlot,
    phasorSine,
    poleZeroResponse,
    secondOrderBode,
    samplingAliasing,
    gaussianKernel,
    histogramEqualization,
    pidStepResponse,
    kalmanEstimate,
    stateSpacePhase,
    smithReflection,
    windowSpectrum,
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

    if (element.type === "note") {
      node.className += " formula-note";
      node.append(paragraph("eyebrow", localized(element.label) || "Note"));
      node.append(paragraph("", localized(element.content)));
      return node;
    }

    if (element.type === "definition") {
      node.className += " formula-definition";
      const heading = document.createElement("h3");
      heading.textContent = localized(element.term) || localized(element.title) || "Definition";
      node.append(heading);
      node.append(paragraph("", localized(element.content)));
      if (element.equation) {
        const equation = document.createElement("div");
        equation.className = "formula-math-block";
        equation.textContent = `$$${localized(element.equation) || element.equation}$$`;
        node.append(equation);
      }
      return node;
    }

    if (element.type === "step") {
      node.className += " formula-step";
      const heading = document.createElement("h3");
      heading.textContent = localized(element.title) || localized(element.label) || "Step";
      node.append(heading);
      node.append(paragraph("", localized(element.content)));
      if (element.equation) {
        const equation = document.createElement("div");
        equation.className = "formula-math-block";
        equation.textContent = `$$${localized(element.equation) || element.equation}$$`;
        node.append(equation);
      }
      return node;
    }

    if (element.type === "table") {
      return renderTableElement(element);
    }

    if (element.type === "variable-table") {
      return renderVariableTableElement(element);
    }

    if (element.type === "derivation-step") {
      return renderDerivationStepElement(element);
    }

    if (element.type === "boundary-case") {
      return renderBoundaryCaseElement(element);
    }

    if (element.type === "design-rules") {
      return renderDesignRulesElement(element);
    }

    if (element.type === "code") {
      return renderCodeElement(element);
    }

    if (element.type === "matrix") {
      return renderMatrixElement(element);
    }

    if (element.type === "comparison") {
      return renderComparisonElement(element);
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

    node.className += " formula-fallback-inline";
    node.textContent = `${t("unsupported")}: ${element.type}`;
    return node;
  }

  function renderTableElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-element-table";
    const tableNode = document.createElement("table");
    tableNode.className = "formula-data-table";
    const headers = element.headers || [];
    if (headers.length) {
      const thead = document.createElement("thead");
      const row = document.createElement("tr");
      headers.forEach((header) => {
        const cell = document.createElement("th");
        cell.textContent = localized(header);
        row.append(cell);
      });
      thead.append(row);
      tableNode.append(thead);
    }
    const tbody = document.createElement("tbody");
    (element.rows || []).forEach((cells) => {
      const row = document.createElement("tr");
      cells.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = localized(value);
        row.append(cell);
      });
      tbody.append(row);
    });
    tableNode.append(tbody);
    if (localized(element.caption)) wrapper.append(paragraph("formula-table-caption", localized(element.caption)));
    wrapper.append(tableNode);
    return wrapper;
  }

  function renderVariableTableElement(element) {
    const rows = (element.rows || []).map((row) => [
      row.symbol || "",
      localized(row.quantity),
      row.unit || "",
      localized(row.meaning)
    ]);
    return renderTableElement({
      type: "table",
      caption: element.caption || { en: "Variable legend", "zh-TW": "變量表", "zh-CN": "变量表" },
      headers: [
        { en: "Symbol", "zh-TW": "符號", "zh-CN": "符号" },
        { en: "Physical quantity", "zh-TW": "物理量", "zh-CN": "物理量" },
        { en: "Unit", "zh-TW": "單位", "zh-CN": "单位" },
        { en: "Engineering meaning", "zh-TW": "工程意義", "zh-CN": "工程意义" }
      ],
      rows
    });
  }

  function renderDerivationStepElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-derivation-step";

    const heading = document.createElement("h3");
    heading.textContent = localized(element.title) || "Derivation step";
    wrapper.append(heading);

    if (localized(element.content)) {
      wrapper.append(paragraph("", localized(element.content)));
    }

    if (element.equation) {
      const equation = document.createElement("div");
      equation.className = "formula-math-block";
      equation.textContent = `$$${localized(element.equation) || element.equation}$$`;
      wrapper.append(equation);
    }

    if (localized(element.logicNote)) {
      const logic = document.createElement("p");
      logic.className = "formula-logic-note";
      logic.textContent = `// ${localized(element.logicNote)}`;
      wrapper.append(logic);
    }

    return wrapper;
  }

  function renderBoundaryCaseElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-boundary-case";

    const labels = state.lang === "en"
      ? { title: "Limiting case", condition: "Condition", result: "Formula behavior" }
      : state.lang === "zh-CN"
        ? { title: "极限条件", condition: "条件", result: "公式表现" }
        : { title: "極限條件", condition: "條件", result: "公式表現" };

    wrapper.append(paragraph("eyebrow", labels.title));

    const grid = document.createElement("div");
    grid.className = "formula-boundary-grid";

    const condition = document.createElement("div");
    const conditionLabel = document.createElement("span");
    conditionLabel.textContent = labels.condition;
    const conditionValue = document.createElement("strong");
    conditionValue.textContent = element.condition || "";
    condition.append(conditionLabel, conditionValue);

    const result = document.createElement("div");
    const resultLabel = document.createElement("span");
    resultLabel.textContent = labels.result;
    const resultValue = document.createElement("strong");
    resultValue.textContent = localized(element.result);
    result.append(resultLabel, resultValue);

    grid.append(condition, result);
    wrapper.append(grid);
    wrapper.append(paragraph("", localized(element.meaning)));
    return wrapper;
  }

  function renderDesignRulesElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-design-rules";
    const heading = document.createElement("h3");
    heading.textContent = localized(element.title) || (state.lang === "en" ? "Design rules" : "設計導則");
    const list = document.createElement("ol");
    (element.rules || []).forEach((rule) => {
      const item = document.createElement("li");
      item.textContent = localized(rule);
      list.append(item);
    });
    wrapper.append(heading, list);
    return wrapper;
  }

  function renderCodeElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-code-block";
    const heading = document.createElement("div");
    heading.className = "formula-code-heading";
    heading.innerHTML = `<span>${localized(element.title) || "Code"}</span><strong>${element.language || "text"}</strong>`;
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = element.content || "";
    pre.append(code);
    wrapper.append(heading, pre);
    return wrapper;
  }

  function renderMatrixElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-element-matrix";
    if (localized(element.caption)) wrapper.append(paragraph("formula-table-caption", localized(element.caption)));
    const grid = document.createElement("div");
    grid.className = "formula-matrix-grid";
    const values = element.values || [];
    const columns = Math.max(1, ...values.map((row) => row.length));
    grid.style.setProperty("--matrix-cols", String(columns));
    values.forEach((row) => {
      row.forEach((value) => {
        const cell = document.createElement("span");
        cell.textContent = localized(value);
        grid.append(cell);
      });
    });
    wrapper.append(grid);
    return wrapper;
  }

  function renderComparisonElement(element) {
    const wrapper = document.createElement("section");
    wrapper.className = "formula-element formula-element-comparison";
    if (localized(element.caption)) wrapper.append(paragraph("formula-table-caption", localized(element.caption)));
    const list = document.createElement("div");
    list.className = "formula-comparison-grid";
    (element.items || []).forEach((item) => {
      const card = document.createElement("article");
      const title = document.createElement("strong");
      title.textContent = localized(item.label);
      const body = document.createElement("p");
      body.textContent = localized(item.value || item.content);
      card.append(title, body);
      list.append(card);
    });
    wrapper.append(list);
    return wrapper;
  }

  function renderPlotElement(element, sectionId) {
    const elementId = element.id || element.handler || "plot";
    const plotId = `plot-${sectionId}-${elementId}`.replace(/[^a-z0-9_-]/gi, "-");
    const paramsKey = `${sectionId}:${elementId}`;
    const wrapper = document.createElement("section");
    wrapper.className = "formula-plot-module";
    wrapper.innerHTML = `
      <div>
        <p class="eyebrow">${t("interactive")}</p>
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

    const started = performance.now();
    const result = handler(state.plotParams[paramsKey] || {}, element);
    const metrics = { ...(result.metrics || {}) };
    if (!metrics.samples) {
      const firstTrace = (result.traces || [])[0];
      const count = firstTrace?.x?.length || result.x?.length || element.expressionConfig?.samples || 0;
      if (count) metrics.samples = String(count);
    }
    if (!metrics.latency) {
      metrics.latency = `${Math.max(1, Math.round(performance.now() - started))} ms`;
    }
    if (typeof Plotly === "undefined") {
      plot.innerHTML = `<p class="formula-fallback">${t("fallback")}</p>`;
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

    if (metricsContainerIsEmpty(root) && metrics) {
      const target = root.querySelector(".formula-metrics");
      Object.keys(metrics).forEach((key) => {
        const item = document.createElement("div");
        item.innerHTML = `
          <span>${key}</span>
          <strong data-metric-value="${key}">--</strong>
        `;
        target?.append(item);
      });
    }

    Object.entries(metrics || {}).forEach(([key, value]) => {
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
    setText("formula-title", t("missingTitle"));
    setText("formula-description", t("missingDescription"));
    const detail = document.getElementById("formula-detail");
    if (detail) {
      detail.innerHTML = `<article class="panel formula-section-card"><a class="button primary" href="/formulas.html">${t("back")}</a></article>`;
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

