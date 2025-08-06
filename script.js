(() => {
  // Setup canvas to full screen size dynamically
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  let WIDTH, HEIGHT;

  function resize() {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
  }
  window.addEventListener("resize", resize);
  resize();

  const TILE_SIZE = 64;

  // Map layout based on your description (9 rows, 30 cols)
  // Biomes: arctic top 2 rows, grass 3 rows (mixed), river 1 row near bottom, desert 2 rows bottom-right, grass fill rest
  const MAP_ROWS = 9;
  const MAP_COLS = 30;

  // We'll create a biome grid matching your map text:
  // Row 0-1: arctic (entire width)
  // Row 2-3: grass (entire width)
  // Row 4: river (entire width)
  // Row 5-6: grass (entire width)
  // Row 7-8: desert (entire width)

  const biomeColors = {
    river: "#3366cc",
    desert: "#d2b48c",
    arctic: "#a0c8f0",
    grass: "#3c8d0d",
  };

  // Generate the biome map grid
  let mapBiomes = [];
  for(let y=0; y < MAP_ROWS; y++){
    mapBiomes[y] = [];
    for(let x=0; x < MAP_COLS; x++){
      if(y <= 1) mapBiomes[y][x] = "arctic";
      else if(y <= 3) mapBiomes[y][x] = "grass";
      else if(y === 4) mapBiomes[y][x] = "river";
      else if(y <= 6) mapBiomes[y][x] = "grass";
      else mapBiomes[y][x] = "desert";
    }
  }

  // Resource node types
  const NODE_TYPES = {
    tree: { resource: 'wood', hp: 10, emoji: '🌳', color: '#228B22' },
    rock: { resource: 'stone', hp: 15, emoji: '🪨', color: '#888' },
    berry: { resource: 'food', hp: 8, emoji: '🫐', color: '#cc0066' },
    gold: { resource: 'gold', hp: 8, emoji: '🥇', color: '#ffd700' },
  };

  // Resource nodes list
  let resourceNodes = [];

  function placeResourceNodes() {
    resourceNodes = [];
    for(let i=0; i < 150; i++) {
      let xTile = Math.floor(Math.random()*MAP_COLS);
      let yTile = Math.floor(Math.random()*MAP_ROWS);
      let biome = mapBiomes[yTile][xTile];

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
        x: xTile * TILE_SIZE + TILE_SIZE/2 + (Math.random()*20 - 10),
        y: yTile * TILE_SIZE + TILE_SIZE/2 + (Math.random()*20 - 10),
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

  // Animals list (simple roaming circles)
  const animals = [];
  function spawnAnimal(x,y) {
    animals.push({
      x,y,
      radius: 15,
      speed: 1.2,
      direction: Math.random()*Math.PI*2,
      color: "#aa8855",
    });
  }
  // Spawn some animals scattered
  for(let i=0; i<30; i++) {
    spawnAnimal(
      Math.random()*MAP_COLS*TILE_SIZE,
      Math.random()*MAP_ROWS*TILE_SIZE
    );
  }

  // Other players for leaderboard demo (static)
  let players = [
    {name: "Player1", gold: 0},
    {name: "Alice", gold: 50},
    {name: "Bob", gold: 30},
    {name: "Eve", gold: 10},
  ];

  // Input handling
  let keys = {};
  window.addEventListener("keydown", e => {
    if(e.repeat) return;
    keys[e.key.toLowerCase()] = true;

    // Hotbar toggle 1-9 keys
    if(e.key >= "1" && e.key <= "9") {
      const hotbar = document.getElementById("hotbar");
      if(hotbar.classList.contains("hidden")){
        hotbar.classList.remove("hidden");
      } else {
        hotbar.classList.add("hidden");
      }
    }
  });
  window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
  });

  // Hotbar slots click & selection
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
  const canvasRect = canvas.getBoundingClientRect();
  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  // Camera object
  let camera = { x: 0, y: 0 };

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
      player.x = Math.max(player.radius, Math.min(player.x, MAP_COLS*TILE_SIZE - player.radius));
      player.y = Math.max(player.radius, Math.min(player.y, MAP_ROWS*TILE_SIZE - player.radius));
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

  // Enemies (wolves) roaming and chasing player
  const enemies = [];
  function spawnEnemy(x,y){
    enemies.push({
      x,y,
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
  // Spawn some enemies randomly in grass biome
  for(let i=0; i < 20; i++){
    let x = Math.random()*MAP_COLS*TILE_SIZE;
    let y = (2 + Math.random()*4)*TILE_SIZE; // rows 2 to 6 ~ grass
    spawnEnemy(x,y);
  }

  // Enemy AI movement
  function updateEnemies(deltaTime) {
    for(let enemy of enemies){
      if(enemy.health <= 0) continue;
      // Chase player if close enough
      const distToPlayer = dist(enemy.x, enemy.y, player.x, player.y);
      if(distToPlayer < 200){
        const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.angle = angleToPlayer;
        enemy.x += Math.cos(enemy.angle) * enemy.speed;
        enemy.y += Math.sin(enemy.angle) * enemy.speed;

        // Attack player
        if(distToPlayer < enemy.radius + player.radius + 10 && enemy.attackCooldown <= 0){
          player.health -= 10;
          enemy.attackCooldown = 1500;
        }
      } else {
        // Roam randomly
        if(Math.random() < 0.02) enemy.angle = Math.random()*Math.PI*2;
        enemy.x += Math.cos(enemy.angle) * enemy.speed * 0.5;
        enemy.y += Math.sin(enemy.angle) * enemy.speed * 0.5;
      }

      // Decrease cooldown
      if(enemy.attackCooldown > 0) enemy.attackCooldown -= deltaTime;

      // Clamp enemy inside map
      enemy.x = Math.max(enemy.radius, Math.min(enemy.x, MAP_COLS*TILE_SIZE - enemy.radius));
      enemy.y = Math.max(enemy.radius, Math.min(enemy.y, MAP_ROWS*TILE_SIZE - enemy.radius));
    }
  }

  // Animal AI movement
  function updateAnimals(deltaTime) {
    for(let animal of animals){
      // Random wandering
      if(Math.random() < 0.01) animal.direction += (Math.random()-0.5)*Math.PI/2;
      animal.x += Math.cos(animal.direction)*animal.speed;
      animal.y += Math.sin(animal.direction)*animal.speed;

      // Clamp inside map
      animal.x = Math.max(animal.radius, Math.min(animal.x, MAP_COLS*TILE_SIZE - animal.radius));
      animal.y = Math.max(animal.radius, Math.min(animal.y, MAP_ROWS*TILE_SIZE - animal.radius));
    }
  }

  // Draw Map
  function drawMap() {
    const startX = Math.floor(camera.x / TILE_SIZE);
    const startY = Math.floor(camera.y / TILE_SIZE);
    const endX = Math.ceil((camera.x + WIDTH) / TILE_SIZE);
    const endY = Math.ceil((camera.y + HEIGHT) / TILE_SIZE);

    for(let y=startY; y < endY; y++){
      for(let x=startX; x < endX; x++){
        if(y < 0 || x < 0 || y >= MAP_ROWS || x >= MAP_COLS) continue;
        let biome = mapBiomes[y][x];
        ctx.fillStyle = biomeColors[biome] || "#000";
        ctx.fillRect(x*TILE_SIZE - camera.x, y*TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);

        // Draw tile border
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.strokeRect(x*TILE_SIZE - camera.x, y*TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);

        // Special river border lines for clarity
        if(biome === "river"){
          ctx.strokeStyle = "#224488";
          ctx.lineWidth = 2;
          ctx.strokeRect(x*TILE_SIZE - camera.x, y*TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Draw map border rectangle
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 5;
    ctx.strokeRect(0 - camera.x, 0 - camera.y, MAP_COLS*TILE_SIZE, MAP_ROWS*TILE_SIZE);
  }

  // Draw resources nodes
  function drawResources() {
    for(let node of resourceNodes){
      if(node.hp <= 0) continue;
      const screenX = node.x - camera.x;
      const screenY = node.y - camera.y;

      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, node.radius, 0, Math.PI*2);
      ctx.fill();

      ctx.font = "24px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(node.emoji, screenX, screenY+8);

      // HP bar
      ctx.fillStyle = "red";
      ctx.fillRect(screenX - 15, screenY + node.radius + 8, 30, 6);
      ctx.fillStyle = "lime";
      ctx.fillRect(screenX - 15, screenY + node.radius + 8, 30 * (node.hp/node.maxHp), 6);
    }
  }

  // Draw player as circle with outline & directional "head" triangle
  function drawPlayer() {
    const screenX = WIDTH/2;
    const screenY = HEIGHT/2;

    // Body
    ctx.fillStyle = "#66ff66";
    ctx.strokeStyle = "#004400";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Rounded edges but no overlap between segments means just a circle for player body
    ctx.arc(screenX, screenY, player.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Head - triangle pointing in player.angle direction
    const headSize = 18;
    ctx.fillStyle = "#88ff88";
    ctx.beginPath();
    const hx = screenX + Math.cos(player.angle) * (player.radius + headSize/2);
    const hy = screenY + Math.sin(player.angle) * (player.radius + headSize/2);
    ctx.moveTo(hx, hy);
    ctx.lineTo(
      screenX + Math.cos(player.angle + Math.PI*0.75) * headSize,
      screenY + Math.sin(player.angle + Math.PI*0.75) * headSize
    );
    ctx.lineTo(
      screenX + Math.cos(player.angle - Math.PI*0.75) * headSize,
      screenY + Math.sin(player.angle - Math.PI*0.75) * headSize
    );
    ctx.closePath();
    ctx.fill();

    // Draw player name below player circle
    ctx.font = "18px Arial";
    ctx.fillStyle = "#55ff55";
    ctx.textAlign = "center";
    ctx.fillText(player.name, screenX, screenY + player.radius + 24);
  }

  // Draw enemies as red circles with health bars
  function drawEnemies() {
    for(let enemy of enemies){
      if(enemy.health <= 0) continue;
      const screenX = enemy.x - camera.x;
      const screenY = enemy.y - camera.y;

      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = "#880000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, enemy.radius, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();

      // Health bar
      ctx.fillStyle = "red";
      ctx.fillRect(screenX - 15, screenY + enemy.radius + 8, 30, 6);
      ctx.fillStyle = "lime";
      ctx.fillRect(screenX - 15, screenY + enemy.radius + 8, 30 * (enemy.health/enemy.maxHealth), 6);
    }
  }

  // Draw animals as brown circles
  function drawAnimals() {
    for(let animal of animals){
      const screenX = animal.x - camera.x;
      const screenY = animal.y - camera.y;

      ctx.fillStyle = animal.color;
      ctx.strokeStyle = "#664422";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, animal.radius, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Draw UI stats
  function updateUI() {
    document.getElementById("foodCount").textContent = player.food;
    document.getElementById("woodCount").textContent = player.wood;
    document.getElementById("stoneCount").textContent = player.stone;
    document.getElementById("goldCount").textContent = player.gold;
    document.getElementById("healthCount").textContent = Math.floor(player.health);
    document.getElementById("xpCount").textContent = player.xp;
    document.getElementById("levelCount").textContent = player.level;
    document.getElementById("playerName").textContent = player.name;
  }

  // Minimap setup and draw
  const minimapCanvas = document.getElementById("minimap");
  const mmCtx = minimapCanvas.getContext("2d");
  const mmWidth = minimapCanvas.width;
  const mmHeight = minimapCanvas.height;

  function drawMinimap() {
    mmCtx.clearRect(0, 0, mmWidth, mmHeight);
    const scaleX = mmWidth / (MAP_COLS * TILE_SIZE);
    const scaleY = mmHeight / (MAP_ROWS * TILE_SIZE);

    // Draw map tiles
    for(let y=0; y < MAP_ROWS; y++) {
      for(let x=0; x < MAP_COLS; x++) {
        mmCtx.fillStyle = biomeColors[mapBiomes[y][x]] || "#000";
        mmCtx.fillRect(x*TILE_SIZE*scaleX, y*TILE_SIZE*scaleY, TILE_SIZE*scaleX, TILE_SIZE*scaleY);
      }
    }

    // Draw player as white dot
    mmCtx.fillStyle = "#fff";
    mmCtx.beginPath();
    mmCtx.arc(player.x*scaleX, player.y*scaleY, 5, 0, Math.PI*2);
    mmCtx.fill();

    // Draw enemies as red dots
    mmCtx.fillStyle = "#ff5555";
    enemies.forEach(e => {
      if(e.health > 0) {
        mmCtx.beginPath();
        mmCtx.arc(e.x*scaleX, e.y*scaleY, 3, 0, Math.PI*2);
        mmCtx.fill();
      }
    });

    // Draw animals as brown dots
    mmCtx.fillStyle = "#aa8855";
    animals.forEach(a => {
      mmCtx.beginPath();
      mmCtx.arc(a.x*scaleX, a.y*scaleY, 3, 0, Math.PI*2);
      mmCtx.fill();
    });
  }

  // Leaderboard update
  function updateLeaderboard() {
    const lbList = document.getElementById("leaderboardList");
    players[0].gold = player.gold; // Sync player gold to leaderboard

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

  // Main game loop
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
    updateAnimals(deltaTime);
    tryLevelUp();

    // Update camera to center on player
    camera.x = player.x - WIDTH/2;
    camera.y = player.y - HEIGHT/2;
    // Clamp camera to map bounds
    camera.x = Math.max(0, Math.min(camera.x, MAP_COLS*TILE_SIZE - WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, MAP_ROWS*TILE_SIZE - HEIGHT));

    // Draw
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    drawMap();
    drawResources();
    drawAnimals();
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

  // Day time counter for tint
  let dayTime = 0;

  // Input for player attack
  window.addEventListener("mousedown", e => playerAttack());
  window.addEventListener("keydown", e => {
    if(e.key === " "){
      e.preventDefault();
      playerAttack();
    }
  });

  gameLoop();
})();
