const LEVELS = [{
  name: "Barrio Soleado",
  duration: 95,
  required: 3,
  traffic: 105,
  theme: "neighborhood",
  mode: "solo",
  sky: "#8ed8ff",
  grass: "#86c968",
  road: "#6c7480",
  accent: "#ef5a43",
  start: { x: 632, y: 360 }
}];
LEVELS.push({
  name: "Parque Central",
  duration: 105,
  required: 4,
  traffic: 125,
  theme: "park",
  mode: "race",
  sky: "#a6e4ff",
  grass: "#75bd65",
  road: "#7c786f",
  accent: "#3e9b5f",
  start: { x: 600, y: 580 }
});
LEVELS.push({
  name: "Ciudad Nocturna",
  duration: 115,
  required: 5,
  traffic: 155,
  theme: "night",
  mode: "stormRace",
  sky: "#202757",
  grass: "#334b52",
  road: "#3f4659",
  accent: "#8d5fd3",
  start: { x: 632, y: 360 }
});
LEVELS.push({
  name: "Zona Industrial",
  duration: 55,
  required: 6,
  traffic: 180,
  theme: "industrial",
  mode: "solo",
  sky: "#f39a62",
  grass: "#b97858",
  road: "#62545a",
  accent: "#e56b43",
  start: { x: 632, y: 360 }
});
(() => {
  "use strict";

  const LEVEL_URLS = ["../level-1/", "../level-2/", "../level-3/", "../level-4/"];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const el = {
    menu: document.getElementById("menuScreen"),
    level: document.getElementById("levelScreen"),
    how: document.getElementById("howScreen"),
    pause: document.getElementById("pauseScreen"),
    result: document.getElementById("resultScreen"),
    hud: document.getElementById("hud"),
    toast: document.getElementById("toast"),
    pauseBtn: document.getElementById("pauseBtn"),
    soundBtn: document.getElementById("soundBtn"),
    hudLevel: document.getElementById("hudLevel"),
    hudTime: document.getElementById("hudTime"),
    hudDeliveries: document.getElementById("hudDeliveries"),
    hudScore: document.getElementById("hudScore"),
    hudHearts: document.getElementById("hudHearts"),
    missionText: document.getElementById("missionText"),
    missionProgress: document.getElementById("missionProgress"),
    resultIcon: document.getElementById("resultIcon"),
    resultEyebrow: document.getElementById("resultEyebrow"),
    resultTitle: document.getElementById("resultTitle"),
    resultMessage: document.getElementById("resultMessage"),
    resultStars: document.getElementById("resultStars"),
    resultTime: document.getElementById("resultTime"),
    resultScore: document.getElementById("resultScore"),
    resultDeliveries: document.getElementById("resultDeliveries"),
    nextBtn: document.getElementById("nextBtn"),
    retryBtn: document.getElementById("retryBtn"),
    resultMenuBtn: document.getElementById("resultMenuBtn")
  };

  const keys = new Set();
  let state = "menu";
  let activeLevel = 0;
  let levelData = LEVELS[0];
  let previousTime = performance.now();
  let audioEnabled = true;
  let audioContext = null;
  let world = null;
  let player = null;
  let timeLeft = 0;
  let delivered = 0;
  let score = 0;
  let hearts = 3;
  let pizzasCarried = 0;
  let currentTarget = 0;
  let invulnerable = 0;
  let actionCooldown = 0;
  let toastTimer = 0;
  let screenShake = 0;
  let rainOffset = 0;
  let ambientTick = 0;
  let animationClock = 0;
  let deliveryCombo = 0;
  let lastDeliveryAt = 0;
  let autoAdvanceTimer = 0;
  let levelIntroTimer = 0;
  let rival = null;
  let stormTimer = 0;
  let mobileSprintActive = false;
  let lastMobileDirectionTapAt = 0;
  let lastMobileDirectionCode = "";
  let mobileCameraX = 0;
  let mobileCameraY = 0;
  const particles = [];
  const floatTexts = [];
  const MAX_PIZZAS = 2;
  const CAMPAIGN_SCORE_KEY = "pizzaDashCampaignScore";
  const LEVEL_PROGRESS_KEY = "pizzaDashLevelProgress";
  const mobileCameraQuery = window.matchMedia("(max-width: 650px), (hover: none) and (pointer: coarse), (orientation: landscape) and (max-height: 760px)");
  const getUpgrades = () => JSON.parse(localStorage.getItem("pizzaDashUpgrades") || '{"speed":0,"capacity":0,"health":0}');
  const maxPizzas = () => MAX_PIZZAS + getUpgrades().capacity;
  const maxHearts = () => 3 + getUpgrades().health;
  const PIZZERIA = { x: 24, y: 672, w: 120, h: 42, refillX: 84, refillY: 694, radius: 36 };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min, max) => min + Math.random() * (max - min);

  function roundedRectPath(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function fillRoundedRect(context, x, y, w, h, r, color) {
    roundedRectPath(context, x, y, w, h, r);
    context.fillStyle = color;
    context.fill();
  }

  function updateResponsiveCamera(dt) {
    if (!mobileCameraQuery.matches) {
      canvas.style.width = "";
      canvas.style.height = "";
      canvas.style.transform = "";
      canvas.style.objectPosition = "";
      return;
    }

    const viewport = canvas.parentElement?.getBoundingClientRect();
    if (!viewport?.width || !viewport?.height) return;

    const landscapeView = viewport.width > viewport.height;
    const portraitView = !landscapeView;
    const zoom = landscapeView ? 1 : 1.18;
    const scale = Math.max(viewport.width / W, viewport.height / H) * zoom;
    const renderedW = W * scale;
    const renderedH = H * scale;
    const centerX = (viewport.width - renderedW) * .5;
    const centerY = (viewport.height - renderedH) * .5;
    const minX = viewport.width - renderedW;
    const minY = viewport.height - renderedH;
    const maxY = portraitView ? Math.min(0, -54 * scale) : 0;
    const desiredX = viewport.width * .5;
    const desiredY = viewport.height * (landscapeView ? .58 : .56);
    const targetX = renderedW <= viewport.width
      ? centerX
      : player
      ? clamp(desiredX - player.x * scale, minX, 0)
      : centerX;
    const targetY = renderedH <= viewport.height
      ? centerY
      : player
      ? clamp(desiredY - player.y * scale, Math.min(minY, maxY), Math.max(minY, maxY))
      : centerY;
    const follow = clamp(dt * (landscapeView ? 8 : 5.5), 0, 1);
    mobileCameraX = lerp(mobileCameraX, targetX, follow);
    mobileCameraY = lerp(mobileCameraY, targetY, follow);
    canvas.style.width = `${renderedW.toFixed(2)}px`;
    canvas.style.height = `${renderedH.toFixed(2)}px`;
    canvas.style.transform = `translate3d(${mobileCameraX.toFixed(2)}px, ${mobileCameraY.toFixed(2)}px, 0)`;
  }

  function readLevelProgress() {
    try {
      return JSON.parse(localStorage.getItem(LEVEL_PROGRESS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function loadCampaignScore() {
    return Number(localStorage.getItem(CAMPAIGN_SCORE_KEY) || 0);
  }

  function saveCampaignScore() {
    localStorage.setItem(CAMPAIGN_SCORE_KEY, String(Math.max(0, Math.floor(score))));
  }

  function restoreLevelProgress(index) {
    const saved = readLevelProgress()[index];
    if (!saved) return;
    delivered = clamp(Number(saved.delivered ?? delivered), 0, levelData.required);
    pizzasCarried = clamp(Number(saved.pizzasCarried ?? pizzasCarried), 0, maxPizzas());
    hearts = clamp(Number(saved.hearts ?? hearts), 1, maxHearts());
    currentTarget = clamp(Number(saved.currentTarget ?? currentTarget), 0, Math.max(0, world.houses.length - 1));
    timeLeft = clamp(Number(saved.timeLeft ?? timeLeft), 1, levelData.duration);
    if (Array.isArray(saved.picnicCollected) && world.picnicOrders) {
      world.picnicOrders.forEach((order, orderIndex) => {
        order.collected = Boolean(saved.picnicCollected[orderIndex]);
      });
    }
  }

  function saveLevelProgress() {
    const store = readLevelProgress();
    store[activeLevel] = {
      delivered,
      pizzasCarried,
      hearts,
      currentTarget,
      timeLeft: Math.max(0, timeLeft),
      picnicCollected: world?.picnicOrders?.map(order => order.collected) || [],
      completed: levelObjectiveComplete()
    };
    localStorage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(store));
  }

  function travelTo(url) {
    saveLevelProgress();
    saveCampaignScore();
    window.location.href = url;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function circleRectCollision(circle, rect) {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.r * circle.r;
  }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      const intersects = ((a.y > y) !== (b.y > y)) &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function closestPointOnSegment(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / lengthSq, 0, 1);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function closestPointOnObstacle(circle, obstacle) {
    if (!obstacle.points) {
      return {
        x: clamp(circle.x, obstacle.x, obstacle.x + obstacle.w),
        y: clamp(circle.y, obstacle.y, obstacle.y + obstacle.h)
      };
    }

    let best = obstacle.points[0];
    let bestDistance = Infinity;
    for (let i = 0; i < obstacle.points.length; i++) {
      const a = obstacle.points[i];
      const b = obstacle.points[(i + 1) % obstacle.points.length];
      const point = closestPointOnSegment(circle.x, circle.y, a, b);
      const distanceSq = (circle.x - point.x) ** 2 + (circle.y - point.y) ** 2;
      if (distanceSq < bestDistance) {
        best = point;
        bestDistance = distanceSq;
      }
    }
    return best;
  }

  function circlePolygonCollision(circle, obstacle) {
    if (!circleRectCollision(circle, obstacle)) return false;
    if (pointInPolygon(circle.x, circle.y, obstacle.points)) return true;
    for (let i = 0; i < obstacle.points.length; i++) {
      const a = obstacle.points[i];
      const b = obstacle.points[(i + 1) % obstacle.points.length];
      const point = closestPointOnSegment(circle.x, circle.y, a, b);
      const dx = circle.x - point.x;
      const dy = circle.y - point.y;
      if (dx * dx + dy * dy < circle.r * circle.r) return true;
    }
    return false;
  }

  function circleObstacleCollision(circle, obstacle) {
    return obstacle.points
      ? circlePolygonCollision(circle, obstacle)
      : circleRectCollision(circle, obstacle);
  }

  function pointInRect(x, y, rect, pad = 0) {
    return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
  }

  function isOnRoad(x, y, pad = 0) {
    return world && world.roads.some(road => pointInRect(x, y, road, pad));
  }

  function getAudioContext() {
    if (!audioEnabled) return null;
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function tone(frequency, duration = 0.1, type = "sine", volume = 0.05, offset = 0) {
    const ac = getAudioContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const now = ac.currentTime + offset;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function sound(name) {
    if (!audioEnabled) return;
    if (name === "click") {
      tone(420, .06, "triangle", .035);
    } else if (name === "coin") {
      tone(760, .08, "sine", .055);
      tone(1060, .11, "sine", .045, .05);
    } else if (name === "deliver") {
      tone(520, .10, "triangle", .06);
      tone(700, .12, "triangle", .06, .08);
      tone(920, .18, "triangle", .055, .16);
    } else if (name === "crash") {
      tone(150, .16, "sawtooth", .065);
      tone(90, .22, "square", .035, .04);
    } else if (name === "win") {
      [520, 660, 780, 1040].forEach((f, i) => tone(f, .24, "triangle", .05, i * .11));
    } else if (name === "lose") {
      [300, 245, 190].forEach((f, i) => tone(f, .25, "sine", .05, i * .15));
    }
  }

  function updateSoundButtonState() {
    el.soundBtn.classList.toggle("is-muted", !audioEnabled);
    el.soundBtn.setAttribute("aria-label", audioEnabled ? "Desactivar sonido" : "Activar sonido");
  }

  function setMobileSprintActive(active) {
    mobileSprintActive = active;
    if (active) {
      keys.add("ShiftLeft");
    } else {
      keys.delete("ShiftLeft");
    }
    document.querySelector(".dpad")?.classList.toggle("is-sprinting", active);
  }

  function clearMobileSprint() {
    setMobileSprintActive(false);
    lastMobileDirectionTapAt = 0;
    lastMobileDirectionCode = "";
  }

  function showOnly(screen) {
    [el.menu, el.level, el.how, el.pause, el.result].forEach(node => node.classList.add("hidden"));
    if (screen) screen.classList.remove("hidden");
  }

  function openMenu() {
    clearTimeout(autoAdvanceTimer);
    state = "menu";
    showOnly(el.menu);
    el.hud.classList.add("hidden");
    el.pauseBtn.classList.add("hidden");
    world = createDecorativeWorld();
    player = null;
  }

  function openLevelSelect() {
    clearTimeout(autoAdvanceTimer);
    state = "levelSelect";
    showOnly(el.level);
    el.hud.classList.add("hidden");
    el.pauseBtn.classList.add("hidden");
    refreshLevelStars();
  }

  function openHow() {
    state = "how";
    showOnly(el.how);
  }

  function refreshLevelStars() {
    LEVEL_URLS.forEach((_, index) => {
      const value = Number(localStorage.getItem(`pizzaDashStars${index}`) || 0);
      const node = document.getElementById(`stars-${index}`);
      if (node) node.textContent = `${"★ ".repeat(value)}${"☆ ".repeat(3 - value)}`.trim();
    });
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const min = String(Math.floor(total / 60)).padStart(2, "0");
    const sec = String(total % 60).padStart(2, "0");
    return `${min}:${sec}`;
  }

  function createDecorativeWorld() {
    return buildWorld(0);
  }

  function buildWorld(levelIndex) {
    const theme = LEVELS[levelIndex].theme;

    const roads = theme === "park"
      ? [
          { x: 0, y: 500, w: W, h: 145, axis: "x" },
          { x: 520, y: 104, w: 160, h: H - 104, axis: "y" }
        ]
      : [
          { x: 0, y: 285, w: W, h: 150, axis: "x" },
          { x: 548, y: 0, w: 170, h: H, axis: "y" }
        ];

    const houses = theme === "park"
      ? [
          makeHouse(80, 72, 210, 136, "#f1c17a", "#cf4f41", 180, 222),
          makeHouse(955, 75, 220, 142, "#f3dfae", "#4c7bad", 1060, 232),
          makeHouse(86, 355, 210, 130, "#eeb48b", "#b96d42", 180, 500),
          makeHouse(950, 350, 220, 135, "#f5cf92", "#5e9c79", 1060, 500)
        ]
      : [
          makeHouse(75, 68, 215, 138, "#f6d9a4", "#d74f42", 182, 228),
          makeHouse(350, 68, 170, 130, "#efc58e", "#4e7fa7", 435, 221),
          makeHouse(760, 62, 190, 138, "#f7dfb0", "#c95852", 855, 225),
          makeHouse(1000, 70, 205, 135, "#efc897", "#668f69", 1103, 225),
          makeHouse(74, 486, 215, 140, "#f4d49f", "#548db3", 182, 472),
          makeHouse(355, 496, 170, 132, "#f0bf8d", "#ce6541", 440, 482),
          makeHouse(760, 492, 190, 138, "#f4ddb0", "#7a65a7", 855, 477),
          makeHouse(1002, 490, 205, 136, "#f3ca91", "#d35d4c", 1104, 476)
        ];

    if (theme === "night") {
      houses.forEach((house, i) => {
        house.wall = i % 2 ? "#4c4b69" : "#54506f";
        house.roof = i % 2 ? "#65456f" : "#3f6583";
        house.night = true;
      });
    }

    const obstacles = houses.flatMap(house => makeHouseObstacles(house));
    const trees = [];
    const benches = [];
    const puddles = [];
    const cats = [];
    const cyclists = [];
    const picnicOrders = [];

    const treeSpots = theme === "park"
      ? [
          [330, 112], [410, 170], [790, 126], [875, 175],
          [360, 365], [842, 386],
          [450, 270], [1030, 286]
        ]
      : [
          [318, 112], [970, 112], [320, 548], [975, 548],
          [70, 255], [1190, 250], [70, 455], [1190, 455]
        ];

    treeSpots.forEach(([x, y], index) => {
      const tree = { x, y, r: 26 + (index % 3) * 3, phase: rand(0, Math.PI * 2) };
      trees.push(tree);
      obstacles.push({ x: x - 18, y: y - 10, w: 36, h: 40, type: "tree" });
    });

    if (theme === "park") {
      benches.push({ x: 315, y: 265, w: 88, h: 26 });
      benches.push({ x: 875, y: 265, w: 88, h: 26 });
      obstacles.push(...benches.map(b => ({ ...b, type: "bench" })));
      puddles.push({ x: 470, y: 420, rx: 55, ry: 23 });
      puddles.push({ x: 790, y: 420, rx: 46, ry: 20 });
      cats.push(makeCat(420, 455, 72, "x"));
      cats.push(makeCat(820, 120, 66, "y"));
      cyclists.push(
        makeCyclist(305, 315, "x", 305, 475, 112, "#d94b55"),
        makeCyclist(900, 230, "y", 230, 430, 96, "#347db7")
      );
      picnicOrders.push(
        { x: 392, y: 430, collected: false, phase: rand(0, Math.PI * 2) },
        { x: 820, y: 350, collected: false, phase: rand(0, Math.PI * 2) },
        { x: 1090, y: 300, collected: false, phase: rand(0, Math.PI * 2) }
      );
    } else {
      puddles.push({ x: 815, y: 455, rx: 42, ry: 17 });
      cats.push(makeCat(330, 448, 58, "x"));
    }

    if (theme === "night") {
      puddles.push(
        { x: 210, y: 448, rx: 46, ry: 18 },
        { x: 870, y: 260, rx: 50, ry: 20 },
        { x: 1090, y: 452, rx: 44, ry: 18 }
      );
    }

    const intersections = createIntersections(roads);
    const traffic = createTraffic(roads, levelIndex, intersections);

    const coinSpots = theme === "park"
      ? [[350, 260], [915, 260], [355, 455], [920, 455], [780, 335], [1080, 265]]
      : [[330, 245], [950, 250], [330, 460], [950, 460], [630, 250], [630, 470]];
    const coins = coinSpots.map(([x, y]) => ({ x, y, taken: false, phase: rand(0, 6.2) }));

    const flowerSeed = [];
    for (let i = 0; i < 90; i++) {
      const x = rand(15, W - 15);
      const y = rand(40, H - 18);
      const inRoad = roads.some(r => x > r.x - 15 && x < r.x + r.w + 15 && y > r.y - 15 && y < r.y + r.h + 15);
      const inHouse = houses.some(h => x > h.x - 20 && x < h.x + h.w + 20 && y > h.y - 20 && y < h.y + h.h + 20);
      if (!inRoad && !inHouse) flowerSeed.push({ x, y, c: Math.floor(rand(0, 4)) });
    }

    const crosswalks = createCrosswalks(roads);

    return {
      roads,
      houses,
      obstacles,
      trees,
      benches,
      puddles,
      cats,
      cyclists,
      picnicOrders,
      cars: traffic.cars,
      trafficSpawns: traffic.spawns,
      trafficReservations: [],
      trafficClock: 0,
      coins,
      flowerSeed,
      crosswalks,
      intersections,
      lightning: []
    };
  }

  function makeHouse(x, y, w, h, wall, roof, doorX, doorY) {
    return { x, y, w, h, wall, roof, doorX, doorY, night: false };
  }

  function makeHouseObstacles(house) {
    const roofPoints = [
      { x: house.x - 15, y: house.y + 20 },
      { x: house.x + house.w / 2, y: house.y - 42 },
      { x: house.x + house.w + 15, y: house.y + 20 }
    ];
    const roof = {
      x: house.x - 15,
      y: house.y - 42,
      w: house.w + 30,
      h: 62,
      points: roofPoints,
      type: "roof"
    };
    const body = {
      x: house.x + 5,
      y: house.y + 8,
      w: house.w - 10,
      h: Math.max(44, house.h - 8),
      type: "house"
    };
    const leftShrub = { x: house.x + 2, y: house.y + house.h - 24, w: 34, h: 30, type: "yard" };
    const rightShrub = { x: house.x + house.w - 36, y: house.y + house.h - 24, w: 34, h: 30, type: "yard" };
    return [roof, body, leftShrub, rightShrub];
  }

  function makeCar(spawn, color, speed, id) {
    const car = {
      id,
      x: spawn.entry.x,
      y: spawn.entry.y,
      cx: spawn.entry.x,
      cy: spawn.entry.y,
      w: 92,
      h: 48,
      dx: spawn.startDx,
      dy: spawn.startDy,
      color,
      speed,
      heading: Math.atan2(spawn.startDy, spawn.startDx),
      lane: spawn.lane,
      route: spawn.route,
      routeLength: spawn.routeLength,
      progress: 0,
      entry: spawn.entry,
      exit: spawn.exit,
      intersections: spawn.intersections,
      hornCooldown: rand(1.5, 4),
      waiting: false,
      waitTimer: 0,
      done: false
    };
    syncCarBounds(car);
    return car;
  }

  function carRectAt(car, x = car.x, y = car.y, pad = 0) {
    return { x: x - pad, y: y - pad, w: car.w + pad * 2, h: car.h + pad * 2 };
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function carSizeForHeading(heading) {
    const c = Math.abs(Math.cos(heading));
    const s = Math.abs(Math.sin(heading));
    return {
      w: 92 * c + 48 * s,
      h: 92 * s + 48 * c
    };
  }

  function carRectFromCenter(cx, cy, heading, pad = 0) {
    const size = carSizeForHeading(heading);
    return {
      x: cx - size.w / 2 - pad,
      y: cy - size.h / 2 - pad,
      w: size.w + pad * 2,
      h: size.h + pad * 2
    };
  }

  function syncCarBounds(car) {
    const size = carSizeForHeading(car.heading);
    car.w = size.w;
    car.h = size.h;
    car.x = car.cx - car.w / 2;
    car.y = car.cy - car.h / 2;
  }

  function buildSmoothRoute(points, radius = 74) {
    const samples = [];
    const addSample = (x, y) => {
      const previous = samples[samples.length - 1];
      if (!previous || Math.hypot(previous.x - x, previous.y - y) > .5) samples.push({ x, y });
    };

    addSample(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const previous = points[i - 1];
      const corner = points[i];
      const next = points[i + 1];
      const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
      const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
      const curveRadius = Math.min(radius, inLength * .42, outLength * .42);

      if (curveRadius < 8) {
        addSample(corner.x, corner.y);
        continue;
      }

      const inDx = (corner.x - previous.x) / inLength;
      const inDy = (corner.y - previous.y) / inLength;
      const outDx = (next.x - corner.x) / outLength;
      const outDy = (next.y - corner.y) / outLength;
      const start = { x: corner.x - inDx * curveRadius, y: corner.y - inDy * curveRadius };
      const end = { x: corner.x + outDx * curveRadius, y: corner.y + outDy * curveRadius };

      addSample(start.x, start.y);
      for (let step = 1; step <= 14; step++) {
        const t = step / 14;
        const inv = 1 - t;
        addSample(
          inv * inv * start.x + 2 * inv * t * corner.x + t * t * end.x,
          inv * inv * start.y + 2 * inv * t * corner.y + t * t * end.y
        );
      }
    }
    addSample(points[points.length - 1].x, points[points.length - 1].y);
    return samples;
  }

  function routeLength(route) {
    let length = 0;
    for (let i = 1; i < route.length; i++) {
      length += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    }
    return length;
  }

  function routePointAt(route, distance) {
    let remaining = distance;
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1];
      const to = route[i];
      const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      if (remaining <= length) {
        const t = remaining / length;
        return {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          dx: (to.x - from.x) / length,
          dy: (to.y - from.y) / length
        };
      }
      remaining -= length;
    }
    const last = route[route.length - 1];
    const prev = route[route.length - 2] || last;
    const length = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
    return { x: last.x, y: last.y, dx: (last.x - prev.x) / length, dy: (last.y - prev.y) / length };
  }

  function computeConflictOffsets(route, intersection) {
    const length = routeLength(route);
    let enter = null;
    let exit = null;
    for (let distance = 0; distance <= length; distance += 5) {
      const point = routePointAt(route, distance);
      const hitbox = carRectFromCenter(point.x, point.y, Math.atan2(point.dy, point.dx), 34);
      if (rectsOverlap(hitbox, intersection)) {
        if (enter === null) enter = distance;
        exit = distance;
      }
    }
    if (enter === null) return { enter: 0, exit: 0 };
    return { enter, exit: Math.min(length, exit + 24) };
  }

  function updateCarDirection(car, dt = 1 / 60) {
    const point = routePointAt(car.route, car.progress);
    car.cx = point.x;
    car.cy = point.y;
    car.dx = point.dx;
    car.dy = point.dy;
    const targetHeading = Math.atan2(point.dy, point.dx);
    const turnSpeed = 8.5;
    car.heading += normalizeAngle(targetHeading - car.heading) * Math.min(1, turnSpeed * dt);
    syncCarBounds(car);
  }

  function advanceCar(car, distance, dt) {
    car.progress += distance;
    if (car.progress >= car.routeLength) {
      car.done = true;
      car.progress = car.routeLength;
    }
    updateCarDirection(car, dt);
  }

  function sameTrafficLane(a, b) {
    if (!a.lane || !b.lane || a.lane.axis !== b.lane.axis || a.lane.road !== b.lane.road) return false;
    if (a.dx !== b.dx || a.dy !== b.dy) return false;
    return a.lane.axis === "x"
      ? Math.abs(a.y - b.y) < 12
      : Math.abs(a.x - b.x) < 12;
  }

  function getTrafficProgress(car) {
    return car.progress;
  }

  function createIntersections(roads) {
    const horizontal = roads.find(road => road.axis === "x");
    const vertical = roads.find(road => road.axis === "y");
    if (!horizontal || !vertical) return [];
    return [{
      x: vertical.x - 18,
      y: horizontal.y - 18,
      w: vertical.w + 36,
      h: horizontal.h + 36
    }];
  }

  function trafficSpawnRect(spawn, pad = 0) {
    return carRectFromCenter(spawn.entry.x, spawn.entry.y, spawn.startHeading, pad);
  }

  function canSpawnTraffic(spawn) {
    const entry = trafficSpawnRect(spawn, 70);
    return !world.cars.some(car => {
      if (car.lane?.startKey !== spawn.startKey) return rectsOverlap(carRectAt(car, car.x, car.y, 12), entry);
      const gap = Math.abs(getTrafficProgress(car));
      return gap < 250 || rectsOverlap(carRectAt(car, car.x, car.y, 16), entry);
    });
  }

  function getIntersectionWindow(spawn) {
    return {
      enter: world.trafficClock + spawn.conflict.enter / spawn.speed,
      exit: world.trafficClock + spawn.conflict.exit / spawn.speed
    };
  }

  function trafficWindowsOverlap(a, b) {
    return a.enter < b.exit + .18 && b.enter < a.exit + .18;
  }

  function canReserveTrafficSlot(spawn) {
    if (!spawn.conflict) return true;
    const window = getIntersectionWindow(spawn);
    return !world.trafficReservations.some(slot => trafficWindowsOverlap(slot, window));
  }

  function reserveTrafficSlot(spawn) {
    if (!spawn.conflict) return;
    const window = getIntersectionWindow(spawn);
    world.trafficReservations.push({
      route: spawn.name,
      enter: window.enter,
      exit: window.exit
    });
  }

  function cleanupTrafficReservations() {
    world.trafficReservations = world.trafficReservations.filter(slot =>
      slot.exit > world.trafficClock - .35
    );
  }

  function spawnTrafficCar(spawn) {
    const id = `level-${activeLevel}-traffic-${spawn.name}-${spawn.sequence++}`;
    reserveTrafficSlot(spawn);
    world.cars.push(makeCar(spawn, spawn.color, spawn.speed, id));
  }

  function updateTrafficSpawns(dt) {
    if (!world.trafficSpawns?.length) return;
    cleanupTrafficReservations();
    for (const spawn of world.trafficSpawns) {
      spawn.timer -= dt;
      if (spawn.timer > 0) continue;
      if (canSpawnTraffic(spawn) && canReserveTrafficSlot(spawn)) {
        spawnTrafficCar(spawn);
        spawn.timer = spawn.interval;
      } else {
        spawn.timer = .18;
      }
    }
  }

  function createTraffic(roads, levelIndex, intersections) {
    const colors = ["#e75245", "#477ec2", "#f2b640", "#7b55b7", "#48a56a", "#e57a3c", "#40a9a8"];
    const multiplier = levelIndex === 0 ? 1 : levelIndex === 1 ? 1.08 : 1.28;
    const horizontal = roads.find(road => road.axis === "x");
    const vertical = roads.find(road => road.axis === "y");
    if (!horizontal || !vertical) return { cars: [], spawns: [] };

    const laneGapX = horizontal.h / 4;
    const laneGapY = vertical.w / 4;
    const intersectionIds = intersections.map((_, index) => index);
    const baseSpeed = LEVELS[levelIndex].traffic * multiplier;
    const westEastY = horizontal.y + laneGapX * 3;
    const eastWestY = horizontal.y + laneGapX;
    const northSouthX = vertical.x + laneGapY;
    const southNorthX = vertical.x + laneGapY * 3;
    const topVerticalY = vertical.y + 46;
    const west = { x: -92, y: westEastY };
    const east = { x: W + 92, y: eastWestY };
    const north = { x: northSouthX, y: topVerticalY };
    const south = { x: southNorthX, y: H + 92 };
    const laneSpecs = [
      {
        name: "west-east",
        waypoints: [west, { x: W + 92, y: westEastY }],
        speed: baseSpeed * .86,
        interval: 4.4,
        delay: .25
      },
      {
        name: "east-west",
        waypoints: [east, { x: -92, y: eastWestY }],
        speed: baseSpeed * .86,
        interval: 4.55,
        delay: 1.35
      },
      {
        name: "north-south",
        waypoints: [north, { x: northSouthX, y: H + 92 }],
        speed: baseSpeed * .8,
        interval: 4.75,
        delay: 2.35
      },
      {
        name: "south-north",
        waypoints: [south, { x: southNorthX, y: topVerticalY }],
        speed: baseSpeed * .8,
        interval: 4.95,
        delay: 3.25
      },
      {
        name: "west-north",
        waypoints: [west, { x: southNorthX, y: westEastY }, { x: southNorthX, y: topVerticalY }],
        speed: baseSpeed * .78,
        interval: 6.2,
        delay: 4.35
      },
      {
        name: "north-east",
        waypoints: [north, { x: northSouthX, y: westEastY }, { x: W + 92, y: westEastY }],
        speed: baseSpeed * .78,
        interval: 6.5,
        delay: 5.35
      },
      {
        name: "east-south",
        waypoints: [east, { x: northSouthX, y: eastWestY }, { x: northSouthX, y: H + 92 }],
        speed: baseSpeed * .78,
        interval: 6.35,
        delay: 6.35
      },
      {
        name: "south-west",
        waypoints: [south, { x: southNorthX, y: eastWestY }, { x: -92, y: eastWestY }],
        speed: baseSpeed * .78,
        interval: 6.7,
        delay: 7.35
      }
    ];

    const spawns = laneSpecs.map((spec, index) => {
      const route = buildSmoothRoute(spec.waypoints);
      const first = route[0];
      const second = route[1];
      const length = Math.hypot(second.x - first.x, second.y - first.y) || 1;
      const axis = Math.abs(second.x - first.x) > Math.abs(second.y - first.y) ? "x" : "y";
      const startKey = `${Math.round(first.x)}:${Math.round(first.y)}:${Math.round((second.x - first.x) / length)}:${Math.round((second.y - first.y) / length)}`;
      const lane = { axis, road: axis === "x" ? horizontal : vertical, name: spec.name, startKey };
      const routeTotal = routeLength(route);
      return {
        ...spec,
        axis,
        startDx: (second.x - first.x) / length,
        startDy: (second.y - first.y) / length,
        startHeading: Math.atan2(second.y - first.y, second.x - first.x),
        startKey,
        lane,
        route,
        entry: route[0],
        exit: route[route.length - 1],
        routeLength: routeTotal,
        conflict: intersections[0] ? computeConflictOffsets(route, intersections[0]) : null,
        intersections: intersectionIds,
        timer: spec.delay,
        color: colors[index % colors.length],
        colorIndex: index,
        sequence: 0
      };
    });

    return { cars: [], spawns };
  }

  function createCrosswalks(roads) {
    const horizontal = roads.find(road => road.axis === "x");
    const vertical = roads.find(road => road.axis === "y");
    if (!horizontal || !vertical) return [];
    return [
      { x: vertical.x, y: horizontal.y - 10, w: vertical.w, h: 14, horizontal: true },
      { x: vertical.x - 13, y: horizontal.y + horizontal.h, w: 14, h: 78, horizontal: false }
    ];
  }

  function makeCat(x, y, range, axis) {
    return {
      x, y, baseX: x, baseY: y, range, axis,
      dir: Math.random() > .5 ? 1 : -1,
      speed: rand(32, 48),
      phase: rand(0, 6.2)
    };
  }

  function makeCyclist(x, y, axis, min, max, speed, color) {
    return {
      x, y, axis, min, max, speed, color,
      dir: Math.random() > .5 ? 1 : -1,
      phase: rand(0, Math.PI * 2)
    };
  }

  function beginLevel(index) {
    clearTimeout(autoAdvanceTimer);
    activeLevel = index;
    levelData = LEVELS[index];
    world = buildWorld(index);
    player = {
      x: levelData.start.x,
      y: levelData.start.y,
      r: 20,
      speed: 215 + getUpgrades().speed * 25,
      facing: "right",
      moving: false,
      bump: 0,
      celebrate: 0,
      trailTimer: 0
    };
    placePlayerSafely();
    rival = createRival(index);
    stormTimer = levelData.mode === "stormRace" ? 3.8 : 0;
    timeLeft = levelData.duration;
    delivered = 0;
    score = loadCampaignScore();
    hearts = maxHearts();
    pizzasCarried = maxPizzas();
    currentTarget = 0;
    invulnerable = 0;
    actionCooldown = 0;
    deliveryCombo = 0;
    lastDeliveryAt = 0;
    restoreLevelProgress(index);
    particles.length = 0;
    floatTexts.length = 0;
    state = "playing";
    levelIntroTimer = 2.2;
    showOnly(null);
    el.hud.classList.remove("hidden");
    el.pauseBtn.classList.remove("hidden");
    updateHud();
    showToast(index === 1
      ? "Parque Central: recoge los pedidos de picnic"
      : `Nivel ${index + 1}: ${levelData.name}`);
    sound("click");
  }

  function createRival(index) {
    if (LEVELS[index].mode === "solo") return null;
    return {
      x: W - 118,
      y: LEVELS[index].theme === "park" ? 585 : 360,
      r: 18,
      speed: index === 2 ? 178 : 158,
      target: 1,
      delivered: 0,
      wait: .7,
      color: index === 2 ? "#65d9ff" : "#7d4ab5",
      facing: "left",
      moving: false,
      dash: 0
    };
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      el.pause.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      el.pause.classList.add("hidden");
    }
  }

  function movePlayer(dx, dy) {
    resolvePlayerObstacles();
    const previousX = player.x;
    const previousY = player.y;
    player.x = clamp(player.x + dx, player.r + 8, W - player.r - 8);
    resolvePlayerObstacles();

    const movedX = Math.abs(player.x - previousX) > .01;
    player.y = clamp(player.y + dy, player.r + 62, H - player.r - 8);
    resolvePlayerObstacles();

    if (!movedX && Math.abs(dx) > .01 && Math.abs(dy) < .01 && Math.abs(player.y - previousY) < .01) {
      player.y = clamp(previousY + Math.sign(dx) * 7, player.r + 62, H - player.r - 8);
      resolvePlayerObstacles();
    }
  }

  function keepPlayerSafe() {
    player.x = clamp(player.x, player.r + 8, W - player.r - 8);
    player.y = clamp(player.y, player.r + 62, H - player.r - 8);
    for (let i = 0; i < 10; i++) {
      const obstacle = world.obstacles.find(o => circleObstacleCollision(player, o));
      if (!obstacle) return;
      const point = closestPointOnObstacle(player, obstacle);
      const cx = point.x;
      const cy = point.y;
      const angle = Math.atan2(player.y - cy, player.x - cx) || -Math.PI / 2;
      player.x += Math.cos(angle) * 8;
      player.y += Math.sin(angle) * 8;
      player.x = clamp(player.x, player.r + 8, W - player.r - 8);
      player.y = clamp(player.y, player.r + 62, H - player.r - 8);
    }
  }

  function resolvePlayerObstacles() {
    resolveCircleObstacles(player, 6);
  }

  function resolveCircleObstacles(circle, iterations) {
    for (let i = 0; i < iterations; i++) {
      const obstacle = world.obstacles.find(o => circleObstacleCollision(circle, o));
      if (!obstacle) return;
      const closest = closestPointOnObstacle(circle, obstacle);
      const closestX = closest.x;
      const closestY = closest.y;
      let dx = circle.x - closestX;
      let dy = circle.y - closestY;
      let length = Math.hypot(dx, dy);
      const insidePolygon = obstacle.points && pointInPolygon(circle.x, circle.y, obstacle.points);
      if (insidePolygon) {
        const center = obstacle.points.reduce((sum, point) => ({
          x: sum.x + point.x / obstacle.points.length,
          y: sum.y + point.y / obstacle.points.length
        }), { x: 0, y: 0 });
        dx = circle.x - center.x;
        dy = circle.y - center.y;
        length = Math.hypot(dx, dy);
      }
      if (length < .001) {
        const left = Math.abs(circle.x - obstacle.x);
        const right = Math.abs(obstacle.x + obstacle.w - circle.x);
        const top = Math.abs(circle.y - obstacle.y);
        const bottom = Math.abs(obstacle.y + obstacle.h - circle.y);
        const min = Math.min(left, right, top, bottom);
        dx = min === left ? -1 : min === right ? 1 : 0;
        dy = min === top ? -1 : min === bottom ? 1 : 0;
        length = 1;
      }
      const edgeDistance = Math.hypot(circle.x - closestX, circle.y - closestY);
      const overlap = insidePolygon
        ? circle.r + edgeDistance + 1.5
        : Math.max(0, circle.r - length + 1.5);
      circle.x = clamp(circle.x + (dx / length) * overlap, circle.r + 8, W - circle.r - 8);
      circle.y = clamp(circle.y + (dy / length) * overlap, circle.r + 62, H - circle.r - 8);
    }
  }

  function placePlayerSafely() {
    if (!world.obstacles.some(o => circleObstacleCollision(player, o))) return;
    const roadCenters = world.roads.flatMap(road => road.axis === "x"
      ? [
          { x: 132, y: road.y + road.h / 2 },
          { x: W - 132, y: road.y + road.h / 2 },
          { x: W / 2, y: road.y + road.h / 2 }
        ]
      : [
          { x: road.x + road.w / 2, y: 104 },
          { x: road.x + road.w / 2, y: H - 104 },
          { x: road.x + road.w / 2, y: H / 2 }
        ]
    );
    const safe = roadCenters.find(point => !world.obstacles.some(o => circleObstacleCollision({ ...point, r: player.r }, o)));
    if (safe) {
      player.x = safe.x;
      player.y = safe.y;
    }
  }

  function update(dt) {
    animationClock += dt;
    rainOffset += dt * 280;
    ambientTick += dt;

    if (state !== "playing") {
      updateDecorations(dt);
      updateParticles(dt);
      updateFloatTexts(dt);
      return;
    }

    if (!levelObjectiveComplete()) timeLeft -= dt;
    levelIntroTimer = Math.max(0, levelIntroTimer - dt);
    invulnerable = Math.max(0, invulnerable - dt);
    actionCooldown = Math.max(0, actionCooldown - dt);
    player.bump = Math.max(0, player.bump - dt * 4);
    player.celebrate = Math.max(0, player.celebrate - dt * 3);
    screenShake = Math.max(0, screenShake - dt * 3);

    let xAxis = 0;
    let yAxis = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) xAxis -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) xAxis += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) yAxis -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) yAxis += 1;

    const magnitude = Math.hypot(xAxis, yAxis) || 1;
    xAxis /= magnitude;
    yAxis /= magnitude;
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    let speed = player.speed * (sprinting ? 1.35 : 1);

    const inPuddle = world.puddles.some(p =>
      ((player.x - p.x) ** 2) / (p.rx ** 2) + ((player.y - p.y) ** 2) / (p.ry ** 2) < 1
    );
    if (inPuddle) speed *= .58;

    player.moving = Math.abs(xAxis) + Math.abs(yAxis) > 0;
    if (xAxis < 0) player.facing = "left";
    if (xAxis > 0) player.facing = "right";
    if (yAxis < 0 && Math.abs(yAxis) > Math.abs(xAxis)) player.facing = "up";
    if (yAxis > 0 && Math.abs(yAxis) > Math.abs(xAxis)) player.facing = "down";

    movePlayer(xAxis * speed * dt, yAxis * speed * dt);
    if (tryExitLevel()) return;
    if (player.moving && sprinting) {
      player.trailTimer -= dt;
      if (player.trailTimer <= 0) {
        player.trailTimer = .08;
        particles.push({
          x: player.x - xAxis * 18,
          y: player.y + 20 - yAxis * 8,
          vx: -xAxis * 28 + rand(-18, 18),
          vy: -yAxis * 20 + rand(-10, 12),
          life: .34,
          maxLife: .34,
          size: rand(3, 6),
          color: isOnRoad(player.x, player.y, 4) ? "rgba(220,205,176,.8)" : "rgba(120,91,54,.5)",
          gravity: 12
        });
      }
    }

    updateCars(dt);
    updateCats(dt);
    updateCyclists(dt);
    updateCoins();
    updatePicnicOrders();
    updatePizzeriaRefill();
    updateRival(dt);
    updateLightning(dt);
    updateParticles(dt);
    updateFloatTexts(dt);

    if ((timeLeft <= 0 && !levelObjectiveComplete()) || hearts <= 0) {
      finishLevel(false);
    }

    updateHud();
  }

  function updateDecorations(dt) {
    if (!world) return;
    world.trees.forEach(tree => tree.phase += dt * .5);
    world.cats.forEach(cat => cat.phase += dt);
  }

  function updateCars(dt) {
    world.trafficClock += dt;
    updateTrafficSpawns(dt);
    for (const car of world.cars) {
      advanceCar(car, car.speed * dt, dt);
      car.waiting = false;
      car.waitTimer = 0;
      car.hornCooldown -= dt;
    }

    world.cars = world.cars.filter(car => !car.done);

    for (const car of world.cars) {
      const hitbox = getCarHitbox(car);
      if (invulnerable <= 0 && circleRectCollision(player, hitbox)) {
        hitPlayer(car);
      }
    }
  }

  function getCarHitbox(car, x = car.x, y = car.y, pad = 0) {
    return { x: x + 7 - pad, y: y + 7 - pad, w: car.w - 14 + pad * 2, h: car.h - 14 + pad * 2 };
  }

  function updateCats(dt) {
    for (const cat of world.cats) {
      if (cat.axis === "x") {
        cat.x += cat.dir * cat.speed * dt;
        if (Math.abs(cat.x - cat.baseX) > cat.range) cat.dir *= -1;
      } else {
        cat.y += cat.dir * cat.speed * dt;
        if (Math.abs(cat.y - cat.baseY) > cat.range) cat.dir *= -1;
      }
      cat.phase += dt * 6;

      if (invulnerable <= 0 && Math.hypot(player.x - cat.x, player.y - cat.y) < player.r + 13) {
        player.bump = 1;
        invulnerable = .65;
        timeLeft = Math.max(0, timeLeft - 1.5);
        spawnText(player.x, player.y - 28, "¡Miau!", "#5b3140");
        burst(player.x, player.y, "#f5c071", 7);
      }
    }
  }

  function updateCyclists(dt) {
    for (const cyclist of world.cyclists) {
      if (cyclist.axis === "x") {
        cyclist.x += cyclist.dir * cyclist.speed * dt;
        if (cyclist.x < cyclist.min || cyclist.x > cyclist.max) {
          cyclist.x = clamp(cyclist.x, cyclist.min, cyclist.max);
          cyclist.dir *= -1;
        }
      } else {
        cyclist.y += cyclist.dir * cyclist.speed * dt;
        if (cyclist.y < cyclist.min || cyclist.y > cyclist.max) {
          cyclist.y = clamp(cyclist.y, cyclist.min, cyclist.max);
          cyclist.dir *= -1;
        }
      }
      cyclist.phase += dt * 8;

      if (invulnerable <= 0 && Math.hypot(player.x - cyclist.x, player.y - cyclist.y) < player.r + 17) {
        invulnerable = .7;
        player.bump = 1;
        timeLeft = Math.max(0, timeLeft - 2);
        burst(player.x, player.y, "#d8eff7", 8);
        spawnText(player.x, player.y - 30, "-2 s", "#347db7");
        showToast("¡Un ciclista te retrasó!");
        sound("crash");
      }
    }
  }

  function hitPlayer(car) {
    hearts -= 1;
    timeLeft = Math.max(0, timeLeft - 4);
    invulnerable = 1.25;
    player.bump = 1;
    screenShake = 1;
    player.x = clamp(player.x - car.dx * 65, 30, W - 30);
    player.y = clamp(player.y - car.dy * 65, 80, H - 30);
    keepPlayerSafe();
    burst(player.x, player.y, "#ffdf77", 16);
    burst(player.x, player.y, "#ef5a43", 10);
    spawnText(player.x, player.y - 34, "-4 s", "#ef4038");
    showToast("¡Cuidado con el tráfico!");
    sound("crash");
  }

  function updateCoins() {
    for (const coin of world.coins) {
      if (!coin.taken && Math.hypot(player.x - coin.x, player.y - coin.y) < player.r + 15) {
        coin.taken = true;
        score += 50;
        saveCampaignScore();
        burst(coin.x, coin.y, "#ffd15b", 12);
        spawnText(coin.x, coin.y - 28, "+50", "#f2a82f");
        sound("coin");
      }
    }
  }

  function updatePicnicOrders() {
    let collectedAny = false;
    for (const order of world.picnicOrders) {
      if (!order.collected && Math.hypot(player.x - order.x, player.y - order.y) < player.r + 18) {
        order.collected = true;
        collectedAny = true;
        score += 75;
        saveCampaignScore();
        burst(order.x, order.y, "#f3c45b", 14);
        spawnText(order.x, order.y - 30, "PEDIDO +75", "#3e9b5f");
        showToast("Pedido de picnic recogido");
        sound("coin");
      }
    }

    if (collectedAny && levelObjectiveComplete()) {
      showToast("Objetivo listo. Sal por la derecha");
    }
  }

  function hasPendingPicnicOrders() {
    return world.picnicOrders.some(order => !order.collected);
  }

  function levelObjectiveComplete() {
    return delivered >= levelData.required && !hasPendingPicnicOrders();
  }

  function tryExitLevel() {
    const entryRoad = world.roads.some(road =>
      road.axis === "x" &&
      player.x <= player.r + 10 &&
      player.y > road.y + 18 &&
      player.y < road.y + road.h - 18
    );
    if (entryRoad) {
      const previousUrl = LEVEL_URLS[activeLevel - 1];
      if (previousUrl) {
        state = "transitioning";
        showToast(`Volviendo al nivel ${activeLevel}`);
        const targetUrl = activeLevel === 1
          ? `${previousUrl}?shop=1&return=${encodeURIComponent(LEVEL_URLS[activeLevel])}`
          : previousUrl;
        setTimeout(() => { travelTo(targetUrl); }, 650);
        return true;
      }
    }

    if (!levelObjectiveComplete()) return false;
    const exitRoad = world.roads.some(road =>
      road.axis === "x" &&
      player.x >= W - player.r - 10 &&
      player.y > road.y + 18 &&
      player.y < road.y + road.h - 18
    );
    if (!exitRoad) return false;

    const nextUrl = LEVEL_URLS[activeLevel + 1];
    if (nextUrl) {
      state = "transitioning";
      showToast(`Nivel ${activeLevel + 2}: en camino`);
      setTimeout(() => { travelTo(nextUrl); }, 650);
    } else {
      saveLevelProgress();
      saveCampaignScore();
      finishLevel(true);
    }
    return true;
  }

  function updatePizzeriaRefill() {
    if (pizzasCarried >= maxPizzas()) return;
    const nearPizzeria = Math.hypot(player.x - PIZZERIA.refillX, player.y - PIZZERIA.refillY) < PIZZERIA.radius;
    if (!nearPizzeria) return;
    pizzasCarried = maxPizzas();
    burst(PIZZERIA.refillX, PIZZERIA.refillY, "#ffd25d", 18);
    spawnText(PIZZERIA.refillX, PIZZERIA.refillY - 38, `RECARGA x${maxPizzas()}`, "#f2a82f");
    showToast(`Mochila recargada: ${maxPizzas()} pizzas`);
    sound("coin");
    updateHud();
  }

  function updateRival(dt) {
    if (!rival || state !== "playing") return;
    rival.wait = Math.max(0, rival.wait - dt);
    rival.dash = Math.max(0, rival.dash - dt * 2);
    if (rival.wait > 0) {
      rival.moving = false;
      return;
    }

    const house = world.houses[rival.target % world.houses.length];
    const target = { x: house.doorX, y: house.doorY };
    const dx = target.x - rival.x;
    const dy = target.y - rival.y;
    const d = Math.hypot(dx, dy) || 1;
    rival.moving = d > 7;
    rival.facing = dx < 0 ? "left" : "right";
    const speedBoost = levelData.mode === "stormRace" && timeLeft < levelData.duration * .55 ? 1.14 : 1;
    rival.x += (dx / d) * rival.speed * speedBoost * dt;
    rival.y += (dy / d) * rival.speed * speedBoost * dt;
    resolveCircleObstacles(rival, 4);

    if (d < 42) {
      rival.delivered += 1;
      rival.wait = levelData.mode === "stormRace" ? .65 : .9;
      rival.dash = 1;
      burst(target.x, target.y, rival.color, 12);
      spawnText(target.x, target.y - 30, "RIVAL +1", rival.color);
      rival.target = findNextTarget(rival.target + 1);
      if (rival.delivered >= levelData.required && !levelObjectiveComplete()) {
        showToast("El rival entregó primero");
        setTimeout(() => finishLevel(false), 450);
      }
    }
  }

  function updateLightning(dt) {
    if (levelData.mode !== "stormRace") return;
    stormTimer -= dt;
    if (stormTimer <= 0 && player) {
      stormTimer = rand(3.1, 4.8);
      world.lightning.push({
        x: player.x + rand(-42, 42),
        y: player.y + rand(-36, 36),
        r: 28,
        life: 1.15,
        strikeAt: .42,
        hit: false
      });
      showToast("¡Rayo acercándose!");
    }

    for (let i = world.lightning.length - 1; i >= 0; i--) {
      const bolt = world.lightning[i];
      bolt.life -= dt;
      if (!bolt.hit && bolt.life <= bolt.strikeAt) {
        bolt.hit = true;
        screenShake = Math.max(screenShake, .75);
        burst(bolt.x, bolt.y, "#d6f3ff", 18);
        burst(bolt.x, bolt.y, "#ffe77d", 10);
        if (invulnerable <= 0 && Math.hypot(player.x - bolt.x, player.y - bolt.y) < player.r + bolt.r) {
          hearts -= 1;
          timeLeft = Math.max(0, timeLeft - 3);
          invulnerable = 1.1;
          player.bump = 1;
          spawnText(player.x, player.y - 34, "-3 s", "#65d9ff");
          sound("crash");
        }
      }
      if (bolt.life <= 0) world.lightning.splice(i, 1);
    }
  }

  function attemptDelivery() {
    if (state !== "playing" || actionCooldown > 0 || delivered >= levelData.required) return;
    const house = world.houses[currentTarget];
    const target = { x: house.doorX, y: house.doorY };
    const near = Math.hypot(player.x - target.x, player.y - target.y) < 74;

    actionCooldown = .35;

    if (pizzasCarried <= 0) {
      showToast("Sin pizzas. Vuelve a la pizzería");
      sound("click");
      return;
    }

    if (!near) {
      showToast("Acércate a la puerta marcada");
      sound("click");
      return;
    }

    const fastDelivery = lastDeliveryAt > 0 && (levelData.duration - timeLeft) - lastDeliveryAt < 18;
    deliveryCombo = fastDelivery ? Math.min(deliveryCombo + 1, 5) : 1;
    lastDeliveryAt = levelData.duration - timeLeft;

    delivered += 1;
    pizzasCarried -= 1;
    const comboBonus = deliveryCombo > 1 ? deliveryCombo * 35 : 0;
    score += 200 + comboBonus + Math.ceil(timeLeft * 2);
    saveCampaignScore();
    player.celebrate = 1;
    burst(target.x, target.y, "#ffd25d", 28);
    burst(target.x, target.y, "#65b86f", 16);
    spawnText(target.x, target.y - 48, comboBonus ? `¡COMBO x${deliveryCombo}!` : "¡ENTREGADA!", "#27874d");
    showToast(comboBonus ? `¡Pizza entregada! Combo +${comboBonus}` : "¡Pizza entregada! +200");
    sound("deliver");

    if (delivered >= levelData.required) {
      if (hasPendingPicnicOrders()) {
        showToast("Completa los pedidos de picnic para terminar");
        updateHud();
        return;
      }
      showToast("Objetivo listo. Sal por la derecha");
      updateHud();
      return;
    }

    currentTarget = findNextTarget(currentTarget);
    updateHud();
  }

  function findNextTarget(from) {
    const max = world.houses.length;
    let next = (from + 1) % max;
    const preferred = [0, 3, 5, 7, 2, 6, 1, 4];
    const candidate = preferred[delivered % preferred.length];
    if (candidate < max) next = candidate;
    return next;
  }

  function finishLevel(won) {
    if (state !== "playing") return;
    state = won ? "won" : "lost";
    el.hud.classList.add("hidden");
    el.pauseBtn.classList.add("hidden");
    el.result.classList.remove("hidden");

    const used = levelData.duration - Math.max(0, timeLeft);
    const stars = won
      ? (hearts === maxHearts() && timeLeft > levelData.duration * .35 ? 3 : hearts >= 2 ? 2 : 1)
      : 0;

    if (won) {
      saveLevelProgress();
      saveCampaignScore();
      const previous = Number(localStorage.getItem(`pizzaDashStars${activeLevel}`) || 0);
      localStorage.setItem(`pizzaDashStars${activeLevel}`, String(Math.max(previous, stars)));
      el.resultIcon.textContent = "🏆";
      el.resultEyebrow.textContent = "MISIÓN COMPLETA";
      const hasNextLevel = activeLevel < LEVELS.length - 1;
      el.resultTitle.textContent = hasNextLevel ? "¡Ruta completada!" : (stars === 3 ? "¡Entrega perfecta!" : "¡Buen trabajo!");
      el.resultMessage.textContent = hasNextLevel
        ? `Siguiente parada: ${LEVELS[activeLevel + 1].name}`
        : `${levelData.name} ya tiene la cena lista.`;
      el.resultStars.textContent = `${"★ ".repeat(stars)}${"☆ ".repeat(3 - stars)}`.trim();
      el.nextBtn.classList.add("hidden");
      el.retryBtn.classList.toggle("hidden", hasNextLevel);
      el.resultMenuBtn.classList.toggle("hidden", hasNextLevel);
      if (hasNextLevel) {
        showToast(`¡Nivel ${activeLevel + 1} listo! Avanzando...`);
        autoAdvanceTimer = setTimeout(() => {
          const nextUrl = LEVEL_URLS[activeLevel + 1];
          if (nextUrl) {
            travelTo(nextUrl);
            return;
          }
          beginLevel(activeLevel + 1);
        }, 1450);
      }
      sound("win");
    } else {
      el.resultIcon.textContent = "🍕";
      el.resultEyebrow.textContent = "SE ENFRIÓ LA PIZZA";
      el.resultTitle.textContent = hearts <= 0 ? "¡Demasiados choques!" : "Se acabó el tiempo";
      el.resultMessage.textContent = "Inténtalo otra vez: ya conoces mejor la ruta.";
      el.resultStars.textContent = "☆ ☆ ☆";
      el.nextBtn.classList.add("hidden");
      el.retryBtn.classList.remove("hidden");
      el.resultMenuBtn.classList.remove("hidden");
      sound("lose");
    }

    el.resultTime.textContent = formatTime(used);
    el.resultScore.textContent = String(score);
    el.resultDeliveries.textContent = `${delivered}/${levelData.required}`;
  }

  function updateHud() {
    el.hudLevel.textContent = String(activeLevel + 1);
    el.hudTime.textContent = formatTime(timeLeft);
    const picnicProgress = world.picnicOrders.length
      ? ` · 🧺 ${world.picnicOrders.filter(order => order.collected).length}/${world.picnicOrders.length}`
      : "";
    el.hudDeliveries.textContent = `${pizzasCarried}/${maxPizzas()} · ${delivered}/${levelData.required}${picnicProgress}`;
    el.hudScore.textContent = String(score);
    el.hudHearts.textContent = `${"♥ ".repeat(hearts)}${"♡ ".repeat(Math.max(0, maxHearts() - hearts))}`.trim();
    el.missionText.textContent = hasPendingPicnicOrders()
      ? `Misión: recoge pedidos de picnic (${world.picnicOrders.filter(order => order.collected).length}/${world.picnicOrders.length})`
      : delivered >= levelData.required
        ? "Objetivo listo: sal por la orilla derecha"
      : pizzasCarried <= 0
        ? "Vuelve a la pizzería para recargar"
      : rival
        ? `Carrera: tú ${delivered}/${levelData.required} · rival ${rival.delivered}/${levelData.required}`
        : "Entrega en la casa marcada";
    el.missionProgress.style.width = `${(delivered / levelData.required) * 100}%`;
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 1700);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(35, 150);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: rand(.35, .8),
        maxLife: 1,
        size: rand(3, 8),
        color,
        gravity: rand(80, 180)
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function spawnText(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 1.1 });
  }

  function updateFloatTexts(dt) {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const item = floatTexts[i];
      item.life -= dt;
      item.y -= 34 * dt;
      if (item.life <= 0) floatTexts.splice(i, 1);
    }
  }

  function draw() {
    ctx.save();
    const shakeAmount = screenShake > 0 ? 7 * screenShake : 0;
    ctx.translate(rand(-shakeAmount, shakeAmount), rand(-shakeAmount, shakeAmount));

    drawBackground();
    if (world) {
      drawRoads();
      drawTerrainDetails();
      drawPuddles();
      drawHouses();
      drawTrees();
      drawBenches();
      drawCoins();
      drawPicnicOrders();
      drawTarget();
      drawLightning();
      drawCats();
      drawCyclists();
      drawCars();
    }
    if (rival) drawRival();
    if (player) drawPlayer();
    drawParticles();
    drawFloatTexts();
    if (levelData.theme === "night") drawNightOverlay();

    ctx.restore();
    drawLevelBanner();
  }

  function drawLevelBanner() {
    if (state !== "playing" || levelIntroTimer <= 0) return;
    const alpha = clamp(levelIntroTimer / .8, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    fillRoundedRect(ctx, W / 2 - 250, 102, 500, 86, 22, "rgba(36,22,47,.88)");
    ctx.strokeStyle = "rgba(255,216,95,.8)";
    ctx.lineWidth = 3;
    roundedRectPath(ctx, W / 2 - 250, 102, 500, 86, 22);
    ctx.stroke();
    ctx.fillStyle = "#ffd85f";
    ctx.font = "900 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${activeLevel + 1}`, W / 2, 132);
    ctx.fillStyle = "#fff";
    ctx.font = "900 32px Trebuchet MS";
    ctx.fillText(levelData.name, W / 2, 166);
    ctx.restore();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    if (levelData.theme === "park") {
      gradient.addColorStop(0, levelData.grass);
      gradient.addColorStop(1, levelData.grass);
    } else if (levelData.theme === "night") {
      gradient.addColorStop(0, "#273061");
      gradient.addColorStop(.25, "#384260");
      gradient.addColorStop(1, levelData.grass);
    } else {
      gradient.addColorStop(0, levelData.sky);
      gradient.addColorStop(.12, levelData.sky);
      gradient.addColorStop(.121, levelData.grass);
      gradient.addColorStop(1, levelData.grass);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    if (levelData.theme !== "night" && levelData.theme !== "park") {
      ctx.fillStyle = "rgba(255,255,255,.5)";
      drawCloud(120, 64, .8);
      drawCloud(1000, 75, 1.1);
      drawCloud(650, 48, .65);
    } else if (levelData.theme === "night") {
      ctx.fillStyle = "#fff2b2";
      ctx.beginPath();
      ctx.arc(1070, 92, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = levelData.sky;
      ctx.beginPath();
      ctx.arc(1088, 78, 38, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 44; i++) {
        const x = (i * 89) % W;
        const y = 22 + ((i * 47) % 170);
        ctx.fillStyle = `rgba(255,255,220,${.25 + (i % 4) * .12})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 12, 24, 0, Math.PI * 2);
    ctx.arc(28, 0, 32, 0, Math.PI * 2);
    ctx.arc(60, 15, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRoads() {
    for (const road of world.roads) {
      ctx.fillStyle = "rgba(45,39,49,.18)";
      ctx.fillRect(road.x - 11, road.y - 11, road.w + 22, road.h + 22);

      ctx.fillStyle = levelData.theme === "night" ? "#676b78" : "#d9cfb8";
      ctx.fillRect(road.x - 8, road.y - 8, road.w + 16, road.h + 16);

      ctx.fillStyle = levelData.road;
      ctx.fillRect(road.x, road.y, road.w, road.h);

      ctx.strokeStyle = levelData.theme === "night" ? "rgba(255,218,112,.72)" : "rgba(255,229,139,.9)";
      ctx.lineWidth = 4;
      ctx.setLineDash([28, 24]);
      ctx.beginPath();
      if (road.axis === "x") {
        ctx.moveTo(0, road.y + road.h / 2);
        ctx.lineTo(W, road.y + road.h / 2);
      } else {
        ctx.moveTo(road.x + road.w / 2, road.y);
        ctx.lineTo(road.x + road.w / 2, road.y + road.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255,255,255,.08)";
      if (road.axis === "x") {
        for (let x = 20; x < W; x += 72) ctx.fillRect(x, road.y + 12, 35, 3);
      } else {
        for (let y = road.y + 20; y < road.y + road.h; y += 72) ctx.fillRect(road.x + 12, y, 3, 35);
      }
    }

    world.crosswalks.forEach(crosswalk => drawCrosswalk(crosswalk.x, crosswalk.y, crosswalk.w, crosswalk.h, crosswalk.horizontal));
  }

  function drawCrosswalk(x, y, w, h, horizontal) {
    ctx.fillStyle = "rgba(255,255,255,.68)";
    if (horizontal) {
      for (let i = 0; i < 7; i++) ctx.fillRect(x + i * 24, y, 12, h);
    } else {
      for (let i = 0; i < 5; i++) ctx.fillRect(x, y + i * 18, w, 9);
    }
  }

  function drawTerrainDetails() {
    for (const flower of world.flowerSeed) {
      const colors = ["#f9e36c", "#f08392", "#f8f2d2", "#8c6fc5"];
      ctx.fillStyle = colors[flower.c];
      ctx.beginPath();
      ctx.arc(flower.x, flower.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4d8c48";
      ctx.fillRect(flower.x - .6, flower.y + 2, 1.2, 3);
    }

    if (levelData.theme === "park") {
      ctx.fillStyle = "#d8c595";
      ctx.beginPath();
      ctx.ellipse(830, 258, 116, 72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#73bcd0";
      ctx.beginPath();
      ctx.ellipse(830, 258, 76, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.45)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(830, 258, 58, 29, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(830, 258, 24 + Math.sin(animationClock * 1.8) * 3, 0, Math.PI * 2);
      ctx.stroke();
      fillRoundedRect(ctx, 738, 132, 184, 52, 18, "rgba(68,145,90,.8)");
      ctx.fillStyle = "#fff7d7";
      ctx.font = "900 18px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("PARQUE", 830, 164);

      drawLamp(470, 465);
      drawLamp(810, 465);
      drawLamp(475, 105);
      drawLamp(805, 105);
    } else if (levelData.theme === "night") {
      drawLamp(310, 252);
      drawLamp(970, 252);
      drawLamp(310, 468);
      drawLamp(970, 468);
      drawNeonSign(420, 255, "ABIERTO", "#65d9ff");
      drawNeonSign(850, 468, "HOT", "#ff6f9a");
    } else {
      drawLamp(310, 252);
      drawLamp(970, 252);
      drawLamp(310, 468);
      drawLamp(970, 468);
      drawYardSign(1030, 255, "2x1");
      drawYardSign(230, 468, "META");
    }

    drawPizzeria();
  }

  function drawYardSign(x, y, text) {
    ctx.fillStyle = "#6d432d";
    ctx.fillRect(x - 4, y, 8, 34);
    fillRoundedRect(ctx, x - 34, y - 30, 68, 32, 7, "#ffd85f");
    ctx.strokeStyle = "#7b422f";
    ctx.lineWidth = 3;
    roundedRectPath(ctx, x - 34, y - 30, 68, 32, 7);
    ctx.stroke();
    ctx.fillStyle = "#8b2f2c";
    ctx.font = "900 15px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y - 9);
  }

  function drawNeonSign(x, y, text, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 + Math.sin(animationClock * 8) * 5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    fillRoundedRect(ctx, x - 58, y - 26, 116, 40, 8, "rgba(25,24,55,.78)");
    ctx.strokeRect(x - 51, y - 20, 102, 28);
    ctx.fillStyle = color;
    ctx.font = "900 15px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawLamp(x, y) {
    ctx.fillStyle = "#3f3842";
    ctx.fillRect(x - 3, y - 25, 6, 30);
    ctx.beginPath();
    ctx.arc(x, y - 29, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = levelData.theme === "night" ? "#ffd76a" : "#fff1a8";
    ctx.beginPath();
    ctx.arc(x, y - 30, 5, 0, Math.PI * 2);
    ctx.fill();
    if (levelData.theme === "night") {
      const glow = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 28);
      glow.addColorStop(0, "rgba(255,220,100,.4)");
      glow.addColorStop(1, "rgba(255,220,100,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y - 30, 28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPizzeria() {
    const x = PIZZERIA.x;
    const y = PIZZERIA.y;
    ctx.save();
    ctx.translate(x, y);
    if (state === "playing" && pizzasCarried < maxPizzas()) {
      ctx.save();
      ctx.translate(PIZZERIA.refillX - x, PIZZERIA.refillY - y);
      const pulse = 1 + Math.sin(animationClock * 6) * .08;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "rgba(255,210,93,.18)";
      ctx.beginPath();
      ctx.arc(0, 0, PIZZERIA.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,210,93,.72)";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, PIZZERIA.radius - 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    fillRoundedRect(ctx, 5, 12, PIZZERIA.w, PIZZERIA.h + 8, 10, "rgba(61,34,39,.16)");
    fillRoundedRect(ctx, 0, 0, PIZZERIA.w, PIZZERIA.h, 9, levelData.theme === "night" ? "#4e4159" : "#f4d49e");
    ctx.fillStyle = "#d85045";
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(PIZZERIA.w / 2, -24);
    ctx.lineTo(PIZZERIA.w + 8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(122,61,38,.18)";
    for (let tx = 9; tx < PIZZERIA.w - 12; tx += 28) {
      ctx.fillRect(tx, 13, 18, 5);
    }
    fillRoundedRect(ctx, 30, 24, 72, 22, 6, "#6c2e2e");
    ctx.fillStyle = "#ffd65a";
    ctx.font = "900 15px Nunito";
    ctx.textAlign = "center";
    ctx.fillText("PIZZA", PIZZERIA.w / 2, 40);
    ctx.restore();
  }

  function drawPuddles() {
    for (const puddle of world.puddles) {
      ctx.save();
      ctx.translate(puddle.x, puddle.y);
      const grad = ctx.createRadialGradient(0, -4, 2, 0, 0, puddle.rx);
      grad.addColorStop(0, "rgba(173,229,245,.95)");
      grad.addColorStop(1, levelData.theme === "night" ? "rgba(78,117,170,.72)" : "rgba(77,155,193,.72)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, puddle.rx, puddle.ry, -.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.42)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-puddle.rx * .2, -2, puddle.rx * .35, puddle.ry * .28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHouses() {
    world.houses.forEach((house, index) => drawHouse(house, index));
  }

  function drawHouse(h, index) {
    ctx.save();
    ctx.translate(h.x, h.y);

    ctx.fillStyle = "rgba(58,35,42,.18)";
    fillRoundedRect(ctx, 7, 11, h.w, h.h + 8, 12, "rgba(58,35,42,.16)");

    fillRoundedRect(ctx, 0, 0, h.w, h.h, 10, h.wall);

    ctx.fillStyle = h.roof;
    ctx.beginPath();
    ctx.moveTo(-15, 20);
    ctx.lineTo(h.w / 2, -42);
    ctx.lineTo(h.w + 15, 20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(72,38,41,.18)";
    for (let tx = 0; tx < h.w; tx += 28) {
      ctx.fillRect(tx, 10, 18, 5);
    }

    const windowColor = h.night ? "#ffd86e" : "#7fc4da";
    drawWindow(28, 48, windowColor);
    drawWindow(h.w - 62, 48, windowColor);

    fillRoundedRect(ctx, h.w / 2 - 18, h.h - 57, 36, 57, 6, h.night ? "#302c48" : "#8d5837");
    ctx.fillStyle = "#f4c95d";
    ctx.beginPath();
    ctx.arc(h.w / 2 + 9, h.h - 28, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5f9b50";
    ctx.beginPath();
    ctx.arc(17, h.h - 6, 15, 0, Math.PI * 2);
    ctx.arc(h.w - 17, h.h - 6, 15, 0, Math.PI * 2);
    ctx.fill();

    if (levelData.theme === "night") {
      ctx.fillStyle = index % 2 ? "#65d9ff" : "#ff6f9a";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 14;
      ctx.font = "900 12px Nunito";
      ctx.textAlign = "center";
      ctx.fillText(index % 2 ? "CAFÉ" : "PIZZA", h.w / 2, 30);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function drawWindow(x, y, color) {
    fillRoundedRect(ctx, x, y, 34, 30, 5, "#5b4140");
    fillRoundedRect(ctx, x + 4, y + 4, 26, 22, 3, color);
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 17, y + 4);
    ctx.lineTo(x + 17, y + 26);
    ctx.moveTo(x + 4, y + 15);
    ctx.lineTo(x + 30, y + 15);
    ctx.stroke();
  }

  function drawTrees() {
    for (const tree of world.trees) {
      const sway = Math.sin(tree.phase) * 1.5;
      ctx.save();
      ctx.translate(tree.x + sway, tree.y);
      ctx.fillStyle = "#795036";
      fillRoundedRect(ctx, -6, 10, 12, 34, 4, "#795036");

      const dark = levelData.theme === "night" ? "#24505a" : "#347e48";
      const light = levelData.theme === "night" ? "#3b6b68" : "#50a557";
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(-14, 1, tree.r * .66, 0, Math.PI * 2);
      ctx.arc(13, -3, tree.r * .72, 0, Math.PI * 2);
      ctx.arc(0, -17, tree.r * .8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(-6, -14, tree.r * .45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBenches() {
    for (const bench of world.benches) {
      ctx.fillStyle = "#6e4a33";
      fillRoundedRect(ctx, bench.x, bench.y, bench.w, 10, 4, "#8a5b38");
      fillRoundedRect(ctx, bench.x, bench.y + 14, bench.w, 8, 4, "#70442e");
      ctx.fillRect(bench.x + 10, bench.y + 20, 5, 12);
      ctx.fillRect(bench.x + bench.w - 15, bench.y + 20, 5, 12);
    }
  }

  function drawCoins() {
    for (const coin of world.coins) {
      if (coin.taken) continue;
      const bob = Math.sin(animationClock * 4 + coin.phase) * 4;
      const squeeze = .65 + Math.abs(Math.sin(animationClock * 3 + coin.phase)) * .35;
      ctx.save();
      ctx.translate(coin.x, coin.y + bob);
      ctx.scale(squeeze, 1);
      ctx.fillStyle = "rgba(82,48,27,.18)";
      ctx.beginPath();
      ctx.ellipse(0, 18, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f7b72d";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffe278";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = "#fff1a3";
      ctx.font = "900 12px Nunito";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("P", 0, 1);
      ctx.restore();
    }
  }

  function drawPicnicOrders() {
    for (const order of world.picnicOrders) {
      if (order.collected) continue;
      const bob = Math.sin(animationClock * 4 + order.phase) * 5;
      const pulse = 1 + Math.sin(animationClock * 5 + order.phase) * .08;
      ctx.save();
      ctx.translate(order.x, order.y + bob);
      ctx.scale(pulse, pulse);

      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
      glow.addColorStop(0, "rgba(255,234,124,.48)");
      glow.addColorStop(1, "rgba(255,234,124,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();

      fillRoundedRect(ctx, -16, -12, 32, 25, 5, "#e7a65b");
      ctx.strokeStyle = "#7b4931";
      ctx.lineWidth = 3;
      roundedRectPath(ctx, -16, -12, 32, 25, 5);
      ctx.stroke();
      ctx.fillStyle = "#d95545";
      ctx.fillRect(-16, -3, 32, 6);
      ctx.fillStyle = "#fff5c7";
      ctx.font = "900 12px Nunito";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PICNIC", 0, 1);
      ctx.restore();
    }
  }

  function drawTarget() {
    if (state !== "playing" || delivered >= levelData.required) return;
    const house = world.houses[currentTarget];
    const x = house.doorX;
    const y = house.doorY - 42 + Math.sin(animationClock * 5) * 7;

    const pulse = 1 + Math.sin(animationClock * 4) * .08;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);

    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 42);
    glow.addColorStop(0, "rgba(255,209,75,.55)");
    glow.addColorStop(1, "rgba(255,209,75,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd04d";
    ctx.beginPath();
    ctx.arc(0, -8, 23, 0, Math.PI * 2);
    ctx.lineTo(0, 29);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7f472b";
    ctx.lineWidth = 4;
    ctx.stroke();

    drawPizzaSlice(0, -8, .46);
    ctx.restore();

    if (player) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,208,77,.62)";
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 13]);
      ctx.lineDashOffset = -animationClock * 42;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 27);
      const midY = isOnRoad(player.x, player.y, 12) ? player.y : house.doorY;
      ctx.quadraticCurveTo((player.x + x) / 2, midY, x, house.doorY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const near = player && Math.hypot(player.x - house.doorX, player.y - house.doorY) < 85;
    if (near) {
      fillRoundedRect(ctx, x - 86, house.doorY + 12, 172, 35, 12, "rgba(36,22,47,.88)");
      ctx.fillStyle = "#fff";
      ctx.font = "800 15px Nunito";
      ctx.textAlign = "center";
      ctx.fillText("E / ESPACIO · ENTREGAR", x, house.doorY + 35);
    }
  }

  function drawPizzaSlice(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(-.18);
    ctx.fillStyle = "#f0a53f";
    ctx.beginPath();
    ctx.moveTo(-25, -20);
    ctx.lineTo(28, -20);
    ctx.lineTo(0, 35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8b482d";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#f7d16d";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-25, -20);
    ctx.lineTo(28, -20);
    ctx.stroke();
    ctx.fillStyle = "#d84a3e";
    [[-9,-7],[10,-8],[1,9]].forEach(([px,py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawCars() {
    for (const car of world.cars) drawCar(car);
  }

  function drawLightning() {
    if (!world?.lightning?.length) return;
    for (const bolt of world.lightning) {
      const warning = bolt.life > bolt.strikeAt;
      const pulse = 1 + Math.sin(animationClock * 18) * .08;
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.scale(pulse, pulse);
      if (warning) {
        ctx.strokeStyle = "rgba(255,232,97,.82)";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, bolt.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,232,97,.14)";
        ctx.beginPath();
        ctx.arc(0, 0, bolt.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(214,243,255,.95)";
        ctx.lineWidth = 7;
        ctx.shadowColor = "#d6f3ff";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(-8, -160);
        ctx.lineTo(9, -78);
        ctx.lineTo(-11, -76);
        ctx.lineTo(8, 0);
        ctx.lineTo(-8, 62);
        ctx.stroke();
        ctx.fillStyle = "rgba(101,217,255,.22)";
        ctx.beginPath();
        ctx.arc(0, 0, bolt.r + 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.cx, car.cy);
    ctx.rotate(car.heading);

    const w = 92;
    const h = 48;

    ctx.fillStyle = "rgba(41,29,38,.18)";
    fillRoundedRect(ctx, -w / 2 + 5, -h / 2 + 8, w, h, 15, "rgba(41,29,38,.18)");

    fillRoundedRect(ctx, -w / 2, -h / 2, w, h, 15, car.color);
    fillRoundedRect(ctx, -w * .18, -h * .36, w * .36, h * .72, 10, "#bfe0eb");
    ctx.fillStyle = "rgba(255,255,255,.43)";
    ctx.fillRect(-w * .11, -h * .29, w * .1, h * .58);

    ctx.fillStyle = "#2f2c34";
    fillRoundedRect(ctx, -w / 2 + 13, -h / 2 - 4, 16, 8, 3, "#2f2c34");
    fillRoundedRect(ctx, w / 2 - 29, -h / 2 - 4, 16, 8, 3, "#2f2c34");
    fillRoundedRect(ctx, -w / 2 + 13, h / 2 - 4, 16, 8, 3, "#2f2c34");
    fillRoundedRect(ctx, w / 2 - 29, h / 2 - 4, 16, 8, 3, "#2f2c34");

    ctx.fillStyle = "#ffe983";
    ctx.beginPath();
    ctx.arc(w / 2 - 8, -h / 2 + 9, 4, 0, Math.PI * 2);
    ctx.arc(w / 2 - 8, h / 2 - 9, 4, 0, Math.PI * 2);
    ctx.fill();

    if (levelData.theme === "night") {
      const glow = ctx.createLinearGradient(w / 2, 0, w / 2 + 70, 0);
      glow.addColorStop(0, "rgba(255,235,150,.25)");
      glow.addColorStop(1, "rgba(255,235,150,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(w / 2, -h / 2 + 3);
      ctx.lineTo(w / 2 + 80, -h);
      ctx.lineTo(w / 2 + 80, h);
      ctx.lineTo(w / 2, h / 2 - 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCats() {
    for (const cat of world.cats) {
      const bounce = Math.abs(Math.sin(cat.phase)) * 2;
      ctx.save();
      ctx.translate(cat.x, cat.y - bounce);
      if (cat.dir < 0) ctx.scale(-1, 1);

      ctx.fillStyle = "rgba(48,28,33,.18)";
      ctx.beginPath();
      ctx.ellipse(0, 14, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#d58a43";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(13, -5, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, -11);
      ctx.lineTo(11, -19);
      ctx.lineTo(15, -11);
      ctx.moveTo(15, -11);
      ctx.lineTo(19, -19);
      ctx.lineTo(21, -9);
      ctx.fill();
      ctx.strokeStyle = "#d58a43";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(-13, -2, 12, Math.PI * .6, Math.PI * 1.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCyclists() {
    for (const cyclist of world.cyclists) {
      const vertical = cyclist.axis === "y";
      const direction = cyclist.dir < 0 ? -1 : 1;
      const pedal = Math.sin(cyclist.phase) * 3;
      ctx.save();
      ctx.translate(cyclist.x, cyclist.y);
      if (vertical) ctx.rotate(Math.PI / 2);
      ctx.scale(direction, 1);

      ctx.fillStyle = "rgba(40,33,45,.2)";
      ctx.beginPath();
      ctx.ellipse(0, 15, 24, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#334054";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-13, 9, 8, 0, Math.PI * 2);
      ctx.arc(14, 9, 8, 0, Math.PI * 2);
      ctx.moveTo(-13, 9);
      ctx.lineTo(-2, 0);
      ctx.lineTo(14, 9);
      ctx.lineTo(3, 9);
      ctx.lineTo(-2, 0);
      ctx.lineTo(7, -1);
      ctx.stroke();

      ctx.strokeStyle = "#bf794d";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-2, -1);
      ctx.lineTo(-7, -15 + pedal);
      ctx.moveTo(1, -1);
      ctx.lineTo(8, -13 - pedal);
      ctx.stroke();
      fillRoundedRect(ctx, -9, -29, 18, 19, 7, cyclist.color);
      ctx.fillStyle = "#e2a477";
      ctx.beginPath();
      ctx.arc(0, -38, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cyclist.color;
      ctx.beginPath();
      ctx.arc(0, -42, 10, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRival() {
    const walk = rival.moving ? Math.sin(animationClock * 14) : 0;
    const bob = rival.moving ? Math.abs(Math.sin(animationClock * 14)) * 3 : Math.sin(animationClock * 2) * 1.1;
    ctx.save();
    ctx.translate(rival.x, rival.y + bob - rival.dash * 8);
    if (rival.facing === "left") ctx.scale(-1, 1);

    ctx.fillStyle = "rgba(30,20,35,.25)";
    ctx.beginPath();
    ctx.ellipse(0, 22, 21, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2c2940";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, 12);
    ctx.lineTo(-10 + walk * 3, 25);
    ctx.moveTo(7, 12);
    ctx.lineTo(10 - walk * 3, 25);
    ctx.stroke();

    fillRoundedRect(ctx, -18, -7, 36, 31, 12, rival.color);
    fillRoundedRect(ctx, -22, 1, 44, 18, 6, "#f0b957");
    ctx.fillStyle = "#6f3240";
    ctx.font = "900 7px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("RIVAL", 0, 13);

    ctx.fillStyle = "#b87848";
    ctx.beginPath();
    ctx.arc(0, -22, 17, 0, Math.PI * 2);
    ctx.fill();
    fillRoundedRect(ctx, -17, -42, 34, 12, 5, "#2c2940");
    ctx.fillStyle = "#1c1830";
    ctx.beginPath();
    ctx.arc(6, -22, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#b87848";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-15, 3);
    ctx.lineTo(-25, 7 + walk * 2);
    ctx.moveTo(15, 3);
    ctx.lineTo(26, 6 - walk * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const flicker = invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0;
    if (flicker) return;

    const walk = player.moving ? Math.sin(animationClock * 13) : 0;
    const bob = player.moving ? Math.abs(Math.sin(animationClock * 13)) * 3 : Math.sin(animationClock * 2.4) * 1.2;
    const bumpRotation = player.bump > 0 ? Math.sin(animationClock * 28) * .18 * player.bump : 0;
    const celebrateLift = player.celebrate > 0 ? Math.sin(player.celebrate * Math.PI) * 10 : 0;
    const armWave = player.celebrate > 0 ? Math.sin(animationClock * 24) * 4 : 0;

    ctx.save();
    ctx.translate(player.x, player.y + bob - celebrateLift);
    ctx.rotate(bumpRotation);

    if (player.facing === "left") ctx.scale(-1, 1);

    ctx.fillStyle = "rgba(52,32,40,.24)";
    ctx.beginPath();
    ctx.ellipse(0, 23, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#29324a";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.lineTo(-10 + walk * 3, 25);
    ctx.moveTo(7, 14);
    ctx.lineTo(10 - walk * 3, 25);
    ctx.stroke();

    fillRoundedRect(ctx, -19, -6, 38, 31, 12, "#fff6df");
    ctx.fillStyle = "#df493c";
    ctx.fillRect(-19, 1, 38, 7);

    ctx.fillStyle = "#ce854e";
    ctx.beginPath();
    ctx.arc(0, -21, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3b2630";
    ctx.beginPath();
    ctx.arc(-6, -31, 13, Math.PI, Math.PI * 2);
    ctx.arc(7, -31, 12, Math.PI, Math.PI * 2);
    ctx.fill();

    drawChefHat();

    ctx.fillStyle = "#2d1b25";
    ctx.beginPath();
    ctx.arc(6, -21, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#74362f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, -16, 5, .1, 1.5);
    ctx.stroke();

    ctx.strokeStyle = "#ce854e";
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (player.celebrate > 0) {
      ctx.moveTo(-15, 1);
      ctx.lineTo(-27, -17 + armWave);
      ctx.moveTo(15, 1);
      ctx.lineTo(27, -18 - armWave);
    } else {
      ctx.moveTo(-15, 3);
      ctx.lineTo(-28, 7 + walk * 2);
      ctx.moveTo(15, 3);
      ctx.lineTo(25, 5 - walk * 2);
    }
    ctx.stroke();

    if (pizzasCarried > 0) {
      ctx.save();
      ctx.translate(4, 4);
      ctx.rotate(-.08);
      for (let i = 0; i < pizzasCarried; i++) {
        const y = -7 - i * 8;
        fillRoundedRect(ctx, -23, y, 48, 21, 5, "#eeb55e");
        ctx.strokeStyle = "#754231";
        ctx.lineWidth = 3;
        roundedRectPath(ctx, -23, y, 48, 21, 5);
        ctx.stroke();
        ctx.fillStyle = "#9a3a31";
        ctx.font = "900 8px Nunito";
        ctx.textAlign = "center";
        ctx.fillText("PIZZA", 1, y + 14);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawChefHat() {
    ctx.fillStyle = "#fffdf3";
    ctx.strokeStyle = "#5d3440";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-9, -42, 10, 0, Math.PI * 2);
    ctx.arc(0, -47, 12, 0, Math.PI * 2);
    ctx.arc(10, -42, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    fillRoundedRect(ctx, -17, -42, 34, 10, 4, "#fffdf3");
    ctx.strokeStyle = "#5d3440";
    ctx.strokeRect(-15, -40, 30, 7);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    ctx.textAlign = "center";
    ctx.font = "900 19px Nunito";
    for (const item of floatTexts) {
      ctx.globalAlpha = clamp(item.life, 0, 1);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 5;
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawNightOverlay() {
    ctx.fillStyle = "rgba(22,22,59,.18)";
    ctx.fillRect(0, 0, W, H);

    for (let i = -20; i < W + 40; i += 38) {
      const x = i + (rainOffset % 38);
      ctx.strokeStyle = "rgba(173,214,255,.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 22, H);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 760);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(5,8,28,.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function loop(now) {
    const dt = Math.min((now - previousTime) / 1000, .035);
    previousTime = now;
    update(dt);
    updateResponsiveCamera(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindButton(id, handler) {
    document.getElementById(id).addEventListener("click", () => {
      sound("click");
      handler();
    });
  }

  bindButton("playBtn", openLevelSelect);
  bindButton("howBtn", openHow);
  bindButton("closeHowBtn", openMenu);
  bindButton("howPlayBtn", openLevelSelect);
  bindButton("backToMenuBtn", openMenu);
  bindButton("resumeBtn", togglePause);
  bindButton("pauseMenuBtn", openMenu);
  bindButton("resultMenuBtn", openMenu);
  bindButton("retryBtn", () => beginLevel(activeLevel));
  bindButton("nextBtn", () => beginLevel(Math.min(activeLevel + 1, LEVELS.length - 1)));

  el.pauseBtn.addEventListener("click", () => {
    sound("click");
    togglePause();
  });

  el.soundBtn.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    updateSoundButtonState();
    if (audioEnabled) sound("click");
  });

  document.querySelectorAll(".mobile-controls, .mobile-controls button, .topbar-actions button, .control-icon").forEach(node => {
    ["contextmenu", "selectstart", "dragstart"].forEach(type => {
      node.addEventListener(type, event => event.preventDefault());
    });
  });

  document.querySelectorAll(".level-card").forEach(card => {
    card.addEventListener("click", () => {
      if (card.dataset.url) {
        window.location.href = card.dataset.url;
        return;
      }
      beginLevel(Number(card.dataset.level));
    });
  });

  window.addEventListener("keydown", event => {
    const code = event.code;
    const gameKeys = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","KeyW","KeyA","KeyS","KeyD","KeyE","ShiftLeft","ShiftRight"];
    if (gameKeys.includes(code)) event.preventDefault();

    keys.add(code);
    if ((code === "Space" || code === "KeyE") && !event.repeat) attemptDelivery();
    if (code === "Escape") {
      if (state === "playing" || state === "paused") togglePause();
    }
  }, { passive: false });

  window.addEventListener("keyup", event => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    clearMobileSprint();
    if (state === "playing") togglePause();
  });

  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const press = event => {
      event.preventDefault();
      const now = performance.now();
      const doubleTapped = !mobileSprintActive &&
        code === lastMobileDirectionCode &&
        now - lastMobileDirectionTapAt < 330;

      if (doubleTapped) {
        setMobileSprintActive(true);
        lastMobileDirectionTapAt = 0;
        lastMobileDirectionCode = "";
      } else {
        if (mobileSprintActive) setMobileSprintActive(false);
        lastMobileDirectionTapAt = now;
        lastMobileDirectionCode = code;
      }

      keys.add(code);
      getAudioContext();
    };
    const release = event => {
      event.preventDefault();
      keys.delete(code);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  document.getElementById("mobileAction").addEventListener("pointerdown", event => {
    event.preventDefault();
    attemptDelivery();
  });

  levelData = LEVELS[1];
  world = createDecorativeWorld();
  refreshLevelStars();
  updateSoundButtonState();
  beginLevel(1);
  requestAnimationFrame(loop);
})();
