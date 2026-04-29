(function () {
  const fallbackI18n = {
    en: {},
    "zh-TW": {},
    "zh-CN": {}
  };

  const fallbackData = {
    profile: {
      name: "Josh Huang",
      summary: {
        en: "A public personal portal for projects, notes, and UI/UX experiments.",
        "zh-TW": "公開個人門戶，用於專案、筆記與 UI/UX 實驗。",
        "zh-CN": "公开个人门户，用于项目、笔记与 UI/UX 实验。"
      },
      tags: ["UI/UX", "Web", "Engineering"],
      contacts: [{ label: "GitHub", url: "https://github.com/joshhuang060725", public: true }]
    },
    projects: [],
    shortcuts: [],
    tools: [],
    wallpapers: [],
    i18n: fallbackI18n
  };

  let state = {
    lang: detectLanguage(),
    themeMode: detectThemeMode(),
    data: fallbackData,
    runtime: {
      geo: null,
      weather: null,
      latency: null,
      locationError: false,
      weatherError: false,
      pingError: false
    },
    selectedWallpaper: null,
    wallpaperPanel: 0,
    wallpaperWheelLocked: false
  };

  function detectLanguage() {
    const saved = localStorage.getItem("portal-lang");
    if (saved) return saved;

    const lang = navigator.language || "en";
    if (/^zh-(tw|hk|mo)$/i.test(lang)) return "zh-TW";
    if (/^zh/i.test(lang)) return "zh-CN";
    return "en";
  }

  function detectThemeMode() {
    return localStorage.getItem("portal-theme") || "auto";
  }

  function resolveTheme() {
    if (state.themeMode !== "auto") return state.themeMode;
    const hour = new Date().getHours();
    return hour >= 7 && hour < 18 ? "light" : "dark";
  }

  function setThemeMode(mode) {
    state.themeMode = mode;
    localStorage.setItem("portal-theme", mode);
    updateTheme();
  }

  function updateTheme() {
    document.body.dataset.theme = resolveTheme();
    document.body.dataset.themeMode = state.themeMode;
    document.querySelectorAll("[data-theme-button]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.themeButton === state.themeMode);
    });
  }

  function t(key, fallback = key) {
    return state.data.i18n?.[state.lang]?.[key] || state.data.i18n?.en?.[key] || fallback;
  }

  function localized(value) {
    if (!value || typeof value === "string") return value || "";
    return value[state.lang] || value.en || value["zh-TW"] || "";
  }

  function interpolate(template, values) {
    return Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, value ?? "--"),
      template
    );
  }

  function setLanguage(lang) {
    state.lang = lang;
    localStorage.setItem("portal-lang", lang);
    document.documentElement.lang = lang;
    render();
  }

  function updateClock() {
    const now = new Date();
    const clock = document.getElementById("clock");
    const dateLine = document.getElementById("date-line");

    if (clock) {
      clock.textContent = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(now);
    }

    if (dateLine) {
      dateLine.textContent = new Intl.DateTimeFormat(state.lang, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit"
      }).format(now);
    }
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n, node.textContent);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder, node.getAttribute("placeholder") || ""));
    });

    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.langButton === state.lang);
    });

    updateTheme();
  }

  function renderProfile() {
    const profile = state.data.profile || fallbackData.profile;
    const name = document.getElementById("profile-name");
    const summary = document.getElementById("profile-summary");
    const tags = document.getElementById("profile-tags");
    const contacts = document.getElementById("contact-actions");

    if (name) name.textContent = profile.name || "Josh Huang";
    if (summary) summary.textContent = localized(profile.summary);

    if (tags) {
      tags.innerHTML = "";
      (profile.tags || []).forEach((tag) => {
        const item = document.createElement("span");
        item.textContent = tag;
        tags.append(item);
      });
    }

    if (contacts) {
      contacts.innerHTML = "";
      (profile.contacts || [])
        .filter((contact) => contact.public && contact.url)
        .forEach((contact, index) => {
          const link = document.createElement("a");
          link.className = index === 0 ? "button primary" : "button ghost";
          link.href = contact.url;
          link.textContent = contact.label;
          if (!contact.url.startsWith("mailto:")) {
            link.target = "_blank";
            link.rel = "noreferrer";
          }
          contacts.append(link);
        });
    }
  }

  function renderProjects() {
    const list = document.getElementById("project-list");
    if (!list) return;

    list.innerHTML = "";
    (state.data.projects || []).forEach((project) => {
      const card = document.createElement("article");
      card.className = "project-card";
      card.innerHTML = `
        <span>${project.status || "active"}</span>
        <h3>${localized(project.title)}</h3>
        <p>${localized(project.description)}</p>
        <div class="project-tags"></div>
      `;

      const tags = card.querySelector(".project-tags");
      (project.tech_stack || []).forEach((tech) => {
        const item = document.createElement("span");
        item.textContent = tech;
        tags.append(item);
      });

      list.append(card);
    });
  }

  function renderShortcuts() {
    const list = document.getElementById("shortcut-list");
    if (!list) return;

    list.innerHTML = "";
    (state.data.shortcuts || []).forEach((shortcut) => {
      const isLocked = shortcut.category === "locked" || !shortcut.url;
      const node = document.createElement(isLocked ? "article" : "a");
      node.className = "shortcut-card";

      if (!isLocked) {
        node.href = shortcut.url;
        node.target = "_blank";
        node.rel = "noreferrer";
      }

      node.innerHTML = `
        <span>${isLocked ? t("state.locked") : shortcut.category || "public"}</span>
        <strong>${shortcut.name}</strong>
        <p>${localized(shortcut.description)}</p>
      `;

      list.append(node);
    });
  }

  function renderTools() {
    const list = document.getElementById("tool-list");
    if (!list) return;

    list.innerHTML = "";
    (state.data.tools || []).forEach((tool) => {
      const card = document.createElement("article");
      card.className = "tool-card";
      card.dataset.status = tool.status === "ready" ? "ready" : "planned";
      card.innerHTML = `
        <h3>${tool.name}</h3>
        <p>${localized(tool.description)}</p>
        <span class="tool-status">${t("state.status")}: ${tool.status}</span>
      `;
      list.append(card);
    });
  }

  function getWallpaperBackgrounds() {
    const source = state.data.wallpapers;
    if (Array.isArray(source)) return source;
    return source?.backgrounds || [];
  }

  function getWallpaperLinks() {
    const source = state.data.wallpapers;
    return Array.isArray(source) ? [] : source?.links || [];
  }

  function setWallpaperPanel(index) {
    const panelIndex = index > 0 ? 1 : 0;
    const viewport = document.getElementById("wallpaper-viewport");
    const track = document.getElementById("wallpaper-track");
    if (!viewport || !track) return;

    state.wallpaperPanel = panelIndex;
    viewport.dataset.activePanel = String(panelIndex);
    track.style.transform = `translateX(-${panelIndex * 50}%)`;
    document.querySelectorAll("[data-wallpaper-panel]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.wallpaperPanel) === panelIndex);
    });
  }

  function selectWallpaper(wallpaper) {
    const viewport = document.getElementById("wallpaper-viewport");
    if (!viewport || !wallpaper) return;

    state.selectedWallpaper = wallpaper;
    viewport.dataset.wallpaperTone = wallpaper.tone || "yellow";
    viewport.style.setProperty("--wallpaper-accent", wallpaper.accent || "#FFD900");
    viewport.style.setProperty("--wallpaper-name", `"${localized(wallpaper.title) || "Wallpaper"}"`);

    if (wallpaper.src) {
      viewport.style.setProperty("--wallpaper-image", `url("${wallpaper.src}")`);
      viewport.classList.add("has-wallpaper-image");
    } else {
      viewport.style.removeProperty("--wallpaper-image");
      viewport.classList.remove("has-wallpaper-image");
    }

    document.querySelectorAll("[data-wallpaper-id]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.wallpaperId === wallpaper.id);
    });
  }

  function renderWallpaperLinks() {
    const grid = document.getElementById("wallpaper-link-grid");
    if (!grid) return;

    grid.innerHTML = "";
    getWallpaperLinks().slice(0, 18).forEach((link) => {
      const anchor = document.createElement("a");
      anchor.className = "wallpaper-link-tile";
      anchor.href = link.url || "#";
      anchor.textContent = link.label || "Link";

      if (/^https?:\/\//i.test(anchor.href) && !anchor.href.startsWith(location.origin)) {
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
      }

      grid.append(anchor);
    });
  }

  function renderWallpaperBackgrounds() {
    const options = document.getElementById("wallpaper-bg-options");
    if (!options) return;

    const backgrounds = getWallpaperBackgrounds();
    options.innerHTML = "";

    if (!backgrounds.length) {
      const empty = document.createElement("span");
      empty.className = "wallpaper-bg-empty";
      empty.textContent = t("wallpapers.empty");
      options.append(empty);
      return;
    }

    if (!state.selectedWallpaper || !backgrounds.some((item) => item.id === state.selectedWallpaper.id)) {
      state.selectedWallpaper = backgrounds[0];
    }

    backgrounds.forEach((wallpaper) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wallpaper-bg-option";
      button.dataset.wallpaperId = wallpaper.id;
      button.style.setProperty("--wallpaper-accent", wallpaper.accent || "#FFD900");
      button.innerHTML = `
        <span>${localized(wallpaper.title)}</span>
        <small>${wallpaper.status || "placeholder"}</small>
      `;
      button.addEventListener("click", () => selectWallpaper(wallpaper));
      options.append(button);
    });

    selectWallpaper(state.selectedWallpaper);
  }

  function renderWallpapers() {
    renderWallpaperLinks();
    renderWallpaperBackgrounds();
    setWallpaperPanel(state.wallpaperPanel);
  }

  function setupWallpaperInteractions() {
    const viewport = document.getElementById("wallpaper-viewport");
    const dock = document.getElementById("wallpaper-bg-dock");
    const handle = dock?.querySelector(".wallpaper-bg-handle");
    if (!viewport || viewport.dataset.wallpaperReady === "true") return;

    viewport.dataset.wallpaperReady = "true";

    document.querySelectorAll("[data-wallpaper-panel]").forEach((button) => {
      button.addEventListener("click", () => setWallpaperPanel(Number(button.dataset.wallpaperPanel)));
    });

    viewport.addEventListener(
      "wheel",
      (event) => {
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (Math.abs(delta) < 18) return;
        event.preventDefault();
        if (state.wallpaperWheelLocked) return;

        setWallpaperPanel(delta > 0 ? 1 : 0);
        state.wallpaperWheelLocked = true;
        window.setTimeout(() => {
          state.wallpaperWheelLocked = false;
        }, 640);
      },
      { passive: false }
    );

    let touchStartX = 0;
    let touchStartY = 0;
    viewport.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    });

    viewport.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
      setWallpaperPanel(dx < 0 ? 1 : 0);
    });

    if (dock && handle) {
      handle.addEventListener("click", () => {
        const isOpen = dock.classList.toggle("is-open");
        handle.setAttribute("aria-expanded", String(isOpen));
      });
    }
  }

  function renderMeta() {
    const lastModified = document.getElementById("last-modified");
    if (lastModified) {
      lastModified.textContent = new Intl.DateTimeFormat(state.lang, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(document.lastModified));
    }
  }

  function weatherLabel(code) {
    const labels = {
      en: { clear: "Clear", cloudy: "Cloudy", fog: "Fog", drizzle: "Drizzle", rain: "Rain", snow: "Snow", storm: "Storm" },
      "zh-TW": { clear: "晴朗", cloudy: "多雲", fog: "有霧", drizzle: "毛毛雨", rain: "降雨", snow: "降雪", storm: "雷雨" },
      "zh-CN": { clear: "晴朗", cloudy: "多云", fog: "有雾", drizzle: "毛毛雨", rain: "降雨", snow: "降雪", storm: "雷雨" }
    };
    const dictionary = labels[state.lang] || labels.en;

    if (code === 0) return dictionary.clear;
    if ([1, 2, 3].includes(code)) return dictionary.cloudy;
    if ([45, 48].includes(code)) return dictionary.fog;
    if ([51, 53, 55, 56, 57].includes(code)) return dictionary.drizzle;
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return dictionary.rain;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return dictionary.snow;
    if ([95, 96, 99].includes(code)) return dictionary.storm;
    return dictionary.cloudy;
  }

  function renderRuntimeStatus() {
    const placeValue = document.getElementById("place-value");
    const placeMeta = document.getElementById("place-meta");
    const weatherValue = document.getElementById("weather-value");
    const weatherMeta = document.getElementById("weather-meta");
    const pingValue = document.getElementById("ping-value");
    const pingMeta = document.getElementById("ping-meta");

    if (placeValue && placeMeta) {
      if (state.runtime.geo) {
        const { city, region, country_name: countryName, timezone } = state.runtime.geo;
        placeValue.textContent = [city, region || countryName].filter(Boolean).join(", ");
        placeMeta.textContent = interpolate(t("home.locationDetail"), { timezone: timezone || "--" });
      } else if (state.runtime.locationError) {
        placeValue.textContent = t("home.locationUnavailable");
        placeMeta.textContent = t("home.placeMeta");
      }
    }

    if (weatherValue && weatherMeta) {
      if (state.runtime.weather) {
        const { temperature, code, humidity, wind } = state.runtime.weather;
        weatherValue.textContent = `${Math.round(temperature)}°C / ${weatherLabel(code)}`;
        weatherMeta.textContent = interpolate(t("home.weatherDetail"), {
          humidity: humidity ?? "--",
          wind: Math.round(wind ?? 0)
        });
      } else if (state.runtime.weatherError) {
        weatherValue.textContent = t("home.weatherUnavailable");
        weatherMeta.textContent = t("home.weatherMeta");
      }
    }

    if (pingValue && pingMeta) {
      const provider = state.runtime.geo?.org || state.runtime.geo?.asn || t("home.ispUnknown");
      if (state.runtime.latency !== null) {
        pingValue.textContent = `${state.runtime.latency} ms`;
        pingMeta.textContent = interpolate(t("home.pingDetail"), { isp: provider });
      } else if (state.runtime.pingError) {
        pingValue.textContent = t("home.pingValue");
        pingMeta.textContent = interpolate(t("home.pingDetail"), { isp: provider });
      }
    }
  }

  async function fetchJson(url, timeout = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadRuntimeStatus() {
    const placeValue = document.getElementById("place-value");
    const weatherValue = document.getElementById("weather-value");
    if (!placeValue && !weatherValue) return;

    try {
      const geo = await fetchJson("https://ipapi.co/json/");
      if (!geo.latitude || !geo.longitude) throw new Error("Missing geolocation coordinates");
      state.runtime.geo = geo;
      renderRuntimeStatus();

      const params = new URLSearchParams({
        latitude: geo.latitude,
        longitude: geo.longitude,
        current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        timezone: "auto",
        forecast_days: "1"
      });
      const weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      state.runtime.weather = {
        temperature: weather.current?.temperature_2m,
        humidity: weather.current?.relative_humidity_2m,
        code: weather.current?.weather_code,
        wind: weather.current?.wind_speed_10m
      };
    } catch (error) {
      console.warn(error);
      if (!state.runtime.geo) state.runtime.locationError = true;
      state.runtime.weatherError = true;
    }

    renderRuntimeStatus();
  }

  async function measureLatency() {
    const pingValue = document.getElementById("ping-value");
    if (!pingValue) return;

    const samples = [];
    for (let index = 0; index < 3; index += 1) {
      try {
        const started = performance.now();
        const response = await fetch(`/robots.txt?ping=${Date.now()}-${index}`, {
          cache: "no-store",
          headers: { Accept: "text/plain" }
        });
        if (!response.ok) throw new Error(`Ping failed: ${response.status}`);
        await response.text();
        samples.push(performance.now() - started);
      } catch (error) {
        console.warn(error);
      }
    }

    if (samples.length) {
      state.runtime.latency = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
    } else {
      state.runtime.pingError = true;
    }

    renderRuntimeStatus();
  }

  function setupNavigationRail() {
    document.querySelectorAll("[data-nav-collapsible]").forEach((nav) => {
      let pointerInside = false;

      nav.addEventListener("pointerenter", () => {
        pointerInside = true;
      });

      nav.addEventListener("click", (event) => {
        const target = event.target;
        if (target.closest("a, button")) return;
        nav.classList.toggle("is-expanded");
      });

      nav.addEventListener("mouseleave", () => {
        pointerInside = false;
        nav.classList.remove("is-expanded");
        if (nav.contains(document.activeElement) && document.activeElement.matches("button")) {
          document.activeElement.blur();
        }
      });

      nav.addEventListener("focusout", () => {
        window.setTimeout(() => {
          if (!pointerInside && !nav.contains(document.activeElement)) {
            nav.classList.remove("is-expanded");
          }
        }, 0);
      });
    });
  }

  function render() {
    applyTranslations();
    renderProfile();
    renderProjects();
    renderShortcuts();
    renderTools();
    renderWallpapers();
    renderMeta();
    renderRuntimeStatus();
    updateClock();
  }

  async function init() {
    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", () => setLanguage(button.dataset.langButton));
    });
    document.querySelectorAll("[data-theme-button]").forEach((button) => {
      button.addEventListener("click", () => setThemeMode(button.dataset.themeButton));
    });
    setupNavigationRail();
    setupWallpaperInteractions();
    updateTheme();

    try {
      const loaded = await window.PortalData.load();
      state.data = { ...fallbackData, ...loaded };
    } catch (error) {
      console.warn(error);
    }

    document.documentElement.lang = state.lang;
    render();
    loadRuntimeStatus();
    measureLatency();
    setInterval(updateClock, 1000);
    setInterval(updateTheme, 60000);
  }

  init();
})();
