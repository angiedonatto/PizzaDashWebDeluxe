export function createRenderer(deps) {
  const {
    ctx, W, H, PIZZERIA, RIVAL_PIZZERIA, MAX_PIZZAS, clamp, lerp,
    roundedRectPath, fillRoundedRect, isOnRoad, rand
  } = deps;

  let state;
  let world;
  let levelData;
  let delivered;
  let currentTarget;
  let player;
  let rival;
  let animationClock;
  let rainOffset;
  let particles;
  let floatTexts;
  let invulnerable;
  let pizzasCarried;
  let levelIntroTimer;
  let timeLeft;
  let score;
  let hearts;
  let screenShake;
  let activeLevel;

  function syncState() {
    ({
      state, world, levelData, delivered, currentTarget, player, rival,
      animationClock, rainOffset, particles, floatTexts, invulnerable,
      pizzasCarried, levelIntroTimer, timeLeft, score, hearts, screenShake,
      activeLevel
    } = deps.getState());
  }

  function draw() {
    syncState();
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
      drawHeart();
      drawTarget();
      drawLightning();
      drawCats();
      drawDogs();
      drawCars();
    }
    if (rival) drawRival();
    if (player) drawPlayer();
    if (world) drawTreeCanopiesOverActors();
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
    const hasIntro = Boolean(levelData.intro);
    const panelH = hasIntro ? 118 : 86;
    fillRoundedRect(ctx, W / 2 - 285, 102, 570, panelH, 22, "rgba(36,22,47,.9)");
    ctx.strokeStyle = "rgba(255,216,95,.8)";
    ctx.lineWidth = 3;
    roundedRectPath(ctx, W / 2 - 285, 102, 570, panelH, 22);
    ctx.stroke();
    ctx.fillStyle = "#ffd85f";
    ctx.font = "900 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${activeLevel + 1}`, W / 2, 132);
    ctx.fillStyle = "#fff";
    ctx.font = "900 32px Trebuchet MS";
    ctx.fillText(levelData.name, W / 2, 166);
    if (hasIntro) {
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.font = "900 20px Trebuchet MS";
      ctx.fillText(levelData.intro, W / 2, 198);
    }
    ctx.restore();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    if (levelData.theme === "night") {
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

    if (levelData.theme !== "night") {
      ctx.fillStyle = "rgba(255,255,255,.5)";
      drawCloud(120, 64, .8);
      drawCloud(1000, 75, 1.1);
      drawCloud(650, 48, .65);
    } else {
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
        ctx.moveTo(road.x + road.w / 2, 0);
        ctx.lineTo(road.x + road.w / 2, H);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255,255,255,.08)";
      if (road.axis === "x") {
        for (let x = 20; x < W; x += 72) ctx.fillRect(x, road.y + 12, 35, 3);
      } else {
        for (let y = 20; y < H; y += 72) ctx.fillRect(road.x + 12, y, 3, 35);
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
      ctx.ellipse(640, 245, 180, 110, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#73bcd0";
      ctx.beginPath();
      ctx.ellipse(640, 245, 118, 67, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.45)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(640, 245, 95, 50, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(640, 245, 42 + Math.sin(animationClock * 1.8) * 4, 0, Math.PI * 2);
      ctx.stroke();
      fillRoundedRect(ctx, 548, 118, 184, 52, 18, "rgba(68,145,90,.8)");
      ctx.fillStyle = "#fff7d7";
      ctx.font = "900 18px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("PARQUE", 640, 150);

      drawLamp(470, 465);
      drawLamp(810, 465);
      drawLamp(475, 105);
      drawLamp(805, 105);
    } else if (levelData.theme === "night") {
      drawLamp(310, 252);
      drawLamp(970, 252);
      drawLamp(310, 468);
      drawLamp(970, 468);
    } else if (levelData.theme !== "industrial") {
      drawLamp(310, 252);
      drawLamp(970, 252);
      drawLamp(310, 468);
      drawLamp(970, 468);
      drawYardSign(1030, 255, "2x1");
      drawYardSign(230, 468, "META");
    }

    drawPizzeria();
    if (levelData.theme === "night") drawRivalPizzeria();
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
    if (state === "playing" && pizzasCarried < MAX_PIZZAS) {
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
    ctx.scale(.82, .82);
    ctx.fillStyle = "rgba(61,34,39,.16)";
    fillRoundedRect(ctx, 8, 18, 208, 128, 16, "rgba(61,34,39,.18)");
    fillRoundedRect(ctx, 0, 0, 205, 122, 14, "#f2c27f");
    ctx.fillStyle = "#b85b3d";
    for (let row = 0; row < 5; row++) for (let column = 0; column < 7; column++) fillRoundedRect(ctx, 7 + column * 29 + (row % 2) * 7, 8 + row * 16, 23, 11, 3, "#d47750");
    fillRoundedRect(ctx, 22, 34, 161, 31, 8, "#fff2c9");
    ctx.fillStyle = "#b92f32"; ctx.font = "900 22px Nunito"; ctx.textAlign = "center"; ctx.fillText("🍕 PIZZERÍA", 103, 57);
    fillRoundedRect(ctx, 26, 69, 63, 47, 6, "#79c6d2");
    ctx.strokeStyle = "#fff4cf"; ctx.lineWidth = 4; ctx.strokeRect(31, 74, 53, 37);
    fillRoundedRect(ctx, 99, 77, 48, 45, 5, "#713c35");
    ctx.fillStyle = "#ffbd54"; ctx.beginPath(); ctx.arc(123, 101, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd65a"; ctx.font = "900 13px Nunito"; ctx.fillText("PIZZA", 103, 140);
    ctx.restore();
  }

  function drawRivalPizzeria() {
    const x = RIVAL_PIZZERIA.x;
    const y = RIVAL_PIZZERIA.y;
    ctx.save();
    ctx.translate(x, y);
    fillRoundedRect(ctx, 8, 16, RIVAL_PIZZERIA.w, RIVAL_PIZZERIA.h + 18, 14, "rgba(18,22,45,.22)");
    fillRoundedRect(ctx, 0, 0, RIVAL_PIZZERIA.w, RIVAL_PIZZERIA.h, 12, "#334968");
    ctx.fillStyle = "#65d9ff";
    ctx.beginPath();
    ctx.moveTo(-8, 14);
    ctx.lineTo(RIVAL_PIZZERIA.w / 2, -24);
    ctx.lineTo(RIVAL_PIZZERIA.w + 8, 14);
    ctx.closePath();
    ctx.fill();
    fillRoundedRect(ctx, 22, 38, 100, 31, 7, "#202757");
    ctx.fillStyle = "#fff7d7";
    ctx.font = "900 15px Nunito";
    ctx.textAlign = "center";
    ctx.fillText("PIZZA AZUL", RIVAL_PIZZERIA.w / 2, 59);
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

    if (levelData.theme === "industrial") {
      drawIndustrialBuilding(h, index);
      ctx.restore();
      return;
    }

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
      ctx.fillText(index % 2 ? "PIZZA" : "PRIME", h.w / 2, 30);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function drawIndustrialBuilding(h, index) {
    fillRoundedRect(ctx, 8, 8, h.w, h.h + 5, 8, "rgba(45, 28, 35, .18)");
    fillRoundedRect(ctx, 0, 0, h.w, h.h, 7, h.wall);

    ctx.fillStyle = h.roof;
    ctx.fillRect(-4, -12, h.w + 8, 18);
    ctx.fillStyle = "rgba(255, 214, 135, .7)";
    ctx.fillRect(0, 4, h.w, 4);

    ctx.fillStyle = "#6e4b4a";
    for (let x = 18; x < h.w - 20; x += 48) {
      fillRoundedRect(ctx, x, 28, 32, 25, 3, "#6e4b4a");
      ctx.fillStyle = index % 2 ? "#ffc879" : "#f1a76b";
      ctx.fillRect(x + 4, 32, 24, 17);
      ctx.fillStyle = "#6e4b4a";
    }

    ctx.fillStyle = "#413640";
    ctx.fillRect(h.w - 43, -28, 13, 30);
    ctx.fillStyle = "#8d5b50";
    ctx.fillRect(h.w - 48, -34, 23, 7);

    fillRoundedRect(ctx, h.w / 2 - 20, h.h - 50, 40, 50, 4, "#493b43");
    ctx.fillStyle = "#f3bd67";
    ctx.beginPath();
    ctx.arc(h.w / 2 + 10, h.h - 25, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = index % 2 ? "#ffc36f" : "#ff8660";
    ctx.font = "900 12px Nunito";
    ctx.textAlign = "center";
    ctx.fillText(index % 2 ? "FABRICA" : "ALMACEN", h.w / 2, 20);
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
      if (tree.kind === "streetlight") {
        drawIndustrialStreetlight(tree);
        continue;
      }
      const sway = Math.sin(tree.phase) * 1.5;
      ctx.save();
      ctx.translate(tree.x + sway, tree.y);
      ctx.fillStyle = "#795036";
      fillRoundedRect(ctx, -6, 10, 12, 34, 4, "#795036");
      drawTreeCanopy(tree);
      ctx.restore();
    }
  }

  function drawIndustrialStreetlight(light) {
    ctx.save();
    ctx.translate(light.x, light.y);
    fillRoundedRect(ctx, -4, 4, 8, 42, 4, "#3d3943");
    fillRoundedRect(ctx, -12, 43, 24, 7, 3, "#2f2b33");
    ctx.strokeStyle = "#5d5259";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(17, 8);
    ctx.stroke();
    fillRoundedRect(ctx, 13, 2, 18, 12, 5, "#4a4248");
    ctx.fillStyle = "#ffe083";
    ctx.beginPath();
    ctx.arc(24, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,224,131,.14)";
    ctx.beginPath();
    ctx.ellipse(24, 17, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTreeCanopy(tree) {
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
  }

  function actorBehindTree(actor, tree) {
    if (tree.kind === "streetlight") return false;
    if (!actor) return false;
    return Math.abs(actor.x - tree.x) < tree.r + actor.r + 8 &&
      actor.y < tree.y + 30 &&
      actor.y > tree.y - tree.r - 42;
  }

  function drawTreeCanopiesOverActors() {
    for (const tree of world.trees) {
      if (!actorBehindTree(player, tree) && !actorBehindTree(rival, tree)) continue;
      const sway = Math.sin(tree.phase) * 1.5;
      ctx.save();
      ctx.globalAlpha = .96;
      ctx.translate(tree.x + sway, tree.y);
      drawTreeCanopy(tree);
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

  function drawHeart() {
    const heart = world?.heart;
    if (!heart || !heart.active || heart.collected) return;
    const bob = Math.sin(animationClock * 4 + heart.phase) * 5;
    ctx.save();
    ctx.translate(heart.x, heart.y + bob);
    ctx.shadowColor = "#ff6f91";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ff5d82";
    ctx.font = "900 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♥", 0, 0);
    ctx.restore();
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
        ctx.strokeStyle = "rgba(255,232,97,.55)";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, bolt.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,232,97,.08)";
        ctx.beginPath();
        ctx.arc(0, 0, bolt.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(214,243,255,.78)";
        ctx.lineWidth = 5;
        ctx.shadowColor = "#d6f3ff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-6, -118);
        ctx.lineTo(7, -58);
        ctx.lineTo(-8, -56);
        ctx.lineTo(8, 0);
        ctx.lineTo(-6, 42);
        ctx.stroke();
        ctx.fillStyle = "rgba(101,217,255,.13)";
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
      if (cat.stunned > 0) continue;
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

  function drawDogs() {
    for (const dog of world?.dogs || []) {
      if (dog.stunned > 0) continue;
      const bounce = Math.abs(Math.sin(dog.phase)) * 2;
      ctx.save();
      ctx.translate(dog.x, dog.y - bounce);
      if (dog.dir < 0) ctx.scale(-1, 1);
      ctx.fillStyle = "rgba(48,28,33,.22)";
      ctx.beginPath(); ctx.ellipse(0, 16, 21, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a9653e";
      ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16, -7, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#75432f";
      ctx.beginPath(); ctx.moveTo(8, -14); ctx.lineTo(5, -28); ctx.lineTo(16, -18); ctx.moveTo(22, -15); ctx.lineTo(30, -25); ctx.lineTo(29, -10); ctx.fill();
      ctx.fillStyle = "#fff0c6";
      ctx.beginPath(); ctx.arc(20, -8, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawRival() {
    const walk = rival.moving ? Math.sin(animationClock * 14) : 0;
    const bob = rival.moving ? Math.abs(Math.sin(animationClock * 14)) * 3 : Math.sin(animationClock * 2) * 1.1;
    const slipAmount = rival.slipTimer > 0 ? rival.slipTimer / .58 : 0;
    ctx.save();
    ctx.translate(rival.x, rival.y + bob - rival.dash * 8 + slipAmount * 7);
    ctx.rotate(slipAmount * (rival.facing === "left" ? -.48 : .48));
    if (slipAmount > 0) ctx.scale(1 + slipAmount * .06, 1 - slipAmount * .08);
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
    fillRoundedRect(ctx, -22, 1, 44, 18, 6, rival.pizzasCarried > 0 ? "#f0b957" : "#657089");
    ctx.fillStyle = rival.pizzasCarried > 0 ? "#6f3240" : "#d9e7ef";
    ctx.font = "900 7px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(rival.pizzasCarried > 0 ? "PIZZA" : "VACIO", 0, 13);

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

    if (rival.pizzasCarried > 0) {
      ctx.save();
      ctx.translate(1, -1);
      for (let i = 0; i < rival.pizzasCarried; i++) {
        const y = 7 - i * 8;
        fillRoundedRect(ctx, -20, y, 40, 16, 5, "#66d9ff");
        ctx.strokeStyle = "#20394d";
        ctx.lineWidth = 2;
        roundedRectPath(ctx, -20, y, 40, 16, 5);
        ctx.stroke();
        ctx.fillStyle = "#172b42";
        ctx.font = "900 6px Nunito";
        ctx.textAlign = "center";
        ctx.fillText("AZUL", 0, y + 11);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const flicker = invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0;
    if (flicker) return;

    const walk = player.moving ? Math.sin(animationClock * 13) : 0;
    const bob = player.moving ? Math.abs(Math.sin(animationClock * 13)) * 3 : Math.sin(animationClock * 2.4) * 1.2;
    const slipAmount = player.slipTimer > 0 ? player.slipTimer / .72 : 0;
    const bumpRotation = player.bump > 0 ? Math.sin(animationClock * 28) * .18 * player.bump : 0;
    const celebrateLift = player.celebrate > 0 ? Math.sin(player.celebrate * Math.PI) * 10 : 0;
    const armWave = player.celebrate > 0 ? Math.sin(animationClock * 24) * 4 : 0;

    ctx.save();
    ctx.translate(player.x, player.y + bob - celebrateLift + slipAmount * 8);
    ctx.rotate(bumpRotation + slipAmount * (player.facing === "left" ? -.55 : .55));
    if (slipAmount > 0) ctx.scale(1 + slipAmount * .08, 1 - slipAmount * .1);

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
    ctx.fillStyle = "rgba(22,22,59,.16)";
    ctx.fillRect(0, 0, W, H);

    const mist = ctx.createLinearGradient(0, 0, 0, H);
    mist.addColorStop(0, "rgba(170,205,235,.1)");
    mist.addColorStop(.55, "rgba(170,205,235,.05)");
    mist.addColorStop(1, "rgba(170,205,235,.12)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = "round";
    const layers = [
      { count: 78, spacingX: 83, spacingY: 149, speed: .82, len: 18, alpha: .18, width: .9, wind: .22 },
      { count: 54, spacingX: 101, spacingY: 123, speed: 1.1, len: 29, alpha: .29, width: 1.25, wind: .31 },
      { count: 26, spacingX: 149, spacingY: 167, speed: 1.44, len: 39, alpha: .42, width: 1.8, wind: .37 }
    ];
    layers.forEach((layer, layerIndex) => {
      for (let i = 0; i < layer.count; i++) {
        const seed = i + layerIndex * 97;
        const column = (seed * layer.spacingX) % (W + 180);
        const row = (seed * layer.spacingY) % (H + 140);
        const drift = (rainOffset * layer.speed + seed * 17) % (H + 140);
        const variation = ((seed * 37) % 19) / 19;
        const x = column - 90 - drift * layer.wind + Math.sin(animationClock * 2.4 + seed) * 3.5;
        const y = row - 90 + drift;
        const length = layer.len + variation * 15;
        const slant = length * (.24 + variation * .14);
        ctx.strokeStyle = `rgba(205,232,255,${layer.alpha + variation * .06})`;
        ctx.lineWidth = layer.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - slant, y + length);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = "rgba(214,238,255,.25)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const x = (i * 97 + rainOffset * .9) % W;
      const y = 448 + ((i * 43 + rainOffset * .22) % 230);
      ctx.beginPath();
      ctx.ellipse(x, y, 7 + (i % 3) * 2, 2.2, -.15, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineCap = "butt";

    const vignette = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 760);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(5,8,28,.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }



  return { draw };
}
