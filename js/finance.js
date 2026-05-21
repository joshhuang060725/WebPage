(function () {
  const PRIMARY_API = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1";
  const SECONDARY_API = "https://open.er-api.com/v6/latest/USD";

  const currencyMeta = {
    USD: { label: "US Dollar", flag: "US", fallbackRate: 1 },
    CNY: { label: "Chinese Yuan", flag: "CN", fallbackRate: 7.0 },
    TWD: { label: "Taiwan Dollar", flag: "TW", fallbackRate: 31.5 },
    JPY: { label: "Japanese Yen", flag: "JP", fallbackRate: 145 },
    EUR: { label: "Euro", flag: "EU", fallbackRate: 0.92 }
  };

  const moduleLabels = {
    equity: "Global equities / stocks",
    bonds: "Fixed income / treasuries",
    haven: "Haven & commodities",
    real: "Real economy / property",
    crypto: "Decentralized digital assets"
  };

  const derivedQuoteLines = [
    { name: "Reference desk", buySpread: 0.0025, sellSpread: 0.0025 },
    { name: "Retail branch", buySpread: 0.0045, sellSpread: 0.005 },
    { name: "Online banking", buySpread: 0.0018, sellSpread: 0.002 },
    { name: "Card network", buySpread: 0.008, sellSpread: 0.009 },
    { name: "Wire transfer", buySpread: 0.0035, sellSpread: 0.004 },
    { name: "Cash counter", buySpread: 0.0075, sellSpread: 0.0085 }
  ];

  const timeframeRules = {
    "1D": {
      days: 1,
      tickCount: 4,
      unavailable: "1D requires real intraday FX history. The current public no-key source only provides daily snapshots."
    },
    "1W": {
      days: 7,
      tickCount: 8,
      status: "Daily historical FX rates"
    },
    "1M": {
      days: 30,
      tickCount: 7,
      status: "Daily historical FX rates"
    },
    "3M": {
      days: 90,
      tickCount: 7,
      status: "Daily historical FX rates"
    },
    "1Y": {
      days: 365,
      tickCount: 7,
      status: "Daily historical FX rates"
    }
  };

  const state = {
    activeModule: "fx",
    fromCurrency: "USD",
    toCurrency: "CNY",
    amount: 1,
    rateTable: Object.fromEntries(Object.entries(currencyMeta).map(([code, meta]) => [code, meta.fallbackRate])),
    chartMode: "single",
    timeframe: "1Y",
    dataStatus: {
      source: "Local fallback",
      tone: "fallback",
      date: "static fallback",
      hasHistorical: false
    },
    history: [],
    historyStatus: {
      source: "No history loaded",
      tone: "loading"
    },
    chartView: {
      start: 0,
      end: 1
    },
    chartPointer: null,
    chartDrag: null,
    query: ""
  };

  const refs = {
    sourceStatus: document.getElementById("finance-source-status"),
    moduleNotice: document.getElementById("finance-module-notice"),
    board: document.querySelector(".finance-board"),
    search: document.getElementById("finance-search"),
    amountFrom: document.getElementById("finance-amount-from"),
    amountTo: document.getElementById("finance-amount-to"),
    currencyFrom: document.getElementById("finance-currency-from"),
    currencyTo: document.getElementById("finance-currency-to"),
    swap: document.getElementById("finance-swap-currencies"),
    chartSwap: document.getElementById("finance-chart-swap"),
    matrixBody: document.getElementById("finance-matrix-body"),
    bankBody: document.getElementById("finance-bank-body"),
    chartLabel: document.getElementById("finance-chart-label"),
    chart: document.getElementById("finance-chart"),
    legend: document.getElementById("finance-legend"),
    chartStatus: document.getElementById("finance-chart-status"),
    timeframes: document.getElementById("finance-timeframes")
  };

  const currencyCodes = Object.keys(currencyMeta);

  function rate(code) {
    return state.rateTable[code] || currencyMeta[code]?.fallbackRate || 1;
  }

  function pairRate(from, to) {
    return rate(to) / rate(from);
  }

  function formatNumber(value, digits = 4) {
    if (!Number.isFinite(value)) return "--";
    return value.toLocaleString("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function formatCurrencyOption(code) {
    const meta = currencyMeta[code];
    return `${meta.flag} ${code}`;
  }

  function setDataStatus(status) {
    state.dataStatus = { ...state.dataStatus, ...status };
    if (!refs.sourceStatus) return;
    refs.sourceStatus.textContent = `${state.dataStatus.source} - ${state.dataStatus.date}`;
    refs.sourceStatus.dataset.tone = state.dataStatus.tone;
  }

  function timeoutSignal(ms) {
    const controller = new AbortController();
    window.setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function dateRange(days) {
    const end = new Date();
    const start = addDays(end, -days);
    const dates = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(isoDate(cursor));
    }
    return dates;
  }

  function normalizeRates(rawRates) {
    const next = { USD: 1 };
    currencyCodes.forEach((code) => {
      if (code === "USD") return;
      const value = rawRates[code.toLowerCase()] ?? rawRates[code];
      next[code] = Number.isFinite(Number(value)) ? Number(value) : currencyMeta[code].fallbackRate;
    });
    return next;
  }

  async function fetchPrimaryFxRates() {
    const response = await fetch(`${PRIMARY_API}/currencies/usd.json`, {
      headers: { Accept: "application/json" },
      signal: timeoutSignal(5000)
    });
    if (!response.ok) throw new Error(`Primary FX API ${response.status}`);
    const payload = await response.json();
    if (!payload?.usd) throw new Error("Primary FX API missing usd rates");
    return {
      source: "Currency API",
      date: payload.date || "latest",
      rates: normalizeRates(payload.usd)
    };
  }

  async function fetchPrimaryFxRatesForDate(date) {
    const response = await fetch(`${PRIMARY_API.replace("@latest", `@${date}`)}/currencies/usd.json`, {
      headers: { Accept: "application/json" },
      signal: timeoutSignal(5000)
    });
    if (!response.ok) throw new Error(`Historical FX API ${date} ${response.status}`);
    const payload = await response.json();
    if (!payload?.usd) throw new Error(`Historical FX API missing usd rates for ${date}`);
    return {
      date: payload.date || date,
      rates: normalizeRates(payload.usd)
    };
  }

  async function fetchSecondaryFxRates() {
    const response = await fetch(SECONDARY_API, {
      headers: { Accept: "application/json" },
      signal: timeoutSignal(5000)
    });
    if (!response.ok) throw new Error(`Secondary FX API ${response.status}`);
    const payload = await response.json();
    if (payload.result !== "success" || !payload.rates) throw new Error("Secondary FX API payload invalid");
    return {
      source: "ExchangeRate-API",
      date: payload.time_last_update_utc || "latest",
      rates: normalizeRates(payload.rates)
    };
  }

  async function fetchFxRates() {
    try {
      return await fetchPrimaryFxRates();
    } catch (primaryError) {
      console.warn(primaryError);
      try {
        return await fetchSecondaryFxRates();
      } catch (secondaryError) {
        console.warn(secondaryError);
        return {
          source: "Local fallback",
          date: "API unavailable",
          rates: Object.fromEntries(Object.entries(currencyMeta).map(([code, meta]) => [code, meta.fallbackRate])),
          fallback: true
        };
      }
    }
  }

  async function fetchFxHistory(timeframe) {
    const rule = timeframeRules[timeframe] || timeframeRules["1Y"];
    if (rule.unavailable) {
      return {
        source: "Unavailable",
        unavailable: rule.unavailable,
        rows: []
      };
    }

    const dates = dateRange(rule.days);
    const rows = [];
    const chunkSize = 12;
    for (let index = 0; index < dates.length; index += chunkSize) {
      const chunk = dates.slice(index, index + chunkSize);
      const settled = await Promise.allSettled(chunk.map((date) => fetchPrimaryFxRatesForDate(date)));
      settled.forEach((result) => {
        if (result.status === "fulfilled") {
          rows.push({
            date: new Date(`${result.value.date}T00:00:00Z`),
            label: dateLabel(new Date(`${result.value.date}T00:00:00Z`), timeframe),
            rates: Object.fromEntries(Object.entries(result.value.rates).map(([code, value]) => [code.toLowerCase(), value]))
          });
        }
      });
    }

    rows.sort((a, b) => a.date - b.date);
    return {
      source: "Currency API daily history",
      rows
    };
  }

  function dateLabel(date, timeframe) {
    if (timeframe === "1D") {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    if (timeframe === "1W") {
      return date.toLocaleDateString("en-US", { weekday: "short", day: "2-digit" });
    }
    if (timeframe === "1M") {
      return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    }
    if (timeframe === "3M") {
      return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  function updateChartViewForRows() {
    const end = Math.max(state.history.length - 1, 1);
    state.chartView = { start: 0, end };
  }

  function renderCurrencyOptions() {
    [refs.currencyFrom, refs.currencyTo].forEach((select) => {
      if (!select) return;
      select.innerHTML = "";
      currencyCodes.forEach((code) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = formatCurrencyOption(code);
        select.append(option);
      });
    });
    if (refs.currencyFrom) refs.currencyFrom.value = state.fromCurrency;
    if (refs.currencyTo) refs.currencyTo.value = state.toCurrency;
  }

  function renderConvertedAmount() {
    if (!refs.amountTo) return;
    refs.amountTo.value = formatNumber(state.amount * pairRate(state.fromCurrency, state.toCurrency), 4);
  }

  function renderModuleState() {
    const isFx = state.activeModule === "fx";
    if (refs.board) refs.board.hidden = !isFx;
    if (!refs.moduleNotice) return;

    if (isFx) {
      refs.moduleNotice.hidden = true;
      refs.moduleNotice.textContent = "";
      return;
    }

    const label = moduleLabels[state.activeModule] || "Selected module";
    refs.moduleNotice.hidden = false;
    refs.moduleNotice.innerHTML = `
      <span class="eyebrow">Planned module</span>
      <strong>${label}</strong>
      <p>This section is intentionally parked for a later API pass. The FX workbench remains the only complete live module in this release.</p>
    `;
  }

  function currencyMatches(code) {
    const meta = currencyMeta[code];
    const text = `${code} ${meta.label}`.toLowerCase();
    return !state.query || text.includes(state.query);
  }

  function renderMatrix() {
    if (!refs.matrixBody) return;
    refs.matrixBody.innerHTML = "";

    const rows = currencyCodes.filter(currencyMatches);
    if (!rows.length) {
      refs.matrixBody.innerHTML = `<tr><td colspan="3" class="finance-empty-row">No currency matches.</td></tr>`;
      return;
    }

    rows.forEach((code) => {
      const current = code === state.fromCurrency;
      const converted = current ? "-" : formatNumber(state.amount * pairRate(state.fromCurrency, code), 5);
      const previous = previousPairRate(state.fromCurrency, code);
      const currentPair = pairRate(state.fromCurrency, code);
      const change = previous ? ((currentPair - previous) / previous) * 100 : null;
      const trendClass = change >= 0 ? "is-up" : "is-down";
      const trendMark = change >= 0 ? "up" : "down";
      const trendText = change === null ? "history n/a" : `${formatNumber(change, 2)}% ${trendMark}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="finance-currency-token">${formatCurrencyOption(code)} <small>${currencyMeta[code].label}</small></span></td>
        <td>${converted}</td>
        <td><span class="${trendClass}">${trendText}</span></td>
      `;
      refs.matrixBody.append(tr);
    });
  }

  function previousPairRate(from, to) {
    const rows = state.history;
    if (rows.length < 2) return null;
    const previous = rows[rows.length - 2];
    const fromRate = previous.rates[from.toLowerCase()];
    const toRate = previous.rates[to.toLowerCase()];
    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) return null;
    return toRate / fromRate;
  }

  function renderDerivedQuotes() {
    if (!refs.bankBody) return;
    refs.bankBody.innerHTML = "";

    const mid = pairRate(state.fromCurrency, state.toCurrency);
    const rows = derivedQuoteLines.filter((row) => {
      const text = `${row.name} buy sell derived ${state.fromCurrency} ${state.toCurrency}`.toLowerCase();
      return !state.query || text.includes(state.query);
    });

    if (!rows.length) {
      refs.bankBody.innerHTML = `<tr><td colspan="3" class="finance-empty-row">No quote lines match.</td></tr>`;
      return;
    }

    rows.forEach((row) => {
      const buy = mid * (1 - row.buySpread);
      const sell = mid * (1 + row.sellSpread);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="finance-bank-icon">D</span>${row.name}</td>
        <td>${formatNumber(buy, 4)}</td>
        <td>${formatNumber(sell, 4)}</td>
      `;
      refs.bankBody.append(tr);
    });
  }

  function chartRows() {
    const rows = state.history;
    if (rows.length < 2) return [];
    const start = Math.max(0, Math.min(rows.length - 2, Math.floor(state.chartView.start)));
    const end = Math.max(start + 1, Math.min(rows.length - 1, Math.ceil(state.chartView.end)));
    return rows.slice(start, end + 1);
  }

  function rateFromRow(row, code) {
    if (code === "USD") return 1;
    const value = row.rates[code.toLowerCase()];
    return Number.isFinite(value) ? value : rate(code);
  }

  function buildSeries(rows) {
    const focus = state.toCurrency === "USD" ? state.fromCurrency : state.toCurrency;
    if (state.chartMode === "single") {
      return [
        {
          label: `${focus} vs USD`,
          color: "#2aaace",
          values: rows.map((row) => rateFromRow(row, focus))
        }
      ];
    }

    const pairValues = rows.map((row) => rateFromRow(row, state.toCurrency) / rateFromRow(row, state.fromCurrency));
    return [
      {
        label: `${state.fromCurrency}/${state.toCurrency} cross`,
        color: "#2aaace",
        values: pairValues
      }
    ];
  }

  function renderLegend(series) {
    if (!refs.legend) return;
    refs.legend.innerHTML = "";
    series.forEach((item) => {
      const node = document.createElement("span");
      node.innerHTML = `<i style="background:${item.color}"></i>${item.label}`;
      refs.legend.append(node);
    });
  }

  function niceStep(range, targetTicks) {
    const rough = range / Math.max(targetTicks - 1, 1);
    if (!Number.isFinite(rough) || rough <= 0) return 1;
    const exponent = Math.floor(Math.log10(rough));
    const fraction = rough / 10 ** exponent;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * 10 ** exponent;
  }

  function buildYAxis(values, targetTicks = 7) {
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawRange = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.0008, 0.0001);
    const paddedMin = rawMin - rawRange * 0.08;
    const paddedMax = rawMax + rawRange * 0.08;
    const step = niceStep(paddedMax - paddedMin, targetTicks);
    const min = Math.floor(paddedMin / step) * step;
    const max = Math.ceil(paddedMax / step) * step;
    const ticks = [];
    for (let value = max; value >= min - step * 0.5; value -= step) {
      ticks.push(Number(value.toPrecision(12)));
    }
    return { min, max, ticks };
  }

  function yDigitsFor(values, step) {
    const max = Math.max(...values.map((value) => Math.abs(value)));
    if (state.chartMode === "compare") return 2;
    if (step < 0.001) return 5;
    if (step < 0.01) return 4;
    if (step < 0.1) return 3;
    if (max >= 100) return 2;
    return 3;
  }

  function pathForSeries(values, xFor, yFor) {
    return values
      .map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(value).toFixed(2)}`)
      .join(" ");
  }

  function setChartUnavailable(message) {
    if (refs.chartStatus) refs.chartStatus.textContent = message;
    if (refs.legend) refs.legend.innerHTML = "";
    if (refs.chartLabel) refs.chartLabel.textContent = "History unavailable";
    if (!refs.chart) return;
    refs.chart.innerHTML = `
      <rect x="0" y="0" width="1000" height="420" rx="8"></rect>
      <text class="finance-chart-empty" x="500" y="206" text-anchor="middle">${message}</text>
    `;
  }

  function rowDateText(row) {
    if (!row?.date) return "--";
    if (state.timeframe === "1D") {
      return row.date.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return row.date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  }

  function renderPointer(pointer, rows, series, xFor, yFor, width, padding, yDigits) {
    if (!pointer || !rows[pointer.index]) return "";
    const row = rows[pointer.index];
    const value = series[0].values[pointer.index];
    const x = xFor(pointer.index);
    const y = yFor(value);
    const labelWidth = 176;
    const labelX = x > width - padding.right - labelWidth - 12 ? x - labelWidth - 12 : x + 12;
    const priceText = state.chartMode === "compare" ? `${formatNumber(value, 2)} idx` : formatNumber(value, yDigits);
    return `
      <g class="finance-chart-hover">
        <line class="finance-hover-x" x1="${x}" x2="${x}" y1="${padding.top}" y2="${420 - padding.bottom}" />
        <line class="finance-hover-y" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" />
        <circle cx="${x}" cy="${y}" r="4.5"></circle>
        <rect x="${labelX}" y="${Math.max(padding.top + 8, y - 42)}" width="${labelWidth}" height="48" rx="6"></rect>
        <text x="${labelX + 10}" y="${Math.max(padding.top + 8, y - 42) + 18}">${rowDateText(row)}</text>
        <text x="${labelX + 10}" y="${Math.max(padding.top + 8, y - 42) + 36}">${priceText}</text>
      </g>
    `;
  }

  function renderChart() {
    if (!refs.chart) return;
    const rule = timeframeRules[state.timeframe] || timeframeRules["1Y"];
    if (rule.unavailable) {
      setChartUnavailable(rule.unavailable);
      return;
    }
    if (state.historyStatus.tone === "loading") {
      setChartUnavailable("Loading real historical rates...");
      return;
    }
    if (state.history.length < 2) {
      setChartUnavailable("Not enough real historical data returned by the public source.");
      return;
    }
    const rows = chartRows();
    if (rows.length < 2) {
      setChartUnavailable("Zoom window is too small for a line chart.");
      return;
    }
    const series = buildSeries(rows);
    const values = series.flatMap((item) => item.values);
    const axis = buildYAxis(values, 7);
    const width = 1000;
    const height = 420;
    const padding = { top: 30, right: 82, bottom: 48, left: 68 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const denominator = Math.max(rows.length - 1, 1);

    const yFor = (value) => padding.top + chartHeight - ((value - axis.min) / (axis.max - axis.min)) * chartHeight;
    const xFor = (index) => padding.left + (chartWidth / denominator) * index;
    const tickIndexes = Array.from({ length: rule.tickCount }, (_, index) => {
      const ratio = rule.tickCount <= 1 ? 0 : index / (rule.tickCount - 1);
      return Math.round(ratio * (rows.length - 1));
    }).filter((index, position, all) => all.indexOf(index) === position);
    const yDigits = yDigitsFor(values, Math.abs(axis.ticks[0] - axis.ticks[1]) || 1);
    const primarySeries = series[0];
    const latestValue = primarySeries.values[primarySeries.values.length - 1];
    const latestY = yFor(latestValue);
    const latestText = formatNumber(latestValue, yDigits);
    const pointerIndex = state.chartPointer?.source === state.timeframe ? Math.max(0, Math.min(rows.length - 1, state.chartPointer.index)) : null;

    const grid = axis.ticks.map((value) => {
      const y = yFor(value);
      return `<line x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" />`;
    }).join("");
    const xTicks = tickIndexes
      .map((index) => `<text x="${xFor(index)}" y="${height - 16}" text-anchor="middle">${rows[index].label}</text>`)
      .join("");
    const yTickLabels = axis.ticks
      .map((value) => `<text class="finance-y-label" x="${padding.left - 10}" y="${yFor(value) + 4}" text-anchor="end">${formatNumber(value, yDigits)}</text>`)
      .join("");
    const paths = series
      .map((item, index) => `<path d="${pathForSeries(item.values, xFor, yFor)}" stroke="${item.color}" ${index === 2 ? 'stroke-dasharray="10 6"' : ""} />`)
      .join("");

    refs.chart.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="8"></rect>
      <g class="finance-chart-grid">${grid}</g>
      <g class="finance-chart-axis">${xTicks}${yTickLabels}</g>
      <g class="finance-current-price">
        <line x1="${padding.left}" x2="${width - padding.right}" y1="${latestY}" y2="${latestY}" />
        <rect x="${width - padding.right + 8}" y="${latestY - 13}" width="62" height="26" rx="5"></rect>
        <text x="${width - padding.right + 39}" y="${latestY + 4}" text-anchor="middle">${latestText}</text>
      </g>
      <g class="finance-chart-lines">${paths}</g>
      ${pointerIndex === null ? "" : renderPointer({ index: pointerIndex }, rows, series, xFor, yFor, width, padding, yDigits)}
      <rect class="finance-chart-hitbox" x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}"></rect>
    `;

    if (refs.chartLabel) {
      const focus = state.toCurrency === "USD" ? state.fromCurrency : state.toCurrency;
      refs.chartLabel.textContent = state.chartMode === "single" ? `${focus} vs USD` : `${state.fromCurrency}/${state.toCurrency} cross rate`;
    }
    if (refs.chartStatus) {
      const mode = state.chartMode === "compare" ? "cross rate" : "direct FX rate";
      refs.chartStatus.textContent = `${rule.status} / ${state.history.length} real points / visible ${rows.length} / ${mode}`;
    }
    renderLegend(series);
  }

  function renderTimeframes() {
    if (!refs.timeframes) return;
    const frames = ["1D", "1W", "1M", "3M", "1Y"];
    refs.timeframes.innerHTML = "";
    frames.forEach((frame) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = frame === state.timeframe ? "is-active" : "";
      button.dataset.timeframe = frame;
      button.textContent = frame;
      button.addEventListener("click", () => {
        state.timeframe = frame;
        state.chartPointer = null;
        state.historyStatus = { source: "Currency API daily history", tone: "loading" };
        state.history = [];
        updateChartViewForRows();
        renderTimeframes();
        renderChart();
        refreshHistory();
      });
      refs.timeframes.append(button);
    });
  }

  function chartLocalIndexFromEvent(event) {
    if (!refs.chart) return null;
    const rect = refs.chart.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1000;
    const paddingLeft = 68;
    const paddingRight = 82;
    const chartWidth = 1000 - paddingLeft - paddingRight;
    const rows = chartRows();
    if (rows.length < 2) return null;
    const ratio = Math.max(0, Math.min(1, (x - paddingLeft) / chartWidth));
    return Math.round(ratio * (rows.length - 1));
  }

  function bindChartEvents() {
    if (!refs.chart) return;
    refs.chart.addEventListener("pointermove", (event) => {
      if (state.history.length < 2) return;
      const localIndex = chartLocalIndexFromEvent(event);
      if (localIndex === null) return;
      if (state.chartDrag) {
        const rows = state.history;
        const span = state.chartDrag.end - state.chartDrag.start;
        const delta = localIndex - state.chartDrag.index;
        const nextStart = Math.max(0, Math.min(rows.length - 1 - span, state.chartDrag.start - delta));
        state.chartView = { start: nextStart, end: nextStart + span };
      } else {
        state.chartPointer = { source: state.timeframe, index: localIndex };
      }
      renderChart();
    });
    refs.chart.addEventListener("pointerleave", () => {
      if (state.chartDrag) return;
      state.chartPointer = null;
      renderChart();
    });
    refs.chart.addEventListener("pointerdown", (event) => {
      const localIndex = chartLocalIndexFromEvent(event);
      if (localIndex === null) return;
      refs.chart.setPointerCapture?.(event.pointerId);
      state.chartDrag = {
        index: localIndex,
        start: state.chartView.start,
        end: state.chartView.end
      };
    });
    refs.chart.addEventListener("pointerup", (event) => {
      refs.chart.releasePointerCapture?.(event.pointerId);
      state.chartDrag = null;
    });
    refs.chart.addEventListener(
      "wheel",
      (event) => {
        if (state.history.length < 4) return;
        event.preventDefault();
        const rows = state.history;
        const localIndex = chartLocalIndexFromEvent(event);
        if (localIndex === null) return;
        const currentStart = state.chartView.start;
        const currentEnd = state.chartView.end;
        const span = currentEnd - currentStart;
        const minSpan = Math.min(6, rows.length - 1);
        const maxSpan = rows.length - 1;
        const zoomFactor = event.deltaY < 0 ? 0.78 : 1.28;
        const nextSpan = Math.max(minSpan, Math.min(maxSpan, span * zoomFactor));
        const anchor = currentStart + localIndex;
        const anchorRatio = span <= 0 ? 0.5 : localIndex / span;
        let nextStart = anchor - nextSpan * anchorRatio;
        nextStart = Math.max(0, Math.min(rows.length - 1 - nextSpan, nextStart));
        state.chartView = { start: nextStart, end: nextStart + nextSpan };
        state.chartPointer = null;
        renderChart();
      },
      { passive: false }
    );
  }

  function renderAll() {
    renderConvertedAmount();
    renderMatrix();
    renderDerivedQuotes();
    renderChart();
    renderModuleState();
  }

  function swapCurrencies() {
    const currentFrom = state.fromCurrency;
    state.fromCurrency = state.toCurrency;
    state.toCurrency = currentFrom;
    state.chartPointer = null;
    renderCurrencyOptions();
    renderAll();
  }

  function bindEvents() {
    document.querySelectorAll("[data-finance-category]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeModule = button.dataset.financeCategory || "fx";
        document.querySelectorAll("[data-finance-category]").forEach((node) => {
          node.classList.toggle("is-active", node === button);
        });
        renderModuleState();
      });
    });

    document.querySelectorAll("[data-chart-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.chartMode = button.dataset.chartMode || "single";
        document.querySelectorAll("[data-chart-mode]").forEach((node) => {
          node.classList.toggle("is-active", node === button);
        });
        renderChart();
      });
    });

    refs.amountFrom?.addEventListener("input", () => {
      state.amount = Number(refs.amountFrom.value || 0);
      renderAll();
    });
    refs.currencyFrom?.addEventListener("change", () => {
      state.fromCurrency = refs.currencyFrom.value;
      renderAll();
    });
    refs.currencyTo?.addEventListener("change", () => {
      state.toCurrency = refs.currencyTo.value;
      renderAll();
    });
    refs.swap?.addEventListener("click", swapCurrencies);
    refs.chartSwap?.addEventListener("click", swapCurrencies);
    refs.search?.addEventListener("input", () => {
      state.query = refs.search.value.trim().toLowerCase();
      renderMatrix();
      renderDerivedQuotes();
    });
  }

  async function refreshRates() {
    setDataStatus({ source: "Currency API", tone: "loading", date: "loading" });
    const payload = await fetchFxRates();
    state.rateTable = payload.rates;
    setDataStatus({
      source: payload.source,
      tone: payload.fallback ? "fallback" : "live",
      date: payload.date,
      hasHistorical: false
    });
    renderAll();
  }

  async function refreshHistory() {
    const rule = timeframeRules[state.timeframe] || timeframeRules["1Y"];
    state.historyStatus = { source: "Currency API daily history", tone: "loading" };
    state.history = [];
    updateChartViewForRows();
    renderChart();

    const payload = await fetchFxHistory(state.timeframe);
    state.history = payload.rows;
    state.historyStatus = {
      source: payload.source,
      tone: payload.rows.length >= 2 ? "live" : "unavailable",
      message: payload.unavailable || ""
    };
    updateChartViewForRows();
    if (rule.unavailable) {
      renderChart();
      return;
    }
    renderAll();
  }

  function init() {
    if (!refs.amountFrom) return;
    state.amount = Number(refs.amountFrom.value || 1);
    updateChartViewForRows();
    renderCurrencyOptions();
    renderTimeframes();
    bindEvents();
    bindChartEvents();
    renderAll();
    refreshRates();
    refreshHistory();
  }

  init();
})();
