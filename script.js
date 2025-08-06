(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const TILE_SIZE = 64;
  const MAP_TILES_X = 30;
  const MAP_TILES_Y = 30;

  // Biome colors
  const biomeColors = {
    river: "#3366cc",
    desert: "#d2b48c",
    arctic: "#a0c8f0",
    grass: "#3c8d0d",
  };

  // Generate map biomes
  let mapBiomes = [];
  function generateMapBiomes() {
    for(let y=0; y < MAP_TILES_Y; y++) {
      mapBiomes[y] = [];
      for(let x=0; x < MAP_TILES_X; x++) {
        let riverStartY = Math.floor(MAP_TILES_Y*0.75);
        let riverEndY = MAP_TILES_Y - 1;
        let arcticEndY = Math.floor(MAP_TILES_Y*0.2);
        let desertMaxX = Math.floor(MAP_TILES_X*0.33);
        if(y >= riverStartY && y <= riverEndY) mapBiomes[y][x] = "river";
        else if(y <= arcticEndY) mapBiomes[y][x] = "arctic";
        else if(x <= desertMaxX && y > riverStartY) mapBiomes[y][x] = "desert";
        else mapBiomes[y][x] = "grass";
      }
    }
  }
  generateMapBiomes();

  // Resource nodes types
  const NODE_TYPES = {
    tree: { resource: 'wood', hp: 10, emoji: '🌳', color: '#228B22' },
    rock: { resource: 'stone', hp: 15, emoji: '🪨', color: '#888' },
    berry: { resource: 'food', hp: 8, emoji: '🫐', color: '#cc0066' },
    gold: { resource: 'gold', hp: 8, emoji: '🥇', color: '#ffd700' },
  };

  // Create resource nodes on map
  let resourceNodes = [];

  function placeResourceNodes() {
    resourceNodes = [];
    for(let i=0; i < 80; i++) {
      let x = Math.floor(Math.random()*MAP_TILES_X)*TILE_SIZE + TILE_SIZE/2;
      let y = Math.floor(Math.random()*MAP_TILES_Y)*TILE_SIZE + TILE_SIZE/2;
      let tileX = Math.floor(x / TILE_SIZE);
      let tileY = Math.floor(y / TILE_SIZE);
      let biome = mapBiomes[tileY][tileX];

      let possibleTypes = [];
      switch(biome){
        case "grass": possibleTypes = ['tree', 'berry']; break;
        case "river": possibleTypes = ['berry']; break;
        case "desert": possibleTypes = ['rock']; break;
        case "arctic": possibleTypes = ['rock', 'gold']; break;
      }
      if(possibleTypes.length === 0) possibleTypes = ['tree'];

      let typeKey = possibleTypes[Math.floor(Math.random()*possibleTypes.length)];
      let nodeType = NODE_TYPES[typeKey];

      resourceNodes.push({
        x, y,
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
    x: MAP_TILES_X * TILE_SIZE / 2,
    y: MAP_TILES_Y * TILE_SIZE / 2,
    radius: 20,
    speed: 3,
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

  // Other players for leaderboard demo (static)
  let players = [
    {name: "Player1", gold: 0},
    {name: "Alice", gold: 50},
    {name: "Bob", gold: 30},
    {name: "Eve", gold: 10},
  ];

  // Enemy AI (wolves)
  let enemies = [];
  function spawnEnemy(x,y) {
    enemies.push({
      x,y,
      radius: 18,
      speed: 2.2,
      health: 40,
      maxHealth: 40,
      target: null,
      attackCooldown: 0,
    });
  }
  for(let i=0; i<10; i++){
    spawnEnemy(
      Math.random()*MAP_TILES_X*TILE_SIZE,
      Math.random()*MAP_TILES_Y*TILE_SIZE
    );
  }

  // Input handling
  let keys = {};
  window.addEventListener("keydown", e => {
    if(e.repeat) return;
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
  });

  // Hotbar slots and tools
  const hotbarSlots = document.querySelectorAll('.hotbar-slot');
  hotbarSlots.forEach(slot => {
    slot.addEventListener('click', () => {
      hotbarSlots.forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      player.selectedTool = Number(slot.dataset.index);
    });
  });

  // Mouse to rotate player
  let mouse = { x: WIDTH/2, y: HEIGHT/2 };
  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  // Camera object
  let camera = {
    x: 0,
    y: 0,
  };

  // Day-night cycle state
  let dayTime = 0; // 0 to 1, where 0 is midnight, 0.5 is noon

  // XP needed per level
  function xpToNextLevel(level) {
    return 10 + level * 5;
  }

  // Level up player if XP enough
  function tryLevelUp() {
    while(player.xp >= xpToNextLevel(player.level)) {
      player.xp -= xpToNextLevel(player.level);
      player.level++;
      player.health = Math.min(player.maxHealth, player.health + 10);
    }
  }

  // Distance helper
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // Movement
  function movePlayer() {
    let dx=0, dy=0;
    if(keys["w"] || keys["arrowup"]) dy -= 1;
    if(keys["s"] || keys["arrowdown"]) dy += 1;
    if(keys["a"] || keys["arrowleft"]) dx -= 1;
    if(keys["d"] || keys["arrowright"]) dx += 1;

    let len = Math.hypot(dx, dy);
    if(len > 0){
      dx /= len;
      dy /= len;

      player.x += dx * player.speed;
      player.y += dy * player.speed;

      // Clamp position inside map
      player.x = Math.max(player.radius, Math.min(player.x, MAP_TILES_X*TILE_SIZE - player.radius));
      player.y = Math.max(player.radius, Math.min(player.y, MAP_TILES_Y*TILE_SIZE - player.radius));
    }
  }

  // Update player facing angle toward mouse on canvas
  function updatePlayerAngle() {
    player.angle = Math.atan2(mouse.y - HEIGHT/2, mouse.x - WIDTH/2);
  }

  // Player attack function (melee)
  function playerAttack() {
    if(player.attackCooldown > 0) return;
    const selectedTool = player.selectedTool;

    const cooldownTimes = [600, 800, 400, 1200]; // axe, pickaxe, sword, food
    player.attackCooldown = cooldownTimes[selectedTool];

    if(selectedTool === 2){
      // Attack closest enemy in range 50
      for(let enemy of enemies){
        if(enemy.health <= 0) continue;
        if(dist(player.x, player.y, enemy.x, enemy.y) < 50){
          enemy.health -= 25; // sword damage
          if(enemy.health <= 0){
            player.xp += 5;
            player.gold += 3;
            players[0].gold = player.gold;
          }
          break;
        }
      }
    } else if (selectedTool === 3){
      // Use food to heal if any
      if(player.inventory.food > 0 && player.health < player.maxHealth){
        player.health = Math.min(player.maxHealth, player.health + 30);
        player.inventory.food--;
      }
    }
  }

  // Harvest resources
  function harvestResources(deltaTime) {
    if(player.attackCooldown > 0) return;

    for(let node of resourceNodes){
      if(node.hp <= 0) continue;
      let d = dist(player.x, player.y, node.x, node.y);
      if(d < player.radius + node.radius + 10){
        if(node.type === 'tree' && player.selectedTool === 0){ // axe
          node.hp -= deltaTime * 10;
          if(node.hp <= 0){
            player.wood += 5;
            player.xp += 2;
            node.hp = 0;
          }
          player.attackCooldown = 500;
          break;
        }
        else if(node.type === 'rock' && player.selectedTool === 1){ // pickaxe
          node.hp -= deltaTime * 10;
          if(node.hp <= 0){
            player.stone += 4;
            player.xp += 2;
            node.hp = 0;
          }
          player.attackCooldown = 700;
          break;
        }
        else if(node.type === 'berry'){
          if(d < player.radius + node.radius){
            player.food += 2;
            player.xp += 1;
            node.hp = 0;
          }
        }
        else if(node.type === 'gold' && player.selectedTool === 1){
          node.hp -= deltaTime * 10;
          if(node.hp <= 0){
            player.gold += 3;
            player.xp += 3;
            node.hp = 0;
          }
          player.attackCooldown = 800;
          break;
        }
      }
    }
  }

  // Respawn resource nodes with cooldown
  const RESOURCE_RESPAWN_TIME = 30000; // 30 seconds
  let resourceRespawnTimer = 0;
  function respawnResources(deltaTime) {
    resourceRespawnTimer += deltaTime;
    if(resourceRespawnTimer >= RESOURCE_RESPAWN_TIME){
      resourceRespawnTimer = 0;
      placeResourceNodes();
    }
  }

  // Enemy AI logic
  function updateEnemies(deltaTime) {
    for(let enemy of enemies){
      if(enemy.health <= 0) continue;

      // Attack cooldown
      if(enemy.attackCooldown > 0) enemy.attackCooldown -= deltaTime;

      // Move toward player if close
      let d = dist(enemy.x, enemy.y, player.x, player.y);

      if(d < 300){
        // Move closer
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let len = Math.hypot(dx, dy);
        if(len > 0){
          dx /= len; dy /= len;
          enemy.x += dx * enemy.speed;
          enemy.y += dy * enemy.speed;
        }

        // Attack if close enough
        if(d < 40 && enemy.attackCooldown <= 0){
          player.health -= 10;
          enemy.attackCooldown = 1500;
          if(player.health <= 0){
            // Player died - reset stats and position
            player.health = player.maxHealth;
            player.x = MAP_TILES_X * TILE_SIZE / 2;
            player.y = MAP_TILES_Y * TILE_SIZE / 2;
            player.wood = 0;
            player.stone = 0;
            player.food = 0;
            player.gold = 0;
            player.xp = 0;
            player.level = 1;
            players[0].gold = player.gold;
          }
        }
      }
    }
  }

  // Draw map
  function drawMap() {
    const startX = Math.floor(camera.x / TILE_SIZE);
    const startY = Math.floor(camera.y / TILE_SIZE);
    const endX = Math.ceil((camera.x + WIDTH) / TILE_SIZE);
    const endY = Math.ceil((camera.y + HEIGHT) / TILE_SIZE);

    for(let y=startY; y < endY; y++){
      for(let x=startX; x < endX; x++){
        if(y < 0 || x < 0 || y >= MAP_TILES_Y || x >= MAP_TILES_X) continue;
        let biome = mapBiomes[y][x];
        ctx.fillStyle = biomeColors[biome] || "#000";
        ctx.fillRect(x*TILE_SIZE - camera.x, y*TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);

        // Draw river border lines for clarity
        if(biome === "river"){
          ctx.strokeStyle = "#224488";
          ctx.lineWidth = 2;
          ctx.strokeRect(x*TILE_SIZE - camera.x, y*TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // Draw resource nodes
  function drawResources() {
    for(let node of resourceNodes){
      if(node.hp <= 0) continue;
      const screenX = node.x - camera.x;
      const screenY = node.y - camera.y;

      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, node.radius, 0, Math.PI*2);
      ctx.fill();

      ctx.font = "20px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(node.emoji, screenX, screenY+6);

      // HP bar
      ctx.fillStyle = "red";
      ctx.fillRect(screenX - 15, screenY + node.radius + 5, 30, 5);
      ctx.fillStyle = "lime";
      ctx.fillRect(screenX - 15, screenY + node.radius + 5, 30 * (node.hp/node.maxHp), 5);
    }
  }

  // Draw player as circle with outline & directional "head"
  function drawPlayer() {
    const screenX = WIDTH/2;
    const screenY = HEIGHT/2;

    // Body
    ctx.fillStyle = "#66ff66";
    ctx.strokeStyle = "#004400";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, player.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Head - triangle pointing in player.angle direction
    const headSize = 14;
    ctx.fillStyle = "#88ff88";
    ctx.beginPath();
    const hx = screenX + Math.cos(player.angle) * (player.radius + headSize/2);
    const hy = screenY + Math.sin(player.angle) * (player.radius + headSize/2);
    ctx.moveTo(hx, hy);
    ctx.lineTo(
      screenX + Math.cos(player.angle + Math.PI*0.8) * headSize,
      screenY + Math.sin(player.angle + Math.PI*0.8) * headSize
    );
    ctx.lineTo(
      screenX + Math.cos(player.angle - Math.PI*0.8) * headSize,
      screenY + Math.sin(player.angle - Math.PI*0.8) * headSize
    );
    ctx.closePath();
    ctx.fill();
  }

  // Draw enemies as red circles
  function drawEnemies() {
    for(let enemy of enemies){
      if(enemy.health <= 0) continue;
      const screenX = enemy.x - camera.x;
      const screenY = enemy.y - camera.y;

      ctx.fillStyle = "#cc4444";
      ctx.strokeStyle = "#880000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, enemy.radius, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();

      // Health bar
      ctx.fillStyle = "red";
      ctx.fillRect(screenX - 15, screenY + enemy.radius + 5, 30, 5);
      ctx.fillStyle = "lime";
      ctx.fillRect(screenX - 15, screenY + enemy.radius + 5, 30 * (enemy.health/enemy.maxHealth), 5);
    }
  }

  // Draw UI stats
  function updateUI() {
    document.getElementById("foodCount").textContent = player.food;
    document.getElementById("woodCount").textContent = player.wood;
    document.getElementById("stoneCount").textContent = player.stone;
    document.getElementById("goldCount").textContent = player.gold;
    document.getElementById("healthCount").textContent = player.health;
    document.getElementById("xpCount").textContent = player.xp;
    document.getElementById("levelCount").textContent = player.level;
  }

  // Draw minimap
  const minimapCanvas = document.getElementById("minimap");
  const mmCtx = minimapCanvas.getContext("2d");
  const mmWidth = minimapCanvas.width;
  const mmHeight = minimapCanvas.height;

  function drawMinimap() {
    mmCtx.clearRect(0, 0, mmWidth, mmHeight);
    const scaleX = mmWidth / (MAP_TILES_X * TILE_SIZE);
    const scaleY = mmHeight / (MAP_TILES_Y * TILE_SIZE);

    // Draw map tiles
    for(let y=0; y < MAP_TILES_Y; y++) {
      for(let x=0; x < MAP_TILES_X; x++) {
        mmCtx.fillStyle = biomeColors[mapBiomes[y][x]] || "#000";
        mmCtx.fillRect(x*TILE_SIZE*scaleX, y*TILE_SIZE*scaleY, TILE_SIZE*scaleX, TILE_SIZE*scaleY);
      }
    }
    // Draw player as white dot
    mmCtx.fillStyle = "#fff";
    mmCtx.beginPath();
    mmCtx.arc(player.x*scaleX, player.y*scaleY, 5, 0, Math.PI*2);
    mmCtx.fill();
  }

  // Draw leaderboard UI
  function updateLeaderboard() {
    const lbList = document.getElementById("leaderboardList");
    // Sort players by gold descending
    players.sort((a,b) => b.gold - a.gold);

    lbList.innerHTML = "";
    for(let p of players){
      const div = document.createElement("div");
      div.className = "leaderboard-entry";
      div.textContent = p.name;
      const goldSpan = document.createElement("span");
      goldSpan.textContent = p.gold;
      div.appendChild(goldSpan);
      lbList.appendChild(div);
    }
  }

  // Game loop
  let lastTime = 0;
  function gameLoop(timestamp=0){
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Update
    if(player.attackCooldown > 0){
      player.attackCooldown -= deltaTime;
      if(player.attackCooldown < 0) player.attackCooldown = 0;
    }
    movePlayer();
    updatePlayerAngle();
    harvestResources(deltaTime / 16);
    respawnResources(deltaTime);
    updateEnemies(deltaTime);
    tryLevelUp();

    // Update camera to center on player
    camera.x = player.x - WIDTH/2;
    camera.y = player.y - HEIGHT/2;
    // Clamp camera to map bounds
    camera.x = Math.max(0, Math.min(camera.x, MAP_TILES_X*TILE_SIZE - WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, MAP_TILES_Y*TILE_SIZE - HEIGHT));

    // Draw
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    drawMap();
    drawResources();
    drawEnemies();
    drawPlayer();

    updateUI();
    updateLeaderboard();
    drawMinimap();

    // Overlay day/night tint
    dayTime += deltaTime/30000;
    if(dayTime > 1) dayTime = 0;
    const nightAlpha = Math.abs(Math.cos(dayTime * Math.PI * 2)) * 0.5;
    ctx.fillStyle = `rgba(0,0,50,${nightAlpha})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);

  // Player attack input on mouse click or spacebar
  window.addEventListener("mousedown", e => playerAttack());
  window.addEventListener("keydown", e => {
    if(e.key === " "){
      e.preventDefault();
      playerAttack();
    }
  });
})();
