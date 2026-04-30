(function () {
  const fallback = {
    categories: [
      { id: "all", label: { en: "All", "zh-TW": "全部", "zh-CN": "全部" } }
    ],
    items: []
  };

  const state = {
    data: fallback,
    lang: detectLanguage(),
    category: "all",
    query: ""
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

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getCategoryLabel(categoryId) {
    const category = (state.data.categories || []).find((item) => item.id === categoryId);
    return localized(category?.label) || categoryId;
  }

  function formulaText(formula) {
    return [
      localized(formula.title),
      localized(formula.description),
      localized(formula.summary),
      formula.category,
      formula.status,
      ...(formula.tags || [])
    ]
      .join(" ")
      .toLowerCase();
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

  function renderFilters() {
    const target = document.getElementById("formula-filters");
    if (!target) return;

    const categories = state.data.categories?.length ? state.data.categories : fallback.categories;
    target.innerHTML = "";

    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.category = category.id;
      button.className = "formula-filter";
      button.textContent = localized(category.label);
      button.classList.toggle("is-active", category.id === state.category);
      button.addEventListener("click", () => {
        state.category = category.id;
        render();
      });
      target.append(button);
    });
  }

  function renderList() {
    const target = document.getElementById("formula-list");
    if (!target) return;

    const query = normalize(state.query);
    const formulas = (state.data.items || []).filter((formula) => {
      const categoryMatch = state.category === "all" || formula.category === state.category;
      const queryMatch = !query || formulaText(formula).includes(query);
      return categoryMatch && queryMatch;
    });

    target.innerHTML = "";

    if (!formulas.length) {
      const empty = document.createElement("article");
      empty.className = "panel formula-empty";
      empty.textContent = state.lang === "en" ? "No formulas match the current filter." : "目前沒有符合條件的公式。";
      target.append(empty);
      return;
    }

    formulas.forEach((formula) => {
      const isReady = formula.status === "ready";
      const node = document.createElement(isReady ? "a" : "article");
      node.className = "formula-card";
      node.dataset.status = formula.status || "draft";

      if (isReady) {
        node.href = formula.route || `/formula.html?id=${encodeURIComponent(formula.id)}`;
      }

      node.innerHTML = `
        <div class="formula-card-head">
          <span>${getCategoryLabel(formula.category)}</span>
          <small>ID: ${formula.number || formula.id}</small>
        </div>
        <h2>${localized(formula.title)}</h2>
        <p>${localized(formula.description)}</p>
        <div class="formula-math">$$${formula.formula || ""}$$</div>
        <div class="formula-card-footer">
          <span>${formula.status || "draft"}</span>
          <strong>${isReady ? "Open module" : "Coming soon"}</strong>
        </div>
      `;
      target.append(node);
    });

    renderMath(target);
  }

  function render() {
    state.lang = detectLanguage();
    renderFilters();
    renderList();
  }

  async function init() {
    const search = document.getElementById("formula-search");
    const form = document.getElementById("formula-search-form");

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        state.query = search?.value || "";
        renderList();
      });
    }

    if (search) {
      search.addEventListener("input", () => {
        state.query = search.value;
        renderList();
      });
    }

    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", () => {
        window.setTimeout(render, 0);
      });
    });

    try {
      const loaded = await window.PortalData.load();
      state.data = loaded.formulas || fallback;
    } catch (error) {
      console.warn(error);
    }

    render();
  }

  init();
})();
