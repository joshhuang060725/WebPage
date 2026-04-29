(function () {
  const CACHE_TTL = 60 * 60 * 1000;
  const API_URL = "/api/youtube/search";

  const copy = {
    en: {
      idle: "Enter a query to load videos.",
      loading: "Searching YouTube...",
      error: "Unable to load YouTube results.",
      missingKey: "YouTube API key is not configured.",
      empty: "No videos found for this query.",
      cached: "Loaded cached results.",
      ready: "Results loaded.",
      nowPlaying: "Now Playing"
    },
    "zh-TW": {
      idle: "輸入關鍵字以載入影片。",
      loading: "正在搜尋 YouTube...",
      error: "無法載入 YouTube 結果。",
      missingKey: "尚未設定 YouTube API key。",
      empty: "找不到符合此關鍵字的影片。",
      cached: "已載入本機快取結果。",
      ready: "結果已載入。",
      nowPlaying: "正在播放"
    },
    "zh-CN": {
      idle: "输入关键词以加载视频。",
      loading: "正在搜索 YouTube...",
      error: "无法加载 YouTube 结果。",
      missingKey: "尚未设置 YouTube API key。",
      empty: "找不到符合此关键词的视频。",
      cached: "已加载本机缓存结果。",
      ready: "结果已加载。",
      nowPlaying: "正在播放"
    }
  };

  const state = {
    lang: detectLanguage(),
    items: [],
    selectedId: null,
    player: null,
    pendingVideo: null,
    apiLoading: false
  };

  const refs = {
    form: document.getElementById("youtube-search-form"),
    input: document.getElementById("youtube-search-input"),
    status: document.getElementById("youtube-status"),
    results: document.getElementById("youtube-results"),
    ticker: document.getElementById("youtube-ticker-inner"),
    nowTitle: document.getElementById("youtube-now-title")
  };

  function detectLanguage() {
    const saved = localStorage.getItem("portal-lang");
    const lang = saved || navigator.language || "en";
    if (/^zh-(tw|hk|mo)$/i.test(lang)) return "zh-TW";
    if (/^zh/i.test(lang)) return "zh-CN";
    return "en";
  }

  function apiLanguage() {
    if (state.lang === "zh-TW") return "zh-Hant";
    if (state.lang === "zh-CN") return "zh-Hans";
    return "en";
  }

  function t(key) {
    return (copy[state.lang] || copy.en)[key] || copy.en[key] || key;
  }

  function setStatus(message, tone = "idle") {
    if (!refs.status) return;
    refs.status.textContent = message;
    refs.status.dataset.tone = tone;
  }

  function cacheKey(query) {
    return `jats:youtube:${apiLanguage()}:${query.toLowerCase()}`;
  }

  function readCache(query) {
    try {
      const raw = localStorage.getItem(cacheKey(query));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || Date.now() - parsed.timestamp > CACHE_TTL) return null;
      return Array.isArray(parsed.items) ? parsed.items : null;
    } catch (error) {
      console.warn(error);
      return null;
    }
  }

  function writeCache(query, items) {
    try {
      localStorage.setItem(cacheKey(query), JSON.stringify({ timestamp: Date.now(), items }));
    } catch (error) {
      console.warn(error);
    }
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(state.lang, {
        year: "numeric",
        month: "short",
        day: "2-digit"
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function safeText(value) {
    return value == null ? "" : String(value);
  }

  function setActive(videoId) {
    state.selectedId = videoId;
    document.querySelectorAll("[data-youtube-video]").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.youtubeVideo === videoId);
    });
  }

  function renderResults(items) {
    if (!refs.results || !refs.ticker) return;

    refs.results.innerHTML = "";
    refs.ticker.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "youtube-empty";
      empty.textContent = t("empty");
      refs.results.append(empty);
      return;
    }

    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "youtube-result";
      button.dataset.youtubeVideo = item.id;
      button.innerHTML = `
        <img src="${safeText(item.thumbnail)}" alt="" loading="lazy" />
        <span>
          <strong></strong>
          <small></small>
        </span>
      `;
      button.querySelector("strong").textContent = safeText(item.title);
      button.querySelector("small").textContent = [item.channelTitle, formatDate(item.publishedAt)].filter(Boolean).join(" / ");
      button.addEventListener("click", () => playVideo(item));
      refs.results.append(button);
    });

    [...items, ...items].forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "youtube-ticker-item";
      button.dataset.youtubeVideo = item.id;
      button.textContent = `${item.title} / ${item.channelTitle}`;
      button.addEventListener("click", () => playVideo(item));
      refs.ticker.append(button);
    });
  }

  function loadIframeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (state.apiLoading) {
      return new Promise((resolve) => {
        const timer = window.setInterval(() => {
          if (window.YT?.Player) {
            window.clearInterval(timer);
            resolve();
          }
        }, 50);
      });
    }

    state.apiLoading = true;
    return new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") previousReady();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.append(script);
    });
  }

  async function playVideo(item) {
    if (!item?.id) return;
    state.pendingVideo = item;
    setActive(item.id);
    if (refs.nowTitle) refs.nowTitle.textContent = `${t("nowPlaying")}: ${item.title}`;

    await loadIframeApi();

    if (state.player?.loadVideoById) {
      state.player.loadVideoById(item.id);
      if (state.player.mute) state.player.mute();
      return;
    }

    state.player = new window.YT.Player("youtube-player", {
      videoId: item.id,
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
      },
      events: {
        onReady(event) {
          event.target.mute();
          event.target.playVideo();
        }
      }
    });
  }

  async function search(query) {
    const normalized = query.trim().slice(0, 80);
    if (!normalized) {
      setStatus(t("idle"));
      return;
    }

    const cached = readCache(normalized);
    if (cached) {
      state.items = cached;
      renderResults(cached);
      if (cached[0]) playVideo(cached[0]);
      setStatus(t("cached"), "ok");
      return;
    }

    setStatus(t("loading"), "loading");

    try {
      const params = new URLSearchParams({ q: normalized, lang: apiLanguage() });
      const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = payload?.error?.code;
        throw new Error(code === "missing_api_key" ? t("missingKey") : payload?.error?.message || t("error"));
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      state.items = items;
      writeCache(normalized, items);
      renderResults(items);
      if (items[0]) playVideo(items[0]);
      setStatus(items.length ? t("ready") : t("empty"), items.length ? "ok" : "idle");
    } catch (error) {
      console.warn(error);
      setStatus(error.message || t("error"), "error");
    }
  }

  function init() {
    if (!refs.form || !refs.input) return;

    setStatus(t("idle"));
    refs.form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(refs.input.value);
    });

    window.addEventListener("storage", (event) => {
      if (event.key === "portal-lang") state.lang = detectLanguage();
    });

    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", () => {
        state.lang = detectLanguage();
        setStatus(t("idle"));
      });
    });
  }

  init();
})();
