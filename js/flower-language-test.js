(function () {
  const DATA_URL = "/data/flower-language-test.json";
  const IDLE_DELAY = 15000;
  const NEXT_DELAY = 520;
  const CODES = ["A", "B", "C", "D"];

  const state = {
    data: null,
    currentIndex: 0,
    answers: [],
    isLocked: false,
    idleTimer: null,
    resultKey: null
  };

  const els = {
    shell: document.querySelector(".test-shell"),
    loadingView: document.querySelector("[data-loading-view]"),
    questionView: document.querySelector("[data-question-view]"),
    resultView: document.querySelector("[data-result-view]"),
    catalogView: document.querySelector("[data-catalog-view]"),
    kicker: document.querySelector("[data-question-kicker]"),
    title: document.querySelector("[data-question-title]"),
    options: document.querySelector("[data-options]"),
    nodes: document.querySelector("[data-progress-nodes]"),
    sprite: document.querySelector("[data-progress-sprite]"),
    idleTooltip: document.querySelector("[data-idle-tooltip]"),
    resultSymbol: document.querySelector("[data-result-symbol]"),
    resultTitle: document.querySelector("[data-result-title]"),
    resultLanguage: document.querySelector("[data-result-language]"),
    resultSummary: document.querySelector("[data-result-summary]"),
    resultAdvice: document.querySelector("[data-result-advice]"),
    restart: document.querySelector("[data-restart]"),
    openCatalog: document.querySelector("[data-open-catalog]"),
    catalogGrid: document.querySelector("[data-catalog-grid]"),
    backResult: document.querySelector("[data-back-result]"),
    restartCatalog: document.querySelector("[data-restart-catalog]")
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return map[char];
    });
  }

  async function loadData() {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load flower language test data.");
    return response.json();
  }

  function showView(name) {
    els.shell.dataset.view = name;
    els.loadingView.hidden = name !== "loading";
    els.questionView.hidden = name !== "question";
    els.resultView.hidden = name !== "result";
    els.catalogView.hidden = name !== "catalog";
  }

  function buildProgressNodes() {
    els.nodes.innerHTML = "";
    state.data.questions.forEach((_, index) => {
      const node = document.createElement("span");
      node.className = "progress-node";
      node.setAttribute("aria-label", `第 ${index + 1} 題`);
      els.nodes.append(node);
    });
  }

  function updateProgress() {
    const total = state.data.questions.length;
    const maxIndex = Math.max(total - 1, 1);
    const active = Math.min(state.currentIndex, total - 1);
    const offset = `calc((100% - 44px) * ${active / maxIndex})`;

    els.sprite.style.setProperty("--sprite-x", offset);
    [...els.nodes.children].forEach((node, index) => {
      node.classList.toggle("is-active", index === active);
      node.classList.toggle("is-done", index < active);
    });
  }

  function clearIdleTimer() {
    window.clearTimeout(state.idleTimer);
    els.idleTooltip.classList.remove("is-visible");
  }

  function startIdleTimer() {
    clearIdleTimer();
    state.idleTimer = window.setTimeout(() => {
      if (!state.isLocked && !els.questionView.hidden) {
        els.idleTooltip.classList.add("is-visible");
      }
    }, IDLE_DELAY);
  }

  function renderQuestion() {
    const question = state.data.questions[state.currentIndex];
    const total = state.data.questions.length;

    els.kicker.textContent = `Question ${state.currentIndex + 1} / ${total}`;
    els.title.textContent = question.text;
    els.options.innerHTML = "";

    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.className = "option-button";
      button.type = "button";
      button.innerHTML = escapeHtml(option.text);
      button.addEventListener("click", () => selectOption(option, button));
      els.options.append(button);
    });

    updateProgress();
    startIdleTimer();
  }

  function selectOption(option, button) {
    if (state.isLocked) return;

    state.isLocked = true;
    clearIdleTimer();
    button.classList.add("is-selected");
    [...els.options.children].forEach((item) => {
      item.disabled = true;
    });

    state.answers[state.currentIndex] = {
      questionId: state.data.questions[state.currentIndex].id,
      axis: option.axis,
      code: option.code,
      weight: Number(option.weight || 1)
    };

    els.questionView.classList.add("is-exiting");

    window.setTimeout(() => {
      els.questionView.classList.remove("is-exiting");
      state.currentIndex += 1;
      state.isLocked = false;

      if (state.currentIndex >= state.data.questions.length) {
        renderResult();
        return;
      }

      renderQuestion();
      els.questionView.classList.remove("is-entering");
      void els.questionView.offsetWidth;
      els.questionView.classList.add("is-entering");
    }, NEXT_DELAY);
  }

  function calculateResultKey() {
    const latestByAxis = {};
    const scores = {
      x: { A: 0, B: 0, C: 0, D: 0 },
      y: { A: 0, B: 0, C: 0, D: 0 },
      z: { A: 0, B: 0, C: 0, D: 0 }
    };

    state.answers.forEach((answer) => {
      if (!scores[answer.axis] || !CODES.includes(answer.code)) return;
      scores[answer.axis][answer.code] += answer.weight;
      latestByAxis[answer.axis] = answer.code;
    });

    return ["x", "y", "z"]
      .map((axis) => {
        const maxScore = Math.max(...CODES.map((code) => scores[axis][code]));
        const winners = CODES.filter((code) => scores[axis][code] === maxScore);
        const latest = latestByAxis[axis];
        return winners.includes(latest) ? latest : winners[0];
      })
      .join("");
  }

  function renderResult() {
    clearIdleTimer();
    const key = calculateResultKey();
    state.resultKey = key;
    const result = state.data.results[key] || state.data.results.AAA;

    els.resultTitle.textContent = `${result.flower}型`;
    els.resultLanguage.textContent = result.language;
    els.resultSummary.textContent = result.summary;
    els.resultAdvice.textContent = result.advice;
    els.resultSymbol.style.setProperty("--result-petal", result.colors?.petal || "#f6c2bb");
    els.resultSymbol.style.setProperty("--result-accent", result.colors?.accent || "#e9a6a1");
    showView("result");
  }

  function renderCatalog() {
    clearIdleTimer();
    els.catalogGrid.innerHTML = "";

    Object.entries(state.data.results)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, result]) => {
        const card = document.createElement("article");
        card.className = "catalog-card";
        card.classList.toggle("is-current", key === state.resultKey);
        card.innerHTML = `
          <div class="catalog-flower" aria-hidden="true"></div>
          <span>${escapeHtml(key)}${key === state.resultKey ? " · 你的結果" : ""}</span>
          <h2>${escapeHtml(result.flower)}</h2>
          <strong>${escapeHtml(result.language)}</strong>
          <p>${escapeHtml(result.summary)}</p>
        `;
        card.querySelector(".catalog-flower").style.setProperty("--result-petal", result.colors?.petal || "#f6c2bb");
        card.querySelector(".catalog-flower").style.setProperty("--result-accent", result.colors?.accent || "#e9a6a1");
        els.catalogGrid.append(card);
      });

    showView("catalog");
  }

  function restart() {
    state.currentIndex = 0;
    state.answers = [];
    state.isLocked = false;
    state.resultKey = null;
    showView("question");
    renderQuestion();
    els.questionView.classList.remove("is-entering");
    void els.questionView.offsetWidth;
    els.questionView.classList.add("is-entering");
  }

  async function init() {
    try {
      state.data = await loadData();
      buildProgressNodes();
      showView("question");
      renderQuestion();
    } catch (error) {
      els.loadingView.innerHTML = `
        <p class="kicker">花園暫時打烊</p>
        <h1>資料沒有順利載入</h1>
        <p>${escapeHtml(error.message)}</p>
      `;
    }
  }

  els.restart.addEventListener("click", restart);
  els.restartCatalog.addEventListener("click", restart);
  els.openCatalog.addEventListener("click", renderCatalog);
  els.backResult.addEventListener("click", () => showView("result"));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.resultView.hidden) restart();
    if (event.key === "Escape" && !els.catalogView.hidden) showView("result");
  });

  init();
})();
