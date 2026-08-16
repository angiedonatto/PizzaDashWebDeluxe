import { LEVELS, LEVEL_URLS, MAX_PIZZAS, PIZZERIA, RIVAL_PIZZERIA } from "./src/config.js";
import { createAudio } from "./src/audio.js";
import { createRenderer } from "./src/rendering.js";
(() => {
  "use strict";

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
  let pauseToggleGuard = 0;
  const particles = [];
  const floatTexts = [];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min, max) => min + Math.random() * (max - min);
  const mobileCameraQuery = window.matchMedia("(max-width: 650px), (hover: none) and (pointer: coarse)");
  let mobileCameraX = .5;
  let mobileCameraY = .5;

  const renderer = createRenderer({
    ctx, W, H, PIZZERIA, RIVAL_PIZZERIA, MAX_PIZZAS, clamp, lerp,
    roundedRectPath, fillRoundedRect, isOnRoad, rand,
    getState: () => ({
      state, world, levelData, delivered, currentTarget, player, rival,
      animationClock, rainOffset, particles, floatTexts, invulnerable,
      pizzasCarried, levelIntroTimer, timeLeft, score, hearts, screenShake,
      activeLevel
    })
  });

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
      if (canvas.style.objectPosition) canvas.style.objectPosition = "";
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(rect.width / W, rect.height / H);
    const overflowX = Math.max(0, W * scale - rect.width);
    const overflowY = Math.max(0, H * scale - rect.height);
    const desiredX = rect.width * .5;
    const desiredY = rect.height * .5;
    const targetX = player && overflowX > 1
      ? clamp((player.x * scale - desiredX) / overflowX, 0, 1)
      : .5;
    const targetY = player && overflowY > 1
      ? clamp((player.y * scale - desiredY) / overflowY, 0, 1)
      : .5;
    const follow = clamp(dt * 5.5, 0, 1);
    mobileCameraX = lerp(mobileCameraX, targetX, follow);
    mobileCameraY = lerp(mobileCameraY, targetY, follow);
    canvas.style.objectPosition = `${(mobileCameraX * 100).toFixed(2)}% ${(mobileCameraY * 100).toFixed(2)}%`;
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

  const audio = createAudio({
    getAudioEnabled: () => audioEnabled,
    getLevelData: () => levelData
  });

  function getAudioContext() {
    return audio.getAudioContext();
  }

  function sound(name) {
    audio.sound(name);
  }

  function startBackgroundMusic() {
    audio.startBackgroundMusic();
  }

  function stopBackgroundMusic() {
    audio.stopBackgroundMusic();
  }

  function setMusicPaused(paused) {
    audio.setMusicPaused(paused);
  }

  function updateSoundButtonState() {
    el.soundBtn.classList.toggle("is-muted", !audioEnabled);
    el.soundBtn.setAttribute("aria-label", audioEnabled ? "Desactivar sonido" : "Activar sonido");
  }

  function showOnly(screen) {
    [el.menu, el.level, el.how, el.pause, el.result].forEach(node => node.classList.add("hidden"));
    if (screen) screen.classList.remove("hidden");
  }

  function openMenu() {
    clearTimeout(autoAdvanceTimer);
    stopBackgroundMusic();
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
    LEVELS.forEach((_, index) => {
      const value = Number(localStorage.getItem(`pizzaDashStars${index}`) || 0);
      const node = document.getElementById(`stars-${index}`);
      node.textContent = `${"★ ".repeat(value)}${"☆ ".repeat(3 - value)}`.trim();
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
          { x: 520, y: 0, w: 160, h: H, axis: "y" }
        ]
      : [
          { x: 0, y: 285, w: W, h: 150, axis: "x" },
          { x: 548, y: 0, w: 170, h: H, axis: "y" }
        ];

    const houses = theme === "night"
      ? [
          makeHouse(82, 92, 154, 104, "#54506f", "#3f6583", 159, 216),
          makeHouse(345, 88, 158, 106, "#4c4b69", "#65456f", 424, 214),
          makeHouse(790, 88, 158, 106, "#54506f", "#3f6583", 869, 214),
          makeHouse(1030, 96, 154, 102, "#4c4b69", "#65456f", 1107, 218),
          makeHouse(236, 498, 160, 108, "#54506f", "#3f6583", 316, 626),
          makeHouse(760, 500, 166, 108, "#4c4b69", "#65456f", 843, 628)
        ]
      : theme === "park"
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

    if (theme === "night") houses.forEach(house => house.night = true);

    const obstacles = houses.flatMap(makeHouseObstacles);
    if (theme === "night") {
      obstacles.push(
        { x: PIZZERIA.x + 8, y: PIZZERIA.y + 8, w: PIZZERIA.w - 16, h: PIZZERIA.h - 6, type: "pizzeria" },
        { x: RIVAL_PIZZERIA.x + 8, y: RIVAL_PIZZERIA.y + 8, w: RIVAL_PIZZERIA.w - 16, h: RIVAL_PIZZERIA.h - 6, type: "rivalPizzeria" }
      );
    }
    const trees = [];
    const benches = [];
    const puddles = [];
    const cats = [];

    const treeSpots = theme === "night"
      ? [
          [242, 182], [508, 182], [738, 180], [1190, 184],
          [156, 458], [456, 560], [1018, 506], [1186, 462]
        ]
      : theme === "park"
      ? [
          [330, 90], [410, 160], [790, 80], [865, 170],
          [360, 365], [840, 365], [325, 570], [900, 590],
          [470, 260], [770, 260]
        ]
      : [
          [318, 112], [970, 112], [320, 548], [975, 548],
          [70, 255], [1190, 250], [70, 455], [1190, 455]
        ];

    treeSpots.forEach(([x, y], index) => {
      const tree = { x, y, r: 26 + (index % 3) * 3, phase: rand(0, Math.PI * 2) };
      trees.push(tree);
      obstacles.push({
        x: x - 9,
        y: y + 15,
        w: 18,
        h: 28,
        type: "tree"
      });
    });

    if (theme === "park") {
      benches.push({ x: 315, y: 265, w: 88, h: 26 });
      benches.push({ x: 875, y: 265, w: 88, h: 26 });
      obstacles.push(...benches.map(b => ({ ...b, type: "bench" })));
      puddles.push({ x: 470, y: 420, rx: 55, ry: 23 });
      puddles.push({ x: 790, y: 420, rx: 46, ry: 20 });
      cats.push(makeCat(420, 555, 72, "x"));
      cats.push(makeCat(820, 120, 66, "y"));
    } else if (theme === "night") {
      puddles.push(
        { x: 210, y: 452, rx: 34, ry: 13 },
        { x: 870, y: 258, rx: 40, ry: 16 },
        { x: 1040, y: 452, rx: 36, ry: 14 }
      );
      cats.push(makeCat(454, 466, 70, "x"));
    } else {
      puddles.push({ x: 815, y: 455, rx: 42, ry: 17 });
      cats.push(makeCat(330, 448, 58, "x"));
    }

    const coinSpots = theme === "night"
      ? [[284, 244], [1002, 248], [204, 462], [1036, 462], [636, 248], [636, 470]]
      : [[330, 245], [950, 250], [330, 460], [950, 460], [630, 250], [630, 470]];
    const coins = coinSpots.map(([x, y]) => ({ x, y, taken: false, phase: rand(0, 6.2) }));

    const flowerSeed = [];
    const detailCount = theme === "night" ? 46 : 64;
    for (let i = 0; i < detailCount; i++) {
      const x = rand(15, W - 15);
      const y = rand(40, H - 18);
      const inRoad = roads.some(r => x > r.x - 15 && x < r.x + r.w + 15 && y > r.y - 15 && y < r.y + r.h + 15);
      const inHouse = houses.some(h => x > h.x - 20 && x < h.x + h.w + 20 && y > h.y - 20 && y < h.y + h.h + 20);
      if (!inRoad && !inHouse) flowerSeed.push({ x, y, c: Math.floor(rand(0, 4)) });
    }

    const crosswalks = createCrosswalks(roads);

    const intersections = createIntersections(roads);
    const traffic = createTraffic(roads, levelIndex, intersections);

    return {
      roads,
      houses,
      obstacles,
      trees,
      benches,
      puddles,
      cats,
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
      h: Math.max(72, house.h - 8),
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
    const window = getIntersectionWindow(spawn);
    return !world.trafficReservations.some(slot => trafficWindowsOverlap(slot, window));
  }

  function reserveTrafficSlot(spawn) {
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
    const color = spawn.color;
    const speed = spawn.speed;
    reserveTrafficSlot(spawn);
    world.cars.push(makeCar(spawn, color, speed, id));
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
    const west = { x: -92, y: westEastY };
    const east = { x: W + 92, y: eastWestY };
    const north = { x: northSouthX, y: -92 };
    const south = { x: southNorthX, y: H + 92 };
    const laneSpecs = [
      {
        name: "west-east",
        waypoints: [west, { x: W + 92, y: westEastY }],
        speed: baseSpeed * .9,
        interval: 3.7,
        delay: .2
      },
      {
        name: "east-west",
        waypoints: [east, { x: -92, y: eastWestY }],
        speed: baseSpeed * .9,
        interval: 3.85,
        delay: 1.15
      },
      {
        name: "north-south",
        waypoints: [north, { x: northSouthX, y: H + 92 }],
        speed: baseSpeed * .84,
        interval: 4.05,
        delay: 2.15
      },
      {
        name: "south-north",
        waypoints: [south, { x: southNorthX, y: -92 }],
        speed: baseSpeed * .84,
        interval: 4.25,
        delay: 3.15
      },
      {
        name: "west-north",
        waypoints: [west, { x: southNorthX, y: westEastY }, { x: southNorthX, y: -92 }],
        speed: baseSpeed * .82,
        interval: 5.4,
        delay: 4.15
      },
      {
        name: "north-east",
        waypoints: [north, { x: northSouthX, y: westEastY }, { x: W + 92, y: westEastY }],
        speed: baseSpeed * .82,
        interval: 5.8,
        delay: 5.05
      },
      {
        name: "east-south",
        waypoints: [east, { x: northSouthX, y: eastWestY }, { x: northSouthX, y: H + 92 }],
        speed: baseSpeed * .82,
        interval: 5.6,
        delay: 6.05
      },
      {
        name: "south-west",
        waypoints: [south, { x: southNorthX, y: eastWestY }, { x: -92, y: eastWestY }],
        speed: baseSpeed * .82,
        interval: 5.95,
        delay: 6.95
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
        conflict: computeConflictOffsets(route, intersections[0]),
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

  function beginLevel(index) {
    clearTimeout(autoAdvanceTimer);
    activeLevel = index;
    levelData = LEVELS[index];
    world = buildWorld(index);
    player = {
      x: levelData.start.x,
      y: levelData.start.y,
      r: 20,
      speed: 215,
      facing: "right",
      moving: false,
      bump: 0,
      celebrate: 0,
      trailTimer: 0,
      slipTimer: 0,
      slipCooldown: 0,
      slipVx: 0,
      slipVy: 0
    };
    placePlayerSafely();
    rival = createRival(index);
    stormTimer = levelData.mode === "stormRace" ? 6.5 : 0;
    timeLeft = levelData.duration;
    delivered = 0;
    score = 0;
    hearts = 3;
    pizzasCarried = MAX_PIZZAS;
    currentTarget = 0;
    invulnerable = 0;
    actionCooldown = 0;
    deliveryCombo = 0;
    lastDeliveryAt = 0;
    particles.length = 0;
    floatTexts.length = 0;
    state = "playing";
    levelIntroTimer = 2.2;
    showOnly(null);
    el.hud.classList.remove("hidden");
    el.pauseBtn.classList.remove("hidden");
    updateHud();
    showToast(`Nivel ${index + 1}: ${levelData.name}`);
    sound("click");
    startBackgroundMusic();
  }

  function createRival(index) {
    if (LEVELS[index].mode === "solo") return null;
    const nightStart = index === 2
      ? nightRivalDockPoint()
      : null;
    return {
      x: nightStart ? nightStart.x : W - 118,
      y: nightStart ? nightStart.y : LEVELS[index].theme === "park" ? 585 : 360,
      r: 18,
      speed: index === 2 ? 228 : 148,
      target: 1,
      delivered: 0,
      wait: .7,
      pizzasCarried: MAX_PIZZAS,
      color: index === 2 ? "#65d9ff" : "#7d4ab5",
      facing: "left",
      moving: false,
      dash: 0,
      reloaded: true,
      stuckTimer: 0,
      knockX: 0,
      knockY: 0,
      path: [],
      pathGoal: "",
      slipTimer: 0,
      slipCooldown: 0,
      slipCheckCooldown: .8,
      puddleExposure: 0,
      slipVx: 0,
      slipVy: 0
    };
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      setMusicPaused(true);
      el.pause.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      setMusicPaused(false);
      el.pause.classList.add("hidden");
    }
  }

  function playerCollidesAt(x, y) {
    return world.obstacles.some(obstacle => circleObstacleCollision({ x, y, r: player.r }, obstacle));
  }

  function isActorInPuddle(actor) {
    return world.puddles.some(puddle =>
      ((actor.x - puddle.x) ** 2) / (puddle.rx ** 2) + ((actor.y - puddle.y) ** 2) / (puddle.ry ** 2) < 1
    );
  }

  function triggerPlayerSlip(xAxis, yAxis) {
    if (player.slipCooldown > 0 || player.slipTimer > 0 || !player.moving) return;
    const length = Math.hypot(xAxis, yAxis) || 1;
    player.slipTimer = .72;
    player.slipCooldown = 1.65;
    player.slipVx = (xAxis / length) * 230 + rand(-55, 55);
    player.slipVy = (yAxis / length) * 230 + rand(-35, 45);
    player.bump = 1.35;
    invulnerable = Math.max(invulnerable, .55);
    timeLeft = Math.max(0, timeLeft - 2);
    screenShake = Math.max(screenShake, .32);
    burst(player.x, player.y + 12, "#9bd8f1", 18);
    burst(player.x, player.y + 16, "#ffffff", 8);
    spawnText(player.x, player.y - 34, "¡RESBALÓN! -2 s", "#9bd8f1");
    showToast("¡Cuidado con los charcos!");
    sound("slip");
  }

  function triggerRivalSlip(moveX, moveY) {
    if (!rival || rival.slipCooldown > 0 || rival.slipTimer > 0) return;
    const length = Math.hypot(moveX, moveY) || 1;
    rival.slipTimer = .58;
    rival.slipCooldown = 2.2;
    rival.slipCheckCooldown = 1.1;
    rival.slipVx = (moveX / length) * 205 + rand(-42, 42);
    rival.slipVy = (moveY / length) * 205 + rand(-34, 42);
    rival.wait = 0;
    rival.dash = 0;
    rival.stuckTimer = 0;
    burst(rival.x, rival.y + 12, "#9bd8f1", 12);
    spawnText(rival.x, rival.y - 32, "RIVAL RESBALA", "#65d9ff");
  }

  function maybeRivalSlipOnPuddle(previousX, previousY, dt) {
    if (!rival || rival.slipTimer > 0) return;
    if (!isActorInPuddle(rival)) {
      rival.puddleExposure = Math.max(0, rival.puddleExposure - dt * 1.6);
      return;
    }
    const moveX = rival.x - previousX;
    const moveY = rival.y - previousY;
    if (Math.hypot(moveX, moveY) < .6) return;
    rival.puddleExposure += dt * (levelData.mode === "stormRace" ? 1.65 : 1.15);
    if (rival.slipCheckCooldown > 0 || rival.slipCooldown > 0) return;
    const pressure = clamp(.18 + rival.puddleExposure * .85, .24, .68);
    rival.slipCheckCooldown = .18;
    if (rival.puddleExposure > .4 || Math.random() < pressure) {
      triggerRivalSlip(moveX, moveY);
      rival.puddleExposure = 0;
    }
  }

  function movePlayer(dx, dy) {
    resolvePlayerObstacles();
    const startX = player.x;
    const startY = player.y;
    const nextX = clamp(startX + dx, player.r + 8, W - player.r - 8);
    if (!playerCollidesAt(nextX, startY)) {
      player.x = nextX;
    }

    const nextY = clamp(player.y + dy, player.r + 62, H - player.r - 8);
    if (!playerCollidesAt(player.x, nextY)) {
      player.y = nextY;
    }

    resolvePlayerObstacles();
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

  function findNearbyTreeEscape(actor) {
    const tree = world.trees.find(item => Math.hypot(actor.x - item.x, actor.y - (item.y + 24)) < item.r + actor.r + 24);
    if (!tree) return null;
    const candidates = [
      { x: tree.x - tree.r - 36, y: tree.y + 48 },
      { x: tree.x + tree.r + 36, y: tree.y + 48 },
      { x: tree.x, y: tree.y + 72 },
      { x: tree.x - tree.r - 42, y: tree.y - 8 },
      { x: tree.x + tree.r + 42, y: tree.y - 8 }
    ];
    return candidates.find(point => !world.obstacles.some(obstacle =>
      circleObstacleCollision({ x: point.x, y: point.y, r: actor.r }, obstacle)
    )) || null;
  }

  function recoverRivalIfStuck(dt, previousX, previousY, target) {
    if (!rival?.moving) {
      rival.stuckTimer = 0;
      return;
    }
    const progress = Math.hypot(rival.x - previousX, rival.y - previousY);
    rival.stuckTimer = progress < 1 ? rival.stuckTimer + dt : 0;
    if (rival.stuckTimer < 1.25) return;
    const treeEscape = findNearbyTreeEscape(rival);
    if (treeEscape) {
      rival.path.unshift(treeEscape);
    } else if (rival.path.length > 1) {
      rival.path.shift();
    } else {
      const angle = Math.atan2(target.y - rival.y, target.x - rival.x) + Math.PI / 2;
      rival.path.unshift({
        x: clamp(rival.x + Math.cos(angle) * 58, rival.r + 8, W - rival.r - 8),
        y: clamp(rival.y + Math.sin(angle) * 58, rival.r + 62, H - rival.r - 8)
      });
    }
    rival.wait = .08;
    rival.stuckTimer = 0;
  }

  function nightRivalExitPoint() {
    return {
      x: RIVAL_PIZZERIA.x - 58,
      y: Math.min(H - 42, RIVAL_PIZZERIA.y + RIVAL_PIZZERIA.h + 44)
    };
  }

  function nightRivalDockPoint() {
    return {
      x: RIVAL_PIZZERIA.refillX,
      y: Math.min(H - 42, RIVAL_PIZZERIA.y + RIVAL_PIZZERIA.h + 44)
    };
  }

  function rivalNeedsPizzeriaExit() {
    return levelData.theme === "night" &&
      rival.x > RIVAL_PIZZERIA.x - 18 &&
      rival.y > RIVAL_PIZZERIA.y + RIVAL_PIZZERIA.h - 16;
  }

  function rivalRoadX() {
    const road = world.roads.find(item => item.axis === "y");
    return road ? road.x + road.w / 2 : W / 2;
  }

  function cleanRivalPath(points) {
    const cleaned = [];
    points.forEach(point => {
      const previous = cleaned[cleaned.length - 1];
      if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 18) {
        cleaned.push(point);
      }
    });
    return cleaned;
  }

  function findHouseForDoor(target) {
    return world.houses.find(house =>
      Math.abs(house.doorX - target.x) < 2 &&
      Math.abs(house.doorY - target.y) < 2
    );
  }

  function sideApproachForDoor(target) {
    const house = findHouseForDoor(target);
    if (!house) return target;
    const fromLeft = Math.abs(rival.x - (house.x - 46)) < Math.abs(rival.x - (house.x + house.w + 46));
    return {
      x: fromLeft ? house.x - 46 : house.x + house.w + 46,
      y: target.y
    };
  }

  function buildRivalPath(target, kind) {
    const path = [];
    const exit = nightRivalExitPoint();
    const dock = nightRivalDockPoint();
    const roadX = rivalRoadX();
    const upperY = 248;
    const lowerY = Math.min(H - 46, Math.max(664, RIVAL_PIZZERIA.y + RIVAL_PIZZERIA.h + 36));

    if (kind === "reload") {
      if (rival.y < 500) {
        path.push({ x: roadX, y: upperY });
        path.push({ x: roadX, y: lowerY });
      } else {
        path.push({ x: roadX, y: lowerY });
      }
      path.push(exit);
      path.push(dock);
      return cleanRivalPath(path);
    }

    const roadY = target.y > 430 ? Math.min(H - 52, target.y + 40) : 248;
    const approach = sideApproachForDoor(target);
    if (rivalNeedsPizzeriaExit() || Math.hypot(rival.x - dock.x, rival.y - dock.y) < 88) path.push(exit);
    if (target.y <= 430) {
      path.push({ x: roadX, y: lowerY });
      path.push({ x: roadX, y: upperY });
    } else {
      path.push({ x: roadX, y: lowerY });
    }
    path.push({ x: clamp(target.x, 120, W - 120), y: roadY });
    path.push({ x: approach.x, y: roadY });
    path.push(approach);
    path.push(target);
    return cleanRivalPath(path);
  }

  function setRivalPath(target, kind, key) {
    if (rival.pathGoal === key && rival.path.length) return;
    rival.pathGoal = key;
    rival.path = buildRivalPath(target, kind);
  }

  function moveRivalAlongPath(dt, target, previousX, previousY) {
    if (!rival.path.length) {
      rival.moving = false;
      return;
    }
    const point = rival.path[0];
    const dx = point.x - rival.x;
    const dy = point.y - rival.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 12) {
      rival.path.shift();
      return;
    }
    rival.moving = true;
    rival.facing = dx < 0 ? "left" : "right";
    rival.x += (dx / distance) * rival.speed * dt;
    rival.y += (dy / distance) * rival.speed * dt;
    resolveCircleObstacles(rival, 5);
    recoverRivalIfStuck(dt, previousX, previousY, target);
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

    timeLeft -= dt;
    levelIntroTimer = Math.max(0, levelIntroTimer - dt);
    invulnerable = Math.max(0, invulnerable - dt);
    actionCooldown = Math.max(0, actionCooldown - dt);
    player.bump = Math.max(0, player.bump - dt * 4);
    player.celebrate = Math.max(0, player.celebrate - dt * 3);
    player.slipTimer = Math.max(0, player.slipTimer - dt);
    player.slipCooldown = Math.max(0, player.slipCooldown - dt);
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

    const inPuddle = isActorInPuddle(player);
    if (inPuddle) speed *= .58;

    player.moving = player.slipTimer > 0 || Math.abs(xAxis) + Math.abs(yAxis) > 0;
    if (xAxis < 0) player.facing = "left";
    if (xAxis > 0) player.facing = "right";
    if (yAxis < 0 && Math.abs(yAxis) > Math.abs(xAxis)) player.facing = "up";
    if (yAxis > 0 && Math.abs(yAxis) > Math.abs(xAxis)) player.facing = "down";

    if (player.slipTimer > 0) {
      movePlayer(player.slipVx * dt, player.slipVy * dt);
      player.slipVx *= Math.pow(.08, dt);
      player.slipVy *= Math.pow(.08, dt);
    } else {
      movePlayer(xAxis * speed * dt, yAxis * speed * dt);
      if (inPuddle && Math.abs(xAxis) + Math.abs(yAxis) > 0) triggerPlayerSlip(xAxis, yAxis);
    }
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
    updateCoins();
    updatePizzeriaRefill();
    updateRival(dt);
    updateLightning(dt);
    updateParticles(dt);
    updateFloatTexts(dt);

    if (timeLeft <= 0 || hearts <= 0) {
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
      const hitbox = { x: car.x + 7, y: car.y + 7, w: car.w - 14, h: car.h - 14 };
      if (invulnerable <= 0 && circleRectCollision(player, hitbox)) {
        hitPlayer(car);
      }
      if (rival && circleRectCollision(rival, hitbox)) {
        hitRival(car);
      }
    }
  }

  function updateCats(dt) {
    for (const cat of world.cats) {
      if (cat.axis === "x") {
        cat.x += cat.dir * cat.speed * dt;
        if (Math.abs(cat.x - cat.baseX) > cat.range) {
          cat.x = cat.baseX + Math.sign(cat.x - cat.baseX) * cat.range;
          cat.dir *= -1;
        }
      } else {
        cat.y += cat.dir * cat.speed * dt;
        if (Math.abs(cat.y - cat.baseY) > cat.range) {
          cat.y = cat.baseY + Math.sign(cat.y - cat.baseY) * cat.range;
          cat.dir *= -1;
        }
      }
      if (world.obstacles.some(o => circleObstacleCollision({ x: cat.x, y: cat.y, r: 13 }, o))) {
        cat.dir *= -1;
        cat.x = cat.baseX;
        cat.y = cat.baseY;
      }
      cat.phase += dt * 6;

      if (invulnerable <= 0 && Math.hypot(player.x - cat.x, player.y - cat.y) < player.r + 13) {
        player.bump = 1;
        invulnerable = .65;
        timeLeft = Math.max(0, timeLeft - 1.5);
        spawnText(player.x, player.y - 28, "¡Miau!", "#5b3140");
        burst(player.x, player.y, "#f5c071", 7);
      }
      if (rival && Math.hypot(rival.x - cat.x, rival.y - cat.y) < rival.r + 13) {
        rival.wait = Math.max(rival.wait, .55);
        rival.dash = 0;
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

  function hitRival(car) {
    if (!rival || rival.wait > .4) return;
    rival.wait = levelData.mode === "stormRace" ? .45 : .38;
    rival.dash = 0;
    rival.knockX -= car.dx * 120;
    rival.knockY -= car.dy * 120;
    burst(rival.x, rival.y, "#65d9ff", 10);
    spawnText(rival.x, rival.y - 30, "RIVAL -", "#65d9ff");
  }

  function updateCoins() {
    for (const coin of world.coins) {
      if (!coin.taken && Math.hypot(player.x - coin.x, player.y - coin.y) < player.r + 15) {
        coin.taken = true;
        score += 50;
        burst(coin.x, coin.y, "#ffd15b", 12);
        spawnText(coin.x, coin.y - 28, "+50", "#f2a82f");
        sound("coin");
      }
    }
  }

  function updatePizzeriaRefill() {
    if (pizzasCarried >= MAX_PIZZAS) return;
    const nearPizzeria = Math.hypot(player.x - PIZZERIA.refillX, player.y - PIZZERIA.refillY) < PIZZERIA.radius;
    if (!nearPizzeria) return;
    pizzasCarried = MAX_PIZZAS;
    burst(PIZZERIA.refillX, PIZZERIA.refillY, "#ffd25d", 18);
    spawnText(PIZZERIA.refillX, PIZZERIA.refillY - 38, "RECARGA x2", "#f2a82f");
    showToast("Mochila recargada: 2 pizzas");
    sound("coin");
    updateHud();
  }

  function updateRival(dt) {
    if (!rival || state !== "playing") return;
    const previousX = rival.x;
    const previousY = rival.y;
    rival.wait = Math.max(0, rival.wait - dt);
    rival.dash = Math.max(0, rival.dash - dt * 2);
    rival.slipTimer = Math.max(0, rival.slipTimer - dt);
    rival.slipCooldown = Math.max(0, rival.slipCooldown - dt);
    rival.slipCheckCooldown = Math.max(0, rival.slipCheckCooldown - dt);
    if (Math.abs(rival.knockX) + Math.abs(rival.knockY) > 1) {
      rival.x += rival.knockX * dt;
      rival.y += rival.knockY * dt;
      rival.knockX *= Math.pow(.08, dt);
      rival.knockY *= Math.pow(.08, dt);
      resolveCircleObstacles(rival, 5);
    }
    if (rival.slipTimer > 0) {
      rival.x += rival.slipVx * dt;
      rival.y += rival.slipVy * dt;
      rival.slipVx *= Math.pow(.09, dt);
      rival.slipVy *= Math.pow(.09, dt);
      rival.moving = true;
      resolveCircleObstacles(rival, 5);
      return;
    }
    if (rival.wait > 0) {
      rival.moving = false;
      return;
    }

    if (levelData.mode === "stormRace" && rival.pizzasCarried <= 0) {
      const reloadTarget = nightRivalDockPoint();
      setRivalPath(reloadTarget, "reload", "reload");
      moveRivalAlongPath(dt, reloadTarget, previousX, previousY);
      maybeRivalSlipOnPuddle(previousX, previousY, dt);
      const backDistance = Math.hypot(reloadTarget.x - rival.x, reloadTarget.y - rival.y) || 1;
      if (backDistance < 34) {
        rival.pizzasCarried = MAX_PIZZAS;
        rival.reloaded = true;
        rival.wait = .28;
        rival.path.length = 0;
        rival.pathGoal = "";
        burst(reloadTarget.x, reloadTarget.y, rival.color, 10);
      }
      return;
    }

    const house = world.houses[rival.target % world.houses.length];
    const deliveryTarget = { x: house.doorX, y: house.doorY };
    const target = deliveryTarget;
    setRivalPath(target, "deliver", `deliver-${rival.target}`);
    moveRivalAlongPath(dt, target, previousX, previousY);
    maybeRivalSlipOnPuddle(previousX, previousY, dt);

    const d = Math.hypot(target.x - rival.x, target.y - rival.y) || 1;
    if (d < 42 && rival.pizzasCarried > 0) {
      rival.delivered += 1;
      rival.pizzasCarried -= 1;
      rival.wait = levelData.mode === "stormRace" ? .55 : .9;
      rival.dash = 1;
      burst(target.x, target.y, rival.color, 12);
      spawnText(target.x, target.y - 30, "RIVAL +1", rival.color);
      if (rival.pizzasCarried <= 0) rival.reloaded = false;
      rival.target = findNextTarget(rival.target + 1);
      rival.path.length = 0;
      rival.pathGoal = "";
      if (rival.delivered >= levelData.required) {
        showToast("El rival entregó primero");
        setTimeout(() => finishLevel(false), 450);
      }
    }
  }

  function updateLightning(dt) {
    if (levelData.mode !== "stormRace") return;
    stormTimer -= dt;
    if (stormTimer <= 0 && player) {
      stormTimer = rand(6.2, 8.8);
      world.lightning.push({
        x: player.x + rand(-64, 64),
        y: player.y + rand(-58, 58),
        r: 21,
        life: 1.35,
        strikeAt: .5,
        hit: false
      });
      showToast("¡Rayo acercándose!");
      sound("storm");
    }

    for (let i = world.lightning.length - 1; i >= 0; i--) {
      const bolt = world.lightning[i];
      bolt.life -= dt;
      if (!bolt.hit && bolt.life <= bolt.strikeAt) {
        bolt.hit = true;
        screenShake = Math.max(screenShake, .38);
        burst(bolt.x, bolt.y, "#d6f3ff", 10);
        burst(bolt.x, bolt.y, "#ffe77d", 6);
        if (invulnerable <= 0 && Math.hypot(player.x - bolt.x, player.y - bolt.y) < player.r + bolt.r) {
          timeLeft = Math.max(0, timeLeft - 1.5);
          invulnerable = .85;
          player.bump = 1;
          spawnText(player.x, player.y - 34, "-1.5 s", "#65d9ff");
          sound("storm");
        }
        if (rival && Math.hypot(rival.x - bolt.x, rival.y - bolt.y) < rival.r + bolt.r) {
          rival.wait = Math.max(rival.wait, .45);
          rival.dash = 0;
          spawnText(rival.x, rival.y - 32, "RAYO", "#d6f3ff");
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
    player.celebrate = 1;
    burst(target.x, target.y, "#ffd25d", 28);
    burst(target.x, target.y, "#65b86f", 16);
    spawnText(target.x, target.y - 48, comboBonus ? `¡COMBO x${deliveryCombo}!` : "¡ENTREGADA!", "#27874d");
    showToast(comboBonus ? `¡Pizza entregada! Combo +${comboBonus}` : "¡Pizza entregada! +200");
    sound("deliver");

    if (delivered >= levelData.required) {
      setTimeout(() => finishLevel(true), 520);
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
    stopBackgroundMusic();
    state = won ? "won" : "lost";
    el.hud.classList.add("hidden");
    el.pauseBtn.classList.add("hidden");
    el.result.classList.remove("hidden");

    const used = levelData.duration - Math.max(0, timeLeft);
    const stars = won
      ? (hearts === 3 && timeLeft > levelData.duration * .35 ? 3 : hearts >= 2 ? 2 : 1)
      : 0;

    if (won) {
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
            window.location.href = nextUrl;
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
    el.hudDeliveries.textContent = `${pizzasCarried}/${MAX_PIZZAS} · ${delivered}/${levelData.required}`;
    el.hudScore.textContent = String(score);
    el.hudHearts.textContent = `${"♥ ".repeat(hearts)}${"♡ ".repeat(3 - hearts)}`.trim();
    el.missionText.textContent = delivered >= levelData.required
      ? "¡Todas las pizzas fueron entregadas!"
      : pizzasCarried <= 0
        ? "Vuelve a la pizzería para recargar"
      : rival
        ? `Carrera: tú ${delivered}/${levelData.required} · rival ${rival.delivered}/${levelData.required} · rival lleva ${rival.pizzasCarried}/${MAX_PIZZAS}`
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
    renderer.draw();
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

  function handlePauseButton(event) {
    if (event) event.preventDefault();
    const now = performance.now();
    if (now - pauseToggleGuard < 260) return;
    pauseToggleGuard = now;
    sound("click");
    togglePause();
  }

  el.pauseBtn.addEventListener("pointerdown", handlePauseButton);
  el.pauseBtn.addEventListener("click", event => {
    if (performance.now() - pauseToggleGuard < 360) {
      event.preventDefault();
      return;
    }
    handlePauseButton(event);
  });

  el.soundBtn.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    updateSoundButtonState();
    if (audioEnabled) {
      sound("click");
      if (state === "playing") startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
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
    if (state === "playing") togglePause();
  });

  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const press = event => {
      event.preventDefault();
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

  levelData = LEVELS[2];
  world = createDecorativeWorld();
  refreshLevelStars();
  updateSoundButtonState();
  beginLevel(2);
  requestAnimationFrame(loop);
})();
