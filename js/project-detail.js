(function () {
  const fallback = {
    projects: []
  };

  const state = {
    data: fallback,
    lang: detectLanguage(),
    project: null
  };

  function detectLanguage() {
    const saved = localStorage.getItem("portal-lang");
    if (saved) return saved;
    const lang = navigator.language || "en";
    if (/^zh-(tw|hk|mo)$/i.test(lang)) return "zh-TW";
    if (/^zh/i.test(lang)) return "zh-CN";
    return "en";
  }

  function getProjectId() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  function localized(value) {
    if (!value || typeof value === "string") return value || "";
    return value[state.lang] || value.en || value["zh-TW"] || "";
  }

  function text(value) {
    return document.createTextNode(String(value ?? ""));
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value || "";
  }

  function isExternalHref(href) {
    return /^https?:\/\//i.test(href) && !href.startsWith(location.origin);
  }

  function isAllowedHref(href) {
    return /^(https?:\/\/|mailto:|\/|#)/i.test(String(href || ""));
  }

  function appendLink(target, link, className = "button ghost") {
    if (!link?.url || !isAllowedHref(link.url)) return;
    const anchor = document.createElement("a");
    anchor.className = className;
    anchor.href = link.url;
    anchor.textContent = link.label || link.type || "Open";
    if (isExternalHref(anchor.href)) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    }
    target.append(anchor);
  }

  function inlineMarkdown(textValue) {
    const fragment = document.createDocumentFragment();
    const pattern = /(!?)\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(textValue))) {
      if (match.index > lastIndex) {
        fragment.append(text(textValue.slice(lastIndex, match.index)));
      }

      if (match[1] === "!" && isAllowedHref(match[3])) {
        const image = document.createElement("img");
        image.src = match[3];
        image.alt = match[2];
        image.loading = "lazy";
        fragment.append(image);
      } else if (!match[1] && match[2] && isAllowedHref(match[3])) {
        const anchor = document.createElement("a");
        anchor.href = match[3];
        anchor.textContent = match[2];
        if (isExternalHref(anchor.href)) {
          anchor.target = "_blank";
          anchor.rel = "noreferrer";
        }
        fragment.append(anchor);
      } else if (match[4]) {
        const code = document.createElement("code");
        code.textContent = match[4];
        fragment.append(code);
      } else if (match[5]) {
        const strong = document.createElement("strong");
        strong.textContent = match[5];
        fragment.append(strong);
      } else {
        fragment.append(text(match[0]));
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < textValue.length) {
      fragment.append(text(textValue.slice(lastIndex)));
    }

    return fragment;
  }

  function renderMarkdown(markdown) {
    const root = document.createElement("div");
    root.className = "markdown-body";
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let paragraph = [];
    let list = null;
    let codeLines = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      const p = document.createElement("p");
      p.append(inlineMarkdown(paragraph.join(" ")));
      root.append(p);
      paragraph = [];
    }

    function flushList() {
      if (list) {
        root.append(list);
        list = null;
      }
    }

    function flushCode() {
      if (!codeLines) return;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.append(code);
      root.append(pre);
      codeLines = null;
    }

    lines.forEach((line) => {
      if (line.startsWith("```")) {
        if (codeLines) {
          flushCode();
        } else {
          flushParagraph();
          flushList();
          codeLines = [];
        }
        return;
      }

      if (codeLines) {
        codeLines.push(line);
        return;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length + 1;
        const node = document.createElement(`h${level}`);
        node.append(inlineMarkdown(heading[2]));
        root.append(node);
        return;
      }

      const quote = trimmed.match(/^>\s+(.+)$/);
      if (quote) {
        flushParagraph();
        flushList();
        const node = document.createElement("blockquote");
        node.append(inlineMarkdown(quote[1]));
        root.append(node);
        return;
      }

      const item = trimmed.match(/^[-*]\s+(.+)$/);
      if (item) {
        flushParagraph();
        list = list || document.createElement("ul");
        const li = document.createElement("li");
        li.append(inlineMarkdown(item[1]));
        list.append(li);
        return;
      }

      if (/^!\[[^\]]+\]\([^)]+\)$/.test(trimmed)) {
        flushParagraph();
        flushList();
        const figure = document.createElement("figure");
        figure.append(inlineMarkdown(trimmed));
        root.append(figure);
        return;
      }

      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    flushCode();

    if (!root.childElementCount) {
      const empty = document.createElement("p");
      empty.textContent = "No project article has been published yet.";
      root.append(empty);
    }

    return root;
  }

  function renderProject() {
    const project = state.project;
    if (!project) {
      setText("project-title", "Project not found");
      setText("project-description", "The requested project id is not registered in data/projects.json.");
      return;
    }

    setText("project-status", project.status || "project");
    setText("project-title", localized(project.title));
    setText("project-description", localized(project.description));

    const tags = document.getElementById("project-tags");
    if (tags) {
      tags.innerHTML = "";
      (project.tech_stack || []).forEach((tag) => {
        const item = document.createElement("span");
        item.textContent = tag;
        tags.append(item);
      });
    }

    const links = document.getElementById("project-links");
    if (links) {
      links.innerHTML = "";
      (project.links || []).forEach((link, index) => appendLink(links, link, index === 0 ? "button primary" : "button ghost"));
      if (!links.childElementCount) {
        const empty = document.createElement("p");
        empty.textContent = "No external links.";
        links.append(empty);
      }
    }

    const documents = document.getElementById("project-documents");
    if (documents) {
      documents.innerHTML = "";
      (project.documents || []).forEach((documentItem) => {
        appendLink(documents, {
          label: documentItem.label || documentItem.name || documentItem.fileName || "Open PDF",
          url: documentItem.public_url || documentItem.path
        });
      });
      if (!documents.childElementCount) {
        const empty = document.createElement("p");
        empty.textContent = "No project documents.";
        documents.append(empty);
      }
    }

    const content = document.getElementById("project-content");
    if (content) {
      content.innerHTML = "";
      content.append(renderMarkdown(localized(project.content)));
    }
  }

  async function init() {
    try {
      const loaded = await window.PortalData.load();
      state.data = { ...fallback, ...loaded };
    } catch (error) {
      console.warn(error);
    }

    state.lang = detectLanguage();
    state.project = (state.data.projects || []).find((project) => project.id === getProjectId());
    renderProject();

    document.querySelectorAll("[data-lang-button]").forEach((button) => {
      button.addEventListener("click", () => {
        window.setTimeout(() => {
          state.lang = detectLanguage();
          renderProject();
        }, 0);
      });
    });
  }

  init();
})();
