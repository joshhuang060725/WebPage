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
    projects: [
      {
        title: { en: "Personal Portal" },
        description: { en: "A public profile and UI/UX system experiment hosted as a static site." },
        status: "active",
        tech_stack: ["HTML", "CSS", "JavaScript"]
      }
    ],
    shortcuts: [
      {
        name: "GitHub",
        description: { en: "Public code profile and project repositories." },
        url: "https://github.com/joshhuang060725",
        category: "public"
      }
    ],
    tools: [
      {
        name: "Exchange",
        description: { en: "Currency terminal entry reserved for a later release." },
        status: "coming soon"
      }
    ],
    i18n: fallbackI18n
  };

  let state = {
    lang: detectLanguage(),
    data: fallbackData,
    runtime: {
      geo: null,
      weather: null,
      locationError: false,
      weatherError: false
    }
  };

  function detectLanguage() {
    const saved = localStorage.getItem("portal-lang");
    if (saved) return saved;

    const lang = navigator.language || "en";
    if (/^zh-(tw|hk|mo)$/i.test(lang)) return "zh-TW";
    if (/^zh/i.test(lang)) return "zh-CN";
    return "en";
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
      en: {
        clear: "Clear",
        cloudy: "Cloudy",
        fog: "Fog",
        drizzle: "Drizzle",
        rain: "Rain",
        snow: "Snow",
        storm: "Storm"
      },
      "zh-TW": {
        clear: "晴朗",
        cloudy: "多雲",
        fog: "有霧",
        drizzle: "毛毛雨",
        rain: "降雨",
        snow: "降雪",
        storm: "雷雨"
      },
      "zh-CN": {
        clear: "晴朗",
        cloudy: "多云",
        fog: "有雾",
        drizzle: "毛毛雨",
        rain: "降雨",
        snow: "降雪",
        storm: "雷雨"
      }
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
  }

  async function fetchJson(url, timeout = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
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

  function render() {
    applyTranslations();
    renderProfile();
    renderProjects();
    renderShortcuts();
    renderTools();
    renderMeta();
    renderRuntimeStatus();
    updateClock();
  }

  async function init() {
    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", () => setLanguage(button.dataset.langButton));
    });

    try {
      const loaded = await window.PortalData.load();
      state.data = { ...fallbackData, ...loaded };
    } catch (error) {
      console.warn(error);
    }

    document.documentElement.lang = state.lang;
    render();
    loadRuntimeStatus();
    setInterval(updateClock, 1000);
  }

  init();
})();
