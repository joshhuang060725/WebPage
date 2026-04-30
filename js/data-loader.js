(function () {
  const API_BASE = "";

  const endpoints = {
    profile: "/data/profile.json",
    projects: "/data/projects.json",
    shortcuts: "/data/shortcuts.json",
    tools: "/data/tools.json",
    wallpapers: "/data/wallpapers.json",
    files: "/data/files.json",
    formulas: "/data/formulas.json",
    i18n: "/data/i18n.json"
  };

  async function loadJson(path) {
    const response = await fetch(`${API_BASE}${path}`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }
    return response.json();
  }

  async function loadPortalData() {
    const entries = await Promise.allSettled(
      Object.entries(endpoints).map(async ([key, path]) => [key, await loadJson(path)])
    );

    return entries.reduce((data, result) => {
      if (result.status === "fulfilled") {
        const [key, value] = result.value;
        data[key] = value;
      }
      return data;
    }, {});
  }

  window.PortalData = {
    load: loadPortalData,
    apiBase: API_BASE
  };
})();
