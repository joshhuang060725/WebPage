(function () {
  "use strict";

  const DATA_URL = "/data/four-seasons-flowers.json";
  const STORAGE_KEY = "fourSeasonsFlowers:v1";
  const ACTION_LOCK_MS = 1350;
  const DEFAULT_PHOTO_NOTE = "今天也认真照顾了这朵花。";
  // Snapshot-only placement. Adjust these numbers to move the saved PNG composition.
  const SNAPSHOT_PLANT = {
    x: 220,
    y: 290,
    width: 640,
    height: 585
  };
  const SNAPSHOT_POT = {
    x: 310,
    y: 790,
    width: 460,
    height: 230
  };
  const VALID_VIEWS = ["loading", "pot", "flower", "garden"];
  const STAGE_LABELS = {
    seedling: "幼苗期 · Seedling",
    growing: "生长期 · Growing",
    bloom: "盛花期 · Blooming"
  };

  const app = document.querySelector("[data-app]");
  if (!app) return;

  const els = {
    loadingView: document.querySelector("[data-loading-view]"),
    potView: document.querySelector("[data-pot-view]"),
    flowerView: document.querySelector("[data-flower-view]"),
    gardenView: document.querySelector("[data-garden-view]"),
    potGrid: document.querySelector("[data-pot-grid]"),
    flowerGrid: document.querySelector("[data-flower-grid]"),
    nextFlower: document.querySelector("[data-next-flower]"),
    startGrowing: document.querySelector("[data-start-growing]"),
    backTools: document.querySelector("[data-back-tools]"),
    backPot: document.querySelector("[data-back-pot]"),
    openSettings: document.querySelector("[data-open-settings]"),
    settingsModal: document.querySelector("[data-settings-modal]"),
    closeSettings: document.querySelector("[data-close-settings]"),
    resetProgress: document.querySelector("[data-reset-progress]"),
    resetModal: document.querySelector("[data-reset-modal]"),
    cancelReset: document.querySelector("[data-cancel-reset]"),
    confirmReset: document.querySelector("[data-confirm-reset]"),
    settingsPot: document.querySelector("[data-settings-pot]"),
    settingsFlower: document.querySelector("[data-settings-flower]"),
    settingsLevel: document.querySelector("[data-settings-level]"),
    seasonLabel: document.querySelector("[data-season-label]"),
    flowerName: document.querySelector("[data-flower-name]"),
    flowerNameEn: document.querySelector("[data-flower-name-en]"),
    level: document.querySelector("[data-level]"),
    stageLabel: document.querySelector("[data-stage-label]"),
    progressValue: document.querySelector("[data-progress-value]"),
    progressTrack: document.querySelector("[data-progress-track]"),
    progressFill: document.querySelector("[data-progress-fill]"),
    plantStage: document.querySelector("[data-plant-stage]"),
    plantImage: document.querySelector("[data-plant-image]"),
    potImage: document.querySelector("[data-pot-image]"),
    wateringTool: document.querySelector("[data-watering-tool]"),
    nutrientTool: document.querySelector("[data-nutrient-tool]"),
    particleField: document.querySelector("[data-particle-field]"),
    growthFloat: document.querySelector("[data-growth-float]"),
    messageCard: document.querySelector("[data-message-card]"),
    messageTitle: document.querySelector("[data-message-title]"),
    messageCopy: document.querySelector("[data-message-copy]"),
    careCount: document.querySelector("[data-care-count]"),
    cycleCount: document.querySelector("[data-cycle-count]"),
    photoCount: document.querySelector("[data-photo-count]"),
    photoFlash: document.querySelector("[data-photo-flash]"),
    photoModal: document.querySelector("[data-photo-modal]"),
    closePhoto: document.querySelector("[data-close-photo]"),
    cancelPhoto: document.querySelector("[data-cancel-photo]"),
    savePhoto: document.querySelector("[data-save-photo]"),
    photoNote: document.querySelector("[data-photo-note]"),
    actionButtons: [...document.querySelectorAll("[data-action]")]
  };

  let data = null;
  let currentView = "loading";
  let actionLocked = false;
  let selectedPotId = null;
  let selectedFlowerId = null;
  let state = createDefaultState();

  function createDefaultState() {
    return {
      version: 1,
      potId: null,
      flowerId: null,
      growth: 0,
      level: 1,
      careCount: 0,
      cycleCount: 0,
      photoCount: 0,
      hasCompletedIntro: false
    };
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function loadSavedState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      if (!isObject(parsed) || parsed.version !== 1) return createDefaultState();

      const validPot = data.pots.some((pot) => pot.id === parsed.potId);
      const validFlower = data.flowers.some((flower) => flower.id === parsed.flowerId);
      if ((parsed.potId && !validPot) || (parsed.flowerId && !validFlower)) {
        return createDefaultState();
      }

      return {
        version: 1,
        potId: validPot ? parsed.potId : null,
        flowerId: validFlower ? parsed.flowerId : null,
        growth: clamp(parsed.growth, 0, 100),
        level: Math.max(1, Math.floor(Number(parsed.level) || 1)),
        careCount: Math.max(0, Math.floor(Number(parsed.careCount) || 0)),
        cycleCount: Math.max(0, Math.floor(Number(parsed.cycleCount) || 0)),
        photoCount: Math.max(0, Math.floor(Number(parsed.photoCount) || 0)),
        hasCompletedIntro: Boolean(parsed.hasCompletedIntro)
      };
    } catch (_error) {
      return createDefaultState();
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      updateMessage("进度暂时无法保存", "浏览器阻止了本地存储，但本次仍可继续体验。");
    }
  }

  function getPot(id = state.potId) {
    return data.pots.find((pot) => pot.id === id) || null;
  }

  function getFlower(id = state.flowerId) {
    return data.flowers.find((flower) => flower.id === id) || null;
  }

  function showView(name) {
    if (!VALID_VIEWS.includes(name)) return;
    currentView = name;
    app.dataset.view = name;
    els.loadingView.hidden = name !== "loading";
    els.potView.hidden = name !== "pot";
    els.flowerView.hidden = name !== "flower";
    els.gardenView.hidden = name !== "garden";
    const appBody = document.querySelector(".app-body");
    if (appBody) appBody.scrollTop = 0;
  }

  function renderChoices() {
    els.potGrid.innerHTML = "";
    data.pots.forEach((pot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-card";
      button.dataset.choicePot = pot.id;
      button.style.setProperty("--card-accent", pot.accent);
      button.innerHTML = `
        <span class="card-tag">${pot.tag}</span>
        <img src="${pot.asset}" alt="${pot.name}" />
        <strong>${pot.name}</strong>
        <small>${pot.nameEn}</small>
      `;
      button.addEventListener("click", () => selectPot(pot.id));
      els.potGrid.append(button);
    });

    els.flowerGrid.innerHTML = "";
    data.flowers.forEach((flower) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-card";
      button.dataset.choiceFlower = flower.id;
      button.style.setProperty("--card-accent", flower.theme.accent);
      button.innerHTML = `
        <span class="card-tag">${flower.seasonEn}</span>
        <img src="${flower.assets.bloom}" alt="${flower.name}" />
        <strong>${flower.name}</strong>
        <small>${flower.nameEn}</small>
      `;
      button.addEventListener("click", () => selectFlower(flower.id));
      els.flowerGrid.append(button);
    });

    syncChoiceSelection();
  }

  function selectPot(id) {
    selectedPotId = id;
    syncChoiceSelection();
  }

  function selectFlower(id) {
    selectedFlowerId = id;
    syncChoiceSelection();
  }

  function syncChoiceSelection() {
    document.querySelectorAll("[data-choice-pot]").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.choicePot === selectedPotId);
      card.setAttribute("aria-pressed", String(card.dataset.choicePot === selectedPotId));
    });
    document.querySelectorAll("[data-choice-flower]").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.choiceFlower === selectedFlowerId);
      card.setAttribute("aria-pressed", String(card.dataset.choiceFlower === selectedFlowerId));
    });
    els.nextFlower.disabled = !selectedPotId;
    els.startGrowing.disabled = !selectedFlowerId;
  }

  function getGrowthStage(growth) {
    if (growth >= data.growth.thresholds.growing) return "bloom";
    if (growth >= data.growth.thresholds.seedling) return "growing";
    return "seedling";
  }

  function renderGarden(options = {}) {
    const pot = getPot();
    const flower = getFlower();
    if (!pot || !flower) {
      showView("pot");
      return;
    }

    app.style.setProperty("--accent", flower.theme.accent);
    app.style.setProperty("--accent-soft", flower.theme.soft);
    app.style.setProperty("--leaf", flower.theme.leaf);

    const stage = getGrowthStage(state.growth);
    els.seasonLabel.textContent = `${flower.season} · ${flower.seasonEn}`;
    els.flowerName.textContent = flower.name;
    els.flowerNameEn.textContent = flower.nameEn;
    els.level.textContent = state.level;
    els.stageLabel.textContent = STAGE_LABELS[stage];
    els.progressValue.textContent = `${Math.round(state.growth)}%`;
    els.progressTrack.setAttribute("aria-valuenow", String(Math.round(state.growth)));
    els.progressFill.style.width = `${state.growth}%`;
    els.plantImage.src = flower.assets[stage];
    els.plantImage.alt = `${flower.name}${STAGE_LABELS[stage].split(" · ")[0]}`;
    els.potImage.src = pot.asset;
    els.potImage.alt = pot.name;
    els.careCount.textContent = state.careCount;
    els.cycleCount.textContent = state.cycleCount;
    els.photoCount.textContent = state.photoCount;

    if (options.animateGrowth) replayClass(els.plantStage, "is-growing", 760);
    if (options.celebrate) {
      replayClass(els.plantStage, "is-celebrating", 1500);
      createParticles(18, "celebrate");
    }
  }

  function updateMessage(title, copy) {
    els.messageTitle.textContent = title;
    els.messageCopy.textContent = copy;
    replayClass(els.messageCard, "is-updated", 500);
  }

  function replayClass(element, className, duration) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), duration);
  }

  function createParticles(count, type) {
    els.particleField.innerHTML = "";
    const colors = type === "water"
      ? ["#9fcfca", "#c8e4dd", "#ffffff"]
      : ["var(--accent)", "var(--accent-soft)", "#f0c873", "#ffffff", "var(--leaf)"];

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      particle.className = "particle";
      particle.style.setProperty("--x", `${28 + Math.random() * 44}%`);
      particle.style.setProperty("--y", `${36 + Math.random() * 22}px`);
      particle.style.setProperty("--size", `${4 + Math.random() * 8}px`);
      particle.style.setProperty("--color", colors[index % colors.length]);
      particle.style.setProperty("--drift", `${-55 + Math.random() * 110}px`);
      particle.style.setProperty("--duration", `${850 + Math.random() * 650}ms`);
      particle.style.setProperty("--delay", `${Math.random() * 320}ms`);
      els.particleField.append(particle);
    }

    window.setTimeout(() => {
      els.particleField.innerHTML = "";
    }, 2100);
  }

  function showGrowthFloat(amount, label) {
    els.growthFloat.textContent = label || `成长 +${amount}`;
    replayClass(els.growthFloat, "is-visible", 1250);
  }

  function randomMessage(type) {
    const messages = data.messages[type] || [];
    return messages[Math.floor(Math.random() * messages.length)] || "";
  }

  function lockActions() {
    actionLocked = true;
    els.actionButtons.forEach((button) => {
      button.disabled = true;
    });
    window.setTimeout(() => {
      actionLocked = false;
      els.actionButtons.forEach((button) => {
        button.disabled = false;
      });
    }, ACTION_LOCK_MS);
  }

  function applyGrowth(amount, type) {
    if (actionLocked) return;
    lockActions();

    const wasBloomed = state.growth >= 100;
    const previousStage = getGrowthStage(state.growth);
    let reachedBloom = false;
    let advancedLevel = false;

    state.careCount += 1;

    if (type === "water") {
      if (!wasBloomed) {
        state.growth = Math.min(100, state.growth + amount);
        reachedBloom = state.growth >= 100;
      }
    } else if (wasBloomed) {
      state.cycleCount += 1;
      state.level += 1;
      advancedLevel = true;
    } else {
      state.growth = Math.min(100, state.growth + amount);
      reachedBloom = state.growth >= 100;
    }

    saveState();
    renderGarden({
      animateGrowth: previousStage !== getGrowthStage(state.growth),
      celebrate: reachedBloom || advancedLevel
    });

    if (type === "water") {
      replayClass(els.plantStage, "is-watering", 1320);
      createParticles(9, "water");
      if (wasBloomed) {
        updateMessage("已经盛开", "花朵正保持在盛放状态，想进阶等级请使用施肥。");
      } else {
        updateMessage(reachedBloom ? "花朵盛开了！" : "浇水完成", reachedBloom ? getFlower().meaning : randomMessage("water"));
      }
    } else {
      replayClass(els.plantStage, "is-fertilizing", 1280);
      createParticles(reachedBloom || advancedLevel ? 18 : 10, reachedBloom || advancedLevel ? "celebrate" : "fertilize");
      if (advancedLevel) {
        updateMessage("花朵进阶成功", `等级提升到 Lv. ${state.level}，盛开状态已保留。`);
      } else {
        updateMessage(reachedBloom ? "花朵盛开了！" : "施肥完成", reachedBloom ? "继续照顾到 100% 后，就可以施肥进阶等级。" : randomMessage("fertilize"));
      }
    }

    if (advancedLevel) {
      showGrowthFloat(amount, `Lv. ${state.level}`);
    } else if (wasBloomed && type === "water") {
      showGrowthFloat(amount, "已盛开");
    } else {
      showGrowthFloat(amount, reachedBloom ? "盛开！Bloom" : `成长 +${amount}`);
    }
  }

  function openModal(element) {
    element.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal(element) {
    element.hidden = true;
    const allClosed = [els.photoModal, els.settingsModal, els.resetModal].every((modal) => modal.hidden);
    if (allClosed) document.body.style.overflow = "";
  }

  function openPhotoModal() {
    els.photoNote.value = "";
    openModal(els.photoModal);
    window.setTimeout(() => els.photoNote.focus(), 80);
  }

  function closePhotoModal() {
    closeModal(els.photoModal);
  }

  function takePhoto() {
    if (actionLocked) return;
    lockActions();
    state.photoCount += 1;
    saveState();
    renderGarden();
    replayClass(els.photoFlash, "is-active", 520);
    createParticles(8, "celebrate");
    updateMessage("照片已收藏", randomMessage("photo"));
    window.setTimeout(openPhotoModal, 360);
  }

  function loadImageForCanvas(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`无法加载图片：${src}`));
      image.src = src;
    });
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
    const characters = Array.from(text);
    const lines = [];
    let line = "";

    characters.forEach((character) => {
      const candidate = line + character;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);

    const visibleLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let last = visibleLines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      visibleLines[maxLines - 1] = `${last}…`;
    }
    visibleLines.forEach((content, index) => {
      ctx.fillText(content, x, y + index * lineHeight);
    });
  }

  function drawContainedImage(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(
      image,
      x + (width - drawWidth) / 2,
      y + height - drawHeight,
      drawWidth,
      drawHeight
    );
  }

  async function downloadGardenSnapshot(noteText) {
    const pot = getPot();
    const flower = getFlower();
    if (!pot || !flower) return;

    const stage = getGrowthStage(state.growth);
    const note = noteText.trim() || DEFAULT_PHOTO_NOTE;
    const [plantImage, potImage] = await Promise.all([
      loadImageForCanvas(flower.assets[stage]),
      loadImageForCanvas(pot.asset)
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#f7f3e7");
    gradient.addColorStop(0.58, flower.theme.soft);
    gradient.addColorStop(1, "#dce6d4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(180, 180, 210, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(920, 610, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#53614f";
    ctx.font = '700 34px "Microsoft YaHei", "Noto Sans SC", sans-serif';
    ctx.fillText("四季花卉", 80, 94);
    ctx.fillStyle = "#7b8576";
    ctx.font = '24px Georgia, serif';
    ctx.fillText("Four Seasons Flowers", 80, 132);

    ctx.fillStyle = flower.theme.accent;
    ctx.font = '700 24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${flower.season} · ${flower.seasonEn}`, 80, 224);
    ctx.fillStyle = "#394437";
    ctx.font = '700 70px "Microsoft YaHei", "Noto Serif SC", serif';
    ctx.fillText(flower.name, 80, 308);
    ctx.fillStyle = "#727d6f";
    ctx.font = '32px Georgia, serif';
    ctx.fillText(flower.nameEn, 82, 354);

    drawRoundedRect(ctx, 770, 230, 220, 88, 44);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fill();
    ctx.fillStyle = "#4c5949";
    ctx.font = '700 34px Georgia, serif';
    ctx.textAlign = "center";
    ctx.fillText(`Lv. ${state.level}`, 880, 286);
    ctx.textAlign = "left";

    ctx.save();
    ctx.shadowColor = "rgba(62, 78, 57, 0.16)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 18;
    drawContainedImage(ctx, potImage, SNAPSHOT_POT.x, SNAPSHOT_POT.y, SNAPSHOT_POT.width, SNAPSHOT_POT.height);
    ctx.restore();
    drawContainedImage(ctx, plantImage, SNAPSHOT_PLANT.x, SNAPSHOT_PLANT.y, SNAPSHOT_PLANT.width, SNAPSHOT_PLANT.height);

    ctx.strokeStyle = "rgba(92, 116, 83, 0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(540, 1010, 330, 56, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawRoundedRect(ctx, 70, 1080, 940, 260, 42);
    ctx.fillStyle = "rgba(228, 229, 224, 0.92)";
    ctx.fill();
    ctx.fillStyle = "#4b5549";
    ctx.font = '36px "Microsoft YaHei", "Noto Sans SC", sans-serif';
    drawWrappedText(ctx, note, 120, 1152, 840, 54, 3);

    const date = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    ctx.fillStyle = "#7a8376";
    ctx.font = '24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${STAGE_LABELS[stage]}  ·  ${date}`, 120, 1300);

    const safeFlowerName = flower.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${safeFlowerName}-${stage}-${timestamp}.png`;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("无法生成照片文件");

    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function savePhoto() {
    if (els.savePhoto.disabled) return;
    els.savePhoto.disabled = true;
    els.savePhoto.textContent = "正在生成...";
    try {
      await downloadGardenSnapshot(els.photoNote.value);
      closePhotoModal();
      updateMessage("照片已保存", "成长纪念已经下载为 PNG 图片。");
    } catch (error) {
      updateMessage("照片保存失败", String(error.message || error));
    } finally {
      els.savePhoto.disabled = false;
      els.savePhoto.textContent = "保存照片";
    }
  }

  function handleAction(action) {
    if (action === "water") applyGrowth(Number(data.growth.water), "water");
    if (action === "fertilize") applyGrowth(Number(data.growth.fertilize), "fertilize");
    if (action === "photo") takePhoto();
  }

  function startGrowing() {
    if (!selectedPotId || !selectedFlowerId) return;
    const changedPlant = state.potId !== selectedPotId || state.flowerId !== selectedFlowerId;
    state.potId = selectedPotId;
    state.flowerId = selectedFlowerId;
    state.hasCompletedIntro = true;
    if (changedPlant) {
      state.growth = 0;
      state.level = 1;
      state.careCount = 0;
      state.cycleCount = 0;
      state.photoCount = 0;
    }
    saveState();
    renderGarden();
    updateMessage("欢迎来到你的小温室", `${getFlower().meaning} 现在，从第一次浇水开始吧。`);
    showView("garden");
  }

  function updateSettings() {
    const pot = getPot();
    const flower = getFlower();
    els.settingsPot.textContent = pot ? pot.name : "尚未选择";
    els.settingsFlower.textContent = flower ? flower.name : "尚未选择";
    els.settingsLevel.textContent = flower ? `Lv. ${state.level}` : "--";
  }

  function resetAllProgress() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // The in-memory reset still works when storage is unavailable.
    }
    state = createDefaultState();
    selectedPotId = null;
    selectedFlowerId = null;
    syncChoiceSelection();
    closeModal(els.resetModal);
    closeModal(els.settingsModal);
    showView("pot");
  }

  function preloadAssets() {
    const sources = [
      ...data.pots.map((pot) => pot.asset),
      ...data.flowers.flatMap((flower) => Object.values(flower.assets)),
      data.tools.wateringCan,
      data.tools.nutrientBottle
    ];
    sources.forEach((source) => {
      const image = new Image();
      image.src = source;
    });
  }

  function bindEvents() {
    els.nextFlower.addEventListener("click", () => showView("flower"));
    els.startGrowing.addEventListener("click", startGrowing);
    els.backTools.addEventListener("click", () => {
      window.location.href = "/tools.html";
    });
    els.backPot.addEventListener("click", () => showView("pot"));

    els.actionButtons.forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.action));
    });

    els.closePhoto.addEventListener("click", closePhotoModal);
    els.cancelPhoto.addEventListener("click", closePhotoModal);
    els.savePhoto.addEventListener("click", savePhoto);
    els.openSettings.addEventListener("click", () => {
      updateSettings();
      openModal(els.settingsModal);
    });
    els.closeSettings.addEventListener("click", () => closeModal(els.settingsModal));
    els.resetProgress.addEventListener("click", () => openModal(els.resetModal));
    els.cancelReset.addEventListener("click", () => closeModal(els.resetModal));
    els.confirmReset.addEventListener("click", resetAllProgress);

    [els.photoModal, els.settingsModal, els.resetModal].forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!els.photoModal.hidden) closePhotoModal();
      else if (!els.resetModal.hidden) closeModal(els.resetModal);
      else if (!els.settingsModal.hidden) closeModal(els.settingsModal);
    });
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Unable to load data (${response.status})`);
      data = await response.json();
      if (!Array.isArray(data.pots) || !Array.isArray(data.flowers) || !isObject(data.growth)) {
        throw new Error("Invalid flower data");
      }

      state = loadSavedState();
      selectedPotId = state.potId;
      selectedFlowerId = state.flowerId;
      renderChoices();
      preloadAssets();
      els.wateringTool.src = data.tools.wateringCan;
      els.nutrientTool.src = data.tools.nutrientBottle;
      bindEvents();

      if (state.hasCompletedIntro && state.potId && state.flowerId) {
        renderGarden();
        showView("garden");
      } else {
        showView("pot");
      }
    } catch (error) {
      els.loadingView.innerHTML = `
        <div class="loading-mark" aria-hidden="true">!</div>
        <p class="eyebrow">Greenhouse unavailable</p>
        <h1>温室暂时无法打开</h1>
        <p>${String(error.message || error)}</p>
        <a class="primary-button" href="/tools.html">返回工具列表</a>
      `;
    }
  }

  init();
})();
