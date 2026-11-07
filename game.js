const SPEED = 6;
const JUMP_VELOCITY = 11;
const GRAVITY = 30;
const BULLET_SPEED = 9;
const PLAYER_BULLET_SPEED = 40;
let bossHp = 500; // 難易度で変わる
const BOSS_STEP = 100; // このダメージごとに問題が変わる
const BOSS_SHOT_INTERVAL = 1.2;
const BOSS_CHARGE_INTERVAL = 7; // 突進の間隔
const BOSS_WINDUP = 1; // 突進前の予備動作(赤く点滅)
const BOSS_CHARGE_MAX_TIME = 5; // 壁にぶつからなくても、これで止まる(保険)
const BOSS_STUN_TIME = 1.5;
const BOSS_CHARGE_SPEED = 20;
const BOSS_RAIN_INTERVAL = 5; // 降ってくる攻撃の間隔
const RAIN_WARN = 1.2; // 落ちてくるまでの警告時間
const RAIN_RADIUS = 1.6;
const ENEMY_SHOT_INTERVAL = 2.5;
const ENEMY_SHOT_RANGE = 25;
const ENEMY_PATROL_RADIUS = 3;
const ENEMY_PATROL_SPEED = 0.6;
const INVINCIBLE_TIME = 1.5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(5, 10, 5);
sun.castShadow = true;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

// 地面
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x4a7a4a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(200, 100, 0x000000, 0x335533));

// 当たり判定のある障害物(壁・箱)。中心(x,z)、底面y=0、大きさ(w,h,d)
const solids = [];
function addSolid(x, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const solid = {
    minX: x - w / 2, maxX: x + w / 2,
    minY: 0, maxY: h,
    minZ: z - d / 2, maxZ: z + d / 2,
  };
  solids.push(solid);
  return { mesh, solid };
}

// 外周の壁
const FIELD = 30;
const WALL_T = 1;
const WALL_H = 4;
addSolid(0, -FIELD, FIELD * 2 + WALL_T, WALL_H, WALL_T, 0x888888);
addSolid(0, FIELD, FIELD * 2 + WALL_T, WALL_H, WALL_T, 0x888888);
addSolid(-FIELD, 0, WALL_T, WALL_H, FIELD * 2 + WALL_T, 0x888888);
addSolid(FIELD, 0, WALL_T, WALL_H, FIELD * 2 + WALL_T, 0x888888);

// 内側の壁
addSolid(-8, -10, 12, 3, 1, 0xaa7755);
addSolid(10, -14, 1, 3, 14, 0xaa7755);
addSolid(0, 8, 8, 2, 1, 0xaa7755);
addSolid(-20, -6, 1, 3, 10, 0xaa7755);
addSolid(20, 5, 10, 3, 1, 0xaa7755);
addSolid(-14, 12, 1, 3, 8, 0xaa7755);
addSolid(14, 0, 6, 2.5, 1, 0xaa7755);
addSolid(-4, -18, 8, 3, 1, 0xaa7755);
addSolid(22, -10, 1, 3, 8, 0xaa7755);

// 柱
for (const [x, z] of [[6, 4], [-8, 4], [-16, -12], [8, -4], [-10, -24], [18, 22], [-24, 0], [4, -24]]) {
  addSolid(x, z, 2, 3, 2, 0x998877);
}

// 敵(頭の上に1~10の掛け算を表示。正解すると倒れる)
const ENEMY_H = 1.6;
const enemies = [];

function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0, 0, 0, 0.7)";
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#fff";
  g.font = "bold 64px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 64);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true })
  );
  sprite.scale.set(2.4, 1.2, 1);
  return sprite;
}

// 体力バー(敵の頭の上)
function makeHpBar() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sprite.scale.set(2.4, 0.3, 1);
  return { sprite, c, tex };
}

function drawHpBar(en) {
  const g = en.bar.c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = "#3c3";
  g.fillRect(4, 4, 248 * Math.max(0, en.hp) / en.maxHp, 24);
  en.bar.tex.needsUpdate = true;
}

// 出題する計算の種類(スタート画面で選ぶ)。答えはいつも1以上の整数
let operators = ["×"];

function randomProblem() {
  const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const op = operators[rand(0, operators.length - 1)];
  const a = rand(1, 10);
  const b = rand(1, 10);
  if (op === "＋") return { text: `${a} ＋ ${b}`, answer: a + b };
  if (op === "－") {
    const big = rand(2, 20);
    const small = rand(1, big - 1);
    return { text: `${big} － ${small}`, answer: big - small };
  }
  if (op === "÷") return { text: `${a * b} ÷ ${a}`, answer: b };
  return { text: `${a} × ${b}`, answer: a * b };
}

function addEnemy(x, z, boss = false) {
  const problem = randomProblem();
  // ボスは大きくて、体力500・動き回る範囲も広い
  const s = boss ? 1.5 : 1;
  const w = boss ? 2.4 : 1.2;
  const h = boss ? 3.2 : ENEMY_H;
  // 敵は動くので壁・箱の当たり判定には入れない
  const { mesh, solid } = addSolid(x, z, w, h, w, boss ? 0x7722aa : 0xcc3333);
  solids.splice(solids.indexOf(solid), 1);
  const label = makeLabel(problem.text);
  label.scale.set(2.4 * s, 1.2 * s, 1);
  label.position.set(x, h + s, z);
  scene.add(label);
  const bar = makeHpBar();
  bar.sprite.scale.set(2.4 * s, 0.3 * s, 1);
  scene.add(bar.sprite);
  // 体力は答えの数字と同じ(答えが大きいほどタフ)
  const hp = boss ? bossHp : problem.answer;
  const en = {
    mesh, label, bar, answer: problem.answer, hp, maxHp: hp, alive: true, fall: 0,
    w, h, s, boss, stage: 0,
    homeX: x, homeZ: z,
    radius: boss ? 5 : ENEMY_PATROL_RADIUS,
    shotInterval: boss ? BOSS_SHOT_INTERVAL : ENEMY_SHOT_INTERVAL,
    phase: Math.random() * Math.PI * 2,
    mode: "patrol", modeTime: 0, dashDir: new THREE.Vector3(),
    chargeTimer: BOSS_CHARGE_INTERVAL, rainTimer: 3,
  };
  en.shotTimer = 1 + Math.random() * en.shotInterval;
  enemies.push(en);
  drawHpBar(en);
  return en;
}

// 弾
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });

function shoot(from, to) {
  const mesh = new THREE.Mesh(bulletGeo, bulletMat);
  mesh.position.copy(from);
  scene.add(mesh);
  const vel = to.clone().sub(from).normalize().multiplyScalar(BULLET_SPEED);
  bullets.push({ mesh, vel, life: 6 });
}

// ハート
let hearts = 3;
let maxHearts = 3;
let invincible = 0;
let gameOver = false;
let started = false;

// スタート画面: ボタン(またはEnter)でゲーム開始。そのままマウス操作に入る
const startEl = document.getElementById("start");
function startGame(difficulty) {
  if (started) return;
  // えらんだ計算の種類(「すべて」なら4種類全部)
  const checked = [...document.querySelectorAll("#ops input[value]:checked")].map((el) => el.value);
  operators = checked.length ? checked : ["×"];
  started = true;
  setupGame(difficulty);
  startEl.style.display = "none";
  renderer.domElement.requestPointerLock();
}
// 「すべて」を押すと4種類ぜんぶ選ぶ/外す。個別に外すと「すべて」も外れる
const opBoxes = [...document.querySelectorAll("#ops input[value]")];
const opsAll = document.getElementById("opsAll");
opsAll.addEventListener("change", () => {
  opBoxes.forEach((el) => (el.checked = opsAll.checked));
});
opBoxes.forEach((el) => {
  el.addEventListener("change", () => {
    opsAll.checked = opBoxes.every((b) => b.checked);
  });
});

document.querySelectorAll("[data-diff]").forEach((btn) => {
  btn.addEventListener("click", () => startGame(btn.dataset.diff));
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGame("normal");
});
const heartsEl = document.getElementById("hearts");
function drawHearts() {
  heartsEl.textContent = "❤".repeat(hearts) + "♡".repeat(maxHearts - hearts);
}
drawHearts();
document.getElementById("retry").addEventListener("click", () => location.reload());

const HEAL_AMOUNT = 5; // まちがった銃で撃ったときの、敵の回復量
const BOSS_POINTS = 1;

// ポイントで強くなる(キー 1:体力 2:攻撃力 3:足の速さ)
let playerDamage = 5;
let moveSpeed = SPEED;
let points = 0;
let wave = 1;
const upgrades = [
  { key: "1", name: "体力", level: 0, max: 5,
    apply() { maxHearts++; hearts++; drawHearts(); },
    info: () => `ハート最大${maxHearts}個` },
  { key: "2", name: "攻撃力", level: 0, max: 10,
    apply() { playerDamage += 5; },
    info: () => `1発${playerDamage}ダメージ` },
  { key: "3", name: "足の速さ", level: 0, max: 5,
    apply() { moveSpeed += 1; },
    info: () => `速さ${moveSpeed}` },
];
const upgradeCost = (u) => 2 + u.level;

function renderUpgrades() {
  const rows = upgrades.map((u) => {
    const cost = u.level >= u.max ? "MAX" : `${upgradeCost(u)}pt`;
    return `<div>[${u.key}] ${u.name} Lv${u.level} (${u.info()}) … ${cost}</div>`;
  });
  document.getElementById("upgrades").innerHTML =
    `<div>ウェーブ ${wave}</div><div>ポイント: ${points}</div>${rows.join("")}`;
}

window.addEventListener("keydown", (e) => {
  if (!started || gameOver) return;
  const u = upgrades.find((x) => x.key === e.key);
  if (!u) return;
  if (u.level >= u.max) {
    msg.textContent = `${u.name}はもう最大!`;
  } else if (points < upgradeCost(u)) {
    msg.textContent = `ポイントが足りない(${upgradeCost(u)}pt必要)`;
  } else {
    points -= upgradeCost(u);
    u.level++;
    u.apply();
    msg.textContent = `${u.name}アップ! ${u.info()}`;
  }
  renderUpgrades();
});

// プレイヤーがダメージを受ける(ハートが1つ減る。しばらくは無敵)
function damagePlayer() {
  if (invincible > 0 || gameOver) return;
  hearts--;
  invincible = INVINCIBLE_TIME;
  drawHearts();
  if (hearts <= 0) {
    gameOver = true;
    document.exitPointerLock();
    document.getElementById("gameover").style.display = "flex";
  }
}

// ボスの「上から降ってくる攻撃」(警告の赤い円 → 岩が落ちてくる)
const hazards = [];


// プレイヤー
const PLAYER_W = 0.8;
const PLAYER_H = 1.2;
const player = new THREE.Mesh(
  new THREE.BoxGeometry(PLAYER_W, PLAYER_H, PLAYER_W),
  new THREE.MeshStandardMaterial({ color: 0xe66633 })
);
player.castShadow = true;
player.position.y = PLAYER_H / 2;
scene.add(player);

function overlaps(s) {
  const p = player.position;
  const r = PLAYER_W / 2;
  return (
    p.x + r > s.minX && p.x - r < s.maxX &&
    p.y + PLAYER_H / 2 > s.minY && p.y - PLAYER_H / 2 < s.maxY &&
    p.z + r > s.minZ && p.z - r < s.maxZ
  );
}

// 手に持つ銃(答えを入力すると現れる)
let loadedAnswer = null;
const playerBullets = [];
scene.add(camera);
const gun = new THREE.Group();
gun.add(new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.14, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x333344 })
));
const gunLabel = makeLabel("");
gunLabel.material.depthTest = false;
gunLabel.scale.set(0.2, 0.1, 1);
gunLabel.position.set(0, 0.12, 0);
gun.add(gunLabel);
gun.position.set(0.3, -0.25, -0.6);
gun.visible = false;
camera.add(gun);

// 一人称視点: 自分の体は見えない。マウスで見回す(クリックで操作開始、Escで解除)
player.visible = false;
const EYE_OFFSET = 0.4;
const hitEl = document.getElementById("hit");
camera.rotation.order = "YXZ";
let yaw = 0;
let pitch = 0;

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0025;
  pitch -= e.movementY * 0.0025;
  pitch = Math.max(-1.4, Math.min(1.4, pitch));
});

function overlapsPoint(q) {
  const p = player.position;
  const r = PLAYER_W / 2 + 0.2;
  return (
    Math.abs(q.x - p.x) < r &&
    Math.abs(q.y - p.y) < PLAYER_H / 2 + 0.2 &&
    Math.abs(q.z - p.z) < r
  );
}

let vy = 0;
let onGround = true;
const keys = {};

window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});
const msg = document.getElementById("msg");

// 地面に落ちている銃(答えが書いてある)。近づくと拾える
const groundGuns = [];

function addGroundGun(x, z, answer, needLeave = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.25, 1),
    new THREE.MeshStandardMaterial({ color: 0x333344 })
  );
  body.castShadow = true;
  g.add(body);
  const label = makeLabel(String(answer));
  label.scale.set(1.2, 0.6, 1);
  label.position.y = 0.8;
  g.add(label);
  g.position.set(x, 0.6, z);
  scene.add(g);
  groundGuns.push({ mesh: g, answer, needLeave });
}

// 銃を手に持つ
function holdGun(answer) {
  loadedAnswer = answer;
  gun.visible = true;
  gunLabel.material.map = makeLabel(String(answer)).material.map;
  msg.textContent = `銃: ${answer} (右クリックで撃つ)`;
}

// 敵の答えと同じ数字の銃を、フィールドのあちこちに置く
const gunSpots = [
  [-2, 4], [8, 3], [-12, -6], [12, 8], [-8, 14], [18, -12],
  [-20, -15], [0, -20], [14, 20], [-18, 18], [24, 0], [-26, -5],
];
const enemySpots = [
  [-5, -6], [4, -7], [15, -5], [-15, 5], [6, 15],
  [-20, -18], [20, 15], [-10, 22], [22, -22], [-24, 10],
];

// 回復アイテム(ハートの形)。ハートが減っているときに近づくと1つ回復
const healItems = [];
const healSpots = [[-6, 0], [16, -18], [-22, 20], [26, 12], [0, -12]];
const heartGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
  g.translate(-0.25, -0.5, -0.125);
  return g;
})();
const heartMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0x660011 });

function addHealItem(x, z) {
  const mesh = new THREE.Mesh(heartGeo, heartMat);
  mesh.scale.setScalar(0.9);
  mesh.position.set(x, 1, z);
  mesh.castShadow = true;
  scene.add(mesh);
  healItems.push({ mesh, baseY: 1, t: Math.random() * 6 });
}

// 難易度ごとの敵の数とボスの体力
const DIFFICULTIES = {
  easy: { enemies: 2, bossHp: 200 },
  normal: { enemies: 5, bossHp: 500 },
  hard: { enemies: 10, bossHp: 1000 },
};

// 難易度に合わせて敵と銃を配置する(スタート時に1回呼ぶ)
let currentDiff = DIFFICULTIES.normal;
let bossSpawned = false;

function setupGame(key) {
  currentDiff = DIFFICULTIES[key];
  wave = 0;
  startWave();
}

// 新しいウェーブ: 敵を並べなおす。ウェーブが進むほど敵が1体ずつ増え、ボスの体力も100ずつ増える
function startWave() {
  wave++;
  for (const en of enemies) scene.remove(en.mesh);
  enemies.length = 0;
  for (const h of healItems) scene.remove(h.mesh);
  healItems.length = 0;
  bossSpawned = false;
  bossHp = currentDiff.bossHp + 100 * (wave - 1);
  gunSpots.sort(() => Math.random() - 0.5);
  healSpots.slice(0, 3).forEach(([x, z]) => addHealItem(x, z));
  const count = Math.min(enemySpots.length, currentDiff.enemies + wave - 1);
  for (let i = 0; i < count; i++) {
    const en = addEnemy(enemySpots[i][0], enemySpots[i][1]);
    addGroundGun(gunSpots[i][0], gunSpots[i][1], en.answer);
  }
  renderUpgrades();
  msg.textContent = `ウェーブ${wave} スタート`;
}

// ボスの答えの銃を置く(まちがいの銃も2丁まぜる)
function placeBossGuns(answer) {
  for (const gg of groundGuns) scene.remove(gg.mesh);
  groundGuns.length = 0;
  loadedAnswer = null;
  gun.visible = false;
  gunSpots.sort(() => Math.random() - 0.5);
  addGroundGun(gunSpots[0][0], gunSpots[0][1], answer);
  for (let i = 1; i <= 2; i++) {
    let wrong;
    do {
      wrong = randomProblem().answer;
    } while (wrong === answer);
    addGroundGun(gunSpots[i][0], gunSpots[i][1], wrong);
  }
}

// ボスの問題を新しいものに変える(前の問題の銃は使えなくなる)
function newBossProblem(en) {
  let p;
  do {
    p = randomProblem();
  } while (p.answer === en.answer);
  en.answer = p.answer;
  en.label.material.map = makeLabel(p.text).material.map;
  placeBossGuns(en.answer);
}

function spawnBoss() {
  bossSpawned = true;
  const boss = addEnemy(0, 16, true);
  placeBossGuns(boss.answer);
  // ボス戦の前に、回復アイテムを追加で2つ置く
  healSpots.slice(3).forEach(([x, z]) => addHealItem(x, z));
  msg.textContent = `ボスが現れた! 体力${bossHp}`;
}

function defeat(en) {
  en.alive = false;
  scene.remove(en.label);
  scene.remove(en.bar.sprite);
  // たおした敵の数だけポイントがもらえる
  points += en.boss ? BOSS_POINTS : 1;
  renderUpgrades();
  const left = enemies.filter((e) => e.alive).length;
  msg.textContent = left ? `たおした! +1pt 残り${left}体` : "全員たおした! +1pt";
  if (en.boss) {
    msg.textContent = `ボスをたおした! +${BOSS_POINTS}pt まもなく次のウェーブ`;
    for (const b of bullets) scene.remove(b.mesh);
    bullets.length = 0;
    for (const h of hazards) {
      scene.remove(h.marker);
      if (h.rock) scene.remove(h.rock);
    }
    hazards.length = 0;
    setTimeout(() => {
      if (!gameOver) startWave();
    }, 3000);
  } else if (!left && !bossSpawned) {
    spawnBoss();
  }
  if (!enemies.some((e) => e.alive && e.answer === loadedAnswer)) {
    loadedAnswer = null;
    gun.visible = false;
  }
  // 持ち主のいなくなった銃は片づける
  for (let i = groundGuns.length - 1; i >= 0; i--) {
    const gg = groundGuns[i];
    if (enemies.some((e) => e.alive && e.answer === gg.answer)) continue;
    if (bossSpawned && !en.boss) continue; // ボス戦中は、まちがいの銃も残しておく
    scene.remove(gg.mesh);
    groundGuns.splice(i, 1);
  }
}

// 右クリックで銃を撃つ
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("mousedown", (e) => {
  if (e.button !== 2 || gameOver) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  if (loadedAnswer === null) {
    msg.textContent = "先に銃を拾ってね";
    return;
  }
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x33ddff })
  );
  mesh.position.copy(camera.position).addScaledVector(dir, 0.6);
  scene.add(mesh);
  playerBullets.push({ mesh, vel: dir.multiplyScalar(PLAYER_BULLET_SPEED), life: 2, answer: loadedAnswer });
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const BOSS_COLOR = 0x7722aa;
const BOSS_ALERT_COLOR = 0xff2222;

// 降ってくる攻撃: プレイヤーの近くに警告の円を出す(1つ目はプレイヤーの真上)
function spawnRain(count) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = i === 0 ? 0 : 2 + Math.random() * 4;
    const x = Math.max(-FIELD + 2, Math.min(FIELD - 2, player.position.x + Math.cos(ang) * dist));
    const z = Math.max(-FIELD + 2, Math.min(FIELD - 2, player.position.z + Math.sin(ang) * dist));
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(RAIN_RADIUS, 24),
      new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.4 })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.05, z);
    scene.add(marker);
    hazards.push({ x, z, t: 0, marker, rock: null });
  }
}

function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.t += dt;
    if (!h.rock) {
      h.marker.material.opacity = 0.3 + 0.25 * Math.sin(h.t * 15);
      if (h.t >= RAIN_WARN) {
        h.rock = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.4, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x665544 })
        );
        h.rock.castShadow = true;
        h.rock.position.set(h.x, 14, h.z);
        scene.add(h.rock);
      }
      continue;
    }
    h.rock.position.y -= 35 * dt;
    h.rock.rotation.x += dt * 5;
    if (h.rock.position.y > 0.7) continue;
    // 着地: 範囲内で、ジャンプで避けていなければダメージ
    const near = Math.hypot(player.position.x - h.x, player.position.z - h.z) < RAIN_RADIUS + 0.4;
    if (near && player.position.y - PLAYER_H / 2 < 1.2) damagePlayer();
    scene.remove(h.marker);
    scene.remove(h.rock);
    hazards.splice(i, 1);
  }
}

// ボスの動き: 通常は円を描いて歩く → たまに予備動作のあと突進。降ってくる攻撃も定期的に出す
function bossMove(en, dt, a) {
  const pos = en.mesh.position;
  const color = en.mesh.material.color;

  en.chargeTimer -= dt;
  en.rainTimer -= dt;
  if (en.rainTimer <= 0) {
    en.rainTimer = BOSS_RAIN_INTERVAL;
    spawnRain(3 + Math.min(en.stage, 3));
  }

  if (en.mode === "patrol") {
    // 突進のあとも、円の軌道へなめらかに戻る
    const tx = en.homeX + Math.cos(a) * en.radius;
    const tz = en.homeZ + Math.sin(a) * en.radius;
    const k = Math.min(1, dt * 3);
    pos.x += (tx - pos.x) * k;
    pos.z += (tz - pos.z) * k;
    color.setHex(BOSS_COLOR);
    if (en.chargeTimer <= 0) {
      en.mode = "windup";
      en.modeTime = BOSS_WINDUP;
      msg.textContent = "ボスが突進してくる!";
    }
  } else if (en.mode === "windup") {
    en.modeTime -= dt;
    color.setHex(Math.floor(en.modeTime * 10) % 2 ? BOSS_ALERT_COLOR : BOSS_COLOR);
    en.dashDir.set(player.position.x - pos.x, 0, player.position.z - pos.z).normalize();
    if (en.modeTime <= 0) {
      en.mode = "charge";
      en.modeTime = BOSS_CHARGE_MAX_TIME;
    }
  } else if (en.mode === "charge") {
    // 壁にぶつかるまでまっすぐ進む
    en.modeTime -= dt;
    color.setHex(BOSS_ALERT_COLOR);
    const prevX = pos.x;
    const prevZ = pos.z;
    pos.addScaledVector(en.dashDir, BOSS_CHARGE_SPEED * dt);
    const half = en.w / 2;
    const hitWall = solids.some((s) =>
      s.maxY >= 2 &&
      pos.x + half > s.minX && pos.x - half < s.maxX &&
      pos.z + half > s.minZ && pos.z - half < s.maxZ
    );
    const touch = Math.hypot(player.position.x - pos.x, player.position.z - pos.z) < half + 0.6;
    if (touch && player.position.y - PLAYER_H / 2 < en.h) damagePlayer();
    if (hitWall || en.modeTime <= 0) {
      pos.x = prevX;
      pos.z = prevZ;
      en.mode = "stun"; // 壁にぶつかって、少しのあいだ動けない
      en.modeTime = BOSS_STUN_TIME;
      msg.textContent = "ボスが壁にぶつかった! チャンス!";
    }
  } else {
    en.modeTime -= dt;
    color.setHex(0xaaaaaa);
    if (en.modeTime <= 0) {
      en.mode = "patrol";
      en.chargeTimer = BOSS_CHARGE_INTERVAL;
    }
  }
}

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameOver || !started) {
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
    return;
  }

  // 上下矢印で前後、左右矢印で左右(向いている方向が基準)
  const pressed = (arrow, letter) => keys[arrow] || keys[letter] || keys[letter.toUpperCase()];
  const fwd = (pressed("ArrowUp", "w") ? 1 : 0) - (pressed("ArrowDown", "s") ? 1 : 0);
  const strafe = (pressed("ArrowRight", "d") ? 1 : 0) - (pressed("ArrowLeft", "a") ? 1 : 0);
  const dx = (-Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) * moveSpeed * dt;
  const dz = (-Math.cos(yaw) * fwd - Math.sin(yaw) * strafe) * moveSpeed * dt;

  player.position.x += dx;
  for (const s of solids) {
    if (!overlaps(s)) continue;
    player.position.x = dx > 0
      ? s.minX - PLAYER_W / 2
      : s.maxX + PLAYER_W / 2;
  }

  player.position.z += dz;
  for (const s of solids) {
    if (!overlaps(s)) continue;
    player.position.z = dz > 0
      ? s.minZ - PLAYER_W / 2
      : s.maxZ + PLAYER_W / 2;
  }

  // スペースキーでジャンプ(地面にいる時のみ)
  if (keys[" "] && onGround) {
    vy = JUMP_VELOCITY;
    onGround = false;
  }

  vy -= GRAVITY * dt;
  player.position.y += vy * dt;
  onGround = false;
  if (player.position.y <= PLAYER_H / 2) {
    player.position.y = PLAYER_H / 2;
    vy = 0;
    onGround = true;
  }
  for (const s of solids) {
    if (!overlaps(s)) continue;
    if (vy > 0) {
      // 頭をぶつけた
      player.position.y = s.minY - PLAYER_H / 2;
    } else {
      // 箱の上に着地
      player.position.y = s.maxY + PLAYER_H / 2;
      onGround = true;
    }
    vy = 0;
  }

  // 倒された敵は横に倒れていく
  for (const en of enemies) {
    if (en.alive || en.fall >= 1) continue;
    en.fall = Math.min(en.fall + dt * 2, 1);
    en.mesh.rotation.z = (Math.PI / 2) * en.fall;
    en.mesh.position.y = en.h / 2 - (en.h / 2 - en.w / 2) * en.fall;
  }

  // 回復アイテム: 回りながら浮かぶ。ハートが減っているときに近づくと拾える
  for (let i = healItems.length - 1; i >= 0; i--) {
    const h = healItems[i];
    h.t += dt;
    h.mesh.rotation.y += dt * 2;
    h.mesh.position.y = h.baseY + Math.sin(h.t * 3) * 0.15;
    const d = Math.hypot(h.mesh.position.x - player.position.x, h.mesh.position.z - player.position.z);
    if (d < 1.3 && hearts < maxHearts) {
      hearts++;
      drawHearts();
      scene.remove(h.mesh);
      healItems.splice(i, 1);
      msg.textContent = "ハートを拾った! 回復";
    }
  }

  // 地面の銃: くるくる回り、近づくと拾える(持っている銃はその場に置き換わる)
  for (const gg of groundGuns.slice()) {
    gg.mesh.rotation.y += dt * 1.5;
    const dxg = gg.mesh.position.x - player.position.x;
    const dzg = gg.mesh.position.z - player.position.z;
    const near = Math.hypot(dxg, dzg) < 1.3;
    if (!near) gg.needLeave = false;
    if (!near || gg.needLeave) continue;
    const old = loadedAnswer;
    scene.remove(gg.mesh);
    groundGuns.splice(groundGuns.indexOf(gg), 1);
    if (old !== null) addGroundGun(gg.mesh.position.x, gg.mesh.position.z, old, true);
    holdGun(gg.answer);
  }

  // 生きている敵は動き回り、プレイヤーに向けて撃つ
  const time = clock.elapsedTime;
  for (const en of enemies) {
    if (!en.alive) continue;
    const a = time * ENEMY_PATROL_SPEED + en.phase;
    if (en.boss) {
      bossMove(en, dt, a);
    } else {
      en.mesh.position.x = en.homeX + Math.cos(a) * en.radius;
      en.mesh.position.z = en.homeZ + Math.sin(a) * en.radius;
    }
    en.label.position.set(en.mesh.position.x, en.h + en.s, en.mesh.position.z);
    en.bar.sprite.position.set(en.mesh.position.x, en.h + 0.25 * en.s, en.mesh.position.z);

    en.shotTimer -= dt;
    if (en.shotTimer <= 0 && (!en.boss || en.mode === "patrol")) {
      en.shotTimer = en.shotInterval;
      if (en.mesh.position.distanceTo(player.position) < ENEMY_SHOT_RANGE) {
        const from = en.mesh.position.clone();
        from.y = en.h * 0.7;
        shoot(from, player.position);
        if (en.boss) {
          // ボスは左右にもう2発ずつ、3方向に撃つ
          const side = new THREE.Vector3(player.position.z - from.z, 0, from.x - player.position.x).normalize();
          for (const k of [-3, 3]) {
            shoot(from, player.position.clone().addScaledVector(side, k));
          }
        }
      }
    }
  }

  updateHazards(dt);

  // 弾の移動と当たり判定
  invincible = Math.max(0, invincible - dt);
  hitEl.style.opacity = invincible > INVINCIBLE_TIME - 0.3 ? 0.4 : 0;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    const p = b.mesh.position;

    let remove = b.life <= 0 || p.y < 0;
    if (!remove) {
      remove = solids.some((s) =>
        p.x > s.minX && p.x < s.maxX &&
        p.y > s.minY && p.y < s.maxY &&
        p.z > s.minZ && p.z < s.maxZ
      );
    }
    if (!remove && overlapsPoint(p)) {
      remove = true;
      damagePlayer();
    }
    if (remove) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  // プレイヤーの弾: 壁で消え、敵に当たると答えが合うときだけ倒す
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    const p = b.mesh.position;

    let remove = b.life <= 0 || p.y < 0 || solids.some((s) =>
      p.x > s.minX && p.x < s.maxX &&
      p.y > s.minY && p.y < s.maxY &&
      p.z > s.minZ && p.z < s.maxZ
    );
    if (!remove) {
      for (const en of enemies) {
        if (!en.alive) continue;
        const e = en.mesh.position;
        const reach = en.w / 2 + 0.2;
        if (Math.abs(p.x - e.x) < reach && Math.abs(p.z - e.z) < reach && p.y > 0 && p.y < en.h) {
          remove = true;
          if (en.answer === b.answer) {
            en.hp -= playerDamage;
            drawHpBar(en);
            if (en.hp <= 0) defeat(en);
            else {
              msg.textContent = `ヒット! 残り体力 ${en.hp}`;
              // ボスは50削るごとに問題が変わる
              const stage = Math.floor((en.maxHp - en.hp) / BOSS_STEP);
              if (en.boss && stage > en.stage) {
                en.stage = stage;
                newBossProblem(en);
                msg.textContent = `問題が変わった! 残り体力 ${en.hp}`;
              }
            }
          } else {
            // まちがった銃で撃つと、敵の体力が回復してしまう
            en.hp = Math.min(en.maxHp, en.hp + HEAL_AMOUNT);
            drawHpBar(en);
            msg.textContent = `まちがい! 敵が回復した 体力 ${en.hp}`;
          }
          break;
        }
      }
    }
    if (remove) {
      scene.remove(b.mesh);
      playerBullets.splice(i, 1);
    }
  }

  // 一人称視点: カメラはプレイヤーの目の位置
  camera.position.set(player.position.x, player.position.y + EYE_OFFSET, player.position.z);
  camera.rotation.set(pitch, yaw, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
