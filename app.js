/* JUMC Osteology & Pins Masterclass — Standalone Adaptive Engine */
(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const STORAGE_KEY = "jumc_osteology_masterclass_v1";

  const ANTONYM_PAIRS = [
    ["superior", "inferior"],
    ["anterior", "posterior"],
    ["medial", "lateral"],
    ["intermediate", "lateral"],
    ["intermediate", "median"],
    ["median", "lateral"],
    ["greater", "lesser"],
    ["internal", "external"],
    ["artery", "vein"],
    ["supraspinatus", "infraspinatus"],
    ["supraspinous", "infraspinous"],
    ["supraglenoid", "infraglenoid"],
    ["coronoid", "coracoid"],
    ["anatomical", "surgical"],
    ["proximal", "distal"],
    ["submandibular", "sublingual"],
    ["rotundum", "ovale"],
    ["round", "oval"],
    ["ovale", "spinosum"],
    ["oval", "spinous"],
    ["condyle", "epicondyle"],
    ["right", "left"],
  ];

  const QUALIFIER_WORDS = new Set([
    "superior", "inferior", "anterior", "posterior", "medial", "lateral",
    "middle", "intermediate", "median", "greater", "lesser", "internal",
    "external", "proximal", "distal", "anatomical", "surgical", "superficial",
    "deep", "transverse", "dorsal", "pelvic", "palmar", "plantar",
    "artery", "vein", "coronoid", "olecranon", "radial", "ulnar",
    "supraspinatus", "supraspinous", "infraspinatus", "infraspinous",
    "subscapular", "supraglenoid", "infraglenoid", "gluteal", "pectineal",
    "mylohyoid", "masseter", "pterygoid", "digastric", "mental", "mandibular",
    "frontal", "temporal", "zygomatic", "palatine", "alveolar", "sphenoidal",
    "occipital", "carotid", "jugular", "stylomastoid", "petrotympanic",
  ]);

  const CATEGORY_LABELS = {
    bone: "Osteology Landmark",
    tendon_muscle: "Tendon / Muscle Landmark",
    neurovascular: "Foramen / Neurovascular",
    ligament: "Ligament Attachment",
  };

  // App State
  let dataset = null;
  let slideMap = new Map();
  let pinMap = new Map();
  let progress = null;

  let currentMode = "grind"; // grind | reverse | blitz | exam | gaps | atlas
  let deckFilter = "ALL";    // ALL | BONES | SKULL
  let queueFilter = "adaptive";
  let boneFilter = "ALL";
  let customPinPoolIds = null; // when drilling a specific missed set or slide

  // Active card state
  let currentPin = null;
  let cardRevealed = false;
  let cardNudged = false;
  let hintLevel = 0;
  let cardStartTime = 0;
  let timerDurationMs = 30000;
  let pausedRemainingMs = null;
  let timerInterval = null;
  let recentPinIds = [];
  let boostedSiblingIds = new Set();
  let lastEvaluation = null;
  let reverseClickPt = null;

  // Session counters
  let sessionAttempts = 0;
  let sessionCorrect = 0;
  let sessionStreak = 0;
  let sessionTotalMs = 0;

  // Mock Exam state
  let examActive = false;
  let examQueue = [];
  let examIndex = 0;
  let examResults = [];

  // Gaps & Visuals tab state
  let gapsSubtab = "drills"; // drills | attachment_auto | occlusion
  let occGroupFilter = "Carpals & Hand";
  let currentGapItem = null;
  let gapRevealed = false;
  let currentOccCard = null;
  let occRevealed = false;

  // Atlas tab state
  let atlasSearch = "";
  let atlasDeckFilter = "ALL";
  let modalSlideId = null;
  let modalShowLabels = false;
  let modalHighlightPinId = null;

  // Mode 7: Bone & Side ID state
  let currentBoneIdCategory = "ALL";
  let boneIdFormat = "choice"; // "choice" | "typein"
  let boneIdRedOnly = false;
  let currentBoneIdItem = null;
  let boneIdRevealed = false;
  let boneIdStartTime = 0;
  let boneIdRemainingMs = 20000;
  let boneIdTimerInterval = null;
  let boneIdLastEvaluation = null;
  let boneIdSessionStreak = 0;
  let boneIdSessionAttempts = 0;
  let boneIdSessionCorrects = 0;
  let boneIdSessionTotalTime = 0;
  let recentBoneIdItemIds = [];

  // DOM helpers
  const $ = (id) => document.getElementById(id);

  // ---------------- INITIALIZATION ----------------
  async function init() {
    const [dsRes, progRes] = await Promise.all([
      fetch("data/dataset.json?v=3", { cache: "no-store" }),
      fetch("/api/progress", { cache: "no-store" }).catch(() => null),
    ]);
    dataset = await dsRes.json();
    for (const s of dataset.slides) slideMap.set(s.id, s);
    for (const p of dataset.pins) pinMap.set(p.id, p);

    let localBackup = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localBackup = JSON.parse(raw);
    } catch (_) {}

    if (progRes && progRes.ok) {
      const diskProg = await progRes.json();
      if (localBackup && (localBackup.updatedAt || 0) > (diskProg.updatedAt || 0)) {
        progress = localBackup;
        persistProgress();
      } else {
        progress = diskProg;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch (_) {}
      }
    } else {
      progress = localBackup || createDefaultProgress();
    }
    ensureProgressShape();

    populateBoneDropdown();
    bindEvents();
    syncToggleButtons();
    updateCountdown();
    setInterval(updateCountdown, 30000);
    updateGlobalReadinessUI();
    renderRedZoneMiniList();
    preloadImages();

    switchMode("grind");
  }

  function preloadImages() {
    if (!dataset || !dataset.slides) return;
    // Pre-warm the browser image decode cache for all slide photos
    // Guarantees immediate zero-latency painting and eliminates Safari SVG blank render quirks
    setTimeout(() => {
      const urls = new Set();
      for (const s of dataset.slides) {
        for (const p of (s.photos || [])) {
          if (p.src) urls.add(p.src);
        }
      }
      for (const url of urls) {
        const img = new Image();
        img.src = url;
      }
    }, 100);
  }

  function createDefaultProgress() {
    return {
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pins: {},
      reversePins: {},
      gapDrills: {},
      occlusion: {},
      boneId: {},
      examHistory: [],
      dailyStats: {},
      bookmarks: [],
      settings: {
        spotlight: true,
        autoZoom: false,
        blindBone: true,
        timerSeconds: 30,
      },
    };
  }

  function ensureProgressShape() {
    const def = createDefaultProgress();
    for (const k of Object.keys(def)) {
      if (progress[k] === undefined) progress[k] = def[k];
    }
    progress.settings = { ...def.settings, ...(progress.settings || {}) };
    if (!progress.boneId) progress.boneId = {};
  }

  let saveTimeout = null;
  function persistProgress() {
    progress.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (_) {}
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progress),
      }).catch(() => {});
    }, 250);
  }

  // ---------------- COUNTDOWN & READINESS ----------------
  function updateCountdown() {
    if (!dataset) return;
    const now = Date.now();
    const rev = new Date(dataset.meta.reviewLabDate).getTime();
    const prac = new Date(dataset.meta.practicalExamDate).getTime();

    const fmtDiff = (ms) => {
      if (ms <= 0) return "NOW";
      const hrs = Math.floor(ms / 3600000);
      const days = Math.floor(hrs / 24);
      const remH = hrs % 24;
      return days > 0 ? `${days}d ${remH}h` : `${hrs}h`;
    };

    $("countdownBar").innerHTML =
      `Review Lab: <strong>${fmtDiff(rev - now)}</strong> · ` +
      `Practical (20 pins × 30s): <strong>${fmtDiff(prac - now)}</strong> · ` +
      `Exemption Target: <strong>18+/20 (90%)</strong>`;
  }

  function getPinState(pinId) {
    return progress.pins[pinId] || null;
  }

  function classifyPinStatus(pinId) {
    const st = getPinState(pinId);
    if (!st || !st.attempts) return "unseen";
    if (st.mastery >= 0.78 && (st.lastMs || 15000) <= 15000 && st.streak >= 1) return "mastered";
    if (st.mastery < 0.48 || st.streak === 0) return "red";
    return "learning";
  }

  function updateGlobalReadinessUI() {
    let mastered = 0, learning = 0, red = 0, unseen = 0;
    let weightedSum = 0, totalWeight = 0;

    for (const p of dataset.pins) {
      const status = classifyPinStatus(p.id);
      const st = getPinState(p.id);
      const m = st ? st.mastery : 0;
      weightedSum += m * p.weight;
      totalWeight += p.weight;
      if (status === "mastered") mastered++;
      else if (status === "learning") learning++;
      else if (status === "red") red++;
      else unseen++;
    }

    const total = dataset.pins.length;
    const pct = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
    $("readinessPct").textContent = `${pct}%`;
    $("barMastered").style.width = `${(mastered / total) * 100}%`;
    $("barLearning").style.width = `${(learning / total) * 100}%`;
    $("barRed").style.width = `${(red / total) * 100}%`;
    $("readinessCounts").textContent = `${mastered} mastered · ${learning} learning · ${red} red · ${unseen} unseen`;
  }

  function populateBoneDropdown() {
    const sel = $("boneFilterSelect");
    const labs = new Map();
    const bones = new Map();
    for (const p of dataset.pins) {
      labs.set(p.lab, (labs.get(p.lab) || 0) + 1);
      bones.set(p.bone, (bones.get(p.bone) || 0) + 1);
    }

    let html = `<option value="ALL">All Bones &amp; Labs (Mixed Orientation)</option>`;
    html += `<optgroup label="By Lab (Labs 1–9)">`;
    for (const labNum of [...labs.keys()].sort((a, b) => a - b)) {
      html += `<option value="LAB:${labNum}">Lab ${labNum} (${labs.get(labNum)} pins)</option>`;
    }
    html += `</optgroup><optgroup label="By Specific Specimen / Bone">`;
    for (const [bname, cnt] of [...bones.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      html += `<option value="BONE:${bname}">${bname} (${cnt} pins)</option>`;
    }
    html += `</optgroup>`;
    sel.innerHTML = html;
  }

  // ---------------- FILTER POOL & ADAPTIVE SCHEDULER ----------------
  function getFilteredPool() {
    if (customPinPoolIds && customPinPoolIds.length > 0) {
      return customPinPoolIds.map((id) => pinMap.get(id)).filter(Boolean);
    }

    let pool = dataset.pins.filter((p) => {
      if (deckFilter !== "ALL" && p.deck !== deckFilter) return false;
      if (boneFilter.startsWith("LAB:")) {
        if (p.lab !== Number(boneFilter.slice(4))) return false;
      } else if (boneFilter.startsWith("BONE:")) {
        if (p.bone !== boneFilter.slice(5)) return false;
      }

      if (queueFilter === "red") return classifyPinStatus(p.id) === "red";
      if (queueFilter === "unseen") return classifyPinStatus(p.id) === "unseen";
      if (queueFilter === "highyield") return p.weight >= 1.7;
      if (queueFilter === "tendon_muscle") return p.category === "tendon_muscle";
      if (queueFilter === "neurovascular") return p.category === "neurovascular";
      if (queueFilter === "ligament") return p.category === "ligament";
      if (queueFilter === "bookmarked") return progress.bookmarks.includes(p.id);
      return true;
    });

    $("poolCounter").textContent = `${pool.length} pin${pool.length === 1 ? "" : "s"} in pool`;
    return pool;
  }

  function pickNextPin() {
    const pool = getFilteredPool();
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const now = Date.now();
    const recentSet = new Set(recentPinIds.slice(-Math.min(4, pool.length - 1)));

    let bestPin = null;
    let bestScore = -1e9;

    for (const p of pool) {
      if (recentSet.has(p.id)) continue;

      const st = getPinState(p.id);
      let urgency = 0;

      if (boostedSiblingIds.has(p.id)) {
        urgency += 95;
      }

      if (!st || !st.attempts) {
        // Unseen: prioritize by JUMC exam weight + slight jitter for bone variety
        urgency += 45 + p.weight * 14 + Math.random() * 10;
      } else {
        const ageSec = Math.max(1, (now - (st.lastSeen || 0)) / 1000);
        const status = classifyPinStatus(p.id);
        if (status === "red") {
          // Optimal short-term re-drill spacing: rises sharply after 45 seconds
          const spacingBoost = Math.min(40, ageSec / 2.5);
          urgency += 70 + (1 - st.mastery) * 35 + spacingBoost + p.weight * 8;
        } else if (status === "learning") {
          const slowPenalty = st.lastMs > 16000 ? 18 : 0;
          urgency += 28 + (1 - st.mastery) * 25 + slowPenalty + Math.min(25, ageSec / 12) + p.weight * 6;
        } else {
          // Mastered: low urgency unless long time elapsed
          urgency += Math.min(22, ageSec / 120) + Math.random() * 4;
        }
      }

      // Slight variety bonus to switch slides like the real practical exam
      if (currentPin && p.slideId !== currentPin.slideId && pool.length > 8) {
        urgency += 4;
      }

      if (urgency > bestScore) {
        bestScore = urgency;
        bestPin = p;
      }
    }

    return bestPin || pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------------- EXACT OPENXML -> SVG RENDERER ----------------
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "href" || k === "xlink:href") {
        const valStr = String(v);
        el.setAttribute("href", valStr);
        try {
          el.setAttributeNS(XLINK_NS, "href", valStr);
          el.setAttributeNS(XLINK_NS, "xlink:href", valStr);
        } catch (_) {}
      } else {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  function buildTransform(g) {
    const cx = g.x + g.w * 0.5;
    const cy = g.y + g.h * 0.5;
    const sx = g.flipH ? -1 : 1;
    const sy = g.flipV ? -1 : 1;
    if (!g.rot && sx === 1 && sy === 1) return null;
    return `translate(${cx},${cy}) rotate(${g.rot || 0}) scale(${sx},${sy}) translate(${-cx},${-cy})`;
  }

  function renderArrowShape(ar, strokeColor = "#ef4444", fillColor = "#facc15") {
    const grp = svgEl("g");
    const tf = buildTransform(ar);
    if (tf) grp.setAttribute("transform", tf);

    if (ar.kind === "pngArrow") {
      grp.appendChild(svgEl("image", {
        href: ar.src,
        x: ar.x,
        y: ar.y,
        width: ar.w,
        height: ar.h,
        preserveAspectRatio: "none",
      }));
    } else if (ar.kind === "downArrow") {
      const { x, y, w, h } = ar;
      const headY = y + h * 0.58;
      const sx1 = x + w * 0.27;
      const sx2 = x + w * 0.73;
      const pts = [
        `${sx1},${y}`,
        `${sx2},${y}`,
        `${sx2},${headY}`,
        `${x + w},${headY}`,
        `${x + w * 0.5},${y + h}`,
        `${x},${headY}`,
        `${sx1},${headY}`,
      ].join(" ");
      grp.appendChild(svgEl("polygon", {
        points: pts,
        fill: fillColor,
        stroke: "#111827",
        "stroke-width": 2.2,
        "stroke-linejoin": "round",
      }));
    } else if (ar.kind === "rightArrow") {
      const { x, y, w, h } = ar;
      const headX = x + w * 0.58;
      const sy1 = y + h * 0.27;
      const sy2 = y + h * 0.73;
      const pts = [
        `${x},${sy1}`,
        `${headX},${sy1}`,
        `${headX},${y}`,
        `${x + w},${y + h * 0.5}`,
        `${headX},${y + h}`,
        `${headX},${sy2}`,
        `${x},${sy2}`,
      ].join(" ");
      grp.appendChild(svgEl("polygon", {
        points: pts,
        fill: fillColor,
        stroke: "#111827",
        "stroke-width": 2.2,
        "stroke-linejoin": "round",
      }));
    } else if (ar.kind === "line") {
      grp.appendChild(svgEl("line", {
        x1: ar.tailX,
        y1: ar.tailY,
        x2: ar.tipX,
        y2: ar.tipY,
        stroke: strokeColor,
        "stroke-width": 4,
        "stroke-linecap": "round",
      }));
    }
    return grp;
  }

  function renderAuxShape(aux) {
    if (aux.kind === "pngBrace") {
      const img = svgEl("image", {
        href: aux.src,
        x: aux.x,
        y: aux.y,
        width: aux.w,
        height: aux.h,
        preserveAspectRatio: "none",
      });
      const tf = buildTransform(aux);
      if (tf) img.setAttribute("transform", tf);
      return img;
    }
    if (aux.kind === "guideLine") {
      return svgEl("line", {
        x1: aux.x1,
        y1: aux.y1,
        x2: aux.x2,
        y2: aux.y2,
        stroke: "#38bdf8",
        "stroke-width": 3.5,
        "stroke-dasharray": "9 6",
      });
    }
    if (aux.kind === "rightBrace") {
      const { x, y, w, h } = aux;
      const mx = x + w * 0.5;
      const my = y + h * 0.5;
      const d = `M ${x} ${y} Q ${mx} ${y} ${mx} ${y + h * 0.25} L ${mx} ${my - 6} Q ${mx} ${my} ${x + w} ${my} Q ${mx} ${my} ${mx} ${my + 6} L ${mx} ${y + h * 0.75} Q ${mx} ${y + h} ${x} ${y + h}`;
      const p = svgEl("path", {
        d,
        fill: "none",
        stroke: "#facc15",
        "stroke-width": 3.2,
      });
      const tf = buildTransform(aux);
      if (tf) p.setAttribute("transform", tf);
      return p;
    }
    return svgEl("g");
  }

  function renderSlideSvg(targetSvg, slide, options = {}) {
    const {
      activePinId = null,
      spotlight = true,
      autoZoom = false,
      blindBone = true,
      revealed = false,
      hideAllPins = false,
      userClick = null,
      showInlineNames = false,
      onPinClick = null,
      onPinHover = null,
    } = options;

    targetSvg.innerHTML = "";
    const defs = svgEl("defs");
    targetSvg.appendChild(defs);

    // 1. Background clean specimen photos
    slide.photos.forEach((ph, idx) => {
      const g = svgEl("g");
      const tf = buildTransform(ph);
      if (tf) g.setAttribute("transform", tf);

      const crop = ph.crop || {};
      const hasCrop = (crop.l || crop.t || crop.r || crop.b);
      if (hasCrop) {
        const clipId = `clip_${slide.id}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
        const cp = svgEl("clipPath", { id: clipId });
        cp.appendChild(svgEl("rect", { x: ph.x, y: ph.y, width: ph.w, height: ph.h }));
        defs.appendChild(cp);
        g.setAttribute("clip-path", `url(#${clipId})`);

        const l = crop.l || 0, t = crop.t || 0, r = crop.r || 0, b = crop.b || 0;
        const fullW = ph.w / Math.max(0.05, 1 - l - r);
        const fullH = ph.h / Math.max(0.05, 1 - t - b);
        const img = svgEl("image", {
          href: ph.src,
          x: ph.x - l * fullW,
          y: ph.y - t * fullH,
          width: fullW,
          height: fullH,
          preserveAspectRatio: "none",
        });
        img.onerror = () => {
          const raw = ph.src.split("?")[0];
          img.setAttribute("href", raw);
          try { img.setAttributeNS(XLINK_NS, "xlink:href", raw); } catch (_) {}
        };
        g.appendChild(img);
      } else {
        const img = svgEl("image", {
          href: ph.src,
          x: ph.x,
          y: ph.y,
          width: ph.w,
          height: ph.h,
          preserveAspectRatio: "none",
        });
        img.onerror = () => {
          const raw = ph.src.split("?")[0];
          img.setAttribute("href", raw);
          try { img.setAttributeNS(XLINK_NS, "xlink:href", raw); } catch (_) {}
        };
        g.appendChild(img);
      }
      targetSvg.appendChild(g);
    });

    // 2. Slide Titles: always show anatomical orientation compass labels (e.g. "ANTERIOR", "LATERAL" on bones_63),
    // while hiding bone-name spoilers (e.g. "1st RIB" on slides 3-5) in Blind Bone mode until revealed.
    const COMPASS_LABELS = new Set(["ANTERIOR", "POSTERIOR", "MEDIAL", "LATERAL", "SUPERIOR", "INFERIOR", "LEFT", "RIGHT"]);
    for (const st of slide.slideTitles) {
      const isCompass = COMPASS_LABELS.has(String(st.text || "").trim().toUpperCase());
      if (isCompass || !blindBone || revealed) {
        const txt = svgEl("text", {
          x: st.x + 8,
          y: st.y + st.h * 0.72,
          fill: isCompass ? "#38bdf8" : "#94a3b8",
          "font-size": 28,
          "font-weight": "800",
          "font-family": "-apple-system, sans-serif",
        });
        txt.textContent = st.text;
        targetSvg.appendChild(txt);
      }
    }

    // 3. Pins (Arrows + Aux Braces + Number Badges)
    const slidePins = slide.pinIds.map((pid) => pinMap.get(pid)).filter(Boolean);
    let activePinObj = null;

    if (!hideAllPins) {
      for (const pin of slidePins) {
        const isActive = pin.id === activePinId;
        if (isActive) activePinObj = pin;

        const pGrp = svgEl("g", { class: "pin-group", "data-pin-id": pin.id });
        if (activePinId && spotlight && !isActive) {
          pGrp.classList.add("dimmed");
          if (revealed) pGrp.classList.add("post-reveal");
        } else if (isActive) {
          pGrp.classList.add("active-pin");
        }

        for (const aux of pin.auxShapes) {
          pGrp.appendChild(renderAuxShape(aux));
        }

        if (pin.arrow) {
          const fillCol = isActive ? "#38bdf8" : "#facc15";
          pGrp.appendChild(renderArrowShape(pin.arrow, fillCol, fillCol));
        }

        // Number badge
        const lb = pin.labelBox;
        const bw = Math.max(36, lb.w + 6);
        const bh = Math.max(36, lb.h);
        const bx = pin.labelX - bw * 0.5;
        const by = pin.labelY - bh * 0.5;

        pGrp.appendChild(svgEl("rect", {
          x: bx,
          y: by,
          width: bw,
          height: bh,
          rx: 8,
          fill: isActive ? "#0284c7" : "rgba(15, 23, 42, 0.88)",
          stroke: isActive ? "#7dd3fc" : "#facc15",
          "stroke-width": isActive ? 2.8 : 1.8,
        }));

        const numTxt = svgEl("text", {
          x: pin.labelX,
          y: pin.labelY + 8,
          "text-anchor": "middle",
          fill: "#ffffff",
          "font-size": 23,
          "font-weight": "800",
          "font-family": "-apple-system, sans-serif",
        });
        numTxt.textContent = String(pin.pinNum);
        pGrp.appendChild(numTxt);

        // Optional inline label tag in Atlas Inspector
        if (showInlineNames) {
          const tagText = `${pin.pinNum}. ${pin.answer}`;
          const approxW = Math.min(360, tagText.length * 8.2 + 18);
          const tx = Math.min(1590 - approxW, Math.max(10, pin.labelX + bw * 0.5 + 6));
          const ty = pin.labelY - 14;
          pGrp.appendChild(svgEl("rect", {
            x: tx,
            y: ty,
            width: approxW,
            height: 28,
            rx: 6,
            fill: "rgba(7, 11, 18, 0.9)",
            stroke: isActive ? "#38bdf8" : "rgba(148,163,184,0.4)",
            "stroke-width": 1.2,
          }));
          const lbl = svgEl("text", {
            x: tx + 8,
            y: ty + 19,
            fill: "#f8fafc",
            "font-size": 14.5,
            "font-weight": "700",
            "font-family": "-apple-system, sans-serif",
          });
          lbl.textContent = tagText.length > 42 ? tagText.slice(0, 40) + "…" : tagText;
          pGrp.appendChild(lbl);
        }

        if (onPinClick) {
          pGrp.style.cursor = "pointer";
          pGrp.addEventListener("click", (e) => {
            e.stopPropagation();
            onPinClick(pin);
          });
        }
        if (onPinHover) {
          pGrp.addEventListener("mouseenter", () => onPinHover(pin));
          pGrp.addEventListener("mouseleave", () => onPinHover(null));
        }

        targetSvg.appendChild(pGrp);
      }
    }

    // 4. Hollow Target Beacon around active arrow tip (leaves bone structure 100% unobstructed!)
    if (!hideAllPins && activePinObj && spotlight && !activePinObj.wholeBone) {
      targetSvg.appendChild(svgEl("circle", {
        cx: activePinObj.tipX,
        cy: activePinObj.tipY,
        r: 26,
        class: "beacon-ring",
      }));
    }

    // 5. Reverse-Pin user click overlay
    if (userClick && activePinObj) {
      const dist = Math.hypot(userClick.x - activePinObj.tipX, userClick.y - activePinObj.tipY);
      const col = dist <= 68 ? "#10b981" : dist <= 135 ? "#f59e0b" : "#ef4444";

      targetSvg.appendChild(svgEl("line", {
        x1: userClick.x,
        y1: userClick.y,
        x2: activePinObj.tipX,
        y2: activePinObj.tipY,
        stroke: col,
        "stroke-width": 3,
        "stroke-dasharray": "7 5",
      }));
      targetSvg.appendChild(svgEl("circle", {
        cx: activePinObj.tipX,
        cy: activePinObj.tipY,
        r: 68,
        fill: "rgba(16, 185, 129, 0.12)",
        stroke: "#10b981",
        "stroke-width": 2,
      }));
      targetSvg.appendChild(svgEl("circle", {
        cx: userClick.x,
        cy: userClick.y,
        r: 10,
        fill: col,
        stroke: "#ffffff",
        "stroke-width": 2.5,
      }));
    }

    // 6. Auto-Zoom ViewBox handling
    if (autoZoom && activePinObj && !hideAllPins && !activePinObj.wholeBone) {
      const midX = (activePinObj.tipX * 0.65 + activePinObj.labelX * 0.35);
      const midY = (activePinObj.tipY * 0.65 + activePinObj.labelY * 0.35);
      const zw = 920;
      const zh = 517.5;
      const vx = Math.max(0, Math.min(1600 - zw, midX - zw * 0.5));
      const vy = Math.max(0, Math.min(900 - zh, midY - zh * 0.5));
      targetSvg.setAttribute("viewBox", `${vx.toFixed(1)} ${vy.toFixed(1)} ${zw} ${zh}`);
    } else {
      targetSvg.setAttribute("viewBox", "0 0 1600 900");
    }
  }

  // ---------------- SMART ANATOMICAL GRADER ----------------
  function normalizeTerm(str, boneName = "") {
    let s = (str || "")
      .toLowerCase()
      .replace(/['’`]/g, "")
      .replace(/[-_/.,;:()[\]]+/g, " ")
      .replace(/\b(the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (boneName) {
      const bClean = boneName.toLowerCase().replace(/\([^)]*\)/g, "").trim();
      for (const bPart of [bClean, bClean.replace(/\bbone\b/g, "").trim()]) {
        if (bPart && bPart.length >= 4 && s.endsWith(` of ${bPart}`)) {
          s = s.slice(0, -(` of ${bPart}`).length).trim();
        }
      }
    }

    s = s
      .replace(/\bof\b/g, " ")
      .replace(/\bfor\b/g, " ")
      .replace(/\bbone\b/g, " ")
      .replace(/\bmuscle\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return s;
  }

  function damerauLevenshtein(a, b) {
    const al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;
    const dp = Array.from({ length: al + 1 }, () => new Int32Array(bl + 1));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;

    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let val = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          val = Math.min(val, dp[i - 2][j - 2] + 1);
        }
        dp[i][j] = val;
      }
    }
    return dp[al][bl];
  }

  function detectAntonymConflict(userNorm, targetNorms) {
    const uWords = new Set(userNorm.split(" ").filter(Boolean));
    const tAllWords = new Set(targetNorms.join(" ").split(" ").filter(Boolean));

    for (const [w1, w2] of ANTONYM_PAIRS) {
      if (uWords.has(w1) && tAllWords.has(w2) && !tAllWords.has(w1)) {
        return { typed: w1, expected: w2 };
      }
      if (uWords.has(w2) && tAllWords.has(w1) && !tAllWords.has(w2)) {
        return { typed: w2, expected: w1 };
      }
    }
    return null;
  }

  function evaluateAnatomicalAnswer(rawInput, item, allowNudge = true) {
    const trimmed = (rawInput || "").trim();
    if (!trimmed) {
      return { verdict: "blank", ok: false, reason: "No answer entered." };
    }

    const boneCtx = item.bone || "";
    const uNorm = normalizeTerm(trimmed, boneCtx);
    const allTargets = [item.answer, ...(item.synonyms || [])];
    const tNorms = [...new Set(allTargets.map((t) => normalizeTerm(t, boneCtx)).filter(Boolean))];

    // 1. Exact normalized match
    if (tNorms.includes(uNorm)) {
      return { verdict: "exact", ok: true, reason: "Exact anatomical match!" };
    }

    // Also check token-set equality (handles harmless word-order inversions like "palatine greater foramen")
    const uToks = uNorm.split(" ").filter(Boolean);
    const uSetKey = [...uToks].sort().join(" ");
    for (const tn of tNorms) {
      const tToks = tn.split(" ").filter(Boolean);
      if (tToks.length >= 2 && [...tToks].sort().join(" ") === uSetKey) {
        return { verdict: "exact", ok: true, reason: "Correct (word order matched)." };
      }
    }

    // 2. Check Opposite-Orientation / Antonym Trap BEFORE fuzzy matching!
    if (item.answer && item.answer.toLowerCase() === "costal process" && uNorm.includes("transverse process")) {
      return {
        verdict: "confusion",
        ok: false,
        reason: 'High-Yield Exam Trap: Lumbar vertebrae have NO true transverse process! This lateral projection is an embryologically fused rib element (= COSTAL PROCESS). The true transverse process is the ACCESSORY PROCESS.',
      };
    }

    const conflict = detectAntonymConflict(uNorm, tNorms);
    if (conflict) {
      return {
        verdict: "confusion",
        ok: false,
        conflict,
        reason: `Orientation / sibling trap: you wrote "${conflict.typed}" instead of "${conflict.expected}"!`,
      };
    }

    // 3. Check Incomplete Qualifier (Second-chance Nudge!)
    if (allowNudge && uToks.length >= 1) {
      for (const tn of tNorms) {
        const tToks = tn.split(" ").filter(Boolean);
        if (tToks.length > uToks.length && uToks.every((w) => tToks.includes(w))) {
          const missing = tToks.filter((w) => !uToks.includes(w));
          if (missing.some((m) => QUALIFIER_WORDS.has(m))) {
            return {
              verdict: "nudge",
              ok: false,
              missingHint: "Be specific! Add the exact qualifier (e.g. superior/inferior, anterior/posterior, medial/lateral, artery/vein) and press Enter:",
            };
          }
        }
      }
    }

    // 4. Fuzzy Spelling Tolerance (Damerau-Levenshtein)
    let bestDist = 999;
    let bestLen = 0;
    for (const tn of tNorms) {
      const d = damerauLevenshtein(uNorm, tn);
      if (d < bestDist) {
        bestDist = d;
        bestLen = tn.length;
      }
    }
    const maxAllowed = bestLen >= 13 ? 2 : bestLen >= 5 ? 1 : 0;
    if (maxAllowed > 0 && bestDist <= maxAllowed) {
      return {
        verdict: "typo",
        ok: true,
        reason: `Correct — watch spelling (${bestDist} letter slip): "${item.answer}"`,
      };
    }

    return { verdict: "wrong", ok: false, reason: "Incorrect identification." };
  }

  // ---------------- RECORDING MASTERY & CONFUSION PAIRS ----------------
  function recordPinResult(pin, isOk, elapsedMs, evalType = "exact", conflict = null) {
    const prev = progress.pins[pin.id] || {
      attempts: 0,
      correct: 0,
      streak: 0,
      mastery: 0,
      avgMs: elapsedMs,
      lastMs: elapsedMs,
      lastSeen: 0,
      typos: 0,
      orientationTraps: 0,
    };

    prev.attempts += 1;
    prev.lastMs = elapsedMs;
    prev.avgMs = prev.attempts === 1 ? elapsedMs : Math.round(prev.avgMs * 0.65 + elapsedMs * 0.35);
    prev.lastSeen = Date.now();

    if (isOk) {
      prev.correct += 1;
      prev.streak += 1;
      if (evalType === "typo") prev.typos = (prev.typos || 0) + 1;

      // Speed-aware mastery gain: <10s cold recall reaches Exam-Ready fastest
      let gain = elapsedMs <= 10000 ? 0.44 : elapsedMs <= 18000 ? 0.32 : 0.20;
      if (evalType === "typo" || cardNudged) gain *= 0.72;
      prev.mastery = Math.min(1, Math.max(0.38, prev.mastery + gain));
      boostedSiblingIds.delete(pin.id);
    } else {
      prev.streak = 0;
      prev.mastery = Math.max(0.05, prev.mastery * 0.38);
      if (evalType === "confusion") {
        prev.orientationTraps = (prev.orientationTraps || 0) + 1;
        // Find sibling pin on same bone containing conflict.typed and boost both!
        if (conflict) {
          for (const cand of dataset.pins) {
            if (cand.bone === pin.bone && cand.id !== pin.id && cand.answer.toLowerCase().includes(conflict.typed)) {
              boostedSiblingIds.add(cand.id);
            }
          }
        }
      }
    }

    progress.pins[pin.id] = prev;

    // Daily stats
    const dayKey = new Date().toISOString().slice(0, 10);
    const ds = progress.dailyStats[dayKey] || { reviews: 0, correct: 0, totalMs: 0 };
    ds.reviews += 1;
    if (isOk) ds.correct += 1;
    ds.totalMs += elapsedMs;
    progress.dailyStats[dayKey] = ds;

    // Session stats
    sessionAttempts += 1;
    sessionTotalMs += elapsedMs;
    if (isOk) {
      sessionCorrect += 1;
      sessionStreak += 1;
    } else {
      sessionStreak = 0;
    }

    persistProgress();
    updateSessionStatsUI();
    updateGlobalReadinessUI();
    renderRedZoneMiniList();
  }

  function updateSessionStatsUI() {
    $("statStreak").textContent = String(sessionStreak);
    $("statSessionAcc").textContent = sessionAttempts > 0
      ? `${Math.round((sessionCorrect / sessionAttempts) * 100)}% (${sessionCorrect}/${sessionAttempts})`
      : "—";
    $("statAvgSpeed").textContent = sessionAttempts > 0
      ? `${(sessionTotalMs / sessionAttempts / 1000).toFixed(1)}s`
      : "—";
  }

  // ---------------- TIMER MANAGEMENT ----------------
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startTimer(durationMs = 30000, onTimeout = null) {
    stopTimer();
    timerDurationMs = durationMs;
    cardStartTime = performance.now();
    pausedRemainingMs = null;

    const tick = () => {
      const elapsed = performance.now() - cardStartTime;
      const rem = Math.max(0, timerDurationMs - elapsed);
      const pct = (rem / 30000) * 100;
      const fill = $("timerFill");
      const clk = $("clockDisplay");

      fill.style.width = `${Math.min(100, pct)}%`;
      clk.textContent = `${(rem / 1000).toFixed(1)}s`;

      if (rem > 14000) {
        fill.style.backgroundColor = "var(--emerald)";
        clk.className = "clock-time";
      } else if (rem > 6500) {
        fill.style.backgroundColor = "var(--amber)";
        clk.className = "clock-time warn";
      } else {
        fill.style.backgroundColor = "var(--red)";
        clk.className = "clock-time danger";
      }

      if (rem <= 0) {
        stopTimer();
        if (onTimeout) onTimeout();
      }
    };

    tick();
    timerInterval = setInterval(tick, 80);
  }

  function getElapsedMs() {
    return Math.min(30000, Math.max(250, Math.round(performance.now() - cardStartTime)));
  }

  // ---------------- MODE SWITCHING ----------------
  function switchMode(mode, preserveCustomPool = false) {
    stopTimer();
    currentMode = mode;
    if (!preserveCustomPool) customPinPoolIds = null;
    if (mode !== "exam") examActive = false;

    document.querySelectorAll(".mode-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });

    const isCockpit = mode === "grind" || mode === "reverse" || mode === "blitz" || (mode === "exam" && examActive);
    $("cockpitView").classList.toggle("hidden", !isCockpit);
    $("filterStrip").classList.toggle("hidden", !(mode === "grind" || mode === "reverse" || mode === "blitz"));
    $("examSetupView").classList.toggle("hidden", !(mode === "exam" && !examActive));
    $("gapsView").classList.toggle("hidden", mode !== "gaps");
    $("atlasView").classList.toggle("hidden", mode !== "atlas");
    $("boneIdView").classList.toggle("hidden", mode !== "boneid");
    $("examHudBanner").classList.toggle("hidden", !(mode === "exam" && examActive));

    if (mode !== "boneid") {
      stopBoneIdTimer();
    }

    const svg = $("specimenSvg");
    svg.classList.toggle("reverse-cursor", mode === "reverse");

    if (mode === "grind" || mode === "reverse" || mode === "blitz") {
      loadNextCockpitCard();
    } else if (mode === "exam" && !examActive) {
      renderExamSetupView();
    } else if (mode === "gaps") {
      renderGapsView();
    } else if (mode === "atlas") {
      renderAtlasView();
    } else if (mode === "boneid") {
      renderBoneIdView();
    }
  }

  // ---------------- COCKPIT MODES (GRIND / REVERSE / BLITZ / ACTIVE EXAM) ----------------
  function loadNextCockpitCard() {
    stopTimer();
    cardRevealed = false;
    cardNudged = false;
    hintLevel = 0;
    lastEvaluation = null;
    reverseClickPt = null;
    $("feedbackCard").classList.add("hidden");
    $("stageTooltip").classList.add("hidden");

    if (currentMode === "exam" && examActive) {
      if (examIndex >= examQueue.length) {
        finishMockExam();
        return;
      }
      currentPin = examQueue[examIndex];
      updateExamHud();
    } else {
      currentPin = pickNextPin();
    }

    if (!currentPin) {
      $("promptCard").innerHTML = `
        <div class="prompt-label"><span>No pins match this filter</span></div>
        <p style="color:var(--text-2);margin-bottom:12px;">You cleared every pin in this filter (or haven't flagged any yet).</p>
        <button class="btn btn-primary" id="btnResetFilter">Switch to Adaptive Smart Queue</button>
      `;
      $("btnResetFilter").onclick = () => {
        customPinPoolIds = null;
        queueFilter = "adaptive";
        $("queueFilterSelect").value = "adaptive";
        loadNextCockpitCard();
      };
      return;
    }

    recentPinIds.push(currentPin.id);
    if (recentPinIds.length > 16) recentPinIds.shift();

    renderCockpitViewport();
    renderPromptBox();

    const duration = 30000;
    startTimer(duration, () => handleTimeout());
  }

  function renderCockpitViewport() {
    if (!currentPin) return;
    const slide = slideMap.get(currentPin.slideId);
    const isExam = currentMode === "exam" && examActive;
    const isReverse = currentMode === "reverse";

    const blind = isExam ? true : (isReverse ? false : progress.settings.blindBone);
    const showBone = !blind || cardRevealed;

    $("hudLab").textContent = `Lab ${currentPin.lab} · ${currentPin.region}`;
    const boneEl = $("hudBone");
    boneEl.textContent = showBone ? currentPin.bone : "Hidden Specimen (Blind Mode)";
    boneEl.classList.toggle("masked", !showBone);

    const catEl = $("hudCat");
    catEl.textContent = cardRevealed ? CATEGORY_LABELS[currentPin.category] : (isReverse ? CATEGORY_LABELS[currentPin.category] : "Pin ID");
    catEl.className = `badge badge-cat cat-${cardRevealed || isReverse ? currentPin.category : "bone"}`;

    $("hudSlideRef").textContent = `${currentPin.deck} Slide ${currentPin.slideNum} · Pin #${currentPin.pinNum}`;

    const isFlagged = progress.bookmarks.includes(currentPin.id);
    const flagBtn = $("btnBookmark");
    flagBtn.textContent = isFlagged ? "★ Flagged" : "☆ Flag";
    flagBtn.classList.toggle("flagged", isFlagged);

    renderSlideSvg($("specimenSvg"), slide, {
      activePinId: currentPin.id,
      spotlight: isExam ? progress.settings.spotlight : progress.settings.spotlight,
      autoZoom: isReverse && !cardRevealed ? false : progress.settings.autoZoom,
      blindBone: blind,
      revealed: cardRevealed,
      hideAllPins: isReverse && !cardRevealed,
      userClick: reverseClickPt,
      onPinHover: (hoveredPin) => {
        if (!cardRevealed) return;
        const tt = $("stageTooltip");
        if (hoveredPin) {
          tt.textContent = `Pin #${hoveredPin.pinNum}: ${hoveredPin.answer}`;
          tt.classList.remove("hidden");
        } else {
          tt.classList.add("hidden");
        }
      },
      onPinClick: (clickedPin) => {
        if (!cardRevealed || clickedPin.id === currentPin.id) return;
        const tt = $("stageTooltip");
        tt.textContent = `Pin #${clickedPin.pinNum}: ${clickedPin.answer}${clickedPin.hook ? " — " + clickedPin.hook : ""}`;
        tt.classList.remove("hidden");
      },
    });
  }

  function renderPromptBox() {
    const box = $("promptCard");
    if (currentMode === "grind" || (currentMode === "exam" && examActive)) {
      const isExam = currentMode === "exam" && examActive;
      $("modeCaption").textContent = isExam ? "STRICT 30s PRACTICAL EXAM" : "30s ACTIVE PIN RECALL";
      box.innerHTML = `
        <div class="prompt-label">
          <span>Name Pin <strong>#${currentPin.pinNum}</strong>${currentPin.wholeBone ? " (Whole Bone)" : ""}</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--text-2);">${isExam ? "Auto-advances at 0s" : "Enter = Submit · Tab = Hint"}</span>
        </div>
        <div class="answer-input-row">
          <input type="text" id="pinAnswerInput" class="answer-input" placeholder="Type exact English anatomical term..." autocomplete="off" spellcheck="false" />
          <button class="btn btn-primary" id="btnSubmitPin">Check</button>
        </div>
        <div id="nudgeContainer"></div>
        <div id="hintContainer"></div>
        ${isExam ? "" : `
        <div class="prompt-actions">
          <button class="btn btn-ghost" id="btnHintPin" title="Shortcut [Tab]: Reveal word pattern">💡 Hint <kbd>Tab</kbd></button>
          <button class="btn btn-ghost" id="btnGiveUpPin">Reveal Answer</button>
        </div>`}
      `;

      const inp = $("pinAnswerInput");
      inp.focus();
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (!cardRevealed) submitTypedPinAnswer(false);
          else loadNextCockpitCard();
        } else if (e.key === "Tab" && !isExam && !cardRevealed) {
          e.preventDefault();
          showProgressiveHint();
        }
      });
      $("btnSubmitPin").onclick = () => {
        if (!cardRevealed) submitTypedPinAnswer(false);
        else loadNextCockpitCard();
      };
      if (!isExam) {
        $("btnHintPin").onclick = () => showProgressiveHint();
        $("btnGiveUpPin").onclick = () => submitTypedPinAnswer(true);
      }
    } else if (currentMode === "reverse") {
      $("modeCaption").textContent = "SPATIAL CLICK-ON-BONE";
      box.innerHTML = `
        <div class="prompt-label">
          <span>Click directly on the specimen photo where this structure sits:</span>
        </div>
        <div class="prompt-target-title">${currentPin.answer}</div>
        <div style="font-size:12.5px;color:var(--text-2);margin-bottom:8px;">
          Specimen: <strong style="color:var(--text-0)">${currentPin.bone}</strong> (${CATEGORY_LABELS[currentPin.category]})
        </div>
        ${cardRevealed ? `
          <button class="btn btn-primary" id="btnNextReverse" style="width:100%;">Next Landmark <kbd>Enter</kbd></button>
        ` : `
          <div class="prompt-actions">
            <span style="font-size:12px;color:var(--text-2);">🎯 Click the exact landmark on the photo ←</span>
            <button class="btn btn-ghost" id="btnReverseGiveUp">Show Pin</button>
          </div>
        `}
      `;
      if (!cardRevealed && $("btnReverseGiveUp")) {
        $("btnReverseGiveUp").onclick = () => handleReverseReveal(null);
      }
      if (cardRevealed && $("btnNextReverse")) {
        $("btnNextReverse").onclick = () => loadNextCockpitCard();
      }
    } else if (currentMode === "blitz") {
      $("modeCaption").textContent = "RAPID RECOGNITION BLITZ";
      if (!cardRevealed) {
        box.innerHTML = `
          <div class="prompt-label">
            <span>Say Pin <strong>#${currentPin.pinNum}</strong> out loud before flipping:</span>
            <span style="font-family:var(--mono);font-size:11px;color:var(--text-2);">Space = Flip</span>
          </div>
          <button class="btn btn-primary" id="btnBlitzFlip" style="width:100%;padding:13px;">
            Reveal Answer <kbd style="margin-left:6px;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">Space</kbd>
          </button>
        `;
        $("btnBlitzFlip").onclick = () => revealBlitzCard();
      } else {
        box.innerHTML = `
          <div class="prompt-label">
            <span>How fast &amp; accurate was your recall?</span>
            <span style="font-family:var(--mono);font-size:11px;color:var(--text-2);">Keys 1 / 2 / 3</span>
          </div>
          <div class="blitz-grade-grid">
            <button class="btn btn-red" data-bgrade="1">1 · Missed</button>
            <button class="btn btn-amber" data-bgrade="2">2 · Hesitant</button>
            <button class="btn btn-emerald" data-bgrade="3">3 · Instant Cold</button>
          </div>
        `;
        box.querySelectorAll("[data-bgrade]").forEach((btn) => {
          btn.onclick = () => gradeBlitzCard(Number(btn.dataset.bgrade));
        });
      }
    }
  }

  function showProgressiveHint() {
    if (!currentPin || cardRevealed) return;
    hintLevel += 1;
    const words = currentPin.answer.split(" ");
    const masked = words.map((w) => {
      const revealCount = Math.min(w.length, hintLevel);
      return w.slice(0, revealCount) + "_".repeat(Math.max(0, w.length - revealCount));
    }).join("  ");
    const hc = $("hintContainer");
    if (hc) {
      hc.innerHTML = `<div class="hint-banner">Hint (${words.length} word${words.length > 1 ? "s" : ""}): ${masked}${currentPin.cue && hintLevel >= 2 ? `<br><span style="color:var(--text-1);font-family:var(--font);">Cue: ${currentPin.cue}</span>` : ""}</div>`;
    }
  }

  function submitTypedPinAnswer(gaveUp = false) {
    if (cardRevealed || !currentPin) return;
    const isExam = currentMode === "exam" && examActive;
    const inp = $("pinAnswerInput");
    const rawVal = gaveUp ? "" : (inp ? inp.value : "");

    const res = gaveUp
      ? { verdict: "blank", ok: false, reason: "Revealed answer." }
      : evaluateAnatomicalAnswer(rawVal, currentPin, !isExam && !cardNudged);

    // Second-chance orientation/precision nudge!
    if (res.verdict === "nudge") {
      cardNudged = true;
      cardStartTime += 6500; // grant +6.5s bonus to complete the specific qualifier
      if (inp) {
        inp.classList.add("nudge-border");
        inp.focus();
      }
      const nc = $("nudgeContainer");
      if (nc) nc.innerHTML = `<div class="nudge-banner">⚡ ${res.missingHint}</div>`;
      return;
    }

    stopTimer();
    const elapsed = getElapsedMs();
    cardRevealed = true;
    lastEvaluation = { ...res, rawVal, elapsed };

    if (inp) inp.disabled = true;
    if ($("btnSubmitPin")) $("btnSubmitPin").textContent = isExam ? "Next →" : "Next (Enter) →";

    recordPinResult(currentPin, res.ok, elapsed, res.verdict, res.conflict || null);

    if (isExam) {
      examResults.push({
        pin: currentPin,
        ok: res.ok,
        verdict: res.verdict,
        typed: rawVal,
        elapsedMs: elapsed,
      });
      examIndex += 1;
      updateExamHud();
    }

    renderCockpitViewport();
    renderFeedbackCard(currentPin, res, rawVal, elapsed, !isExam);
  }

  function handleTimeout() {
    if (cardRevealed || !currentPin) return;
    if (currentMode === "grind" || (currentMode === "exam" && examActive)) {
      const inp = $("pinAnswerInput");
      const rawVal = inp && inp.value.trim() ? inp.value.trim() : "";
      if (rawVal) {
        // Grade whatever they managed to type before buzzer!
        submitTypedPinAnswer(false);
        if (!cardRevealed) {
          // If it triggered a nudge at 0s, force finalize as incomplete
          cardNudged = true;
          submitTypedPinAnswer(false);
        }
      } else {
        submitTypedPinAnswer(true);
      }
      // In strict Mock Exam, auto-advance after brief 1.6s flash if timed out
      if (currentMode === "exam" && examActive) {
        setTimeout(() => {
          if (currentMode === "exam" && examActive && cardRevealed) {
            loadNextCockpitCard();
          }
        }, 1600);
      }
    } else if (currentMode === "reverse") {
      handleReverseReveal(null);
    } else if (currentMode === "blitz") {
      revealBlitzCard();
    }
  }

  // Reverse Mode SVG Click Handler
  function handleSvgStageClick(evt) {
    if (currentMode !== "reverse" || cardRevealed || !currentPin) return;
    const svg = $("specimenSvg");
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    handleReverseReveal({ x: svgPt.x, y: svgPt.y });
  }

  function handleReverseReveal(clickPt) {
    if (cardRevealed || !currentPin) return;
    stopTimer();
    const elapsed = getElapsedMs();
    cardRevealed = true;
    reverseClickPt = clickPt;

    let dist = 999;
    let verdict = "wrong";
    let ok = false;
    let reason = "Pin revealed.";

    if (clickPt) {
      dist = Math.round(Math.hypot(clickPt.x - currentPin.tipX, clickPt.y - currentPin.tipY));
      // Check if user accidentally clicked closer to a sibling pin on this slide!
      const slide = slideMap.get(currentPin.slideId);
      let nearestSibling = null;
      let nearestSibDist = dist;
      for (const pid of slide.pinIds) {
        if (pid === currentPin.id) continue;
        const sib = pinMap.get(pid);
        const sd = Math.hypot(clickPt.x - sib.tipX, clickPt.y - sib.tipY);
        if (sd + 15 < nearestSibDist && sd < 90) {
          nearestSibDist = sd;
          nearestSibling = sib;
        }
      }

      if (dist <= 70) {
        ok = true;
        verdict = "exact";
        reason = `Bullseye! (${dist}px from exact landmark tip)`;
      } else if (dist <= 135 && !nearestSibling) {
        ok = true;
        verdict = "typo";
        reason = `Close hit (${dist}px from arrow tip) — tighten precision!`;
      } else {
        ok = false;
        verdict = nearestSibling ? "confusion" : "wrong";
        reason = nearestSibling
          ? `Careful! You clicked right on "${nearestSibling.answer}" (Pin #${nearestSibling.pinNum}) instead!`
          : `Off-target (${dist}px from landmark). Check the green target zone!`;
        if (nearestSibling) boostedSiblingIds.add(nearestSibling.id);
      }
    }

    const rPrev = progress.reversePins[currentPin.id] || { attempts: 0, hits: 0, bestDist: 999 };
    rPrev.attempts += 1;
    if (ok) rPrev.hits += 1;
    rPrev.bestDist = Math.min(rPrev.bestDist, dist);
    rPrev.lastSeen = Date.now();
    progress.reversePins[currentPin.id] = rPrev;

    recordPinResult(currentPin, ok, elapsed, verdict, null);
    renderCockpitViewport();
    renderPromptBox();
    renderFeedbackCard(currentPin, { verdict, ok, reason }, clickPt ? `Clicked Δ=${dist}px` : "(Shown)", elapsed, false);
  }

  function revealBlitzCard() {
    if (cardRevealed || !currentPin) return;
    stopTimer();
    const elapsed = getElapsedMs();
    cardRevealed = true;
    lastEvaluation = { elapsed };
    renderCockpitViewport();
    renderPromptBox();
    renderFeedbackCard(
      currentPin,
      { verdict: "exact", ok: true, reason: `Flipped in ${(elapsed / 1000).toFixed(1)}s — grade honestly with 1 / 2 / 3` },
      "",
      elapsed,
      false,
      true
    );
  }

  function gradeBlitzCard(grade) {
    if (!cardRevealed || !currentPin) return;
    const baseElapsed = lastEvaluation ? lastEvaluation.elapsed : 8000;
    if (grade === 1) {
      recordPinResult(currentPin, false, 25000, "wrong");
    } else if (grade === 2) {
      recordPinResult(currentPin, true, Math.max(18500, baseElapsed), "typo");
    } else {
      recordPinResult(currentPin, true, Math.min(9000, baseElapsed), "exact");
    }
    loadNextCockpitCard();
  }

  function renderFeedbackCard(pin, res, rawVal, elapsedMs, allowOverride = true, isBlitzPreview = false) {
    const fb = $("feedbackCard");
    fb.classList.remove("hidden", "verdict-ok", "verdict-typo", "verdict-bad");
    const cls = isBlitzPreview
      ? "verdict-ok"
      : res.verdict === "exact"
      ? "verdict-ok"
      : res.verdict === "typo"
      ? "verdict-typo"
      : "verdict-bad";
    fb.classList.add(cls);

    const badgeTxt = isBlitzPreview
      ? "ANSWER REVEALED"
      : res.verdict === "exact"
      ? `✓ CORRECT (${(elapsedMs / 1000).toFixed(1)}s)`
      : res.verdict === "typo"
      ? `✓ ACCEPTED — CHECK SPELLING / PRECISION (${(elapsedMs / 1000).toFixed(1)}s)`
      : res.verdict === "confusion"
      ? `⚠ ORIENTATION / SIBLING CONFUSION TRAP`
      : `✕ MISSED (${(elapsedMs / 1000).toFixed(1)}s)`;

    const altSyns = (pin.synonyms || [])
      .filter((s) => s !== pin.answer.toLowerCase() && s.length > 3)
      .slice(0, 3);

    fb.innerHTML = `
      <div class="fb-verdict-row">
        <span class="fb-verdict-badge">${badgeTxt}</span>
        <span style="font-size:11px;color:var(--text-2);font-family:var(--mono);">${CATEGORY_LABELS[pin.category]}</span>
      </div>
      <div class="fb-canonical">${pin.answer}</div>
      <div class="fb-bone-sub">${pin.bone} · Lab ${pin.lab} (${pin.deck} Slide ${pin.slideNum}, Pin #${pin.pinNum})</div>
      ${rawVal ? `<div class="fb-user-diff">You: <strong>${escapeHtml(rawVal)}</strong> — ${escapeHtml(res.reason)}</div>` : `<div style="font-size:12px;color:var(--text-2);margin-bottom:6px;">${escapeHtml(res.reason)}</div>`}
      ${altSyns.length ? `<div style="font-size:11.5px;color:var(--text-2);margin-bottom:6px;">Also accepted: <em>${escapeHtml(altSyns.join(" · "))}</em></div>` : ""}

      <div class="fb-intel-box">
        ${pin.hook ? `<div class="intel-row"><span class="intel-tag tag-hook">${pin.category === "neurovascular" ? "Passes" : "Attaches / Role"}</span><span>${escapeHtml(pin.hook)}</span></div>` : ""}
        ${pin.cue ? `<div class="intel-row"><span class="intel-tag tag-cue">5s Spot Cue</span><span>${escapeHtml(pin.cue)}</span></div>` : ""}
        ${pin.teacherNote ? `<div class="intel-row"><span class="intel-tag tag-warn">Exam Key Note</span><span>${escapeHtml(pin.teacherNote)}</span></div>` : ""}
      </div>

      ${isBlitzPreview ? "" : `
      <div class="fb-footer">
        ${!res.ok && allowOverride ? `<button class="override-link" id="btnOverrideOk">I knew this / valid synonym — mark Correct [O]</button>` : `<span></span>`}
        <button class="btn btn-primary" id="btnNextPinCard" style="padding:7px 14px;">Next Pin <kbd>Enter</kbd></button>
      </div>`}
    `;

    if ($("btnNextPinCard")) {
      $("btnNextPinCard").onclick = () => loadNextCockpitCard();
    }
    if ($("btnOverrideOk")) {
      $("btnOverrideOk").onclick = () => overrideLastMissAsCorrect();
    }
  }

  function overrideLastMissAsCorrect() {
    if (!currentPin || !cardRevealed || !lastEvaluation || lastEvaluation.ok) return;
    lastEvaluation.ok = true;
    const st = progress.pins[currentPin.id];
    if (st) {
      st.correct += 1;
      st.streak = 1;
      st.mastery = Math.max(0.55, st.mastery + 0.35);
    }
    sessionCorrect += 1;
    sessionStreak += 1;
    persistProgress();
    updateSessionStatsUI();
    updateGlobalReadinessUI();
    renderRedZoneMiniList();
    renderFeedbackCard(currentPin, { verdict: "exact", ok: true, reason: "Marked correct via override." }, lastEvaluation.rawVal, lastEvaluation.elapsed, false);
  }

  function renderRedZoneMiniList() {
    const redPins = dataset.pins
      .filter((p) => classifyPinStatus(p.id) === "red")
      .sort((a, b) => (progress.pins[a.id]?.mastery || 0) - (progress.pins[b.id]?.mastery || 0));

    const container = $("redZoneMiniList");
    if (redPins.length === 0) {
      container.innerHTML = `<div class="rm-empty">0 pins in Red Zone right now. Keep grinding — any missed, confused, or slow pins will cluster here!</div>`;
      return;
    }

    container.innerHTML = redPins.slice(0, 5).map((p) => {
      const st = progress.pins[p.id];
      const traps = st?.orientationTraps ? ` · ⚠ swap` : "";
      return `
        <div class="rm-item" data-jump-pin="${p.id}">
          <div>
            <strong style="color:var(--text-0);">${escapeHtml(p.answer)}</strong>
            <span style="color:var(--text-2);font-size:11px;"> · ${escapeHtml(p.bone)}${traps}</span>
          </div>
          <span style="color:var(--red);font-family:var(--mono);font-size:11px;">${Math.round((st?.mastery || 0) * 100)}%</span>
        </div>
      `;
    }).join("") + (redPins.length > 5 ? `<div style="font-size:11px;color:var(--text-2);padding-top:2px;">+ ${redPins.length - 5} more in Red Zone</div>` : "");

    container.querySelectorAll("[data-jump-pin]").forEach((el) => {
      el.onclick = () => {
        const pid = el.dataset.jumpPin;
        const p = pinMap.get(pid);
        if (p) openSlideModal(p.slideId, p.id);
      };
    });
  }

  // ---------------- MODE 4: 20-PIN MOCK PRACTICAL EXAM ----------------
  function renderExamSetupView(lastReport = null) {
    const view = $("examSetupView");
    const histHtml = (progress.examHistory || []).slice(-6).reverse().map((h) => {
      const pct = Math.round((h.score / h.total) * 100);
      const col = pct >= 90 ? "var(--emerald)" : pct >= 50 ? "var(--amber)" : "var(--red)";
      return `
        <div style="display:flex;justify-content:space-between;padding:8px 11px;background:var(--bg-0);border-radius:8px;border:1px solid var(--border);">
          <span><strong>${escapeHtml(h.label)}</strong> · ${new Date(h.ts).toLocaleDateString()} ${new Date(h.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
          <span style="font-family:var(--mono);font-weight:800;color:${col};">${h.score}/${h.total} (${pct}%) · ${(h.avgMs/1000).toFixed(1)}s avg</span>
        </div>
      `;
    }).join("");

    let reportHtml = "";
    if (lastReport) {
      const pct = Math.round((lastReport.score / lastReport.total) * 100);
      const exempt = pct >= 90;
      reportHtml = `
        <div class="hero-card" style="border-color:${exempt ? "var(--emerald)" : "var(--amber)"};">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
            <div>
              <div style="font-size:11.5px;font-weight:800;color:${exempt ? "var(--emerald)" : "var(--amber)"};text-transform:uppercase;">
                ${exempt ? "🏆 EXEMPTION PACE ACHIEVED (≥90%)" : pct >= 50 ? "✓ PASSED — PUSH FOR 18/20 EXEMPTION PACE" : "⚠ BELOW 50% — DRILL MISSED PINS IMMEDIATELY"}
              </div>
              <h2 style="font-size:28px;margin-top:2px;">Score: ${lastReport.score} / ${lastReport.total} (${pct}%)</h2>
              <p style="color:var(--text-2);font-size:13px;">Average recognition speed: <strong>${(lastReport.avgMs / 1000).toFixed(1)}s</strong> per specimen</p>
            </div>
            <div style="display:flex;gap:8px;">
              ${lastReport.missedIds.length > 0 ? `<button class="btn btn-primary" id="btnDrillExamMisses">⚡ Drill My ${lastReport.missedIds.length} Missed Pins Now</button>` : ""}
              <button class="btn btn-ghost" id="btnRetakeMock">Run Another 20-Pin Mock</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;">
            ${lastReport.items.map((it, idx) => `
              <div style="padding:9px 11px;border-radius:8px;background:var(--bg-0);border:1px solid ${it.ok ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.45)"};cursor:pointer;" data-inspect-slide="${it.pin.slideId}" data-inspect-pin="${it.pin.id}">
                <div style="display:flex;justify-content:space-between;font-size:11.5px;">
                  <strong style="color:${it.ok ? "var(--emerald)" : "var(--red)"};">#${idx + 1} · ${it.ok ? "✓" : "✕"} ${escapeHtml(it.pin.answer)}</strong>
                  <span style="font-family:var(--mono);color:var(--text-2);">${(it.elapsedMs / 1000).toFixed(1)}s</span>
                </div>
                <div style="font-size:11px;color:var(--text-2);margin-top:2px;">
                  ${escapeHtml(it.pin.bone)} · You typed: <span style="color:var(--text-1);font-family:var(--mono);">${escapeHtml(it.typed || "(blank)")}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    view.innerHTML = `
      <div class="section-container">
        ${reportHtml}
        <div class="hero-card">
          <h2 style="font-size:21px;margin-bottom:6px;">Thursday 5 Nov Practical Exam Simulator (20 Pins × 30 Seconds)</h2>
          <p style="color:var(--text-1);margin-bottom:16px;max-width:820px;">
            Simulates exact prosectorium test conditions: <strong>20 distinct specimens</strong>, <strong>strict 30-second clock</strong>, blind bone identification, and English syllabus terminology grading toward your <strong>18+/20 (90% Final Practical Exemption)</strong> target.
          </p>
          <div class="grid-3">
            <div class="roi-card" data-start-exam="realistic">
              <div style="font-weight:800;font-size:15px;color:var(--cyan);margin-bottom:4px;">🎯 Realistic Full Practical (Labs 1–9)</div>
              <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">14 Bone pins + 6 Skull pins weighted by JUMC exam frequency (Femur, Tibia, Talus, Radius, Hip, Cranial Base, Mandible...).</p>
              <button class="btn btn-primary" style="width:100%;">Start Realistic 20-Pin Exam</button>
            </div>
            <div class="roi-card" data-start-exam="bones">
              <div style="font-weight:800;font-size:15px;color:var(--emerald);margin-bottom:4px;">🦴 Osteology Only (Labs 1–5)</div>
              <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">20 pins across Vertebral Column, Thorax, Upper Limb, Pelvis, Femur, Tibia/Fibula &amp; Tarsals.</p>
              <button class="btn btn-ghost" style="width:100%;">Start 20-Pin Bones Mock</button>
            </div>
            <div class="roi-card" data-start-exam="skull">
              <div style="font-weight:800;font-size:15px;color:var(--violet);margin-bottom:4px;">💀 Skull &amp; Fossae Only (Labs 6–9)</div>
              <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">20 pins across Neurocranium, Internal/External Cranial Base Foramina, Palate &amp; Mandible.</p>
              <button class="btn btn-ghost" style="width:100%;">Start 20-Pin Skull Mock</button>
            </div>
            <div class="roi-card" data-start-exam="weak">
              <div style="font-weight:800;font-size:15px;color:var(--red);margin-bottom:4px;">🔥 Weak-Spot Torture Mock</div>
              <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">20 pins drawn preferentially from your Red Zone, confused pairs, slow recalls, and high-yield unseen pins.</p>
              <button class="btn btn-red" style="width:100%;">Start Weak-Spot Mock</button>
            </div>
          </div>
        </div>

        ${histHtml ? `
        <div class="hero-card">
          <h3 style="margin-bottom:10px;font-size:15px;">Recent Mock Practical Scores</h3>
          <div style="display:flex;flex-direction:column;gap:6px;">${histHtml}</div>
        </div>` : ""}
      </div>
    `;

    view.querySelectorAll("[data-start-exam]").forEach((card) => {
      card.onclick = () => startMockExam(card.dataset.startExam);
    });

    if ($("btnDrillExamMisses") && lastReport) {
      $("btnDrillExamMisses").onclick = () => {
        customPinPoolIds = [...lastReport.missedIds];
        switchMode("grind", true);
      };
    }
    if ($("btnRetakeMock")) {
      $("btnRetakeMock").onclick = () => startMockExam("realistic");
    }
    view.querySelectorAll("[data-inspect-slide]").forEach((el) => {
      el.onclick = () => openSlideModal(el.dataset.inspectSlide, el.dataset.inspectPin);
    });
  }

  function weightedSampleDistinctSlides(candidates, count) {
    const chosen = [];
    const usedSlides = new Set();
    let pool = [...candidates];

    while (chosen.length < count && pool.length > 0) {
      // Prefer distinct slides first so 20 specimens = 20 distinct specimens!
      let avail = pool.filter((p) => !usedSlides.has(p.slideId));
      if (avail.length === 0) avail = pool;

      const totalW = avail.reduce((acc, p) => acc + p.weight, 0);
      let r = Math.random() * totalW;
      let pick = avail[avail.length - 1];
      for (const p of avail) {
        r -= p.weight;
        if (r <= 0) {
          pick = p;
          break;
        }
      }
      chosen.push(pick);
      usedSlides.add(pick.slideId);
      pool = pool.filter((p) => p.id !== pick.id);
    }
    return chosen;
  }

  function startMockExam(preset) {
    const bonesPins = dataset.pins.filter((p) => p.deck === "BONES");
    const skullPins = dataset.pins.filter((p) => p.deck === "SKULL");

    if (preset === "bones") {
      examQueue = weightedSampleDistinctSlides(bonesPins, 20);
    } else if (preset === "skull") {
      examQueue = weightedSampleDistinctSlides(skullPins, 20);
    } else if (preset === "weak") {
      const sorted = [...dataset.pins].sort((a, b) => {
        const ma = progress.pins[a.id]?.mastery ?? 0.35;
        const mb = progress.pins[b.id]?.mastery ?? 0.35;
        return (ma - a.weight * 0.1) - (mb - b.weight * 0.1);
      });
      examQueue = weightedSampleDistinctSlides(sorted.slice(0, 75), 20);
    } else {
      const b14 = weightedSampleDistinctSlides(bonesPins, 14);
      const s6 = weightedSampleDistinctSlides(skullPins, 6);
      examQueue = [...b14, ...s6].sort(() => Math.random() - 0.5);
    }

    examActive = true;
    examIndex = 0;
    examResults = [];
    examQueue.presetLabel = preset === "bones" ? "Bones Only" : preset === "skull" ? "Skull Only" : preset === "weak" ? "Weak-Spot Mock" : "Full Practical";

    $("examSetupView").classList.add("hidden");
    $("cockpitView").classList.remove("hidden");
    $("examHudBanner").classList.remove("hidden");
    loadNextCockpitCard();
  }

  function updateExamHud() {
    $("examStepLabel").textContent = `Specimen ${Math.min(examIndex + 1, examQueue.length)} / ${examQueue.length}`;
    let dots = "";
    for (let i = 0; i < examQueue.length; i++) {
      let cls = "exam-dot";
      if (i < examResults.length) cls += examResults[i].ok ? " ok" : " bad";
      else if (i === examIndex) cls += " current";
      dots += `<div class="${cls}"></div>`;
    }
    $("examDots").innerHTML = dots;
  }

  function finishMockExam() {
    stopTimer();
    examActive = false;
    const score = examResults.filter((r) => r.ok).length;
    const total = examResults.length;
    const avgMs = total ? Math.round(examResults.reduce((a, r) => a + r.elapsedMs, 0) / total) : 0;
    const missedIds = examResults.filter((r) => !r.ok).map((r) => r.pin.id);

    const record = {
      ts: Date.now(),
      label: examQueue.presetLabel || "Full Practical",
      score,
      total,
      avgMs,
      missedIds,
    };
    progress.examHistory.push(record);
    persistProgress();

    $("cockpitView").classList.add("hidden");
    $("examHudBanner").classList.add("hidden");
    $("examSetupView").classList.remove("hidden");
    renderExamSetupView({ ...record, items: examResults });
  }

  // ---------------- MODE 5: TENDONS, MUSCLE GROOVES, SYLLABUS GAPS & VISUAL OCCLUSION ----------------
  function getAutoAttachmentDrills() {
    // Converts high-yield tendon/muscle/ligament/foramen pins with rich hooks into rapid reverse-association cards!
    return dataset.pins
      .filter((p) => p.category !== "bone" && p.hook && p.hook.length > 15)
      .map((p) => ({
        id: `att_${p.id}`,
        pinId: p.id,
        slideId: p.slideId,
        category: p.category,
        lab: p.lab,
        bone: p.bone,
        prompt: `On ${p.bone}: which bony landmark matches this attachment / content?\n"${p.hook}"`,
        answer: p.answer,
        synonyms: p.synonyms,
        detail: `${p.bone} (Lab ${p.lab}, ${p.deck} Slide ${p.slideNum} Pin #${p.pinNum})${p.cue ? " — " + p.cue : ""}`,
      }));
  }

  function renderGapsView() {
    const view = $("gapsView");
    const autoDrills = getAutoAttachmentDrills();
    const occGroups = ["Carpals & Hand", "Foot & Tarsals", "Joint Ligaments (Bonus)"];

    view.innerHTML = `
      <div class="section-container">
        <div class="hero-card" style="padding:16px 20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="font-size:18px;">Tendons, Muscle Grooves &amp; Unpinned Syllabus Gap-Fillers</h2>
              <p style="font-size:12.5px;color:var(--text-2);">
                Kept modular so your main 407-pin bone grind stays ultra-fast, while covering every tendon groove, muscle tuberosity, carpal/tarsal bone, and cranial foramen.
              </p>
            </div>
            <div class="pill-group">
              <button class="pill ${gapsSubtab === "drills" ? "active" : ""}" data-gsub="drills">📋 Syllabus Must-Know Gaps (${dataset.gapDrills.length})</button>
              <button class="pill ${gapsSubtab === "attachment_auto" ? "active" : ""}" data-gsub="attachment_auto">💪 What Attaches / Passes Here? (${autoDrills.length})</button>
              <button class="pill ${gapsSubtab === "occlusion" ? "active" : ""}" data-gsub="occlusion">🖐️ Visual Carpals, Tarsals &amp; Ligaments (${dataset.occlusionCards.length})</button>
            </div>
          </div>
        </div>

        <div id="gapsSubContent"></div>
      </div>
    `;

    view.querySelectorAll("[data-gsub]").forEach((btn) => {
      btn.onclick = () => {
        gapsSubtab = btn.dataset.gsub;
        currentGapItem = null;
        currentOccCard = null;
        renderGapsView();
      };
    });

    if (gapsSubtab === "occlusion") {
      renderOcclusionSubtab(occGroups);
    } else {
      const pool = gapsSubtab === "drills" ? dataset.gapDrills : autoDrills;
      renderGapDrillSubtab(pool);
    }
  }

  function renderGapDrillSubtab(pool) {
    const sub = $("gapsSubContent");
    if (!currentGapItem || !pool.some((x) => x.id === currentGapItem.id)) {
      // Pick least-mastered item
      const sorted = [...pool].sort((a, b) => {
        const ma = progress.gapDrills[a.id]?.mastery ?? 0;
        const mb = progress.gapDrills[b.id]?.mastery ?? 0;
        return ma - mb + (Math.random() * 0.25 - 0.125);
      });
      currentGapItem = sorted[0];
      gapRevealed = false;
    }

    const masteredCnt = pool.filter((x) => (progress.gapDrills[x.id]?.mastery || 0) >= 0.75).length;

    sub.innerHTML = `
      <div class="hero-card" style="max-width:820px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span class="badge badge-cat cat-${currentGapItem.category}">${CATEGORY_LABELS[currentGapItem.category] || "Osteology"} · Lab ${currentGapItem.lab} · ${escapeHtml(currentGapItem.bone)}</span>
          <span style="font-family:var(--mono);font-size:12px;color:var(--text-2);">${masteredCnt} / ${pool.length} mastered</span>
        </div>

        <div style="font-size:17px;font-weight:700;line-height:1.5;margin:14px 0 18px;white-space:pre-line;">${escapeHtml(currentGapItem.prompt)}</div>

        <div class="answer-input-row" style="margin-bottom:12px;">
          <input type="text" id="gapInput" class="answer-input" placeholder="Type answer (or press Space/Reveal to flip fast)..." autocomplete="off" ${gapRevealed ? "disabled" : ""} />
          <button class="btn btn-primary" id="btnGapCheck">${gapRevealed ? "Next →" : "Check"}</button>
          ${!gapRevealed ? `<button class="btn btn-ghost" id="btnGapFlip">Flip</button>` : ""}
        </div>

        <div id="gapFeedbackArea"></div>
      </div>
    `;

    const inp = $("gapInput");
    if (!gapRevealed && inp) {
      inp.focus();
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          gradeGapInput(pool, false);
        }
      });
    }
    $("btnGapCheck").onclick = () => {
      if (!gapRevealed) gradeGapInput(pool, false);
      else {
        currentGapItem = null;
        renderGapDrillSubtab(pool);
      }
    };
    if ($("btnGapFlip")) {
      $("btnGapFlip").onclick = () => gradeGapInput(pool, true);
    }
  }

  function gradeGapInput(pool, flippedOnly) {
    if (gapRevealed || !currentGapItem) return;
    gapRevealed = true;
    const inp = $("gapInput");
    const val = flippedOnly ? "" : (inp ? inp.value.trim() : "");
    if (inp) inp.disabled = true;
    $("btnGapCheck").textContent = "Next (Enter) →";

    const res = flippedOnly
      ? { ok: false, verdict: "flip", reason: "Flipped — self-grade below:" }
      : evaluateAnatomicalAnswer(val, currentGapItem, false);

    if (!flippedOnly) {
      saveGapMastery(currentGapItem.id, res.ok);
    }

    const fb = $("gapFeedbackArea");
    fb.innerHTML = `
      <div style="padding:14px;border-radius:10px;background:var(--bg-0);border:1px solid ${flippedOnly ? "var(--cyan)" : res.ok ? "var(--emerald)" : "var(--red)"};margin-top:8px;">
        <div style="font-size:11.5px;font-weight:800;color:${flippedOnly ? "var(--cyan)" : res.ok ? "var(--emerald)" : "var(--red)"};text-transform:uppercase;">
          ${flippedOnly ? "ANSWER" : res.ok ? "✓ CORRECT" : "✕ REVIEW THIS"}
        </div>
        <div style="font-size:20px;font-weight:800;margin:4px 0;">${escapeHtml(currentGapItem.answer)}</div>
        <p style="font-size:13px;color:var(--text-1);margin-top:4px;">${escapeHtml(currentGapItem.detail)}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px;flex-wrap:wrap;">
          ${currentGapItem.slideId ? `<button class="btn btn-ghost" id="btnViewGapSlide">🗺️ View on Real Specimen Slide</button>` : `<span></span>`}
          ${flippedOnly ? `
            <div style="display:flex;gap:8px;">
              <button class="btn btn-red" id="btnGapSelfBad">1 · Missed</button>
              <button class="btn btn-emerald" id="btnGapSelfOk">2 · Knew It</button>
            </div>
          ` : `<button class="btn btn-primary" id="btnGapNext2">Next Card →</button>`}
        </div>
      </div>
    `;

    if ($("btnViewGapSlide")) {
      $("btnViewGapSlide").onclick = () => openSlideModal(currentGapItem.slideId, currentGapItem.pinId);
    }
    if ($("btnGapSelfBad")) {
      $("btnGapSelfBad").onclick = () => {
        saveGapMastery(currentGapItem.id, false);
        currentGapItem = null;
        renderGapDrillSubtab(pool);
      };
    }
    if ($("btnGapSelfOk")) {
      $("btnGapSelfOk").onclick = () => {
        saveGapMastery(currentGapItem.id, true);
        currentGapItem = null;
        renderGapDrillSubtab(pool);
      };
    }
    if ($("btnGapNext2")) {
      $("btnGapNext2").onclick = () => {
        currentGapItem = null;
        renderGapDrillSubtab(pool);
      };
    }
  }

  function saveGapMastery(id, ok) {
    const prev = progress.gapDrills[id] || { attempts: 0, correct: 0, mastery: 0, lastSeen: 0 };
    prev.attempts += 1;
    if (ok) {
      prev.correct += 1;
      prev.mastery = Math.min(1, prev.mastery + 0.45);
    } else {
      prev.mastery = Math.max(0.05, prev.mastery * 0.35);
    }
    prev.lastSeen = Date.now();
    progress.gapDrills[id] = prev;
    persistProgress();
  }

  function renderOcclusionSubtab(occGroups) {
    const sub = $("gapsSubContent");
    const pool = dataset.occlusionCards.filter((c) => c.group === occGroupFilter);
    if (!currentOccCard || currentOccCard.group !== occGroupFilter) {
      const sorted = [...pool].sort((a, b) => {
        const ma = progress.occlusion[a.id]?.mastery ?? 0;
        const mb = progress.occlusion[b.id]?.mastery ?? 0;
        return ma - mb + (Math.random() * 0.3 - 0.15);
      });
      currentOccCard = sorted[0];
      occRevealed = false;
    }

    const masteredCnt = pool.filter((c) => (progress.occlusion[c.id]?.mastery || 0) >= 0.75).length;

    sub.innerHTML = `
      <div class="hero-card" style="text-align:center;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
          <div class="pill-group">
            ${occGroups.map((g) => `<button class="pill ${occGroupFilter === g ? "active" : ""}" data-occgrp="${escapeHtml(g)}">${escapeHtml(g)} (${dataset.occlusionCards.filter((x) => x.group === g).length})</button>`).join("")}
          </div>
          <span style="font-family:var(--mono);font-size:12px;color:var(--text-2);">
            ${escapeHtml(currentOccCard?.title || "")} · ${masteredCnt}/${pool.length} mastered
          </span>
        </div>

        ${currentOccCard ? `
          <div class="occ-stage">
            <img class="occ-base" src="${currentOccCard.baseImg}" alt="Atlas diagram" />
            <img class="occ-mask" src="${occRevealed ? currentOccCard.aMask : currentOccCard.qMask}" alt="Occlusion mask" />
          </div>
          <div style="margin-top:14px;display:flex;justify-content:center;gap:10px;">
            ${!occRevealed ? `
              <button class="btn btn-primary" id="btnOccFlip" style="min-width:240px;">Identify Red Box → Reveal <kbd>Space</kbd></button>
            ` : `
              <button class="btn btn-red" id="btnOccMiss">1 · Missed</button>
              <button class="btn btn-emerald" id="btnOccHit">2 · Got It Cold <kbd>Space</kbd></button>
            `}
          </div>
        ` : `<p>No visual occlusion cards found.</p>`}
      </div>
    `;

    sub.querySelectorAll("[data-occgrp]").forEach((btn) => {
      btn.onclick = () => {
        occGroupFilter = btn.dataset.occgrp;
        currentOccCard = null;
        renderOcclusionSubtab(occGroups);
      };
    });

    if ($("btnOccFlip")) {
      $("btnOccFlip").onclick = () => {
        occRevealed = true;
        renderOcclusionSubtab(occGroups);
      };
    }
    if ($("btnOccMiss")) {
      $("btnOccMiss").onclick = () => gradeOccCard(false, occGroups);
    }
    if ($("btnOccHit")) {
      $("btnOccHit").onclick = () => gradeOccCard(true, occGroups);
    }
  }

  function gradeOccCard(ok, occGroups) {
    if (!currentOccCard) return;
    const prev = progress.occlusion[currentOccCard.id] || { attempts: 0, correct: 0, mastery: 0 };
    prev.attempts += 1;
    if (ok) {
      prev.correct += 1;
      prev.mastery = Math.min(1, prev.mastery + 0.5);
    } else {
      prev.mastery = Math.max(0.05, prev.mastery * 0.35);
    }
    progress.occlusion[currentOccCard.id] = prev;
    persistProgress();
    currentOccCard = null;
    renderOcclusionSubtab(occGroups);
  }

  // ---------------- MODE 6: 103-SLIDE INTERACTIVE SPECIMEN ATLAS & WEAK-SPOT RADAR ----------------
  function renderAtlasView() {
    const view = $("atlasView");

    // Compute Bone-by-Bone ROI Priority (Exam Weight * (1 - Mastery))
    const boneStats = new Map();
    for (const p of dataset.pins) {
      if (!boneStats.has(p.bone)) {
        boneStats.set(p.bone, { bone: p.bone, lab: p.lab, deck: p.deck, total: 0, mastered: 0, red: 0, sumM: 0, weight: p.weight });
      }
      const bs = boneStats.get(p.bone);
      bs.total += 1;
      const st = classifyPinStatus(p.id);
      if (st === "mastered") bs.mastered += 1;
      if (st === "red") bs.red += 1;
      bs.sumM += progress.pins[p.id]?.mastery || 0;
    }

    const roiList = [...boneStats.values()]
      .map((b) => {
        const avgM = b.sumM / b.total;
        const roi = b.weight * (1 - avgM) + (b.red * 0.25);
        return { ...b, avgM, roi };
      })
      .sort((a, b) => b.roi - a.roi);

    const q = atlasSearch.trim().toLowerCase();
    const filteredSlides = dataset.slides.filter((s) => {
      if (atlasDeckFilter !== "ALL" && s.deck !== atlasDeckFilter) return false;
      if (!q) return true;
      if (s.bone.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)) return true;
      return s.pinIds.some((pid) => {
        const p = pinMap.get(pid);
        return p.answer.toLowerCase().includes(q) || (p.hook && p.hook.toLowerCase().includes(q));
      });
    });

    view.innerHTML = `
      <div class="section-container">
        <div class="hero-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="font-size:19px;">Weak-Spot Radar &amp; Highest-ROI Bone Targets</h2>
              <p style="font-size:12.5px;color:var(--text-2);">Sorted by <strong>Exam Pin Weight × Remaining Weakness</strong>. Click any bone to focus-grind it immediately.</p>
            </div>
            <button class="btn btn-ghost" id="btnResetAllProgress" style="color:var(--red);border-color:rgba(239,68,68,0.3);">Reset Progress (Saves Backup)</button>
          </div>

          <div class="bone-roi-grid">
            ${roiList.slice(0, 12).map((b) => {
              const pct = Math.round(b.avgM * 100);
              const col = pct >= 80 ? "var(--emerald)" : b.red > 0 ? "var(--red)" : "var(--cyan)";
              return `
                <div class="roi-card" data-drill-bone="${escapeHtml(b.bone)}">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <strong style="font-size:13px;">${escapeHtml(b.bone)}</strong>
                    <span style="font-family:var(--mono);font-size:11.5px;color:${col};">${pct}%</span>
                  </div>
                  <div class="readiness-bar" style="margin-bottom:5px;">
                    <div class="rbar-seg" style="width:${pct}%;background:${col};"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-2);">
                    <span>Lab ${b.lab} · ${b.total} pins${b.red ? ` · <strong style="color:var(--red)">${b.red} weak</strong>` : ""}</span>
                    <span style="color:var(--cyan);font-weight:700;">Drill →</span>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="hero-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h3 style="font-size:17px;">Interactive 103-Slide Specimen Atlas (${filteredSlides.length} slides)</h3>
              <div class="pill-group">
                <button class="pill ${atlasDeckFilter === "ALL" ? "active" : ""}" data-adeck="ALL">All (103)</button>
                <button class="pill ${atlasDeckFilter === "BONES" ? "active" : ""}" data-adeck="BONES">Bones (83)</button>
                <button class="pill ${atlasDeckFilter === "SKULL" ? "active" : ""}" data-adeck="SKULL">Skull (20)</button>
              </div>
            </div>
            <input type="text" id="atlasSearchInput" class="answer-input" style="max-width:340px;padding:7px 12px;font-size:13px;" placeholder="Search landmark, muscle, tendon, foramen..." value="${escapeHtml(atlasSearch)}" />
          </div>

          <div class="grid-slides">
            ${filteredSlides.map((s) => {
              const pins = s.pinIds.map((id) => pinMap.get(id));
              const mCnt = pins.filter((p) => classifyPinStatus(p.id) === "mastered").length;
              const rCnt = pins.filter((p) => classifyPinStatus(p.id) === "red").length;
              const thumb = s.photos[0]?.src || "";
              return `
                <div class="slide-tile" data-open-slide="${s.id}">
                  <div class="slide-thumb-box">
                    ${thumb ? `<img src="${thumb}" loading="lazy" alt="${escapeHtml(s.bone)}" />` : ""}
                    <span class="badge badge-lab" style="position:absolute;top:6px;left:6px;">${s.deck} #${s.slideNum}</span>
                    <span class="badge" style="position:absolute;top:6px;right:6px;background:rgba(7,11,18,0.85);">${pins.length} pins</span>
                  </div>
                  <div style="font-weight:700;font-size:13.5px;">${escapeHtml(s.bone)}</div>
                  <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-2);">
                    <span>Lab ${s.lab} · ${mCnt}/${pins.length} mastered</span>
                    ${rCnt > 0 ? `<span style="color:var(--red);font-weight:700;">${rCnt} red</span>` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    view.querySelectorAll("[data-drill-bone]").forEach((el) => {
      el.onclick = () => {
        deckFilter = "ALL";
        document.querySelectorAll("#deckFilterGroup .pill").forEach((p) => p.classList.toggle("active", p.dataset.deck === "ALL"));
        queueFilter = "adaptive";
        $("queueFilterSelect").value = "adaptive";
        boneFilter = `BONE:${el.dataset.drillBone}`;
        $("boneFilterSelect").value = boneFilter;
        switchMode("grind");
      };
    });

    view.querySelectorAll("[data-adeck]").forEach((btn) => {
      btn.onclick = () => {
        atlasDeckFilter = btn.dataset.adeck;
        renderAtlasView();
      };
    });

    const sInput = $("atlasSearchInput");
    sInput.addEventListener("input", () => {
      atlasSearch = sInput.value;
      const pos = sInput.selectionStart;
      renderAtlasView();
      const sInput2 = $("atlasSearchInput");
      sInput2.focus();
      sInput2.setSelectionRange(pos, pos);
    });

    view.querySelectorAll("[data-open-slide]").forEach((tile) => {
      tile.onclick = () => openSlideModal(tile.dataset.openSlide);
    });

    $("btnResetAllProgress").onclick = async () => {
      if (!confirm("Reset all mastery scores? (A timestamped backup will be saved automatically on disk first.)")) return;
      const res = await fetch("/api/reset", { method: "POST" });
      if (res.ok) {
        const payload = await res.json();
        progress = payload.state;
        ensureProgressShape();
        localStorage.removeItem(STORAGE_KEY);
        sessionAttempts = 0;
        sessionCorrect = 0;
        sessionStreak = 0;
        sessionTotalMs = 0;
        updateSessionStatsUI();
        updateGlobalReadinessUI();
        renderRedZoneMiniList();
        renderAtlasView();
      }
    };
  }

  // ---------------- SLIDE X-RAY INSPECTOR MODAL ----------------
  function openSlideModal(slideId, highlightPinId = null) {
    const slide = slideMap.get(slideId);
    if (!slide) return;
    modalSlideId = slideId;
    modalHighlightPinId = highlightPinId || slide.pinIds[0];
    modalShowLabels = true;
    $("slideModal").classList.remove("hidden");
    renderSlideModalContent();
  }

  function renderSlideModalContent() {
    const slide = slideMap.get(modalSlideId);
    if (!slide) return;
    $("modalTitle").textContent = `${slide.bone} — ${slide.deck} Slide ${slide.slideNum} (Lab ${slide.lab})`;
    $("btnModalToggleLabels").textContent = modalShowLabels ? "Hide Inline Labels" : "Show Inline Labels";
    $("btnModalToggleLabels").classList.toggle("active", modalShowLabels);

    renderSlideSvg($("modalSvg"), slide, {
      activePinId: modalHighlightPinId,
      spotlight: Boolean(modalHighlightPinId),
      autoZoom: false,
      blindBone: false,
      revealed: true,
      showInlineNames: modalShowLabels,
      onPinClick: (pin) => {
        modalHighlightPinId = modalHighlightPinId === pin.id ? null : pin.id;
        renderSlideModalContent();
      },
    });

    const listEl = $("modalPinList");
    listEl.innerHTML = slide.pinIds.map((pid) => {
      const p = pinMap.get(pid);
      const st = progress.pins[pid];
      const status = classifyPinStatus(pid);
      const col = status === "mastered" ? "var(--emerald)" : status === "red" ? "var(--red)" : status === "learning" ? "var(--amber)" : "var(--text-2)";
      return `
        <div class="modal-pin-item ${modalHighlightPinId === pid ? "highlighted" : ""}" data-mpin="${pid}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>#${p.pinNum} · ${escapeHtml(p.answer)}</strong>
            <span style="font-size:11px;font-family:var(--mono);color:${col};">${st ? `${Math.round(st.mastery * 100)}% · ${(st.avgMs / 1000).toFixed(1)}s` : "unseen"}</span>
          </div>
          <div style="font-size:11px;color:var(--cyan);margin-top:2px;">${CATEGORY_LABELS[p.category]}</div>
          ${p.hook ? `<div style="font-size:12px;color:var(--text-1);margin-top:4px;">${escapeHtml(p.hook)}</div>` : ""}
          ${p.cue ? `<div style="font-size:11.5px;color:var(--text-2);margin-top:2px;"><em>Cue: ${escapeHtml(p.cue)}</em></div>` : ""}
          ${p.teacherNote ? `<div style="font-size:11.5px;color:var(--amber);margin-top:2px;">⚠ ${escapeHtml(p.teacherNote)}</div>` : ""}
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-mpin]").forEach((el) => {
      el.onclick = () => {
        modalHighlightPinId = el.dataset.mpin;
        renderSlideModalContent();
      };
    });
  }

  // ==========================================================================
  // MODE 7: BONE ID & DISCRIMINATION (Whole Bone, Left/Right, Vertebrae, Carpals, Tarsals)
  // ==========================================================================
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getBoneIdMasteredCount() {
    if (!progress || !progress.boneId || !dataset || !dataset.boneIdItems) return 0;
    return dataset.boneIdItems.filter((it) => (progress.boneId[it.id]?.mastery || 0) >= 0.75).length;
  }

  function getBoneIdFilteredPool() {
    if (!dataset || !dataset.boneIdItems) return [];
    let pool = dataset.boneIdItems;
    if (currentBoneIdCategory !== "ALL") {
      pool = pool.filter((it) => it.categories && it.categories.includes(currentBoneIdCategory));
    }
    if (boneIdRedOnly) {
      const redPool = pool.filter((it) => progress.boneId && progress.boneId[it.id]?.weak);
      if (redPool.length > 0) pool = redPool;
    }
    return pool;
  }

  function pickNextBoneIdItem() {
    const pool = getBoneIdFilteredPool();
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const candidates = pool.filter((it) => !recentBoneIdItemIds.slice(-Math.min(5, pool.length - 1)).includes(it.id));
    const list = candidates.length > 0 ? candidates : pool;

    const scored = list.map((it) => {
      const p = progress.boneId ? progress.boneId[it.id] : null;
      let score = Math.random() * 8;
      if (!p || p.attempts === 0) {
        score += 35; // unseen
      } else if (p.weak) {
        score += 65; // red-zone weak spot
      } else if (p.mastery < 0.75) {
        score += 30 * (1 - p.mastery);
      }
      return { item: it, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].item;
  }

  function renderBoneIdView() {
    const view = $("boneIdView");
    const categories = dataset.boneIdCategories || [];
    const allItems = dataset.boneIdItems || [];

    view.innerHTML = `
      <div class="boneid-container">
        <!-- Top Toolbar -->
        <div class="boneid-toolbar">
          <div class="boneid-cats" id="boneIdCatTabs">
            ${categories.map((c) => {
              const count = c.id === "ALL" ? allItems.length : allItems.filter((it) => it.categories && it.categories.includes(c.id)).length;
              const isActive = currentBoneIdCategory === c.id;
              return `<button class="boneid-cat-btn ${isActive ? "active" : ""}" data-bid-cat="${c.id}" title="${escapeHtml(c.desc)}">
                <span>${c.icon}</span>
                <span>${escapeHtml(c.label)}</span>
                <span class="badge-count">${count}</span>
              </button>`;
            }).join("")}
          </div>

          <div class="boneid-toolbar-options">
            <div class="pill-group" id="boneIdFormatGroup">
              <button class="pill ${boneIdFormat === "choice" ? "active" : ""}" data-bid-fmt="choice" title="Keys [1]-[4] or [L]/[R]">⚡ 4 Choices / Keys</button>
              <button class="pill ${boneIdFormat === "typein" ? "active" : ""}" data-bid-fmt="typein" title="Type name with auto-suggest and typo tolerance">⌨️ Type-in Recall</button>
            </div>
            <button class="toggle-chip ${boneIdRedOnly ? "active" : ""}" id="btnBoneIdRedOnly" title="Practice only weak / missed specimens">
              <span>🔴</span> Weak Only
            </button>
          </div>
        </div>

        <!-- Cockpit Workspace -->
        <div class="boneid-cockpit-grid">
          <!-- Left: Specimen Stage -->
          <div class="boneid-stage-card">
            <div class="boneid-stage-header">
              <div class="boneid-hud-left">
                <span class="badge badge-bone" id="boneIdHudBone">Specimen</span>
                <span class="badge badge-cat" id="boneIdHudView">View</span>
                <span class="hud-slide-ref" id="boneIdHudQueueCount">Pool: 0</span>
              </div>
              <div class="boneid-hud-right">
                <button class="icon-btn" id="btnBoneIdZoomToggle" title="Zoom in / out on specimen [Z]">🔍 Zoom</button>
                <div class="boneid-timer-pill" id="boneIdTimerPill">20.0s</div>
              </div>
            </div>

            <div class="boneid-img-wrap" id="boneIdImgWrap" title="Click to zoom in/out">
              <img id="boneIdImg" src="" alt="Specimen Image" />
            </div>

            <div class="boneid-stage-footer">
              <span id="boneIdSlideRef">Specimen Photo</span>
              <span id="boneIdCategoryBadge">Category</span>
            </div>
          </div>

          <!-- Right: Interactive Control & Feedback Panel -->
          <div class="boneid-panel-card">
            <!-- Stats Strip -->
            <div class="boneid-stats-strip">
              <div class="mini-stat">
                <span class="ms-val" id="boneIdStatStreak">${boneIdSessionStreak}</span>
                <span class="ms-lbl">Streak</span>
              </div>
              <div class="mini-stat">
                <span class="ms-val" id="boneIdStatAcc">${boneIdSessionAttempts > 0 ? Math.round((boneIdSessionCorrects / boneIdSessionAttempts) * 100) + "%" : "—"}</span>
                <span class="ms-lbl">Accuracy</span>
              </div>
              <div class="mini-stat">
                <span class="ms-val" id="boneIdStatMastered">${getBoneIdMasteredCount()} / ${allItems.length}</span>
                <span class="ms-lbl">Mastered</span>
              </div>
              <div class="mini-stat">
                <span class="ms-val" id="boneIdStatAvgSpeed">${boneIdSessionAttempts > 0 ? (boneIdSessionTotalTime / boneIdSessionAttempts / 1000).toFixed(1) + "s" : "—"}</span>
                <span class="ms-lbl">Avg Speed</span>
              </div>
            </div>

            <!-- Prompt Header -->
            <div class="boneid-prompt-box">
              <div class="boneid-prompt-kicker" id="boneIdPromptKicker">RAPID-FIRE RECOGNITION</div>
              <div class="boneid-prompt-text" id="boneIdPromptText">Loading specimen...</div>
              <div class="boneid-prompt-sub" id="boneIdPromptSub"></div>
            </div>

            <!-- Dynamic Action Area (Buttons or Type-in) -->
            <div id="boneIdActionArea"></div>

            <!-- Dynamic Feedback Card -->
            <div class="hidden" id="boneIdFeedbackArea"></div>
          </div>
        </div>
      </div>
    `;

    // Category click handlers
    view.querySelectorAll("[data-bid-cat]").forEach((btn) => {
      btn.onclick = () => {
        currentBoneIdCategory = btn.dataset.bidCat;
        currentBoneIdItem = null;
        renderBoneIdView();
      };
    });

    // Format toggle handlers
    view.querySelectorAll("[data-bid-fmt]").forEach((btn) => {
      btn.onclick = () => {
        boneIdFormat = btn.dataset.bidFmt;
        view.querySelectorAll("[data-bid-fmt]").forEach((b) => b.classList.toggle("active", b.dataset.bidFmt === boneIdFormat));
        renderBoneIdActionArea();
      };
    });

    // Red-only toggle
    const redBtn = $("btnBoneIdRedOnly");
    if (redBtn) {
      redBtn.onclick = () => {
        boneIdRedOnly = !boneIdRedOnly;
        redBtn.classList.toggle("active", boneIdRedOnly);
        currentBoneIdItem = null;
        loadNextBoneIdCard();
      };
    }

    // Zoom toggles
    const zoomBtn = $("btnBoneIdZoomToggle");
    const imgWrap = $("boneIdImgWrap");
    if (zoomBtn && imgWrap) {
      zoomBtn.onclick = () => imgWrap.classList.toggle("zoomed");
      imgWrap.onclick = () => imgWrap.classList.toggle("zoomed");
    }

    loadNextBoneIdCard();
  }

  function startBoneIdTimer() {
    stopBoneIdTimer();
    const timerPill = $("boneIdTimerPill");
    boneIdTimerInterval = setInterval(() => {
      const elapsed = Date.now() - boneIdStartTime;
      const rem = Math.max(0, boneIdRemainingMs - elapsed);
      if (timerPill) {
        timerPill.textContent = (rem / 1000).toFixed(1) + "s";
        if (rem <= 5000) {
          timerPill.style.color = "var(--red)";
          timerPill.style.borderColor = "var(--red)";
        } else {
          timerPill.style.color = "var(--cyan)";
          timerPill.style.borderColor = "rgba(56, 189, 248, 0.3)";
        }
      }
      if (rem <= 0) {
        stopBoneIdTimer();
        if (!boneIdRevealed) {
          submitBoneIdAnswer("__TIMEOUT__");
        }
      }
    }, 100);
  }

  function stopBoneIdTimer() {
    if (boneIdTimerInterval) {
      clearInterval(boneIdTimerInterval);
      boneIdTimerInterval = null;
    }
  }

  function loadNextBoneIdCard() {
    stopBoneIdTimer();
    boneIdRevealed = false;
    boneIdLastEvaluation = null;
    $("boneIdImgWrap")?.classList.remove("zoomed");

    const item = pickNextBoneIdItem();
    if (!item) {
      const promptText = $("boneIdPromptText");
      if (promptText) promptText.textContent = "No specimens in this filter queue.";
      const actionArea = $("boneIdActionArea");
      if (actionArea) actionArea.innerHTML = `<div style="color:var(--text-2);padding:14px;">Try selecting 'All Bones &amp; Specimens' or disabling 'Weak Only'.</div>`;
      return;
    }

    currentBoneIdItem = item;
    recentBoneIdItemIds.push(item.id);
    if (recentBoneIdItemIds.length > 15) recentBoneIdItemIds.shift();

    // Prepare display choices (randomized for 4-choice questions)
    if (item.mode !== "siding" && item.choices) {
      item._displayChoices = shuffleArray(item.choices);
    } else {
      item._displayChoices = ["Left", "Right"];
    }

    // Update HUD
    const pool = getBoneIdFilteredPool();
    const hudBone = $("boneIdHudBone");
    const hudView = $("boneIdHudView");
    const queueBadge = $("boneIdHudQueueCount");
    const slideRef = $("boneIdSlideRef");
    const catBadge = $("boneIdCategoryBadge");
    const img = $("boneIdImg");

    if (hudBone) hudBone.textContent = item.mode === "siding" ? item.bone : "Identify Bone";
    if (hudView) hudView.textContent = item.view || "Anatomical Aspect";
    if (queueBadge) queueBadge.textContent = `Pool: ${pool.length} items`;
    if (slideRef) slideRef.textContent = item.slideId ? `Slide ${item.slideId}` : "Course Specimen";
    if (catBadge) catBadge.textContent = item.categories ? item.categories.join(" · ") : "Specimen ID";

    if (img) {
      img.src = item.image;
      img.alt = item.bone;
    }

    // Update Prompt
    const kicker = $("boneIdPromptKicker");
    const promptText = $("boneIdPromptText");
    const promptSub = $("boneIdPromptSub");

    if (item.mode === "siding") {
      if (kicker) kicker.textContent = "LEFT VS. RIGHT SPECIMEN IDENTIFICATION";
      if (promptText) promptText.textContent = item.prompt || `Is this ${item.bone} specimen LEFT or RIGHT?`;
      if (promptSub) promptSub.textContent = `Orient by: Superior/Inferior, Anterior/Posterior, Medial/Lateral`;
    } else {
      if (kicker) kicker.textContent = "RAPID AT-A-GLANCE IDENTIFICATION";
      if (promptText) promptText.textContent = item.prompt || `Identify this bone at a glance:`;
      if (promptSub) promptSub.textContent = item.view ? `Aspect: ${item.view}` : `Name the whole bone period`;
    }

    // Hide feedback area
    const fb = $("boneIdFeedbackArea");
    if (fb) {
      fb.className = "hidden";
      fb.innerHTML = "";
    }

    // Render Action Area
    renderBoneIdActionArea();

    // Start timer
    boneIdStartTime = Date.now();
    boneIdRemainingMs = 20000;
    startBoneIdTimer();
  }

  function renderBoneIdActionArea() {
    const area = $("boneIdActionArea");
    if (!area || !currentBoneIdItem) return;
    const item = currentBoneIdItem;

    if (item.mode === "siding") {
      area.innerHTML = `
        <div class="siding-btn-group">
          <button class="siding-btn siding-btn-left" id="btnSideLeft" title="Hotkey [L] or [1]">
            <span>⬅️ LEFT</span>
            <kbd>Key 1 or L</kbd>
          </button>
          <button class="siding-btn siding-btn-right" id="btnSideRight" title="Hotkey [R] or [2]">
            <span>➡️ RIGHT</span>
            <kbd>Key 2 or R</kbd>
          </button>
        </div>
      `;
      const btnL = $("btnSideLeft");
      const btnR = $("btnSideRight");
      if (btnL) btnL.onclick = () => submitBoneIdAnswer("Left");
      if (btnR) btnR.onclick = () => submitBoneIdAnswer("Right");
    } else if (boneIdFormat === "choice") {
      const choices = item._displayChoices || item.choices || [];
      area.innerHTML = `
        <div class="boneid-choices-grid">
          ${choices.map((c, i) => `
            <button class="boneid-choice-btn" data-choice-idx="${i}" data-choice-val="${escapeHtml(c)}">
              <span class="boneid-choice-key">${i + 1}</span>
              <span style="flex:1;">${escapeHtml(c)}</span>
            </button>
          `).join("")}
        </div>
      `;
      area.querySelectorAll(".boneid-choice-btn").forEach((btn) => {
        btn.onclick = () => submitBoneIdAnswer(btn.dataset.choiceVal);
      });
    } else {
      const allBoneNames = [...new Set((dataset.boneIdItems || []).map((x) => x.bone).concat(["Atlas", "Axis", "Scaphoid", "Lunate", "Triquetrum", "Pisiform", "Trapezium", "Trapezoid", "Capitate", "Hamate", "Talus", "Calcaneus", "Navicular", "Cuboid", "Medial Cuneiform", "Intermediate Cuneiform", "Lateral Cuneiform"]))].sort();

      area.innerHTML = `
        <div class="boneid-typein-wrap">
          <div class="boneid-input-row">
            <input type="text" id="boneIdInput" class="answer-input" list="boneIdDatalist" placeholder="Type bone name (e.g. Scaphoid, Atlas, Calcaneus)..." autocomplete="off" />
            <button class="btn btn-primary" id="btnBoneIdSubmit">Submit (Enter)</button>
            <button class="btn btn-ghost" id="btnBoneIdReveal">Reveal</button>
          </div>
          <datalist id="boneIdDatalist">
            ${allBoneNames.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("")}
          </datalist>
        </div>
      `;
      const inp = $("boneIdInput");
      const subBtn = $("btnBoneIdSubmit");
      const revBtn = $("btnBoneIdReveal");

      if (inp) {
        inp.focus();
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitBoneIdAnswer(inp.value.trim());
          }
        });
      }
      if (subBtn) subBtn.onclick = () => submitBoneIdAnswer(inp?.value.trim() || "");
      if (revBtn) revBtn.onclick = () => submitBoneIdAnswer("__REVEAL__");
    }
  }

  function evaluateBoneIdAnswer(userAnswer, item) {
    if (userAnswer === "__REVEAL__") {
      return { ok: false, verdict: "reveal", reason: "Answer revealed." };
    }
    if (userAnswer === "__TIMEOUT__") {
      return { ok: false, verdict: "timeout", reason: "Time ran out (20s)." };
    }

    const trimmed = (userAnswer || "").trim();
    if (!trimmed) {
      return { ok: false, verdict: "blank", reason: "No answer entered." };
    }

    if (item.mode === "siding") {
      const isLeft = /left|^l$/i.test(trimmed);
      const isRight = /right|^r$/i.test(trimmed);
      const targetIsLeft = /left/i.test(item.answer);

      if ((isLeft && targetIsLeft) || (isRight && !targetIsLeft)) {
        return { ok: true, verdict: "exact", reason: `Spot on! Confirmed ${item.answer.toUpperCase()}.` };
      }
      return { ok: false, verdict: "wrong", reason: `Incorrect laterality: this is a ${item.answer.toUpperCase()} specimen.` };
    }

    if (trimmed.toLowerCase() === item.answer.toLowerCase()) {
      return { ok: true, verdict: "exact", reason: "Exact match!" };
    }

    return evaluateAnatomicalAnswer(trimmed, item, false);
  }

  function submitBoneIdAnswer(userAnswer) {
    if (boneIdRevealed || !currentBoneIdItem) return;
    stopBoneIdTimer();
    boneIdRevealed = true;

    const item = currentBoneIdItem;
    const elapsedMs = Math.max(200, Date.now() - boneIdStartTime);
    const evalRes = evaluateBoneIdAnswer(userAnswer, item);
    boneIdLastEvaluation = { evalRes, item, elapsedMs, userAnswer };

    if (!progress.boneId) progress.boneId = {};
    const prev = progress.boneId[item.id] || {
      attempts: 0,
      correct: 0,
      streak: 0,
      mastery: 0,
      avgMs: elapsedMs,
      lastSeen: 0,
      weak: false,
    };

    prev.attempts++;
    prev.lastSeen = Date.now();
    prev.avgMs = Math.round((prev.avgMs * (prev.attempts - 1) + elapsedMs) / prev.attempts);

    if (evalRes.ok) {
      prev.correct++;
      prev.streak++;
      prev.mastery = Math.min(1, prev.mastery + 0.25);
      if (prev.streak >= 2) prev.weak = false;
      boneIdSessionStreak++;
      boneIdSessionCorrects++;
    } else {
      prev.streak = 0;
      prev.mastery = Math.max(0, prev.mastery - 0.35);
      prev.weak = true;
      boneIdSessionStreak = 0;
    }

    progress.boneId[item.id] = prev;
    boneIdSessionAttempts++;
    boneIdSessionTotalTime += elapsedMs;
    persistProgress();

    const streakEl = $("boneIdStatStreak");
    const accEl = $("boneIdStatAcc");
    const mastEl = $("boneIdStatMastered");
    const speedEl = $("boneIdStatAvgSpeed");

    if (streakEl) streakEl.textContent = boneIdSessionStreak;
    if (accEl) accEl.textContent = Math.round((boneIdSessionCorrects / boneIdSessionAttempts) * 100) + "%";
    if (mastEl) mastEl.textContent = `${getBoneIdMasteredCount()} / ${(dataset.boneIdItems || []).length}`;
    if (speedEl) speedEl.textContent = (boneIdSessionTotalTime / boneIdSessionAttempts / 1000).toFixed(1) + "s";

    if (item.mode === "siding") {
      const btnL = $("btnSideLeft");
      const btnR = $("btnSideRight");
      const targetIsLeft = /left/i.test(item.answer);
      if (btnL && btnR) {
        if (targetIsLeft) {
          btnL.classList.add("selected-correct");
          if (!evalRes.ok) btnR.classList.add("selected-wrong");
        } else {
          btnR.classList.add("selected-correct");
          if (!evalRes.ok) btnL.classList.add("selected-wrong");
        }
      }
    } else if (boneIdFormat === "choice") {
      const btns = document.querySelectorAll(".boneid-choice-btn");
      btns.forEach((btn) => {
        const val = btn.dataset.choiceVal;
        if (val === item.answer) {
          btn.classList.add("selected-correct");
        } else if (val === userAnswer && !evalRes.ok) {
          btn.classList.add("selected-wrong");
        }
      });
    }

    const fbArea = $("boneIdFeedbackArea");
    if (!fbArea) return;

    fbArea.className = "boneid-feedback-card";
    fbArea.innerHTML = `
      <div class="boneid-verdict-banner ${evalRes.ok ? "verdict-correct" : "verdict-missed"}" id="boneIdVerdictBanner">
        <span>${evalRes.ok ? "✓ CORRECT (+1)" : "✗ MISSED"} · ${(elapsedMs / 1000).toFixed(1)}s</span>
        <span>${escapeHtml(evalRes.reason)}</span>
      </div>

      <div class="boneid-canonical-answer">
        ${escapeHtml(item.answer)} ${item.bone && item.answer !== item.bone && !item.answer.includes(item.bone) ? `(${escapeHtml(item.bone)})` : ""}
      </div>

      ${item.sidingRule ? `
        <div class="siding-rule-box">
          <div class="siding-rule-title">
            <span>📐</span> 3-Point Anatomical Siding Orientation
          </div>
          <div class="siding-axis-list">
            <div class="siding-axis-item">
              <span class="siding-axis-tag">⬆️ SUP / INF</span>
              <span>${escapeHtml(item.sidingRule.superiorInferior)}</span>
            </div>
            <div class="siding-axis-item">
              <span class="siding-axis-tag">⬅️ ANT / POST</span>
              <span>${escapeHtml(item.sidingRule.anteriorPosterior)}</span>
            </div>
            <div class="siding-axis-item">
              <span class="siding-axis-tag">↔️ MED / LAT</span>
              <span>${escapeHtml(item.sidingRule.medialLateral)}</span>
            </div>
          </div>
          ${item.sidingRule.summary ? `<div class="siding-rule-summary">${escapeHtml(item.sidingRule.summary)}</div>` : ""}
        </div>
      ` : ""}

      ${item.cue ? `
        <div class="boneid-cue-box">
          <span style="font-size:16px;">⚡</span>
          <div><strong>5-Second Spot Cue:</strong> ${escapeHtml(item.cue)}</div>
        </div>
      ` : ""}

      ${item.trap ? `
        <div class="boneid-trap-box">
          <span style="font-size:16px;">⚠️</span>
          <div><strong>Exam Trap / Confusion:</strong> ${escapeHtml(item.trap)}</div>
        </div>
      ` : ""}

      <div class="boneid-feedback-actions">
        ${!evalRes.ok ? `<button class="btn btn-ghost" id="btnBoneIdOverride" title="Shortcut [O]">I knew this — Mark Correct [O]</button>` : ""}
        <button class="btn btn-primary" id="btnBoneIdNext" style="flex:1;">Next Specimen (Enter / Space) →</button>
      </div>
    `;

    const nextBtn = $("btnBoneIdNext");
    if (nextBtn) {
      nextBtn.focus();
      nextBtn.onclick = () => loadNextBoneIdCard();
    }

    const ovrBtn = $("btnBoneIdOverride");
    if (ovrBtn) {
      ovrBtn.onclick = () => overrideBoneIdMiss();
    }
  }

  function overrideBoneIdMiss() {
    if (!boneIdLastEvaluation || !boneIdLastEvaluation.item) return;
    const item = boneIdLastEvaluation.item;
    if (!progress.boneId || !progress.boneId[item.id]) return;

    const p = progress.boneId[item.id];
    p.streak = 1;
    p.correct++;
    p.mastery = Math.min(1, p.mastery + 0.35);
    p.weak = false;

    boneIdSessionStreak++;
    boneIdSessionCorrects++;

    persistProgress();

    const banner = $("boneIdVerdictBanner");
    if (banner) {
      banner.className = "boneid-verdict-banner verdict-correct";
      banner.innerHTML = `<span>✓ OVERRIDDEN AS CORRECT (+1)</span><span>Counted toward streak &amp; mastery</span>`;
    }

    const ovrBtn = $("btnBoneIdOverride");
    if (ovrBtn) ovrBtn.remove();

    const streakEl = $("boneIdStatStreak");
    const accEl = $("boneIdStatAcc");
    const mastEl = $("boneIdStatMastered");
    if (streakEl) streakEl.textContent = boneIdSessionStreak;
    if (accEl) accEl.textContent = Math.round((boneIdSessionCorrects / boneIdSessionAttempts) * 100) + "%";
    if (mastEl) mastEl.textContent = `${getBoneIdMasteredCount()} / ${(dataset.boneIdItems || []).length}`;
  }

  // ---------------- EVENTS & GLOBAL KEYBOARD SHORTCUTS ----------------
  function syncToggleButtons() {
    $("btnSpotlight").classList.toggle("active", progress.settings.spotlight);
    $("btnAutoZoom").classList.toggle("active", progress.settings.autoZoom);
    $("btnBlindBone").classList.toggle("active", progress.settings.blindBone);
  }

  function bindEvents() {
    document.querySelectorAll(".mode-tab").forEach((btn) => {
      btn.onclick = () => switchMode(btn.dataset.mode);
    });

    $("readinessCluster").onclick = () => switchMode("atlas");

    document.querySelectorAll("#deckFilterGroup .pill").forEach((btn) => {
      btn.onclick = () => {
        customPinPoolIds = null;
        deckFilter = btn.dataset.deck;
        document.querySelectorAll("#deckFilterGroup .pill").forEach((b) => b.classList.toggle("active", b === btn));
        loadNextCockpitCard();
      };
    });

    $("queueFilterSelect").onchange = (e) => {
      customPinPoolIds = null;
      queueFilter = e.target.value;
      loadNextCockpitCard();
    };

    $("boneFilterSelect").onchange = (e) => {
      customPinPoolIds = null;
      boneFilter = e.target.value;
      loadNextCockpitCard();
    };

    $("btnSpotlight").onclick = () => {
      progress.settings.spotlight = !progress.settings.spotlight;
      syncToggleButtons();
      persistProgress();
      renderCockpitViewport();
    };

    $("btnAutoZoom").onclick = () => {
      progress.settings.autoZoom = !progress.settings.autoZoom;
      syncToggleButtons();
      persistProgress();
      renderCockpitViewport();
    };

    $("btnBlindBone").onclick = () => {
      progress.settings.blindBone = !progress.settings.blindBone;
      syncToggleButtons();
      persistProgress();
      renderCockpitViewport();
    };

    $("btnBookmark").onclick = () => toggleCurrentBookmark();
    $("btnOpenSlideAtlas").onclick = () => {
      if (currentPin) openSlideModal(currentPin.slideId, currentPin.id);
    };

    $("btnDrillRedNow").onclick = () => {
      customPinPoolIds = null;
      queueFilter = "red";
      $("queueFilterSelect").value = "red";
      switchMode("grind");
    };

    $("specimenSvg").addEventListener("click", handleSvgStageClick);

    // Modal controls
    $("btnCloseModal").onclick = () => $("slideModal").classList.add("hidden");
    $("slideModal").addEventListener("click", (e) => {
      if (e.target === $("slideModal")) $("slideModal").classList.add("hidden");
    });
    $("btnModalToggleLabels").onclick = () => {
      modalShowLabels = !modalShowLabels;
      renderSlideModalContent();
    };
    $("btnModalDrillSlide").onclick = () => {
      const s = slideMap.get(modalSlideId);
      if (!s) return;
      $("slideModal").classList.add("hidden");
      customPinPoolIds = [...s.pinIds];
      switchMode("grind", true);
    };

    // Global Hotkeys
    window.addEventListener("keydown", (e) => {
      if (!$("slideModal").classList.contains("hidden")) {
        if (e.key === "Escape") $("slideModal").classList.add("hidden");
        return;
      }

      if (e.altKey && e.key >= "1" && e.key <= "7") {
        e.preventDefault();
        const modes = ["grind", "reverse", "blitz", "exam", "gaps", "atlas", "boneid"];
        switchMode(modes[Number(e.key) - 1]);
        return;
      }

      const activeTag = document.activeElement?.tagName;
      const inInput = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

      if (!inInput) {
        if (e.key === "Enter" && cardRevealed && (currentMode === "grind" || currentMode === "reverse" || (currentMode === "exam" && examActive))) {
          e.preventDefault();
          loadNextCockpitCard();
          return;
        }
        if ((e.key === "o" || e.key === "O") && cardRevealed && lastEvaluation && !lastEvaluation.ok && !(currentMode === "exam" && examActive)) {
          e.preventDefault();
          overrideLastMissAsCorrect();
          return;
        }
        if (e.key === "s" || e.key === "S") {
          $("btnSpotlight").click();
          return;
        }
        if (e.key === "z" || e.key === "Z") {
          $("btnAutoZoom").click();
          return;
        }
        if (e.key === "b" || e.key === "B") {
          $("btnBlindBone").click();
          return;
        }
        if (e.key === "f" || e.key === "F") {
          toggleCurrentBookmark();
          return;
        }

        // Blitz keyboard controls
        if (currentMode === "blitz") {
          if (e.code === "Space" && !cardRevealed) {
            e.preventDefault();
            revealBlitzCard();
          } else if (cardRevealed && ["1", "2", "3"].includes(e.key)) {
            e.preventDefault();
            gradeBlitzCard(Number(e.key));
          }
        }

        // Visual Occlusion keyboard controls
        if (currentMode === "gaps" && gapsSubtab === "occlusion") {
          if (e.code === "Space") {
            e.preventDefault();
            if ($("btnOccFlip")) $("btnOccFlip").click();
            else if ($("btnOccHit")) $("btnOccHit").click();
          } else if (e.key === "1" && $("btnOccMiss")) {
            e.preventDefault();
            $("btnOccMiss").click();
          } else if (e.key === "2" && $("btnOccHit")) {
            e.preventDefault();
            $("btnOccHit").click();
          }
        }

        // Bone ID (Mode 7) keyboard controls
        if (currentMode === "boneid") {
          if (boneIdRevealed) {
            if (e.key === "Enter" || e.code === "Space") {
              e.preventDefault();
              loadNextBoneIdCard();
              return;
            }
            if (e.key === "o" || e.key === "O") {
              e.preventDefault();
              overrideBoneIdMiss();
              return;
            }
          } else {
            if (e.key === "z" || e.key === "Z") {
              e.preventDefault();
              $("boneIdImgWrap")?.classList.toggle("zoomed");
              return;
            }
            if (currentBoneIdItem && currentBoneIdItem.mode === "siding") {
              if (e.key === "1" || e.key === "l" || e.key === "L") {
                e.preventDefault();
                submitBoneIdAnswer("Left");
                return;
              }
              if (e.key === "2" || e.key === "r" || e.key === "R") {
                e.preventDefault();
                submitBoneIdAnswer("Right");
                return;
              }
            } else if (boneIdFormat === "choice" && currentBoneIdItem && currentBoneIdItem.mode !== "siding") {
              if (["1", "2", "3", "4"].includes(e.key)) {
                e.preventDefault();
                const idx = Number(e.key) - 1;
                const choices = currentBoneIdItem._displayChoices || currentBoneIdItem.choices;
                if (choices && choices[idx]) {
                  submitBoneIdAnswer(choices[idx]);
                  return;
                }
              }
            }
            if (e.code === "Space") {
              e.preventDefault();
              submitBoneIdAnswer("__REVEAL__");
              return;
            }
          }
        }
      }
    });
  }

  function toggleCurrentBookmark() {
    if (!currentPin) return;
    const idx = progress.bookmarks.indexOf(currentPin.id);
    if (idx >= 0) progress.bookmarks.splice(idx, 1);
    else progress.bookmarks.push(currentPin.id);
    persistProgress();
    renderCockpitViewport();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  init();
})();
