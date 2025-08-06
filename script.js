(() => {
  // Canvas & context
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  let WIDTH, HEIGHT;

  // Resize to full viewport
  function resize() {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
  }
  window.addEventListener("resize", resize);
  resize();

  // Constants
  const TILE_SIZE = 64;
  const MAP_ROWS = 145;
  const MAP_COLS = 145;

  // Biome colors
  const biomeColors = {
    river: "#5a8ddb",
    desert: "#e5d6b3",
    arctic: "#c7e9fb",
    grass: "#69b34c",
  };

  // Create biome map
  let mapBiomes = [];
  for (let y = 0; y < MAP_ROWS; y++) {
    mapBiomes[y] = [];
    for (let x = 0; x < MAP_COLS; x++) {
      if (y <= 20) mapBiomes[y][x] = "arctic";
      else if (y <= 70) mapBiomes[y][x] = "grass";
      else if (y <= 75) mapBiomes[y][x] = "river";
      else if (y <= 120) mapBiomes[y][x] = "grass";
      else mapBiomes[y][x] = "desert";
    }
  }

  // Resource nodes
  const NODE_TYPES = {
    tree: { resource: "wood", hp: 10, emoji: "🌳", color: "#228B22" },
    rock: { resource: "stone", hp: 15, emoji: "🪨", color: "#888" },
    berry: { resource: "food", hp: 8, emoji: "🫐", color: "#cc0066" },
    gold: { resource: "gold", hp: 8, emoji: "🥇", color: "#ffd700" },
  };

  let resourceNodes = [];

  function placeResourceNodes() {
    resourceNodes = [];
    for (let i = 0; i < 500; i++) {
      let xTile = Math.floor(Math.random() * MAP_COLS);
      let yTile = Math.floor(Math.random() * MAP_ROWS);
      let biome = mapBiomes[yTile][xTile];

      let possibleTypes = [];
      switch (biome) {
        case "grass":
          possibleTypes = ["tree", "berry"];
          break;
        case "river":
          possibleTypes = ["berry"];
          break;
        case "desert":
          possibleTypes = ["rock"];
          break;
        case "arctic":
          possibleTypes = ["rock", "gold"];
          break;
      }
      if (possibleTypes.length === 0) possibleTypes = ["tree"];

      let typeKey = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
      let nodeType = NODE_TYPES[typeKey];

      resourceNodes.push({
        x: xTile * TILE_SIZE + TILE_SIZE / 2 + Math.random() * 20 - 10,
        y: yTile * TILE_SIZE + TILE_SIZE / 2 + Math.random() * 20 - 10,
        type: typeKey,
        hp: nodeType.hp,
        maxHp: nodeType.hp,
        resource: nodeType.resource,
        emoji: nodeType.emoji,
        color: nodeType.color,
        radius: 20,
      });
    }
  }
  placeResourceNodes();

  // Player object
  let player = {
    x: (MAP_COLS * TILE_SIZE) / 2,
    y: (MAP_ROWS * TILE_SIZE) / 2,
    radius: TILE_SIZE / 2, // one tile size
    speed: 4,
    health: 100,
    maxHealth: 100,
    wood: 0,
    stone: 0,
    food: 0,
    gold: 0,
    xp: 0,
    level: 1,
    name: "Player1",
    angle: 0,
    attackCooldown: 0,
    inventory: {
      axe: true,
      pickaxe: true,
      sword: true,
      food: 3,
    },
    selectedTool: 0,
  };

  // Animals array
  const animals = [];
  function spawnAnimal(x, y) {
    animals.push({
      x,
      y,
      radius: 15,
      speed: 1.2,
      direction: Math.random() * Math.PI * 2,
      color: "#aa8855",
    });
  }
  // Spawn 50 animals randomly
  for (let i = 0; i < 50; i++) {
    spawnAnimal(Math.random() * MAP_COLS * TILE_SIZE, Math.random() * MAP_ROWS * TILE_SIZE);
  }

  // Enemies (wolves)
  const enemies = [];
  function spawnEnemy(x, y) {
    enemies.push({
      x,
      y,
      radius: 18,
      speed: 2,
      health: 60,
      maxHealth: 60,
      angle: 0,
      target: null,
      attackCooldown: 0,
      color: "#cc4444",
    });
  }
  // Spawn 40 enemies in grass biome area
  for (let i = 0; i < 40; i++) {
    let x = Math.random() * MAP_COLS * TILE_SIZE;
    let y = (21 + Math.random() * 50) * TILE_SIZE;
    spawnEnemy(x, y);
  }

  // Other players for leaderboard demo (static)
  let players = [
    { name: "Player1", gold: 0 },
    { name: "Alice", gold: 50 },
    { name: "Bob", gold: 30 },
    { name: "Eve", gold: 10 },
  ];

  // Input handling
  let keys = {};
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    keys[e.key.toLowerCase()] = true;

    // Hotbar toggle with keys 1-9
    if (e.key >= "1" && e.key <= "9") {
      const hotbar = document.getElementById("hotbar");
      if (hotbar.classList.contains("hidden")) {
        hotbar.classList.remove("hidden");
      } else {
        hotbar.classList.add("hidden");
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // Hotbar slots click & selection
  const hotbarSlots = document.querySelectorAll(".hotbar-slot");
  hotbarSlots.forEach((slot) => {
    slot.addEventListener("click", () => {
      hotbarSlots.forEach((s) => s.classList.remove("selected"));
      slot.classList.add("selected");
      player.selectedTool = Number(slot.dataset.index);
    });
  });

  // Mouse to rotate player
  let mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  // Camera
  let camera = { x: 0, y: 0 };

  // XP needed for next level
  function xpToNextLevel(level) {
    return 10 + level * 5;
  }

  // Level up
  function tryLevelUp() {
    while (player.xp >= xpToNextLevel(player.level)) {
      player.xp -= xpToNextLevel(player.level);
      player.level++;
      player.health = Math.min(player.maxHealth, player.health + 10);
    }
  }

  // Distance helper
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // Move player
  function movePlayer() {
    let dx = 0,
      dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    let len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;

      player.x += dx * player.speed;
      player.y += dy * player.speed;

      // Clamp player inside map borders
      player.x = Math.max(player.radius, Math.min(player.x, MAP_COLS * TILE_SIZE - player.radius));
      player.y = Math.max(player.radius, Math.min(player.y, MAP_ROWS * TILE_SIZE - player.radius));
    }
  }

  // Update player facing angle toward mouse
  function updatePlayerAngle() {
    player.angle = Math.atan2(mouse.y - HEIGHT / 2, mouse.x - WIDTH / 2);
  }

  // Player attack
  function playerAttack() {
    if (player.attackCooldown > 0) return;
    const selectedTool = player.selectedTool;
    const cooldownTimes = [600, 800, 400, 1200]; // axe, pickaxe, sword, food
    player.attackCooldown = cooldownTimes[selectedTool];

    if (selectedTool === 2) {
      // Sword attack closest enemy in range 50
      for (let enemy of enemies) {
        if (enemy.health <= 0) continue;
        if (dist(player.x, player.y, enemy.x, enemy.y) < 50) {
          enemy.health -= 25;
          if (enemy.health <= 0) {
            player.xp += 5;
            player.gold += 3;
            players[0].gold = player.gold;
          }
          break;
        }
      }
    } else if (selectedTool === 3) {
      // Use food to heal
      if (player.inventory.food > 0 && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 30);
        player.inventory.food--;
      }
    }
  }

  // Harvest resources
  function harvestResources(deltaTime) {
    if (player.attackCooldown > 0) return;

    for (let node of resourceNodes) {
      if (node.hp <= 0) continue;
      let d = dist(player.x, player.y, node.x, node.y);
      if (d < player.radius + node.radius + 10) {
        if (node.type === "tree" && player.selectedTool === 0) {
          node.hp -= deltaTime * 10;
          if (node.hp <= 0) {
            player.wood += 5;
            player.xp += 2;
            node.hp = 0;
          }
          player.attackCooldown = 500;
          break;
        } else if (node.type === "rock" && player.selectedTool === 1) {
          node.hp -= deltaTime * 10;
          if (node.hp <= 0) {
            player.stone += 4;
            player.xp += 2;
            node.hp = 0;
          }
          player.attackCooldown = 500;
          break;
        } else if (node.type === "berry" && player.selectedTool === 3) {
          node.hp -= deltaTime * 12;
          if (node.hp <= 0) {
            player.food += 3;
            player.xp += 2;
            node.hp = 0;
          }
          player.attackCooldown = 500;
          break;
        } else if (node.type === "gold" && player.selectedTool === 1) {
          node.hp -= deltaTime * 8;
          if (node.hp <= 0) {
            player.gold += 1;
            player.xp += 3;
            node.hp = 0;
          }
          player.attackCooldown = 500;
          break;
        }
      }
    }
  }

  // Update animals movement
  function updateAnimals(deltaTime) {
    for (let animal of animals) {
      if (Math.random() < 0.01) animal.direction = Math.random() * Math.PI * 2;

      animal.x += Math.cos(animal.direction) * animal.speed;
      animal.y += Math.sin(animal.direction) * animal.speed;

      // Clamp inside map
      animal.x = Math.max(animal.radius, Math.min(animal.x, MAP_COLS * TILE_SIZE - animal.radius));
      animal.y = Math.max(animal.radius, Math.min(animal.y, MAP_ROWS * TILE_SIZE - animal.radius));
    }
  }

  // Update enemies AI
  function updateEnemies(deltaTime) {
    for (let enemy of enemies) {
      if (enemy.health <= 0) continue;

      if (!enemy.target || enemy.target.health <= 0) {
        enemy.target = player;
      }

      // Move toward target
      let dx = enemy.target.x - enemy.x;
      let dy = enemy.target.y - enemy.y;
      let distToTarget = Math.hypot(dx, dy);

      if (distToTarget > 30) {
        enemy.x += (dx / distToTarget) * enemy.speed;
        enemy.y += (dy / distToTarget) * enemy.speed;
      } else {
        // Attack cooldown
        if (enemy.attackCooldown <= 0) {
          player.health -= 5;
          enemy.attackCooldown = 1000;
        }
      }

      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaTime);
    }
  }

  // Draw player with angle
  function drawPlayer() {
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.rotate(player.angle);

    // Player body (circle)
    ctx.fillStyle = "#4466aa";
    ctx.strokeStyle = "#223366";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye direction
    ctx.fillStyle = "#ddeeff";
    ctx.beginPath();
    ctx.arc(player.radius / 2, -player.radius / 3, player.radius / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Player name below
    ctx.fillStyle = "#222";
    ctx.font = "bold 12px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText(player.name, WIDTH / 2, HEIGHT / 2 + player.radius + 14);
  }

  // Draw resource nodes
  function drawResources() {
    for (let node of resourceNodes) {
      if (node.hp <= 0) continue;

      let screenX = node.x - camera.x;
      let screenY = node.y - camera.y;

      if (screenX < -50 || screenX > WIDTH + 50 || screenY < -50 || screenY > HEIGHT + 50) continue;

      // Draw circle base
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, node.radius, 0, Math.PI * 2);
      ctx.fill();

      // Emoji icon in center
      ctx.font = `${node.radius * 1.2}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#222";
      ctx.fillText(node.emoji, screenX, screenY - 3);

      // Health bar
      ctx.fillStyle = "#aa4444";
      ctx.fillRect(screenX - 20, screenY + node.radius + 4, 40, 6);
      ctx.fillStyle = "#55bb55";
      ctx.fillRect(screenX - 20, screenY + node.radius + 4, (node.hp / node.maxHp) * 40, 6);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX - 20, screenY + node.radius + 4, 40, 6);
    }
  }

  // Draw animals
  function drawAnimals() {
    for (let animal of animals) {
      let screenX = animal.x - camera.x;
      let screenY = animal.y - camera.y;

      if (screenX < -20 || screenX > WIDTH + 20 || screenY < -20 || screenY > HEIGHT + 20) continue;

      ctx.fillStyle = animal.color;
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, animal.radius * 1.3, animal.radius, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(screenX + animal.radius * 0.5, screenY - animal.radius * 0.2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw enemies
  function drawEnemies() {
    for (let enemy of enemies) {
      if (enemy.health <= 0) continue;

      let screenX = enemy.x - camera.x;
      let screenY = enemy.y - camera.y;

      if (screenX < -30 || screenX > WIDTH + 30 || screenY < -30 || screenY > HEIGHT + 30) continue;

      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      // Health bar
      ctx.fillStyle = "#aa4444";
      ctx.fillRect(screenX - 25, screenY + enemy.radius + 6, 50, 8);
      ctx.fillStyle = "#55bb55";
      ctx.fillRect(screenX - 25, screenY + enemy.radius + 6, (enemy.health / enemy.maxHealth) * 50, 8);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX - 25, screenY + enemy.radius + 6, 50, 8);
    }
  }

  // Draw biome tiles in visible area with grid lines
  function drawMap() {
    let startCol = Math.floor(camera.x / TILE_SIZE);
    let endCol = Math.min(MAP_COLS - 1, Math.floor((camera.x + WIDTH) / TILE_SIZE));
    let startRow = Math.floor(camera.y / TILE_SIZE);
    let endRow = Math.min(MAP_ROWS - 1, Math.floor((camera.y + HEIGHT) / TILE_SIZE));

    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        let biome = mapBiomes[y][x];
        ctx.fillStyle = biomeColors[biome] || "#777";
        let px = x * TILE_SIZE - camera.x;
        let py = y * TILE_SIZE - camera.y;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Draw grid lines (lighter)
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw map border
    ctx.strokeStyle = "#0000aa";
    ctx.lineWidth = 4;
    ctx.strokeRect(
      -camera.x,
      -camera.y,
      MAP_COLS * TILE_SIZE,
      MAP_ROWS * TILE_SIZE
    );
  }

  // Draw day/night overlay tint
  let dayTime = 0;
  function drawDayNightCycle() {
    dayTime += 0.001;
    if (dayTime > 1) dayTime = 0;

    // Use sine wave for smooth brightness
    let brightness = 0.6 + 0.4 * Math.sin(dayTime * Math.PI * 2);
    ctx.fillStyle = `rgba(10,20,40,${1 - brightness})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Draw minimap
  const minimap = document.getElementById("minimap");
  const miniCtx = minimap.getContext("2d");
  const MINIMAP_SIZE = 200;
  minimap.width = MINIMAP_SIZE;
  minimap.height = MINIMAP_SIZE;

  function drawMinimap() {
    miniCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw biomes (scaled down)
    const scaleX = MINIMAP_SIZE / (MAP_COLS * TILE_SIZE);
    const scaleY = MINIMAP_SIZE / (MAP_ROWS * TILE_SIZE);

    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        miniCtx.fillStyle = biomeColors[mapBiomes[y][x]] || "#777";
        miniCtx.fillRect(
          x * TILE_SIZE * scaleX,
          y * TILE_SIZE * scaleY,
          TILE_SIZE * scaleX,
          TILE_SIZE * scaleY
        );
      }
    }

    // Draw animals
    miniCtx.fillStyle = "#aa8855";
    animals.forEach((animal) => {
      miniCtx.beginPath();
      miniCtx.arc(
        animal.x * scaleX,
        animal.y * scaleY,
        3,
        0,
        Math.PI * 2
      );
      miniCtx.fill();
    });

    // Draw enemies
    miniCtx.fillStyle = "#cc4444";
    enemies.forEach((enemy) => {
      if (enemy.health <= 0) return;
      miniCtx.beginPath();
      miniCtx.arc(enemy.x * scaleX, enemy.y * scaleY, 4, 0, Math.PI * 2);
      miniCtx.fill();
    });

    // Draw player (big dot)
    miniCtx.fillStyle = "#2244cc";
    miniCtx.beginPath();
    miniCtx.arc(player.x * scaleX, player.y * scaleY, 6, 0, Math.PI * 2);
    miniCtx.fill();

    // Draw viewport rectangle
    miniCtx.strokeStyle = "#2244cc";
    miniCtx.lineWidth = 2;
    miniCtx.strokeRect(
      camera.x * scaleX,
      camera.y * scaleY,
      WIDTH * scaleX,
      HEIGHT * scaleY
    );
  }

  // Update UI
  function updateUI() {
    document.getElementById("healthCount").textContent = player.health.toFixed(0);
    document.getElementById("xpCount").textContent = player.xp.toFixed(0);
    document.getElementById("levelCount").textContent = player.level;
    document.getElementById("foodCount").textContent = player.food;
    document.getElementById("woodCount").textContent = player.wood;
    document.getElementById("stoneCount").textContent = player.stone;
    document.getElementById("goldCount").textContent = player.gold;
    document.getElementById("playerName").textContent = player.name;

    // Leaderboard update (sort by gold descending)
    const lbList = document.getElementById("leaderboardList");
    players.sort((a, b) => b.gold - a.gold);
    lbList.innerHTML = "";
    for (let p of players) {
      const div = document.createElement("div");
      div.className = "leaderboard-entry";
      div.textContent = `${p.name} - Gold: ${p.gold}`;
      lbList.appendChild(div);
    }
  }

  // Main game loop
  let lastTime = performance.now();
  function gameLoop(time) {
    let deltaTime = time - lastTime;
    lastTime = time;

    // Update
    movePlayer();
    updatePlayerAngle();
    tryLevelUp();
    harvestResources(deltaTime / 16);
    updateAnimals(deltaTime / 16);
    updateEnemies(deltaTime / 16);

    // Attack cooldown
    if (player.attackCooldown > 0) player.attackCooldown -= deltaTime;

    // Camera follows player
    camera.x = player.x - WIDTH / 2;
    camera.y = player.y - HEIGHT / 2;

    // Clamp camera inside map
    camera.x = Math.max(0, Math.min(camera.x, MAP_COLS * TILE_SIZE - WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, MAP_ROWS * TILE_SIZE - HEIGHT));

    // Draw
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawMap();
    drawResources();
    drawAnimals();
    drawEnemies();
    drawPlayer();
    drawDayNightCycle();
    drawMinimap();
    updateUI();

    requestAnimationFrame(gameLoop);
  }

  // Click or space to attack
  window.addEventListener("mousedown", playerAttack);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") playerAttack();
  });

  // Start
  gameLoop(lastTime);
})();
