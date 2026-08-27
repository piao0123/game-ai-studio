let canvas = document.getElementById('canvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let listenersAttached = false;

function ensureCanvas() {
    if (!canvas) {
        canvas = document.getElementById('canvas');
        if (canvas) {
            ctx = canvas.getContext('2d');
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            if (!listenersAttached) {
                setupCanvasListeners();
                listenersAttached = true;
            }
            initMapLayout();
        }
    } else if (!listenersAttached) {
        setupCanvasListeners();
        listenersAttached = true;
    }
    if (canvas && (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight)) {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }
    return canvas && ctx;
}

var width = window.innerWidth;
var height = window.innerHeight;
window.width = width;
window.height = height;

// --- 武器系统 ---
const WEAPONS = {
    RIFLE:   { id: 1, name: "RIFLE",   range: 600, cooldown: 12, damage: 35, speed: 16, radius: 3.5, type: 'bullet' },
    PISTOL:  { id: 2, name: "PISTOL",  range: 350, cooldown: 18, damage: 50, speed: 14, radius: 4.0, type: 'bullet' },
    SMG:     { id: 3, name: "SMG",     range: 320, cooldown: 5,  damage: 20, speed: 17, radius: 2.8, type: 'bullet' },
    SNIPER:  { id: 4, name: "SNIPER",  range: 1100,cooldown: 55, damage: 130,speed: 26, radius: 3.0, type: 'bullet' },
    GRENADE: { id: 5, name: "GRENADE", range: 380, cooldown: 75, damage: 120,speed: 9,  radius: 6.0, type: 'grenade', blastRadius: 110 }
};

let currentWeapon = WEAPONS.RIFLE;
let unlockedWeapons = [WEAPONS.RIFLE.id];

let shootCooldownTimer = 0;

let wave = 1;
let killCount = 0;
let isGameOver = false;
let isPaused = true;
let waveTransitionTimer = 0;
let gateAlarmCooldown = 0;

const player = { 
    x: 100, y: 350, angle: 0, speed: 3.8, walkCycle: 0, 
    flashTimer: 0, hp: 100, maxHp: 100,
    shield: 100, maxShield: 100, shieldActive: true, lastHitTimer: 0,
    fov: Math.PI / 2.2, viewDistance: 500
};

let blindActive = false;
let blindEnergy = 100;
const MAX_BLIND_ENERGY = 100;
const BLIND_CONSUME_RATE = 0.20; 
const BLIND_RECOVER_RATE = 0.12; 
let blindZone = null;

const mouse = { x: width / 2, y: height / 2 };
const keys = {};

const playerBullets = [];
const grenades = [];
const enemyBullets = [];
const particles = [];
const dropItems = []; 
const traps = []; 

// Level 3 specific structures and fog variables
let lasers = [];
let laserAlarmCooldown = 0;

let bankRevealGrid = [];
let bankGridRows = 0;
let bankGridCols = 0;
let totalBankCells = 0;
let scannableBankCellsCount = 0;
let revealedBankCellsCount = 0;
let allBankCellsRevealed = true;
let level3TargetSecured = false;

function initBankRevealGrid() {
    bankRevealGrid = [];
    const cellSize = 60;
    bankGridCols = Math.ceil(width / cellSize);
    bankGridRows = Math.ceil(height / cellSize);
    scannableBankCellsCount = 0;
    revealedBankCellsCount = 0;
    allBankCellsRevealed = true;
    
    for (let r = 0; r < bankGridRows; r++) {
        bankRevealGrid[r] = [];
        for (let c = 0; c < bankGridCols; c++) {
            const cx = c * cellSize + cellSize / 2;
            const cy = r * cellSize + cellSize / 2;
            // Check if cell center is inside a solid wall
            const inSolid = checkObstacleCollision(cx, cy, 10);
            if (inSolid) {
                bankRevealGrid[r][c] = true;
            } else {
                bankRevealGrid[r][c] = false;
                scannableBankCellsCount++;
            }
        }
    }
}

function circleIntersectsSegment(cx, cy, r, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        return Math.hypot(cx - x1, cy - y1) <= r;
    }
    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const distSq = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY);
    return distSq <= r * r;
}

function isCellRevealed(x, y) {
    return true;
}

function isObjectRevealed(x, y, w = 1, h = 1) {
    return true;
}

function drawLasers() {
    if (levelManager.getCurrentLevel().id !== 'level3_bank') return;
    lasers.forEach(laser => {
        if (!laser.active) return;
        
        // Only draw if laser is revealed
        if (!allBankCellsRevealed) {
            const midX = (laser.x1 + laser.x2) / 2;
            const midY = (laser.y1 + laser.y2) / 2;
            if (!isCellRevealed(midX, midY) && !isCellRevealed(laser.x1, laser.y1) && !isCellRevealed(laser.x2, laser.y2)) {
                return;
            }
        }

        ctx.save();
        ctx.strokeStyle = '#FF3344';
        ctx.lineWidth = 3.0;
        ctx.shadowColor = '#FF3344';
        ctx.shadowBlur = 12;
        
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(laser.x1, laser.y1, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(laser.x2, laser.y2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

var obstacles = [];
var securityGates = [];
var zones = [];
var props = [];
var waypoints = [];
var cameras = [];
var enemies = [];

function setMapData(obs, sec, prp, zns, way, cam, lsr) {
    obstacles = obs || [];
    securityGates = sec || [];
    props = prp || [];
    zones = zns || [];
    waypoints = way || [];
    cameras = cam || [];
    lasers = lsr || [];
    window.obstacles = obstacles;
    window.securityGates = securityGates;
    window.props = props;
    window.zones = zones;
    window.waypoints = waypoints;
    window.cameras = cameras;
    window.lasers = lasers;
}
window.setMapData = setMapData;

window.obstacles = obstacles;
window.securityGates = securityGates;
window.zones = zones;
window.props = props;
window.waypoints = waypoints;
window.cameras = cameras;
window.enemies = enemies;
window.lasers = lasers;
window.player = player;

function initMapLayout() {
    level3TargetSecured = false;
    levelManager.loadCurrentLevel();
    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (currentLevelId === 'level3_bank') {
        const cashRack = props.find(p => p.type === 'cash_rack' || (p.label && p.label.includes('CASH')));
        let itemX = width - 180;
        let itemY = height / 2;
        if (cashRack) {
            const x_vault_left = cashRack.x - 60;
            itemX = x_vault_left + 110;
            itemY = cashRack.y - 70;
        }
        dropItems.push({
            x: itemX,
            y: itemY,
            type: 'classified_drive',
            timer: Infinity
        });
    }
}

function resizeCanvas() {
    if (!ensureCanvas()) return;
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width; canvas.height = height;
    initMapLayout();
}
window.addEventListener('resize', resizeCanvas);

function getRayIntersection(ray, segment) {
    const r_px = ray.x, r_py = ray.y, r_dx = ray.dx, r_dy = ray.dy;
    const s_px = segment.x1, s_py = segment.y1, s_dx = segment.x2 - segment.x1, s_dy = segment.y2 - segment.y1;

    const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
    const s_mag = Math.sqrt(s_dx * s_dx + s_dy * s_dy);

    if (r_dx / r_mag === s_dx / s_mag && r_dy / r_mag === s_dy / s_mag) return null;

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / (s_dx * r_dy - s_dy * r_dx);
    const T1 = (s_px + s_dx * T2 - r_px) / r_dx;

    if (T1 < 0 || T2 < 0 || T2 > 1) return null;
    return { x: r_px + r_dx * T1, y: r_py + r_dy * T1, param: T1 };
}

function getVisionBlockingSegments() {
    const segments = [];
    obstacles.forEach(obs => {
        if (obs.type === 'solid' || obs.type === 'low_wall') {
            segments.push(
                { x1: obs.x, y1: obs.y, x2: obs.x + obs.w, y2: obs.y },
                { x1: obs.x + obs.w, y1: obs.y, x2: obs.x + obs.w, y2: obs.y + obs.h },
                { x1: obs.x + obs.w, y1: obs.y + obs.h, x2: obs.x, y2: obs.y + obs.h },
                { x1: obs.x, y1: obs.y + obs.h, x2: obs.x, y2: obs.y }
            );
        }
    });
    return segments;
}

function drawTacticalFOV(x, y, angle, fovAngle, maxDist, fillColor, strokeColor) {
    const segments = getVisionBlockingSegments();
    const rayCount = 100;
    const startAngle = angle - fovAngle / 2;
    const step = fovAngle / rayCount;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let i = 0; i <= rayCount; i++) {
        const a = startAngle + step * i;
        const ray = { x: x, y: y, dx: Math.cos(a) * maxDist, dy: Math.sin(a) * maxDist };

        let closestHit = null;
        let minParam = 1;

        segments.forEach(seg => {
            const hit = getRayIntersection(ray, seg);
            if (hit && hit.param < minParam) {
                minParam = hit.param;
                closestHit = hit;
            }
        });

        const targetX = closestHit ? closestHit.x : x + ray.dx;
        const targetY = closestHit ? closestHit.y : y + ray.dy;
        ctx.lineTo(targetX, targetY);
    }

    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6; // 增宽描边厚度以加强可见度与科技质感
        ctx.stroke();
    }
    ctx.restore();
}

function getVisionConePolygon(originX, originY, angle, fovAngle, maxDist, segments, rayCount) {
    if (!segments) segments = getVisionBlockingSegments();
    if (!rayCount) rayCount = 100;
    const startAngle = angle - fovAngle / 2;
    const step = fovAngle / rayCount;
    const poly = [{ x: originX, y: originY }];

    for (let i = 0; i <= rayCount; i++) {
        const a = startAngle + step * i;
        const ray = { x: originX, y: originY, dx: Math.cos(a) * maxDist, dy: Math.sin(a) * maxDist };

        let closestHit = null;
        let minParam = 1;

        segments.forEach(seg => {
            const hit = getRayIntersection(ray, seg);
            if (hit && hit.param < minParam) {
                minParam = hit.param;
                closestHit = hit;
            }
        });

        const targetX = closestHit ? closestHit.x : originX + ray.dx;
        const targetY = closestHit ? closestHit.y : originY + ray.dy;
        poly.push({ x: targetX, y: targetY });
    }
    return poly;
}

function drawYellowHighlightedOutlines(polyPoints) {
    if (!polyPoints || polyPoints.length < 3) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
    for (let i = 1; i < polyPoints.length; i++) {
        ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
    }
    ctx.closePath();
    ctx.clip(); // 限制描边仅绘制在视锥覆盖的视线多边形内部

    ctx.strokeStyle = '#FFE600'; // 战术高亮亮黄
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 4;

    // 1. 掩体与墙体障碍物
    if (typeof obstacles !== 'undefined' && Array.isArray(obstacles)) {
        obstacles.forEach(obs => {
            if (obs && obs.w && obs.h) {
                ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            }
        });
    }

    // 2. 道具与设施
    if (typeof props !== 'undefined' && Array.isArray(props)) {
        props.forEach(p => {
            if (p && p.w && p.h) {
                ctx.strokeRect(p.x, p.y, p.w, p.h);
            }
        });
    }

    // 3. 闸机与安检门
    if (typeof securityGates !== 'undefined' && Array.isArray(securityGates)) {
        securityGates.forEach(g => {
            if (g && g.w && g.h) {
                ctx.strokeRect(g.x, g.y, g.w, g.h);
            }
        });
    }

    ctx.restore();
}

function drawNightShadowMask() {
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    if (levelId !== 'level3_bank' || player.hp <= 0 || level3TargetSecured) return;

    const segments = getVisionBlockingSegments();
    const rayCount = 100;

    // 1. 计算玩家当前半弧形视锥多边形
    const playerPoly = getVisionConePolygon(player.x, player.y, player.angle, player.fov, player.viewDistance, segments, rayCount);

    ctx.save();
    ctx.beginPath();
    // 全屏外框路径
    ctx.rect(0, 0, width, height);

    // 抠出玩家视锥区域
    ctx.moveTo(playerPoly[0].x, playerPoly[0].y);
    for (let i = 1; i < playerPoly.length; i++) {
        ctx.lineTo(playerPoly[i].x, playerPoly[i].y);
    }
    ctx.closePath();

    // 奇偶填充规则 (evenodd)：覆盖地图全屏，仅将玩家视锥区域掏空镂空
    ctx.fillStyle = 'rgba(2, 6, 14, 0.88)';
    ctx.fill('evenodd');
    ctx.restore();

    // 2. 绘制玩家视锥扫过区域的黄色高亮轮廓
    drawYellowHighlightedOutlines(playerPoly);
}

function getLevelBounds() {
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    if (levelId === 'level3_bank') {
        return {
            minX: 24 + 14,
            maxX: width - 24 - 14,
            minY: 80 + 14,
            maxY: height - 110 - 14
        };
    } else { // level1_airport or level2_subway
        return {
            minX: 40 + 12,
            maxX: width - 40 - 12,
            minY: 40 + 12,
            maxY: height - 40 - 12
        };
    }
}

function checkObstacleCollision(x, y, radius) {
    const bounds = getLevelBounds();
    if (x - radius < bounds.minX || x + radius > bounds.maxX || y - radius < bounds.minY || y + radius > bounds.maxY) {
        return true;
    }
    for (let obs of obstacles) {
        if (x > obs.x - radius && x < obs.x + obs.w + radius && y > obs.y - radius && y < obs.y + obs.h + radius) {
            return true;
        }
    }
    for (let p of props) {
        if (p.w && p.h) {
            if (x > p.x - radius && x < p.x + p.w + radius && y > p.y - radius && y < p.y + p.h + radius) {
                return true;
            }
        }
    }
    return false;
}

function checkLineObstacleIntersection(x1, y1, x2, y2) {
    for (let obs of obstacles) {
        if (lineIntersectsRect(x1, y1, x2, y2, obs)) return obs;
    }
    return null;
}

function lineIntersectsRect(x1, y1, x2, y2, rect) {
    const rx = rect.x, ry = rect.y, rw = rect.w, rh = rect.h;
    // Check if either endpoint is inside the rect
    if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true;
    if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true;

    // Check intersection with all 4 rectangle edges
    if (lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx + rw, ry)) return true;
    if (lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh)) return true;
    if (lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh)) return true;
    if (lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx, ry + rh)) return true;

    return false;
}

function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
}

function canSee(fromX, fromY, toX, toY) {
    for (let obs of obstacles) {
        if (obs.type === 'solid' || obs.type === 'low_wall') {
            if (lineIntersectsRect(fromX, fromY, toX, toY, obs)) return false;
        }
    }
    return true;
}

function isInFOV(target) {
    if (!target) return false;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);

    // 1. 超出最大视角距离不可见
    if (dist > player.viewDistance) return false;

    // 2. 判断是否在玩家视野弧度扇形内
    const targetAngle = Math.atan2(dy, dx);
    let angleDiff = targetAngle - player.angle;

    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    if (Math.abs(angleDiff) > player.fov / 2) return false;

    // 3. 检查是否有障碍物遮挡 (利用你原本的 canSee 函数)
    return canSee(player.x, player.y, target.x, target.y);
}

function triggerGlobalAlarm() {
    if (typeof soundManager !== 'undefined') {
        soundManager.playAlarm();
    }
    const banner = document.getElementById('alarm-banner');
    if (banner) {
        const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
        if (levelId === 'level3_bank') {
            banner.innerText = "🚨 VAULT SECURITY BREACH // CENTRAL BANK LOCKDOWN IN PROGRESS 🚨";
        } else if (levelId === 'level2_subway') {
            banner.innerText = "🚨 METRO SECURITY BREACH // SUBWAY STATION LOCKED DOWN 🚨";
        } else {
            banner.innerText = "🚨 AIRPORT SECURITY ALARM // TERMINAL ALL SECTORS ALERTED 🚨";
        }
        banner.style.display = 'block';
    }
    enemies.forEach(e => {
        if (e.hp > 0 && e.spawnGraceTimer <= 0) {
            e.alert = true;
            e.alertCooldown = 300; 
        }
    });
}

function spawnWave() {
    enemies = [];
    const count = 2 + wave;
    const bounds = getLevelBounds();
    const minSpawnX = bounds.minX + 24;
    const maxSpawnX = bounds.maxX - 24;
    const minSpawnY = bounds.minY + 24;
    const maxSpawnY = bounds.maxY - 24;

    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';

    for (let i = 0; i < count; i++) {
        let spawnX, spawnY, valid = false, attempts = 0;
        while (!valid && attempts < 150) {
            attempts++;
            if (levelId === 'level3_bank') {
                // 金库关卡：85%概率刷新在Zone A/B（0.20~0.68），15%概率刷新在Zone C走廊（0.68~0.74），严禁刷新在金库内部（>=0.75）
                const vaultLeftBoundary = bounds.minX + (bounds.maxX - bounds.minX) * 0.74;
                let randXFrac;
                if (Math.random() < 0.85) {
                    randXFrac = 0.20 + Math.random() * 0.48; // Zone A & B
                } else {
                    randXFrac = 0.68 + Math.random() * 0.06; // Zone C 走廊过道
                }
                spawnX = minSpawnX + (maxSpawnX - minSpawnX) * randXFrac;
                spawnY = minSpawnY + Math.random() * (maxSpawnY - minSpawnY);

                if (spawnX >= vaultLeftBoundary - 15) {
                    continue; // 拒绝金库内部及门前紧贴区域的刷新
                }
            } else {
                spawnX = minSpawnX + (maxSpawnX - minSpawnX) * (0.35 + Math.random() * 0.55);
                spawnY = minSpawnY + Math.random() * (maxSpawnY - minSpawnY);
            }

            if (Math.hypot(spawnX - player.x, spawnY - player.y) > 280 && !checkObstacleCollision(spawnX, spawnY, 20)) {
                valid = true;
            }
        }

        if (!valid) {
            if (levelId === 'level3_bank') {
                spawnX = minSpawnX + (maxSpawnX - minSpawnX) * 0.45;
                spawnY = minSpawnY + (maxSpawnY - minSpawnY) * 0.5;
            } else {
                spawnX = minSpawnX + (maxSpawnX - minSpawnX) * 0.7;
                spawnY = minSpawnY + (maxSpawnY - minSpawnY) * 0.5;
            }
        }

        const isShieldObserver = wave >= 2 && (Math.random() < 0.4 || i === 0);

        enemies.push({
            id: i, x: spawnX, y: spawnY, angle: Math.PI, hp: 100, maxHp: 100,
            isObserver: isShieldObserver,
            shield: isShieldObserver ? 80 : 0, maxShield: isShieldObserver ? 80 : 0,
            alert: false, alertCooldown: 0,
            pendingDamage: 0,
            targetWaypoint: waypoints.length > 0 ? Math.floor(Math.random() * waypoints.length) : 0,
            stuckFrames: 0, 
            spawnGraceTimer: 100,
            confusedTimer: 0, confusedAngle: 0,
            patrolSpeed: 1.0 + Math.random() * 0.3, walkCycle: 0, hitTimer: 0, scanAngle: Math.random() * 6, shootCooldown: 0,
            deathAlpha: 1.0
        });
    }
    addLog(`WAVE ${wave} INITIATED. ${count} HOSTILES DETECTED.`);
}

window.addEventListener('keydown', e => { 
    if (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
        return;
    }
    if (isPaused) return;

    if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); toggleBlindZone(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        addLog("BODY ARMOR IS ALWAYS ACTIVE // 战术防弹衣默认持续开启中");
    }
    if (e.code === 'Digit1' && unlockedWeapons.includes(WEAPONS.RIFLE.id)) switchWeapon(WEAPONS.RIFLE);
    if (e.code === 'Digit2' && unlockedWeapons.includes(WEAPONS.PISTOL.id)) switchWeapon(WEAPONS.PISTOL);
    if (e.code === 'Digit3' && unlockedWeapons.includes(WEAPONS.SMG.id)) switchWeapon(WEAPONS.SMG);
    if (e.code === 'Digit4' && unlockedWeapons.includes(WEAPONS.SNIPER.id)) switchWeapon(WEAPONS.SNIPER);
    if (e.code === 'Digit5' && unlockedWeapons.includes(WEAPONS.GRENADE.id)) switchWeapon(WEAPONS.GRENADE);

    if (e.code === 'KeyR' || e.key === 'r') { if(isGameOver) resetGame(); }
    keys[e.code] = true; keys[e.key.toLowerCase()] = true;
});

function togglePause(forcedState) {
    if (forcedState !== undefined) {
        isPaused = forcedState;
    } else {
        isPaused = !isPaused;
    }
    if (isPaused) {
        addLog("OPERATIONS SUSPENDED [PAUSED].");
    } else {
        addLog("OPERATIONS RESUMED.");
    }
    if (typeof window.onGamePauseChange === 'function') {
        window.onGamePauseChange(isPaused);
    }
    return isPaused;
}

window.addEventListener('keyup', e => { keys[e.code] = false; keys[e.key.toLowerCase()] = false; });
function setupCanvasListeners() {
    if (!canvas) return;
    canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) shoot(); });

    canvas.addEventListener('dblclick', e => {
        if (blindActive && blindZone) {
            const tx = e.clientX;
            const ty = e.clientY;

            if (inBlindZone(tx, ty)) {
                // Prevent accidental teleport when clicking/shooting at enemies, cameras, gates, etc.
                let nearThreat = false;
                for (let enemy of enemies) {
                    if (enemy.hp > 0 && Math.hypot(tx - enemy.x, ty - enemy.y) < 45) {
                        nearThreat = true;
                        break;
                    }
                }
                if (nearThreat) {
                    addLog("CANNOT TELEPORT ON TARGETS // 无法在目标附近或其上方进行瞬移");
                    return;
                }

                const oldX = player.x;
                const oldY = player.y;

                let targetX = tx;
                let targetY = ty;

                // Check if destination is in an obstacle and needs adjustment
                if (checkObstacleCollision(targetX, targetY, 22)) {
                    let found = false;
                    for (let d = 8; d <= 120 && !found; d += 8) {
                        for (let angleIdx = 0; angleIdx < 24; angleIdx++) {
                            const angle = (angleIdx / 24) * Math.PI * 2;
                            const cx = targetX + Math.cos(angle) * d;
                            const cy = targetY + Math.sin(angle) * d;

                            if (cx >= 25 && cx <= width - 25 && cy >= 25 && cy <= height - 25) {
                                if (!checkObstacleCollision(cx, cy, 22)) {
                                    targetX = cx;
                                    targetY = cy;
                                    found = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                // Move player to target position
                player.x = targetX;
                player.y = targetY;

                // Visual explosion feedback at start and end
                createExplosion(oldX, oldY, 15, '#FFCC00');
                createExplosion(targetX, targetY, 15, '#00FF66');
                addLog("TELEPORTED // 盲区瞬移成功");
            }
        }
    });

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (blindActive && blindZone && currentWeapon.id === WEAPONS.GRENADE.id) {
            const tx = e.clientX;
            const ty = e.clientY;
            if (inBlindZone(tx, ty)) {
                if (!checkObstacleCollision(tx, ty, 12)) {
                    traps.push({ x: tx, y: ty, pulseTimer: 0 });
                    if (typeof soundManager !== 'undefined') soundManager.playTrap();
                    createExplosion(tx, ty, 8, '#FF6600');
                    addLog("DECOY TRAP DEPLOYED // 诱饵陷阱部署成功");
                } else {
                    addLog("CANNOT DEPLOY ON OBSTACLE // 无法在障碍物/掩体上部署");
                }
            } else {
                addLog("DEPLOY OUTSIDE BLIND ZONE // 只能在盲区内部署陷阱");
            }
        }
    });
}

function switchWeapon(wp) {
    currentWeapon = wp;
    addLog(`EQUIPPED: ${wp.name}`);
    if (typeof soundManager !== 'undefined') {
        soundManager.playReload();
    }
}

function addLog(text) {
    const log = document.getElementById('log-panel');
    if (!log) return;
    const line = document.createElement('div');
    line.innerText = "> " + text;
    log.appendChild(line);
    if(log.children.length > 5) log.removeChild(log.children[0]);
}
window.addLog = addLog;

function createExplosion(x, y, count = 15, color = null) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4.5;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 25 + Math.random() * 15, maxLife: 40,
            color: color || (Math.random() > 0.3 ? '#FF3344' : '#00FF66')
        });
    }
}

function spawnDropItem(x, y) {
    // Prevent spawning inside Teller Glass seating / counter area in Level 3
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (levelId === 'level3_bank') {
        let tellerX = -1;
        if (typeof obstacles !== 'undefined') {
            const tg = obstacles.find(o => o.label === 'TELLER GLASS' || (o.type === 'glass' && o.label && o.label.includes('TELLER')));
            if (tg) {
                tellerX = tg.x;
            }
        }
        if (tellerX > 0) {
            // Teller workspace/desks span horizontally from tellerX to tellerX + 50
            if (x >= tellerX - 5 && x <= tellerX + 50) {
                if (x < tellerX + 22) {
                    x = tellerX - 15; // Push to public lobby side
                } else {
                    x = tellerX + 60; // Push to staff corridor side
                }
            }
        } else {
            // Fallback estimation
            if (x >= 210 && x <= 260) {
                if (x < 235) x = 205;
                else x = 265;
            }
        }
    }

    const rand = Math.random();
    if (rand < 0.7) { 
        if (rand < 0.25) {
            dropItems.push({ x, y, type: 'medkit', timer: 700 });
        } else if (rand < 0.50) {
            dropItems.push({ x, y, type: 'battery', timer: 700 });
        } else {
            const allWps = [WEAPONS.PISTOL, WEAPONS.SNIPER, WEAPONS.SMG, WEAPONS.GRENADE];
            const lockedWps = allWps.filter(w => !unlockedWeapons.includes(w.id));
            const wpToDrop = lockedWps.length > 0 ? lockedWps[Math.floor(Math.random() * lockedWps.length)] : allWps[Math.floor(Math.random() * allWps.length)];
            dropItems.push({ x, y, type: 'weapon', weaponData: wpToDrop, timer: 700 });
        }
    }
}

function toggleBlindZone() {
    if (player.hp <= 0 || isGameOver || isPaused) return;
    if (!blindActive) {
        if (blindEnergy >= 15) {
            blindActive = true;
            blindZone = { x: player.x, y: player.y, radius: 240 };
            addLog("BLIND ZONE ACTIVATED.");
            if (typeof soundManager !== 'undefined') {
                soundManager.playBlindZone();
            }
        } else {
            addLog("ENERGY TOO LOW TO ACTIVATE!");
        }
    } else {
        closeBlindZone("MANUAL DEACTIVATION");
    }
}

function closeBlindZone(reason = "COLLAPSED") {
    if (!blindActive) return;
    blindActive = false;
    blindZone = null;
    addLog(`BLIND ZONE DEACTIVATED (${reason}).`);
    if (typeof soundManager !== 'undefined') {
        soundManager.stopBlindZone();
    }
    
    enemies.forEach(e => {
        if (e.pendingDamage > 0) {
            applyDamageToEnemy(e, e.pendingDamage);
            e.pendingDamage = 0; e.alert = true; e.alertCooldown = 300; e.hitTimer = 8;
            createExplosion(e.x, e.y, 20);
        }
    });
}

function applyDamageToEnemy(enemy, amount) {
    if (enemy.shield > 0) {
        if (enemy.shield >= amount) {
            enemy.shield -= amount;
            createExplosion(enemy.x, enemy.y, 6, '#00CCFF');
            return;
        } else {
            const overflow = amount - enemy.shield;
            enemy.shield = 0;
            enemy.hp -= overflow;
            createExplosion(enemy.x, enemy.y, 6, '#FF3344');
        }
    } else {
        enemy.hp -= amount;
        createExplosion(enemy.x, enemy.y, 8, '#FF3344');
    }

    if (enemy.hp <= 0) {
        killCount++;
        createExplosion(enemy.x, enemy.y, 18);
        spawnDropItem(enemy.x, enemy.y);
    }
}

function inBlindZone(x, y) {
    if (!blindActive || !blindZone) return false;
    const dx = x - blindZone.x, dy = y - blindZone.y;
    return (dx*dx + dy*dy) <= blindZone.radius * blindZone.radius;
}

function shoot() {
    if (player.hp <= 0 || isGameOver || isPaused || shootCooldownTimer > 0) return;
    
    if (typeof soundManager !== 'undefined') {
        soundManager.playShoot(currentWeapon.type);
    }
    
    shootCooldownTimer = currentWeapon.cooldown;
    if (currentWeapon.type !== 'grenade') {
        player.flashTimer = 3;
    } else {
        player.flashTimer = 0;
    }
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    if (currentWeapon.type === 'grenade') {
        grenades.push({
            x: player.x, y: player.y,
            targetX: mouse.x, targetY: mouse.y,
            startX: player.x, startY: player.y,
            vx: Math.cos(angle) * currentWeapon.speed,
            vy: Math.sin(angle) * currentWeapon.speed,
            traveled: 0,
            maxDist: Math.min(currentWeapon.range, Math.hypot(mouse.x - player.x, mouse.y - player.y)),
            damage: currentWeapon.damage,
            blastRadius: currentWeapon.blastRadius
        });
    } else {
        playerBullets.push({
            x: player.x + Math.cos(angle) * 24,
            y: player.y + Math.sin(angle) * 24,
            startX: player.x, startY: player.y,
            vx: Math.cos(angle) * currentWeapon.speed,
            vy: Math.sin(angle) * currentWeapon.speed,
            traveled: 0,
            maxRange: currentWeapon.range,
            damage: currentWeapon.damage,
            radius: currentWeapon.radius,
            penetrations: 1
        });
    }

    if (inBlindZone(player.x, player.y)) {
        enemies.forEach(e => {
            if (!inBlindZone(e.x, e.y) && !e.alert && Math.hypot(e.x - player.x, e.y - player.y) < 450) {
                e.confusedTimer = 60;
            }
        });
    }
}

function triggerGameOver(success) {
    isGameOver = true;
    const screen = document.getElementById('game-over-screen');
    const title = document.getElementById('over-title');
    const desc = document.getElementById('over-desc');
    if (screen) screen.style.display = 'flex';
    if(success) {
        if (title) { title.innerText = "SECTOR CLEARED"; title.style.color = "#00FF66"; }
        if (desc) desc.innerText = `SECTOR CLEARED. TOTAL KILLS: ${killCount}`;
    } else {
        if (title) { title.innerText = "MISSION FAILED"; title.style.color = "#FF3344"; }
        if (desc) desc.innerText = `OPERATIVE KILLED AT WAVE ${wave}. TOTAL KILLS: ${killCount}`;
    }
}

function resetGame() {
    wave = 1; killCount = 0; isGameOver = false; isPaused = false; gateAlarmCooldown = 0;
    unlockedWeapons = [WEAPONS.RIFLE.id];
    currentWeapon = WEAPONS.RIFLE;
    const banner = document.getElementById('alarm-banner');
    if (banner) banner.style.display = 'none';
    player.hp = 100; player.shield = 100; player.shieldActive = true; player.lastHitTimer = 0;
    
    blindActive = false; blindEnergy = MAX_BLIND_ENERGY; blindZone = null;
    playerBullets.length = 0; grenades.length = 0; enemyBullets.length = 0; particles.length = 0; dropItems.length = 0; traps.length = 0;
    const screen = document.getElementById('game-over-screen');
    if (screen) screen.style.display = 'none';

    initMapLayout();
    spawnWave();
    if (typeof window.onGamePauseChange === 'function') {
        window.onGamePauseChange(isPaused);
    }
}

function update() {
    if (typeof soundManager !== 'undefined') {
        soundManager.updateGameState(isGameOver, isPaused);
    }
    if (isGameOver || isPaused) return;
    if (shootCooldownTimer > 0) shootCooldownTimer--;
    if (gateAlarmCooldown > 0) gateAlarmCooldown--;
    if (typeof laserAlarmCooldown !== 'undefined' && laserAlarmCooldown > 0) laserAlarmCooldown--;

    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (currentLevelId === 'level3_bank') {
        // Update lasers
        if (typeof lasers !== 'undefined') {
            lasers.forEach(laser => {
                if (laser.pulseType === 'flicker') {
                    laser.timer = (laser.timer + 1) % laser.interval;
                    laser.active = (laser.timer < laser.onTime);
                } else if (laser.pulseType === 'moving_y') {
                    laser.y += laser.speed * laser.dir;
                    if (laser.y < laser.minY) {
                        laser.y = laser.minY;
                        laser.dir = 1;
                    } else if (laser.y > laser.maxY) {
                        laser.y = laser.maxY;
                        laser.dir = -1;
                    }
                    laser.y1 = laser.y;
                    laser.y2 = laser.y;
                } else if (laser.pulseType === 'moving_x') {
                    laser.x += laser.speed * laser.dir;
                    if (laser.x < laser.minX) {
                        laser.x = laser.minX;
                        laser.dir = 1;
                    } else if (laser.x > laser.maxX) {
                        laser.x = laser.maxX;
                        laser.dir = -1;
                    }
                    laser.x1 = laser.x;
                    laser.x2 = laser.x;
                }
            });
        }

        // Check laser collision
        if (typeof lasers !== 'undefined') {
            lasers.forEach(laser => {
                if (laser.active) {
                    // Check player collision
                    if (circleIntersectsSegment(player.x, player.y, 16, laser.x1, laser.y1, laser.x2, laser.y2)) {
                        if (laserAlarmCooldown <= 0) {
                            triggerGlobalAlarm();
                            laserAlarmCooldown = 120;
                            addLog("SECURITY SYSTEM BREACH! LASER CONTACT DETECTED! // 触发高能激光防御警报！");
                        }
                        // Continuous damage to player
                        player.lastHitTimer = 180; // Delay health regen
                        if (player.shield > 0) {
                            player.shield = Math.max(0, player.shield - 0.8);
                            player.hp = Math.max(0, player.hp - 0.2);
                        } else {
                            player.hp = Math.max(0, player.hp - 0.6);
                        }
                        // small continuous burn spark
                        if (Math.random() < 0.25) {
                            createExplosion(player.x + (Math.random() - 0.5) * 10, player.y + (Math.random() - 0.5) * 10, 2, '#FF3344');
                        }
                        if (player.hp <= 0) {
                            triggerGameOver(false);
                            return;
                        }
                    }

                    // Check enemy collision
                    enemies.forEach(e => {
                        if (e.hp > 0 && circleIntersectsSegment(e.x, e.y, 18, laser.x1, laser.y1, laser.x2, laser.y2)) {
                            // Constant damage to enemies
                            applyDamageToEnemy(e, 0.8);
                            e.alert = true;
                            e.alertCooldown = 300;
                            e.hitTimer = 2;
                            if (Math.random() < 0.25) {
                                createExplosion(e.x + (Math.random() - 0.5) * 10, e.y + (Math.random() - 0.5) * 10, 2, '#FF5533');
                            }
                        }
                    });
                }
            });
        }

        // Update fog grid reveal
        if (!allBankCellsRevealed && typeof bankRevealGrid !== 'undefined' && bankRevealGrid.length > 0) {
            const cellSize = 60;
            let newlyRevealed = false;
            for (let r = 0; r < bankGridRows; r++) {
                for (let c = 0; c < bankGridCols; c++) {
                    if (!bankRevealGrid[r][c]) {
                        const cx = c * cellSize + cellSize / 2;
                        const cy = r * cellSize + cellSize / 2;
                        if (Math.hypot(cx - player.x, cy - player.y) <= 240 && isInFOV({ x: cx, y: cy })) {
                            bankRevealGrid[r][c] = true;
                            revealedBankCellsCount++;
                            newlyRevealed = true;
                        }
                    }
                }
            }
            if (newlyRevealed && scannableBankCellsCount > 0) {
                const progress = Math.min(100, Math.floor((revealedBankCellsCount / scannableBankCellsCount) * 100));
                if (progress >= 92) {
                    allBankCellsRevealed = true;
                    addLog("MAP SYNCHRONIZED 100% // 战术平面图100%同步，完整地图已载入");
                }
            }
        }
    }

    let moveSpeed = player.speed;
    let dx = 0, dy = 0;
    if (keys['KeyW'] || keys['w'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['s'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
        if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
        player.walkCycle += 0.22;
        if (typeof soundManager !== 'undefined') soundManager.playFootstep();
    } else { player.walkCycle = 0; }
    
    let nextX = player.x + dx * moveSpeed;
    let nextY = player.y + dy * moveSpeed;

    let collidesWithLaser = false;
    if (currentLevelId === 'level3_bank' && typeof lasers !== 'undefined') {
        lasers.forEach(laser => {
            if (laser.active) {
                if (circleIntersectsSegment(nextX, nextY, 14, laser.x1, laser.y1, laser.x2, laser.y2)) {
                    collidesWithLaser = true;
                    if (laserAlarmCooldown <= 0) {
                        triggerGlobalAlarm();
                        laserAlarmCooldown = 120;
                        addLog("LASER BARRIER SECURED // 警报！高能激光防御网拦截，通路已封锁！");
                        createExplosion(player.x, player.y, 12, '#FF3344');
                    }
                }
            }
        });
    }

    if (!checkObstacleCollision(nextX, nextY, 18) && !collidesWithLaser) {
        player.x = Math.max(20, Math.min(width - 20, nextX));
        player.y = Math.max(20, Math.min(height - 20, nextY));
    }
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    if (player.flashTimer > 0) player.flashTimer--;

    if (gateAlarmCooldown <= 0) {
        securityGates.forEach(gate => {
            if (player.x > gate.x - 12 && player.x < gate.x + gate.w + 12 &&
                player.y > gate.y && player.y < gate.y + gate.h) {
                triggerGlobalAlarm();
                gateAlarmCooldown = 120;
                addLog("SECURITY GATE BREACHED! ALARM ACTIVATED!");
                createExplosion(player.x, player.y, 8, '#FF3344');
            }
        });
    }

    if (player.lastHitTimer > 0) {
        player.lastHitTimer--;
    } else if (player.shield < player.maxShield) {
        player.shield = Math.min(player.maxShield, player.shield + 0.15);
    }
    
    if (blindActive) {
        blindEnergy = Math.max(0, blindEnergy - BLIND_CONSUME_RATE);
        if (blindEnergy <= 0) closeBlindZone("ENERGY DEPLETED");
    } else {
        blindEnergy = Math.min(MAX_BLIND_ENERGY, blindEnergy + BLIND_RECOVER_RATE);
    }

    for (let i = dropItems.length - 1; i >= 0; i--) {
        let item = dropItems[i];
        item.timer--;
        if (item.timer <= 0) { dropItems.splice(i, 1); continue; }
        if (Math.hypot(player.x - item.x, player.y - item.y) < 28) {
            if (typeof soundManager !== 'undefined') soundManager.playPickup();
            if (item.type === 'medkit') {
                player.hp = Math.min(player.maxHp, player.hp + 35);
                addLog("RECOVERED MEDKIT (+35 VITALS)");
                createExplosion(player.x, player.y, 10, '#00FF66');
            } else if (item.type === 'battery') {
                player.shield = Math.min(player.maxShield, player.shield + 50);
                blindEnergy = Math.min(MAX_BLIND_ENERGY, blindEnergy + 40);
                addLog("RECOVERED BATTERY (+50 SHIELD / +40 ENERGY)");
                createExplosion(player.x, player.y, 10, '#00CCFF');
            } else if (item.type === 'weapon') {
                const wp = item.weaponData;
                if (!unlockedWeapons.includes(wp.id)) {
                    unlockedWeapons.push(wp.id);
                    addLog(`UNLOCKED NEW WEAPON: [${wp.name}]!`);
                } else {
                    addLog(`PICKED UP: [${wp.name}]`);
                }
                switchWeapon(wp);
                createExplosion(player.x, player.y, 12, '#FFFF00');
            } else if (item.type === 'classified_drive' || item.type === 'gold_vault_crown') {
                level3TargetSecured = true;
                killCount += 100;
                addLog("💾 SECURED HIGH-TECH CLASSIFIED DATA DRIVE! NIGHT SHADOW MASK LIFTED.");
                createExplosion(player.x, player.y, 35, '#00CCFF');
                for (let j = 0; j < 30; j++) {
                    particles.push({
                        x: player.x,
                        y: player.y,
                        vx: (Math.random() - 0.5) * 7,
                        vy: (Math.random() - 0.5) * 7,
                        life: 40 + Math.random() * 30,
                        maxLife: 70,
                        color: j % 2 === 0 ? '#00FF66' : '#00CCFF'
                    });
                }
            }
            dropItems.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    for (let i = grenades.length - 1; i >= 0; i--) {
        let g = grenades[i];
        let nextGPointX = g.x + g.vx;
        let nextGPointY = g.y + g.vy;

        const bounds = getLevelBounds();
        let hitBoundary = (nextGPointX < bounds.minX || nextGPointX > bounds.maxX || nextGPointY < bounds.minY || nextGPointY > bounds.maxY);
        let hitObs = checkLineObstacleIntersection(g.x, g.y, nextGPointX, nextGPointY);

        let hitProp = null;
        if (!hitObs) {
            for (let p of props) {
                if (p.w && p.h && lineIntersectsRect(g.x, g.y, nextGPointX, nextGPointY, p)) {
                    hitProp = p;
                    break;
                }
            }
        }

        // Grenades CANNOT pass solid walls, glass walls, props, or outer boundaries.
        // Grenades CAN ONLY pass low_wall (orange partition / low obstacles).
        if (hitBoundary || hitProp || (hitObs && (hitObs.type === 'solid' || hitObs.type === 'glass'))) {
            g.traveled = g.maxDist; // Instantly detonate at current position on hitting solid obstacle
        } else {
            g.x = nextGPointX; g.y = nextGPointY;
            g.traveled += Math.hypot(g.vx, g.vy);
        }

        if (g.traveled >= g.maxDist) {
            createExplosion(g.x, g.y, 35, '#FF5500');
            if (typeof soundManager !== 'undefined') {
                soundManager.playExplosion();
            }
            enemies.forEach(e => {
                if (e.hp <= 0) return;
                const d = Math.hypot(e.x - g.x, e.y - g.y);
                if (d <= g.blastRadius) {
                    const dmg = Math.floor(g.damage * (1 - d / g.blastRadius * 0.4));
                    const isObsSeesPlayer = e.isObserver && inBlindZone(player.x, player.y) && (function() {
                        const pdx = player.x - e.x, pdy = player.y - e.y;
                        const dist = Math.hypot(pdx, pdy);
                        if (dist < 110) {
                            const angleToPlayer = Math.atan2(pdy, pdx);
                            let diff = angleToPlayer - e.angle;
                            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                            return Math.abs(diff) < (Math.PI / 12) && canSee(e.x, e.y, player.x, player.y);
                        }
                        return false;
                    })();

                    if (inBlindZone(e.x, e.y) && !isObsSeesPlayer) {
                        e.pendingDamage += dmg;
                    } else {
                        applyDamageToEnemy(e, dmg);
                        // Resolve existing pendingDamage immediately!
                        if (e.pendingDamage > 0) {
                            applyDamageToEnemy(e, e.pendingDamage);
                            e.pendingDamage = 0;
                            createExplosion(e.x, e.y, 20);
                        }
                        e.alert = true; e.alertCooldown = 300; e.hitTimer = 6;
                    }
                }
            });
            grenades.splice(i, 1);
        }
    }

    for (let i = playerBullets.length - 1; i >= 0; i--) {
        let b = playerBullets[i];
        let nextBX = b.x + b.vx;
        let nextBY = b.y + b.vy;

        let hitObs = checkLineObstacleIntersection(b.x, b.y, nextBX, nextBY);
        if (hitObs) {
            if (hitObs.type === 'glass' && b.penetrations > 0) {
                b.penetrations--;
                b.damage *= 0.65;
                createExplosion(nextBX, nextBY, 4, '#00CCFF');
                b.x = nextBX; b.y = nextBY;
            } else {
                playerBullets.splice(i, 1); continue;
            }
        } else {
            b.x = nextBX; b.y = nextBY;
        }

        b.traveled += Math.hypot(b.vx, b.vy);

        if (b.traveled >= b.maxRange || b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
            playerBullets.splice(i, 1); continue;
        }
        for (let e of enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(b.x - e.x, b.y - e.y) < 22) {
                const isObsSeesPlayer = e.isObserver && inBlindZone(player.x, player.y) && (function() {
                    const pdx = player.x - e.x, pdy = player.y - e.y;
                    const dist = Math.hypot(pdx, pdy);
                    if (dist < 110) {
                        const angleToPlayer = Math.atan2(pdy, pdx);
                        let diff = angleToPlayer - e.angle;
                        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                        return Math.abs(diff) < (Math.PI / 12) && canSee(e.x, e.y, player.x, player.y);
                    }
                    return false;
                })();

                if (inBlindZone(e.x, e.y) && !isObsSeesPlayer) {
                    e.pendingDamage += b.damage;
                } else {
                    applyDamageToEnemy(e, b.damage);
                    e.hitTimer = 6;
                    // Resolve existing pendingDamage immediately since we are doing real-time damage now!
                    if (e.pendingDamage > 0) {
                        applyDamageToEnemy(e, e.pendingDamage);
                        e.pendingDamage = 0;
                        createExplosion(e.x, e.y, 20);
                    }
                    if (inBlindZone(player.x, player.y) && !e.isObserver) {
                        e.confusedTimer = 80;
                    } else {
                        e.alert = true; e.alertCooldown = 300;
                    }
                }
                playerBullets.splice(i, 1); break;
            }
        }
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];
        let nextEBX = eb.x + eb.vx;
        let nextEBY = eb.y + eb.vy;

        let hitObs = checkLineObstacleIntersection(eb.x, eb.y, nextEBX, nextEBY);
        if (hitObs) {
            if (hitObs.type === 'glass' && eb.penetrations > 0) {
                eb.penetrations--;
                eb.x = nextEBX; eb.y = nextEBY;
            } else {
                enemyBullets.splice(i, 1); continue;
            }
        } else {
            eb.x = nextEBX; eb.y = nextEBY;
        }

        if (eb.x < 0 || eb.x > width || eb.y < 0 || eb.y > height) {
            enemyBullets.splice(i, 1); continue;
        }
        if (Math.hypot(eb.x - player.x, eb.y - player.y) < 20) {
            if (typeof soundManager !== 'undefined') soundManager.playHit();
            player.lastHitTimer = 180; // set 3 second delay on regeneration
            if (player.shield > 0) {
                player.shield = Math.max(0, player.shield - 15);
                player.hp = Math.max(0, player.hp - 3);
                createExplosion(eb.x, eb.y, 6, '#00CCFF');
            } else {
                player.hp = Math.max(0, player.hp - 12);
                createExplosion(eb.x, eb.y, 6, '#FF3344');
            }
            enemyBullets.splice(i, 1);
            if (player.hp <= 0) { triggerGameOver(false); return; }
        }
    }
    
    let anyCameraDetecting = false;
    cameras.forEach(cam => {
        cam.sweepTimer += cam.sweepSpeed;
        cam.currentAngle = cam.baseAngle + Math.sin(cam.sweepTimer) * cam.sweepRange;
        
        let inSight = false;
        if (!inBlindZone(player.x, player.y) && player.hp > 0) {
            const pdx = player.x - cam.x;
            const pdy = player.y - cam.y;
            const dist = Math.hypot(pdx, pdy);
            
            if (dist < 320) {
                const angleToPlayer = Math.atan2(pdy, pdx);
                let diff = angleToPlayer - cam.currentAngle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));

                if (Math.abs(diff) < 0.45) {
                    inSight = true;
                }
            }
        }

        if (inSight) {
            cam.detecting = true;
            cam.cooldownTimer = 180;
            triggerGlobalAlarm();
        } else {
            if (cam.cooldownTimer > 0) {
                cam.cooldownTimer--;
            } else {
                cam.detecting = false;
            }
        }

        if (cam.detecting) anyCameraDetecting = true;
    });

    if (!anyCameraDetecting && gateAlarmCooldown <= 0) {
        const banner = document.getElementById('alarm-banner');
        if (banner) banner.style.display = 'none';
    }
    
    let aliveCount = 0;
    enemies.forEach(e => {
        if (e.hp <= 0) {
            if (e.deathAlpha > 0) e.deathAlpha -= 0.08;
            return;
        }
        aliveCount++;
        if (e.hitTimer > 0) e.hitTimer--;
        if (e.flashTimer > 0) e.flashTimer--;
        if (e.shootCooldown > 0) e.shootCooldown--;
        if (e.spawnGraceTimer > 0) e.spawnGraceTimer--;

        const inZone = inBlindZone(e.x, e.y);
        if (inZone && !e.isObserver) {
            if (Math.random() < 0.1) e.confusedAngle = e.angle + (Math.random() - 0.5) * 2.2;
            e.angle += (e.confusedAngle - e.angle) * 0.12;
            return;
        }

        if (e.confusedTimer > 0 && !e.isObserver) {
            e.confusedTimer--;
            if (Math.random() < 0.12) {
                e.confusedAngle = e.angle + (Math.random() - 0.5) * 2.5;
            }
            if (e.confusedAngle !== undefined) {
                e.angle += (e.confusedAngle - e.angle) * 0.15;
            }
            return;
        }
        
        const pdx = player.x - e.x, pdy = player.y - e.y;
        const dist = Math.hypot(pdx, pdy);
        const visible = canSee(e.x, e.y, player.x, player.y);
        
        const playerInBlind = inBlindZone(player.x, player.y);
        let playerIsHidden = playerInBlind && !e.isObserver;
        let observerSeesPlayer = false;

        if (e.isObserver && playerInBlind) {
            // Observer has extremely restricted field of view inside blind spot
            // Range: 110, Angle: +/- 15 degrees (Math.PI / 12)
            if (dist < 110) {
                const angleToPlayer = Math.atan2(pdy, pdx);
                let diff = angleToPlayer - e.angle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                if (Math.abs(diff) < (Math.PI / 12) && visible) {
                    observerSeesPlayer = true;
                }
            }
            playerIsHidden = !observerSeesPlayer;
        }

        if (e.spawnGraceTimer <= 0 && dist < 280 && visible && !playerIsHidden) {
            if (!e.alert && typeof soundManager !== 'undefined') soundManager.playAlert();
            e.alert = true;
            e.alertCooldown = 300; 
        }
        
        if (e.alert) {
            if (!visible || playerIsHidden) {
                e.alertCooldown--;
                if (e.alertCooldown <= 0) {
                    e.alert = false;
                }
            }
        }

        let attractedToTrap = null;
        if (e.isObserver && traps.length > 0 && !(e.alert && !playerIsHidden && e.spawnGraceTimer <= 0)) {
            let closestDist = Infinity;
            traps.forEach(t => {
                const d = Math.hypot(t.x - e.x, t.y - e.y);
                if (d < closestDist) {
                    closestDist = d;
                    attractedToTrap = t;
                }
            });
        }

        if (attractedToTrap) {
            const tdx = attractedToTrap.x - e.x, tdy = attractedToTrap.y - e.y;
            const d = Math.hypot(tdx, tdy);
            if (d < 16) {
                // Trigger trap explosion and instant kill!
                createExplosion(attractedToTrap.x, attractedToTrap.y, 25, '#FF3300');
                if (typeof soundManager !== 'undefined') {
                    soundManager.playExplosion();
                }
                applyDamageToEnemy(e, e.maxHp + 100);
                
                const tIndex = traps.indexOf(attractedToTrap);
                if (tIndex > -1) traps.splice(tIndex, 1);
                addLog("OBSERVER ELIMINATED BY TRAP // 侦察兵已被陷阱秒杀");
            } else {
                const moveAngle = Math.atan2(tdy, tdx);
                e.angle = moveAngle;
                
                let speed = e.patrolSpeed * 1.3;
                if (playerInBlind) {
                    speed = 0.55;
                }
                
                let pNextX = e.x + Math.cos(moveAngle) * speed;
                let pNextY = e.y + Math.sin(moveAngle) * speed;
                let moved = false;
                if (!checkObstacleCollision(pNextX, pNextY, 16)) {
                    e.x = pNextX; e.y = pNextY; moved = true;
                } else {
                    if (!checkObstacleCollision(pNextX, e.y, 16)) { e.x = pNextX; moved = true; }
                    else if (!checkObstacleCollision(e.x, pNextY, 16)) { e.y = pNextY; moved = true; }
                }
                if (moved) e.walkCycle += 0.12;
            }
        } else if (e.alert && !playerIsHidden && e.spawnGraceTimer <= 0) {
            e.angle = Math.atan2(pdy, pdx);
            
            // Speed penalty: slower move speed for observers if the player is in the blind spot
            let moveSpeed = 1.5;
            if (e.isObserver && playerInBlind) {
                moveSpeed = 0.5;
            }
            let moveAngle = e.angle;
            
            const stopDistance = 45;
            let moved = false;

            if (dist > stopDistance) {
                let eNextX = e.x + Math.cos(moveAngle) * moveSpeed;
                let eNextY = e.y + Math.sin(moveAngle) * moveSpeed;

                if (!checkObstacleCollision(eNextX, e.y, 16)) { e.x = eNextX; moved = true; }
                if (!checkObstacleCollision(e.x, eNextY, 16)) { e.y = eNextY; moved = true; }

                if (!moved) {
                    let altAngle = moveAngle + Math.PI / 2;
                    let altX = e.x + Math.cos(altAngle) * moveSpeed;
                    let altY = e.y + Math.sin(altAngle) * moveSpeed;
                    if (!checkObstacleCollision(altX, altY, 16)) {
                        e.x = altX; e.y = altY; moved = true;
                    }
                }
            }

            if (moved) e.walkCycle += 0.15;

            if (visible && e.shootCooldown <= 0) {
                e.shootCooldown = Math.max(38, 60 - wave * 2);
                e.flashTimer = 3;
                if (typeof soundManager !== 'undefined') soundManager.playEnemyShoot();
                enemyBullets.push({
                    x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
                    vx: Math.cos(e.angle) * 8.5, vy: Math.sin(e.angle) * 8.5,
                    penetrations: 1
                });
            }
        } else if (waypoints.length > 0) {
            const target = waypoints[e.targetWaypoint];
            const tdx = target.x - e.x, tdy = target.y - e.y;
            if (Math.hypot(tdx, tdy) < 15) {
                let nextIndex;
                do { nextIndex = Math.floor(Math.random() * waypoints.length); } while(nextIndex === e.targetWaypoint && waypoints.length > 1);
                e.targetWaypoint = nextIndex;
                e.stuckFrames = 0;
            } else {
                const moveAngle = Math.atan2(tdy, tdx);
                e.scanAngle += 0.02;
                e.angle = moveAngle + Math.sin(e.scanAngle) * 0.2;
                
                // Speed penalty: slower patrol speed for observers if the player is in the blind spot
                let speed = e.patrolSpeed;
                if (e.isObserver && playerInBlind) {
                    speed = 0.35;
                }
                
                let pNextX = e.x + Math.cos(moveAngle) * speed;
                let pNextY = e.y + Math.sin(moveAngle) * speed;
                if (!checkObstacleCollision(pNextX, pNextY, 16)) {
                    e.x = pNextX; e.y = pNextY; e.walkCycle += 0.1; e.stuckFrames = 0;
                } else {
                    e.stuckFrames++;
                    if (e.stuckFrames > 30) {
                        e.targetWaypoint = (e.targetWaypoint + 1) % waypoints.length;
                        e.stuckFrames = 0;
                    }
                }
            }
        }
    });

    if (aliveCount === 0) {
        waveTransitionTimer++;
        if (waveTransitionTimer > 80) {
            wave++; waveTransitionTimer = 0;
            spawnWave();
        }
    }

    const hpBar = document.getElementById('player-hp-bar');
    if (hpBar) hpBar.style.width = (player.hp / player.maxHp * 100) + '%';

    const shieldBar = document.getElementById('player-shield-bar');
    if (shieldBar) shieldBar.style.width = (player.shield / player.maxShield * 100) + '%';

    const blindBar = document.getElementById('blind-energy-bar');
    if (blindBar) blindBar.style.width = (blindEnergy / MAX_BLIND_ENERGY * 100) + '%';
    
    const label = document.getElementById('blind-label');
    if (label) {
        if (blindActive) {
            label.innerText = "BLIND ZONE ACTIVE // 盲区维持中 [SPACE关闭]";
            label.style.color = "#FF3344";
        } else {
            label.innerText = "BLIND ENERGY // 盲区能量 [SPACE开启]";
            label.style.color = "#00FF66";
        }
    }

    const waveTitle = document.getElementById('wave-title');
    if (waveTitle) waveTitle.innerText = `WAVE: ${wave}`;

    const enemiesLeft = document.getElementById('enemies-left');
    if (enemiesLeft) enemiesLeft.innerText = aliveCount > 0 ? `HOSTILES: ${aliveCount}` : `NEXT WAVE INCOMING...`;

    const scoreCount = document.getElementById('score-count');
    if (scoreCount) scoreCount.innerText = `KILLS: ${killCount}`;
}

function drawZones() {
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    zones.forEach(z => {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(z.x, z.y, z.w, z.h)) {
            return;
        }
        ctx.save();
        if (levelId === 'level1_airport') {
            ctx.strokeStyle = 'rgba(0, 255, 102, 0.4)';
            ctx.fillStyle = 'rgba(0, 255, 102, 0.05)';
        } else if (levelId === 'level4_test') {
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)';
            ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
        } else if (levelId === 'level2_subway') {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
        } else {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
            ctx.fillStyle = 'rgba(30, 58, 138, 0.22)';
        }
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]); // 战术虚线外框
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.fillRect(z.x, z.y, z.w, z.h);
        
        ctx.font = 'bold 9px monospace';
        const txtW = ctx.measureText(z.name).width;
        const align = z.align || 'center';
        let labelX = z.labelX !== undefined ? z.labelX : (z.x + z.w / 2);
        let labelY = z.labelY !== undefined ? z.labelY : (z.y + 14);

        let badgeX = labelX;
        if (align === 'center') {
            badgeX = labelX - txtW / 2;
        } else if (align === 'right') {
            badgeX = labelX - txtW;
        }

        // Background pill badge for zone name so it stays clean and readable
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(badgeX - 5, labelY - 8, txtW + 10, 12);
        ctx.strokeStyle = levelId === 'level1_airport' ? 'rgba(0,255,102,0.4)' : (levelId === 'level4_test' ? 'rgba(236,72,153,0.6)' : (levelId === 'level2_subway' ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.4)'));
        ctx.lineWidth = 0.8;
        ctx.setLineDash([]);
        ctx.strokeRect(badgeX - 5, labelY - 8, txtW + 10, 12);

        ctx.fillStyle = levelId === 'level1_airport' ? '#00FF66' : (levelId === 'level4_test' ? '#F43F5E' : (levelId === 'level2_subway' ? '#FBBF24' : '#93C5FD'));
        ctx.textAlign = align;
        ctx.fillText(z.name, labelX, labelY);
        ctx.restore();
    });
}

function drawPropTagLabel(p) {
    const text = p.label;
    if (!text) return;

    ctx.font = 'bold 8px monospace';
    const txtW = ctx.measureText(text).width;
    let tagX = p.labelX !== undefined ? p.labelX : (p.x + (p.w - txtW) / 2);
    let tagY = p.labelY !== undefined ? p.labelY : (p.y - 4);
    
    if (p.tagPosition === 'bottom') {
        tagY = p.y + p.h + 9;
    } else if (p.tagPosition === 'inside') {
        tagY = p.y + p.h / 2 + 3;
    } else if (p.tagPosition === 'right') {
        tagX = p.x + p.w + 6;
        tagY = p.y + p.h / 2 + 3;
    } else if (p.tagPosition === 'left') {
        tagX = p.x - txtW - 6;
        tagY = p.y + p.h / 2 + 3;
    } else if (p.labelY === undefined && p.y < 85) {
        tagY = p.y + p.h + 9;
    }

    if (p.tagXOffset) tagX += p.tagXOffset;
    if (p.tagYOffset) tagY += p.tagYOffset;

    tagX = Math.max(4, Math.min(width - txtW - 6, tagX));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(tagX - 4, tagY - 7, txtW + 8, 10);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(tagX - 4, tagY - 7, txtW + 8, 10);

    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.fillText(text, tagX, tagY);
}

function drawProps() {
    props.forEach(p => {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(p.x, p.y, p.w || 1, p.h || 1)) {
            return;
        }
        ctx.save();
        const lbl = (p.label || '').toUpperCase();

        if (lbl.includes('TRAIN')) {
            // 列车车体与列车轨道细节
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x - 10, p.y + 4); ctx.lineTo(p.x + p.w + 10, p.y + 4);
            ctx.moveTo(p.x - 10, p.y + p.h - 4); ctx.lineTo(p.x + p.w + 10, p.y + p.h - 4);
            ctx.stroke();

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1.5;
            for (let rx = p.x - 8; rx <= p.x + p.w + 8; rx += 12) {
                ctx.beginPath();
                ctx.moveTo(rx, p.y + 1); ctx.lineTo(rx, p.y + p.h - 1);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);

            let trainGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
            trainGrad.addColorStop(0, '#1e293b');
            trainGrad.addColorStop(0.5, '#0f172a');
            trainGrad.addColorStop(1, '#1e293b');
            ctx.fillStyle = trainGrad;
            ctx.fillRect(p.x, p.y, p.w, p.h);

            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            ctx.fillStyle = '#00CCFF';
            ctx.fillRect(p.x, p.y + 2, p.w, 2);

            ctx.fillStyle = 'rgba(0, 204, 255, 0.25)';
            ctx.strokeStyle = 'rgba(0, 204, 255, 0.7)';
            ctx.lineWidth = 1;
            const windowW = 18;
            const windowGap = 26;
            for (let wx = p.x + 22; wx < p.x + p.w - windowW; wx += windowGap) {
                ctx.fillRect(wx, p.y + 6, windowW, p.h - 12);
                ctx.strokeRect(wx, p.y + 6, windowW, p.h - 12);
            }

            ctx.strokeStyle = '#FF3344';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x + p.w * 0.3, p.y); ctx.lineTo(p.x + p.w * 0.3, p.y + p.h);
            ctx.moveTo(p.x + p.w * 0.7, p.y); ctx.lineTo(p.x + p.w * 0.7, p.y + p.h);
            ctx.stroke();

            ctx.fillStyle = '#00FF66';
            ctx.fillRect(p.x + 2, p.y + 4, 3, 4);
            ctx.fillRect(p.x + 2, p.y + p.h - 8, 3, 4);
            ctx.fillStyle = '#FF3344';
            ctx.fillRect(p.x + p.w - 5, p.y + 4, 3, 4);
            ctx.fillRect(p.x + p.w - 5, p.y + p.h - 8, 3, 4);

            ctx.fillStyle = '#00CCFF';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(p.label || "TRAIN", p.x + 8, p.y + p.h - 6, Math.max(10, p.w - 16));

        } else if (p.type === 'conveyor' || lbl.includes('CAROUSEL') || lbl.includes('BELT')) {
            // 传送带 / 行李提取转盘细节 (Baggage Claim Carousel) - 精细化设计，参考安检 X-Ray 机高科技质感
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h); // 阴影

            // 1. 外部大框 (Dark Blue-Grey casing)
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 2. 两端驱动/控制金属端盖 (Control/Drive Housing at both ends, like X-Ray machine sides)
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p.x, p.y, 8, p.h);
            ctx.fillRect(p.x + p.w - 8, p.y, 8, p.h);
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x, p.y, 8, p.h);
            ctx.strokeRect(p.x + p.w - 8, p.y, 8, p.h);

            // 3. 内部主皮带运行床 (Dark Core)
            ctx.fillStyle = '#09131a';
            ctx.fillRect(p.x + 10, p.y + 4, p.w - 20, p.h - 8);
            ctx.strokeStyle = 'rgba(0, 204, 255, 0.5)';
            ctx.strokeRect(p.x + 10, p.y + 4, p.w - 20, p.h - 8);

            // 4. 重复的细皮带缝隙/叶片纹理 (Finer conveyor slats, directly mirroring X-Ray scanning line pattern)
            ctx.strokeStyle = 'rgba(0, 204, 255, 0.4)';
            ctx.lineWidth = 1;
            for (let lx = p.x + 14; lx < p.x + p.w - 14; lx += 5) {
                ctx.beginPath();
                ctx.moveTo(lx, p.y + 4);
                ctx.lineTo(lx, p.y + p.h - 4);
                ctx.stroke();
            }

            // 5. 传送带中央金属隔离岛 (Central Metal Island inside the claim loop)
            const islandW = p.w * 0.55;
            const islandH = p.h * 0.35;
            const islandX = p.x + (p.w - islandW) / 2;
            const islandY = p.y + (p.h - islandH) / 2;
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(islandX, islandY, islandW, islandH);
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(islandX, islandY, islandW, islandH);

            // 隔离岛内部细节
            ctx.fillStyle = '#07111a';
            ctx.fillRect(islandX + 3, islandY + 3, islandW - 6, islandH - 6);
            ctx.strokeStyle = 'rgba(0, 204, 255, 0.3)';
            ctx.strokeRect(islandX + 3, islandY + 3, islandW - 6, islandH - 6);

            // 6. 状态指示灯 (LED lights on side panels - Green & Red status)
            // 动力就绪指示
            ctx.fillStyle = '#00FF66';
            ctx.beginPath(); ctx.arc(p.x + 4, p.y + 6, 1.8, 0, Math.PI * 2); ctx.fill();
            // 载荷警示指示
            ctx.fillStyle = '#FF3344';
            ctx.beginPath(); ctx.arc(p.x + 4, p.y + p.h - 6, 1.8, 0, Math.PI * 2); ctx.fill();

            // 右侧端盖指示
            const pulseLight = (Date.now() % 800 < 400);
            ctx.fillStyle = pulseLight ? '#00CCFF' : 'rgba(0, 204, 255, 0.3)';
            ctx.beginPath(); ctx.arc(p.x + p.w - 4, p.y + p.h / 2, 2, 0, Math.PI * 2); ctx.fill();

            // 7. 转盘上的行李箱 (Suitcases) - 绘制极其精细的拉杆行李箱和背包
            if (p.w >= 80) {
                // 行李 A: 经典蓝皮箱 (含把手、拉杆与绑带)
                const bagAX = p.x + p.w * 0.18;
                const bagAY = p.y + p.h * 0.12;
                ctx.fillStyle = '#1e3a8a'; // 宝蓝色
                ctx.fillRect(bagAX, bagAY, 18, 11);
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 1;
                ctx.strokeRect(bagAX, bagAY, 18, 11);
                // 行李箱把手 & 金属边角
                ctx.strokeStyle = '#94a3b8';
                ctx.beginPath(); ctx.moveTo(bagAX + 4, bagAY); ctx.lineTo(bagAX + 4, bagAY - 2); ctx.lineTo(bagAX + 14, bagAY - 2); ctx.lineTo(bagAX + 14, bagAY); ctx.stroke();
                ctx.fillStyle = '#60a5fa';
                ctx.fillRect(bagAX + 1, bagAY + 1, 2, 2);
                ctx.fillRect(bagAX + 15, bagAY + 1, 2, 2);
                // 箱体固定捆带 (Yellow luggage strap)
                ctx.fillStyle = '#FFCC00';
                ctx.fillRect(bagAX + 8, bagAY, 2.5, 11);

                // 行李 B: 艳丽紫皮箱
                const bagBX = p.x + p.w - 44;
                const bagBY = p.y + p.h - 22;
                ctx.fillStyle = '#701a75'; // 紫色
                ctx.fillRect(bagBX, bagBY, 18, 11);
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = 1;
                ctx.strokeRect(bagBX, bagBY, 18, 11);
                // 行李箱拉杆
                ctx.strokeStyle = '#94a3b8';
                ctx.beginPath(); ctx.moveTo(bagBX + 4, bagBY + 11); ctx.lineTo(bagBX + 4, bagBY + 13); ctx.lineTo(bagBX + 14, bagBY + 13); ctx.lineTo(bagBX + 14, bagBY + 11); ctx.stroke();
                // 捆带
                ctx.fillStyle = '#00FF66';
                ctx.fillRect(bagBX + 9, bagBY, 2, 11);

                // 行理 C: 极具质感的军绿旅行袋 (Duffel Bag) (放在中间空白偏右处)
                const bagCX = p.x + p.w * 0.32;
                const bagCY = p.y + p.h * 0.58;
                ctx.fillStyle = '#14532d'; // 深绿色
                ctx.beginPath();
                ctx.roundRect(bagCX, bagCY, 16, 9, 3);
                ctx.fill();
                ctx.strokeStyle = '#4ade80';
                ctx.stroke();
                // 手提带
                ctx.strokeStyle = '#4ade80';
                ctx.beginPath();
                ctx.arc(bagCX + 8, bagCY, 4, Math.PI, 0);
                ctx.stroke();
            }

            // 8. 文字标识
            ctx.fillStyle = '#00CCFF';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(p.label || "CAROUSEL", p.x + 12, p.y + p.h - 6, Math.max(10, p.w - 24));

        } else if (lbl.includes('FLIGHT BOARD')) {
            // 航班告示屏立柱
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#020617';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 模拟点阵荧光屏航讯
            ctx.fillStyle = '#00FF66';
            for (let lineY = p.y + 5; lineY < p.y + p.h - 10; lineY += 5) {
                ctx.fillRect(p.x + 4, lineY, p.w * 0.42, 2);
                ctx.fillStyle = '#FFFF00';
                ctx.fillRect(p.x + 4 + p.w * 0.48, lineY, p.w * 0.38, 2);
                ctx.fillStyle = '#00FF66';
            }

            ctx.fillStyle = '#00FF66';
            ctx.font = 'bold 8px monospace';
            ctx.fillText("FLIGHTS", p.x + 3, p.y + p.h - 2);

        } else if (lbl.includes('CHECK-IN')) {
            // 值机打票柜台
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 电脑显示屏
            ctx.fillStyle = '#09131a';
            ctx.fillRect(p.x + 6, p.y + 3, 16, 11);
            ctx.strokeStyle = '#00FF66'; ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 6, p.y + 3, 16, 11);

            // 称重托盘 (Baggage Scale)
            ctx.fillStyle = '#334155';
            ctx.fillRect(p.x + 28, p.y + 4, 26, p.h - 8);
            ctx.strokeStyle = '#00CCFF';
            ctx.strokeRect(p.x + 28, p.y + 4, 26, p.h - 8);

            drawPropTagLabel(p);

        } else if (lbl.includes('BAR') || lbl.includes('DUTY FREE')) {
            // 免税吧台 / 展台
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 吧台亮紫色台面高光
            ctx.fillStyle = '#c084fc';
            ctx.fillRect(p.x, p.y + 2, p.w, 2);

            // 展示柜玻璃反光
            ctx.fillStyle = 'rgba(192, 132, 252, 0.25)';
            ctx.fillRect(p.x + 5, p.y + 6, p.w - 10, p.h - 14);

            drawPropTagLabel(p);

        } else if (lbl.includes('CARGO') || lbl.includes('CONTAINER')) {
            // 航空集装箱
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#334155';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 集装箱加固线条
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 1;
            for (let cx = p.x + 5; cx < p.x + p.w - 4; cx += 5) {
                ctx.beginPath(); ctx.moveTo(cx, p.y + 2); ctx.lineTo(cx, p.y + p.h - 2); ctx.stroke();
            }

            drawPropTagLabel(p);

        } else if (lbl.includes('X-RAY')) {
            // 安检 X-Ray 扫描机细节
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p.x, p.y, 5, p.h);
            ctx.fillRect(p.x + p.w - 5, p.y, 5, p.h);

            ctx.fillStyle = '#09131a';
            ctx.fillRect(p.x + 7, p.y + 3, p.w - 14, p.h - 6);
            ctx.strokeStyle = '#00FF66';
            ctx.strokeRect(p.x + 7, p.y + 3, p.w - 14, p.h - 6);

            ctx.strokeStyle = 'rgba(0, 255, 102, 0.45)';
            ctx.lineWidth = 1;
            for (let lx = p.x + 10; lx < p.x + p.w - 10; lx += 4) {
                ctx.beginPath();
                ctx.moveTo(lx, p.y + 3); ctx.lineTo(lx, p.y + p.h - 3);
                ctx.stroke();
            }

            ctx.fillStyle = '#00FF66';
            ctx.beginPath(); ctx.arc(p.x + 10, p.y + 6, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FF3344';
            ctx.beginPath(); ctx.arc(p.x + 16, p.y + 6, 2, 0, Math.PI * 2); ctx.fill();

            drawPropTagLabel(p);

        } else if (lbl.includes('BAGGAGE')) {
            // 行李堆 / 手推车
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p.x, p.y, p.w, p.h);

            ctx.fillStyle = '#0e3a47';
            ctx.fillRect(p.x + 2, p.y + 2, p.w - 10, p.h - 8);
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 2, p.y + 2, p.w - 10, p.h - 8);
            ctx.fillStyle = '#334155';
            ctx.fillRect(p.x + 5, p.y, 8, 2);

            ctx.fillStyle = '#3d2b0f';
            ctx.fillRect(p.x + p.w - 14, p.y + p.h - 16, 12, 14);
            ctx.strokeStyle = '#FF9900';
            ctx.strokeRect(p.x + p.w - 14, p.y + p.h - 16, 12, 14);

            drawPropTagLabel(p);

        } else if (lbl.includes('KIOSK')) {
            // 自助终端
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            ctx.fillStyle = '#042f2e';
            ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h * 0.45);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h * 0.45);

            ctx.fillStyle = '#00FF66';
            ctx.fillRect(p.x + 6, p.y + 7, p.w - 12, 2);
            ctx.fillRect(p.x + 6, p.y + 11, p.w * 0.5, 2);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p.x + 5, p.y + p.h * 0.55, p.w - 10, p.h * 0.22);
            ctx.fillStyle = '#00CCFF';
            ctx.fillRect(p.x + p.w - 10, p.y + p.h * 0.58, 3, 2);

            drawPropTagLabel(p);

        } else if (lbl.includes('BOOTH') || lbl.includes('CONSOLE')) {
            // 控制台 / 监控台
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            const monW = (p.w - 12) / 2;
            ctx.fillStyle = '#09131a';
            ctx.fillRect(p.x + 4, p.y + 4, monW, 12);
            ctx.fillRect(p.x + 4 + monW + 4, p.y + 4, monW, 12);

            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 4, p.y + 4, monW, 12);
            ctx.strokeRect(p.x + 4 + monW + 4, p.y + 4, monW, 12);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p.x + 5, p.y + 18, p.w - 10, p.h - 22);

            drawPropTagLabel(p);

        } else if (lbl.includes('SERVER')) {
            // 服务器机架
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            ctx.strokeStyle = 'rgba(0, 204, 255, 0.3)';
            ctx.lineWidth = 1;
            for (let sy = p.y + 4; sy < p.y + p.h - 10; sy += 5) {
                ctx.beginPath();
                ctx.moveTo(p.x + 4, sy); ctx.lineTo(p.x + p.w - 4, sy);
                ctx.stroke();
                ctx.fillStyle = (sy % 2 === 0) ? '#00FF66' : '#FF9900';
                ctx.fillRect(p.x + p.w - 6, sy - 1, 2, 2);
            }

            drawPropTagLabel(p);

        } else if (lbl.includes('GENERATOR') || lbl.includes('CRATES') || lbl.includes('GEAR')) {
            // 物资箱 / 发电机
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#FF9900';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            if (lbl.includes('GENERATOR')) {
                ctx.strokeStyle = 'rgba(255, 153, 0, 0.45)';
                ctx.lineWidth = 1;
                for (let vy = p.y + 6; vy < p.y + p.h - 10; vy += 4) {
                    ctx.beginPath();
                    ctx.moveTo(p.x + 5, vy); ctx.lineTo(p.x + p.w - 5, vy);
                    ctx.stroke();
                }
                ctx.fillStyle = '#FF9900';
                ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + 7, 2.5, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(255, 153, 0, 0.35)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y + p.h);
                ctx.moveTo(p.x + p.w, p.y); ctx.lineTo(p.x, p.y + p.h);
                ctx.stroke();
            }

            drawPropTagLabel(p);

        } else if (p.type === 'chair_group') {
            // 排椅细节
            ctx.strokeStyle = 'rgba(0, 255, 102, 0.5)';
            ctx.lineWidth = 1;
            for(let i = 0; i < 4; i++) {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(p.x + i * 22, p.y, 18, 18);
                ctx.strokeRect(p.x + i * 22, p.y, 18, 18);
                ctx.strokeRect(p.x + i * 22 + 3, p.y + 3, 12, 12);
            }
            drawPropTagLabel(p);

        } else if (p.type === 'sofa' || lbl.includes('SOFA')) {
            // High-fidelity luxury leather sofa drawing
            // 1. Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);

            // 2. Base cushion / main couch body (Brown leather or deep cozy color)
            ctx.fillStyle = '#451a03'; // Rich dark brown leather base
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#d97706'; // Golden brown stitching border
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 3. Backrest & Armrest depending on orientation (horizontal or vertical)
            if (p.w >= p.h) {
                // Horizontal Sofa
                ctx.fillStyle = '#78350f'; // Lighter brown leather
                ctx.fillRect(p.x, p.y, p.w, 4); // Backrest at top
                ctx.strokeRect(p.x, p.y, p.w, 4);

                ctx.fillRect(p.x, p.y, 4, p.h); // Left armrest
                ctx.strokeRect(p.x, p.y, 4, p.h);
                ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h); // Right armrest
                ctx.strokeRect(p.x + p.w - 4, p.y, 4, p.h);

                // Seat cushions split
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x + p.w / 2, p.y + 4);
                ctx.lineTo(p.x + p.w / 2, p.y + p.h);
                ctx.stroke();
            } else {
                // Vertical Sofa (e.g. Lobby sofas on left wall facing right)
                ctx.fillStyle = '#78350f';
                ctx.fillRect(p.x, p.y, 4, p.h); // Backrest on left wall side
                ctx.strokeRect(p.x, p.y, 4, p.h);

                ctx.fillRect(p.x, p.y, p.w, 4); // Top armrest
                ctx.strokeRect(p.x, p.y, p.w, 4);
                ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4); // Bottom armrest
                ctx.strokeRect(p.x, p.y + p.h - 4, p.w, 4);

                // Seat cushions split
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x + 4, p.y + p.h / 2);
                ctx.lineTo(p.x + p.w, p.y + p.h / 2);
                ctx.stroke();
            }

            drawPropTagLabel(p);

        } else if (p.type === 'cash_rack' || lbl.includes('CASH') || lbl.includes('RACK')) {
            // Ultra-realistic cash and gold storage rack drawing
            // 1. Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);

            // 2. Base steel frame
            ctx.fillStyle = '#1e293b'; // Slate dark grey rack
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#64748b'; // Metallic steel borders
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 3. Draw shelves/dividers (4 columns/compartments)
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.5;
            const cols = 4;
            const colW = p.w / cols;
            for (let i = 1; i < cols; i++) {
                ctx.beginPath();
                ctx.moveTo(p.x + i * colW, p.y);
                ctx.lineTo(p.x + i * colW, p.y + p.h);
                ctx.stroke();
            }

            // 4. Fill compartments with money stacks and gold bars alternately!
            for (let i = 0; i < cols; i++) {
                const startX = p.x + i * colW + 3;
                const endX = p.x + (i + 1) * colW - 3;
                const currentW = endX - startX;
                
                if (i % 2 === 0) {
                    // Gold bars: Draw shiny yellow golden rectangles with orange highlights
                    ctx.fillStyle = '#f59e0b'; // Gold base
                    ctx.fillRect(startX, p.y + 3, currentW, p.h - 6);
                    
                    // Shiny highlights
                    ctx.fillStyle = '#fef08a'; // Golden shine
                    for (let gy = p.y + 5; gy < p.y + p.h - 5; gy += 4) {
                        ctx.fillRect(startX + 2, gy, currentW - 4, 1.5);
                    }
                    // Border around gold pile
                    ctx.strokeStyle = '#d97706';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(startX, p.y + 3, currentW, p.h - 6);
                } else {
                    // Dollar bundles: Draw emerald green rectangles with a white ribbon/strap in the center
                    ctx.fillStyle = '#10b981'; // Money green
                    ctx.fillRect(startX, p.y + 3, currentW, p.h - 6);
                    
                    // White strap/band in the center of the bundle
                    ctx.fillStyle = '#f8fafc'; // Clean white paper strap
                    ctx.fillRect(startX + currentW / 2 - 2, p.y + 3, 4, p.h - 6);
                    
                    // Money paper lines
                    ctx.strokeStyle = '#047857';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(startX, p.y + 3, currentW, p.h - 6);
                }
            }

            // Red security LED indicator
            ctx.fillStyle = '#ef4444'; 
            ctx.beginPath();
            ctx.arc(p.x + 6, p.y + p.h / 2, 2, 0, Math.PI * 2);
            ctx.fill();

            drawPropTagLabel(p);

        } else if (p.type === 'deposit_boxes' || lbl.includes('DEPOSIT') || lbl.includes('BOXES')) {
            // High-fidelity Safe Deposit Lockers
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);

            // Metallic safe base
            ctx.fillStyle = '#334155'; // Dark slate
            ctx.fillRect(p.x, p.y, p.w, p.h);
            
            ctx.strokeStyle = '#94a3b8'; // Metallic grey frame
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Draw a grid of safe deposit box doors
            const rows = p.h > 45 ? 3 : 2;
            const cols = p.w > 65 ? 4 : 3;
            const boxW = p.w / cols;
            const boxH = p.h / rows;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const bx = p.x + c * boxW;
                    const by = p.y + r * boxH;
                    
                    // Box borders
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(bx, by, boxW, boxH);
                    
                    // Golden keyhole dot
                    ctx.fillStyle = '#eab308';
                    ctx.beginPath();
                    ctx.arc(bx + boxW * 0.3, by + boxH * 0.5, 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Tiny lock latch line
                    ctx.strokeStyle = '#1e293b';
                    ctx.beginPath();
                    ctx.moveTo(bx + boxW * 0.3, by + boxH * 0.5);
                    ctx.lineTo(bx + boxW * 0.5, by + boxH * 0.5);
                    ctx.stroke();

                    // Miniature indicator LED
                    ctx.fillStyle = (r + c) % 3 === 0 ? '#10b981' : '#ef4444'; // blink-like static lights
                    ctx.fillRect(bx + boxW - 5, by + 3, 2, 2);
                }
            }

            drawPropTagLabel(p);

        } else if (p.type === 'desk' || p.type === 'table' || p.type === 'counter' || lbl.includes('DESK') || lbl.includes('TABLE') || lbl.includes('RECEPTION') || lbl.includes('PANTRY') || lbl.includes('TELLER') || lbl.includes('COUNTER')) {
            // Custom Office Workspace Desk / Conference Table / Pantry Leisure Table
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            const isLeisure = lbl.includes('PANTRY') || lbl.includes('COFFEE') || lbl.includes('TEA') || lbl.includes('LOUNGE') || lbl.includes('SOFA') || lbl.includes('REST') || lbl.includes('BREAK');
            const isConference = lbl.includes('CONF') || p.w > 120;

            if (isLeisure) {
                // Leisure Coffee / Pantry / Lounge Table (NO computers, keyboards or monitors!)
                ctx.fillStyle = '#7c2d12'; // Rich warm mahogany wood
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#a16207'; // Polished wooden border
                ctx.lineWidth = 1.5;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                // Glass top / decorative center runner
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);

                // Leisure Items: Coffee Mugs, Snacks/Pastries on a plate, Books/Magazines, Teapot
                // 1. Coffee / Tea Mug
                const mugX = p.x + 8;
                const mugY = p.y + p.h / 2;
                ctx.fillStyle = '#ffffff'; // Porcelain white mug
                ctx.beginPath();
                ctx.arc(mugX, mugY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#451a03'; // Coffee brown liquid center
                ctx.beginPath();
                ctx.arc(mugX, mugY, 1.8, 0, Math.PI * 2);
                ctx.fill();

                // 2. Snack Plate with pastries/doughnuts/cookies
                const plateX = p.x + p.w / 2;
                const plateY = p.y + p.h / 2;
                ctx.fillStyle = '#f8fafc'; // White ceramic plate
                ctx.beginPath();
                ctx.arc(plateX, plateY, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                // Croissant / cookies on plate
                ctx.fillStyle = '#f59e0b'; // Golden pastry
                ctx.beginPath();
                ctx.arc(plateX - 1.5, plateY - 1, 1.8, 0, Math.PI * 2);
                ctx.arc(plateX + 1.5, plateY + 1, 1.8, 0, Math.PI * 2);
                ctx.fill();

                // 3. Books & Magazines stacked
                if (p.w > 40) {
                    const bookX = p.x + p.w - 14;
                    const bookY = p.y + 3;
                    ctx.fillStyle = '#0284c7'; // Blue book
                    ctx.fillRect(bookX, bookY, 10, 6);
                    ctx.fillStyle = '#ef4444'; // Red magazine on top
                    ctx.fillRect(bookX + 2, bookY + 1.5, 8, 4.5);
                }

                // 4. Teapot / Glass carafe if larger table
                if (p.w > 60) {
                    const potX = p.x + 22;
                    const potY = p.y + p.h / 2;
                    ctx.fillStyle = '#38bdf8'; // Glass tea kettle
                    ctx.beginPath();
                    ctx.arc(potX, potY, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }

            } else if (isConference) {
                // Conference Table: Draw modern central frosted glass strip and wooden inlay
                ctx.fillStyle = '#7c2d12';
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#9a3412';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.fillRect(p.x + 8, p.y + p.h / 2 - 2, p.w - 16, 4);
                
                // Draw multiple paper/documentation folders around the table for meetings
                ctx.fillStyle = '#f8fafc'; // White docs
                for (let dx = p.x + 15; dx < p.x + p.w - 15; dx += 30) {
                    ctx.fillRect(dx, p.y + 3, 8, 6);
                    ctx.fillRect(dx + 10, p.y + p.h - 9, 8, 6);
                }

            } else {
                // Standard Office Workspace Desk / Staff Desk / Teller Counter
                ctx.fillStyle = '#475569'; // Office steel grey
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                // 1. Dual computer screens with glowing cyan display
                const screenW = Math.min(22, p.w * 0.4);
                const screenX = p.x + p.w / 2 - screenW / 2;
                const screenY = p.y + 4;
                
                ctx.fillStyle = '#0f172a'; // Monitor bezel
                ctx.fillRect(screenX, screenY, screenW, 4);
                ctx.fillStyle = '#06b6d4'; // Cyan display screen glow
                ctx.fillRect(screenX + 2, screenY + 1, screenW - 4, 2);

                // 2. Keyboard
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(screenX + 2, screenY + 6, screenW - 4, 3);
                
                // 3. Papers / folders on the side
                ctx.fillStyle = '#e2e8f0'; // Folder sheets
                ctx.fillRect(p.x + 4, p.y + p.h - 10, 8, 6);
                ctx.fillStyle = '#3b82f6'; // Blue folder spine
                ctx.fillRect(p.x + 4, p.y + p.h - 12, 8, 2);

                // 4. Coffee cup
                ctx.fillStyle = '#f43f5e'; // Red mug
                ctx.beginPath();
                ctx.arc(p.x + p.w - 8, p.y + p.h - 8, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#78350f';
                ctx.beginPath();
                ctx.arc(p.x + p.w - 8, p.y + p.h - 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            drawPropTagLabel(p);

        } else {
            // 默认掩体
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            drawPropTagLabel(p);
        }
        ctx.restore();
    });
}

function drawTraps() {
    traps.forEach(t => {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(t.x, t.y, 1, 1)) {
            return;
        }
        ctx.save();
        // Outer pulsing ring
        t.pulseTimer += 0.08;
        const pulseRadius = 10 + Math.sin(t.pulseTimer) * 5;
        ctx.strokeStyle = 'rgba(255, 102, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner solid core
        ctx.fillStyle = '#FF6600';
        ctx.shadowColor = '#FF6600';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawObstacle(obs) {
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    if (levelId === 'level3_bank' && !obs.isOuterBorder) {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(obs.x, obs.y, obs.w, obs.h)) {
            return;
        }
    }
    ctx.save();

    if (obs.type === 'solid') {
        const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
        
        // 实体墙：阴影 + 渐变墙体
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w, obs.h);

        let grad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
        let wallStroke, gridStroke;
        
        if (levelId === 'level1_airport') {
            // 机场关卡：亮白色/浅灰色实墙，搭配深灰高光描边与精致灰色网格纹
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(1, '#EAECEF');
            wallStroke = 'rgba(107, 114, 128, 0.85)'; // 深灰色描边
            gridStroke = 'rgba(156, 163, 175, 0.18)'; // 灰色网格缝隙
        } else if (levelId === 'level3_bank') {
            // 金库关卡：夜间战术装甲墙，深海夜蓝与高硬度钛钢底色，搭配皇家夜蓝高亮描边
            grad.addColorStop(0, '#1E293B'); // 深钛金灰
            grad.addColorStop(1, '#0F172A'); // 暗夜炭黑
            wallStroke = 'rgba(59, 130, 246, 0.85)'; // 皇家夜蓝高亮描边
            gridStroke = 'rgba(59, 130, 246, 0.2)'; // 深蓝拼接缝
        } else {
            // 地铁关卡：深褐色/暗棕色车站实墙，搭配浅褐/暖沙高光与细腻褐棕色网格
            grad.addColorStop(0, '#543F33'); // 饱满的战术褐
            grad.addColorStop(1, '#271B16'); // 哑光暗沙褐
            wallStroke = 'rgba(140, 110, 90, 0.85)'; // 浅棕/沙色高光描边
            gridStroke = 'rgba(140, 110, 90, 0.18)'; // 褐棕色网格缝隙
        }
        
        ctx.fillStyle = grad;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        // 墙面混凝土网格纹理
        ctx.strokeStyle = gridStroke;
        ctx.lineWidth = 1;
        const tileSize = 16;
        for (let x = obs.x; x < obs.x + obs.w; x += tileSize) {
            for (let y = obs.y; y < obs.y + obs.h; y += tileSize) {
                ctx.strokeRect(x, y, Math.min(tileSize, obs.x + obs.w - x), Math.min(tileSize, obs.y + obs.h - y));
            }
        }

        // 高光描边
        ctx.strokeStyle = wallStroke;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        // 银行关卡额外细节：在边角绘制防爆铆钉
        if (levelId === 'level3_bank' && obs.w >= 16 && obs.h >= 16) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
            const rSize = 2.5;
            ctx.fillRect(obs.x + 3, obs.y + 3, rSize, rSize);
            ctx.fillRect(obs.x + obs.w - 3 - rSize, obs.y + 3, rSize, rSize);
            ctx.fillRect(obs.x + 3, obs.y + obs.h - 3 - rSize, rSize, rSize);
            ctx.fillRect(obs.x + obs.w - 3 - rSize, obs.y + obs.h - 3 - rSize, rSize, rSize);
        }

    } else if (obs.type === 'glass') {
        const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
        if (levelId === 'level3_bank') {
            // 银行防弹安全玻璃：半透夜蓝色 + 透视金属竖条纹
            ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            ctx.strokeStyle = 'rgba(59, 130, 246, 0.14)';
            ctx.lineWidth = 1;
            for (let gx = obs.x + 10; gx < obs.x + obs.w; gx += 16) {
                ctx.beginPath();
                ctx.moveTo(gx, obs.y);
                ctx.lineTo(gx, obs.y + obs.h);
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            ctx.setLineDash([]);
        } else {
            // 玻璃墙：半透明底色 + 虚线框 + 四角加固件
            ctx.fillStyle = 'rgba(0, 204, 255, 0.1)';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            ctx.strokeStyle = 'rgba(0, 204, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            ctx.setLineDash([]);

            ctx.fillStyle = '#00CCFF';
            const cs = 4;
            ctx.fillRect(obs.x - 1, obs.y - 1, cs, cs);
            ctx.fillRect(obs.x + obs.w - cs + 1, obs.y - 1, cs, cs);
            ctx.fillRect(obs.x - 1, obs.y + obs.h - cs + 1, cs, cs);
            ctx.fillRect(obs.x + obs.w - cs + 1, obs.y + obs.h - cs + 1, cs, cs);
        }

    } else if (obs.type === 'low_wall') {
        const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(obs.x + 3, obs.y + 3, obs.w, obs.h);

        let counterGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
        if (levelId === 'level3_bank') {
            // 银行关卡：战术琥珀橙底色，明确标注橙色物理属性！（视线被遮挡、枪支被阻挡、手雷可抛越）
            counterGrad.addColorStop(0, '#D97706'); // 琥珀橙
            counterGrad.addColorStop(1, '#78350F'); // 深褐橙
            ctx.fillStyle = counterGrad;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            ctx.strokeStyle = '#F59E0B'; // 战术亮橙高光包边
            ctx.lineWidth = 1.8;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

            // 橙色战术斜线条纹
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
            ctx.lineWidth = 1;
            for (let sx = obs.x - obs.h; sx < obs.x + obs.w; sx += 8) {
                ctx.beginPath();
                ctx.moveTo(Math.max(obs.x, sx), obs.y);
                ctx.lineTo(Math.min(obs.x + obs.w, sx + obs.h), obs.y + obs.h);
                ctx.stroke();
            }
        } else {
            // 低墙：警戒黄线条纹
            ctx.fillStyle = 'rgba(255, 153, 0, 0.18)';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            ctx.strokeStyle = '#FF9900';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        }
    }

    if (obs.label) {
        ctx.font = 'bold 7.5px monospace';
        const txtW = ctx.measureText(obs.label).width;
        let labelX = obs.labelX !== undefined ? obs.labelX : (obs.x + 3);
        let labelY = obs.labelY !== undefined ? obs.labelY : (obs.y - 4);
        if (obs.labelY === undefined && obs.y < 95) {
            labelY = (obs.h > 20) ? obs.y + 12 : obs.y + obs.h + 8;
        }
        if (obs.tagXOffset) labelX += obs.tagXOffset;
        if (obs.tagYOffset) labelY += obs.tagYOffset;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(labelX - 2, labelY - 7, txtW + 4, 9);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(labelX - 2, labelY - 7, txtW + 4, 9);

        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(obs.label, labelX, labelY);
    }

    ctx.restore();
}

function drawSecurityGates() {
    securityGates.forEach(gate => {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(gate.x, gate.y, gate.w, gate.h)) {
            return;
        }
        ctx.save();

        // 1. 地面安检警示区域 (Floor indicator: subtle red glow zone)
        ctx.fillStyle = 'rgba(255, 51, 68, 0.05)';
        ctx.fillRect(gate.x, gate.y, gate.w, gate.h);

        // 2. 侧边机箱柱体 (Top and Bottom posts/pillars of the walkthrough detector frame)
        const pillarW = gate.w + 4;
        const pillarH = 7;
        const pX = gate.x + gate.w / 2 - pillarW / 2;

        // 顶部立柱 (Top Post)
        ctx.fillStyle = '#1e293b'; // 钢灰色
        ctx.fillRect(pX, gate.y, pillarW, pillarH);
        ctx.strokeStyle = '#ef4444'; // 红色警示包边
        ctx.lineWidth = 1.2;
        ctx.strokeRect(pX, gate.y, pillarW, pillarH);

        // 顶部小红/绿LED工作指示灯
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(pX + 3, gate.y + pillarH / 2, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(pX + pillarW - 3, gate.y + pillarH / 2, 1.2, 0, Math.PI * 2); ctx.fill();

        // 底部立柱 (Bottom Post)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(pX, gate.y + gate.h - pillarH, pillarW, pillarH);
        ctx.strokeRect(pX, gate.y + gate.h - pillarH, pillarW, pillarH);

        // 底部小红/绿LED工作指示灯
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(pX + 3, gate.y + gate.h - pillarH / 2, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(pX + pillarW - 3, gate.y + gate.h - pillarH / 2, 1.2, 0, Math.PI * 2); ctx.fill();

        // 3. 中央红外检测光束 (Infrared beam)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gate.x + gate.w / 2, gate.y + pillarH);
        ctx.lineTo(gate.x + gate.w / 2, gate.y + gate.h - pillarH);
        ctx.stroke();

        // 4. 安检门外框轮廓描边
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);

        // 5. 关卡文字标识 (CHECKPOINT / GATE)
        ctx.font = 'bold 7.5px monospace';
        const txtW = ctx.measureText(gate.label).width;
        let gateLabelX = gate.labelX !== undefined ? gate.labelX : (gate.x - 5);
        let gateLabelY = gate.labelY !== undefined ? gate.labelY : (gate.y - 4);
        if (gate.labelY === undefined && gate.y < 95) {
            gateLabelY = gate.y + gate.h + 8;
        }
        if (gate.tagXOffset) gateLabelX += gate.tagXOffset;
        if (gate.tagYOffset) gateLabelY += gate.tagYOffset;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(gateLabelX - 2, gateLabelY - 7, txtW + 4, 9);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(gateLabelX - 2, gateLabelY - 7, txtW + 4, 9);

        ctx.fillStyle = '#f87171';
        ctx.fillText(gate.label, gateLabelX, gateLabelY);

        ctx.restore();
    });
}

// 统一精细武器矢量绘制函数 (1步枪-AR15, 2手枪-GLOCK, 3狙击枪-R700, 4冲锋枪-SMG, 5手雷-M67)
function drawWeaponSilhouette(ctx, weaponId, x, y, w, h, color, isSelected) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = isSelected ? 1.8 : 1.4;

    const cx = x + w / 2;
    const cy = y + h / 2;
    const darkColor = (color === '#00FF66' || color.startsWith('#00FF')) ? '#020e06' : '#050c08';

    if (weaponId === 1) {
        // --- 1: RIFLE - 参考 AR-15 / M4A1 (图片2) ---
        // 枪管与枪口防焰器
        ctx.fillRect(cx - 22, cy - 2, 6, 3);
        ctx.fillRect(cx - 16, cy - 1.5, 5, 2);

        // 散热护木与皮轨
        ctx.fillRect(cx - 11, cy - 3, 11, 5);
        ctx.fillRect(cx - 11, cy - 4.5, 11, 1.5);

        // 散热孔
        ctx.fillStyle = darkColor;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(cx - 9 + i * 2, cy - 0.5, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = color;

        // 主机匣与抛壳窗
        ctx.fillRect(cx, cy - 4.5, 10, 7.5);
        ctx.fillStyle = darkColor;
        ctx.fillRect(cx + 1, cy - 3.5, 5, 1.5);
        ctx.fillStyle = color;

        // 扳机护圈
        ctx.fillRect(cx + 1, cy + 3, 5, 1.2);
        ctx.fillRect(cx + 5, cy + 3, 1.2, 3);
        ctx.fillRect(cx + 1, cy + 5.5, 5, 1);

        // 弯曲 STANAG 弹匣
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + 3);
        ctx.lineTo(cx - 8, cy + 12);
        ctx.lineTo(cx - 3, cy + 12);
        ctx.lineTo(cx + 1, cy + 3);
        ctx.closePath();
        ctx.fill();

        // 弹匣纵向肋条
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - 5.5, cy + 4.5); ctx.lineTo(cx - 8.5, cy + 10.5);
        ctx.moveTo(cx - 3.5, cy + 4.5); ctx.lineTo(cx - 6.5, cy + 10.5);
        ctx.moveTo(cx - 1.5, cy + 4.5); ctx.lineTo(cx - 4.5, cy + 10.5);
        ctx.stroke();
        ctx.strokeStyle = color;

        // 人体工程学握把
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy + 3);
        ctx.lineTo(cx + 10, cy + 11);
        ctx.lineTo(cx + 14, cy + 10);
        ctx.lineTo(cx + 10, cy + 3);
        ctx.closePath();
        ctx.fill();

        // 战术伸缩枪托
        ctx.fillRect(cx + 10, cy - 2, 5, 2.5);
        ctx.beginPath();
        ctx.moveTo(cx + 13, cy - 4);
        ctx.lineTo(cx + 21, cy - 4);
        ctx.lineTo(cx + 21, cy + 6);
        ctx.lineTo(cx + 17, cy + 6);
        ctx.lineTo(cx + 15, cy + 2);
        ctx.lineTo(cx + 13, cy + 2);
        ctx.closePath();
        ctx.fill();

        // 枪托底板散热孔
        ctx.fillStyle = darkColor;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 2; c++) {
                ctx.beginPath();
                ctx.arc(cx + 18.5 + c * 1.5, cy + 1.5 + r * 1.5, 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

    } else if (weaponId === 2) {
        // --- 2: PISTOL - 参考 GLOCK 17 (图片1) ---
        // 套筒
        ctx.fillRect(cx - 14, cy - 7, 24, 6.5);

        // 前后准星
        ctx.fillRect(cx - 12, cy - 8.5, 1.5, 1.8);
        ctx.fillRect(cx + 8, cy - 8.5, 1.5, 1.8);

        // 套筒抛壳窗与凹槽线
        ctx.fillStyle = darkColor;
        ctx.fillRect(cx - 3, cy - 6, 9, 2);
        ctx.fillRect(cx - 13, cy - 2.5, 22, 0.9);
        ctx.fillStyle = color;

        // 枪管前端
        ctx.fillRect(cx - 15, cy - 5, 1.5, 3);

        // 套筒座与扳机护圈
        ctx.fillRect(cx - 14, cy - 0.5, 12, 2.5);

        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - 0.5);
        ctx.lineTo(cx - 3, cy + 4.5);
        ctx.lineTo(cx + 3, cy + 4.5);
        ctx.lineTo(cx + 3, cy - 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = darkColor;
        ctx.fillRect(cx - 1.8, cy + 0.8, 3.6, 2.7);
        ctx.fillStyle = color;

        // 扳机
        ctx.beginPath();
        ctx.moveTo(cx - 0.5, cy + 0.8);
        ctx.quadraticCurveTo(cx + 1, cy + 2, cx - 0.5, cy + 3.2);
        ctx.lineTo(cx + 0.5, cy + 3.2);
        ctx.fill();

        // 聚合物握把 (含海狸尾弧线)
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy - 0.5);
        ctx.lineTo(cx + 3, cy + 11);
        ctx.lineTo(cx + 10, cy + 11);
        ctx.lineTo(cx + 9, cy + 1);
        ctx.quadraticCurveTo(cx + 11, cy - 2, cx + 8, cy - 0.5);
        ctx.closePath();
        ctx.fill();

    } else if (weaponId === 3) {
        // --- 3: SMG - 参考 Micro Uzi / MP9 (图片3右侧) ---
        // 枪管与枪口
        ctx.fillRect(cx - 13, cy - 5, 4, 2);

        // 紧凑型机匣与抛壳窗
        ctx.fillRect(cx - 9, cy - 7, 18, 6);
        ctx.fillStyle = darkColor;
        ctx.fillRect(cx - 3, cy - 6, 7, 1.8);
        ctx.fillStyle = color;

        // 顶置折叠托
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy - 7);
        ctx.lineTo(cx + 12, cy - 11);
        ctx.lineTo(cx + 11, cy - 12);
        ctx.lineTo(cx + 5, cy - 8);
        ctx.closePath();
        ctx.fill();

        // 垂直手柄
        ctx.fillRect(cx - 2, cy - 1, 6, 8);

        // 超长直型弹匣
        ctx.fillRect(cx - 1, cy + 7, 4, 11);
        ctx.fillRect(cx - 1.5, cy + 17, 5, 1.5);

        // 扳机护圈
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 1);
        ctx.lineTo(cx - 7, cy + 4);
        ctx.lineTo(cx - 2, cy + 4);
        ctx.lineTo(cx - 2, cy - 1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = darkColor;
        ctx.fillRect(cx - 5.8, cy + 0.2, 3.6, 2.8);
        ctx.fillStyle = color;
        ctx.fillRect(cx - 4, cy + 0.5, 1, 2);

    } else if (weaponId === 4) {
        // --- 4: SNIPER - 枪口朝左 ---
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(-1, 1);
        ctx.translate(-cx, -cy);

        // 消音器与重型枪管
        ctx.fillRect(cx - 5, cy - 1, 18, 2);
        ctx.fillRect(cx + 11, cy - 2.5, 13, 5);

        // 双目战术高倍瞄准镜
        ctx.fillRect(cx - 7, cy - 4.5, 2, 2);
        ctx.fillRect(cx + 1, cy - 4.5, 2, 2);
        ctx.fillRect(cx - 10, cy - 7, 16, 2.5);

        // 前物镜大喇叭
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 7);
        ctx.lineTo(cx + 9, cy - 8.5);
        ctx.lineTo(cx + 9, cy - 3);
        ctx.lineTo(cx + 4, cy - 4.5);
        ctx.closePath();
        ctx.fill();

        // 后目镜
        ctx.fillRect(cx - 12, cy - 8, 3, 4.5);
        // 调节塔
        ctx.fillRect(cx - 2, cy - 8.5, 2.5, 2);

        // 机匣与拉机柄
        ctx.fillRect(cx - 12, cy - 2.5, 14, 5);
        ctx.fillRect(cx - 9, cy - 4, 1.5, 2);
        ctx.beginPath();
        ctx.arc(cx - 10, cy - 4, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // 拆卸式盒状弹匣
        ctx.fillRect(cx - 3, cy + 2.5, 6, 6);

        // 扳机护圈与握把
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 2.5);
        ctx.lineTo(cx - 11, cy + 9.5);
        ctx.lineTo(cx - 7, cy + 9.5);
        ctx.lineTo(cx - 5, cy + 2.5);
        ctx.closePath();
        ctx.fill();

        // 战术枪托与贴腮板
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 1);
        ctx.lineTo(cx - 22, cy - 1);
        ctx.lineTo(cx - 22, cy + 7);
        ctx.lineTo(cx - 19, cy + 7);
        ctx.lineTo(cx - 18, cy + 3);
        ctx.lineTo(cx - 12, cy + 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(cx - 20, cy - 4, 7, 2.5);
        ctx.fillStyle = darkColor;
        ctx.fillRect(cx - 21.5, cy + 0.5, 1.5, 5);
        ctx.fillStyle = color;

        ctx.restore();

    } else if (weaponId === 5) {
        // --- 5: GRENADE - 参考 M67 手雷 (图片4) ---
        // 圆形破片弹体
        ctx.beginPath();
        ctx.arc(cx + 1, cy + 3, 8.5, 0, Math.PI * 2);
        ctx.fill();

        // 右上方高光弧线
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx + 1, cy + 3, 6.8, -Math.PI * 0.35, -Math.PI * 0.05);
        ctx.stroke();

        // 顶部引信与旋钮
        ctx.fillStyle = color;
        ctx.fillRect(cx - 2.5, cy - 6, 5, 3);
        ctx.fillRect(cx - 4.5, cy - 11, 8.5, 5);

        ctx.beginPath();
        ctx.arc(cx + 5, cy - 10, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 左侧曲面保险压片
        ctx.beginPath();
        ctx.moveTo(cx - 4.5, cy - 10.5);
        ctx.lineTo(cx - 9, cy - 5);
        ctx.lineTo(cx - 9.5, cy + 3);
        ctx.lineTo(cx - 8.5, cy + 8);
        ctx.lineTo(cx - 7, cy + 8);
        ctx.lineTo(cx - 8, cy + 3);
        ctx.lineTo(cx - 7.5, cy - 4.5);
        ctx.lineTo(cx - 3.5, cy - 9);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawWeaponIcons() {
    const boxSize = 46;
    const gap = 12;
    const startX = 25;
    const startY = height - 62;

    let index = 0;
    for (let key in WEAPONS) {
        let w = WEAPONS[key];
        let x = startX + index * (boxSize + gap);
        let y = startY;
        let isUnlocked = unlockedWeapons.includes(w.id);
        let isSelected = (w.id === currentWeapon.id);

        ctx.save();
        if (!isUnlocked) {
            ctx.fillStyle = 'rgba(12, 18, 15, 0.65)';
            ctx.strokeStyle = 'rgba(80, 100, 90, 0.3)';
            ctx.lineWidth = 1;
            ctx.fillRect(x, y, boxSize, boxSize);
            ctx.strokeRect(x, y, boxSize, boxSize);

            // 未解锁暗色枪械图形
            drawWeaponSilhouette(ctx, w.id, x, y, boxSize, boxSize, 'rgba(80, 100, 90, 0.35)', false);

            ctx.fillStyle = 'rgba(80, 100, 90, 0.5)';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`[${w.id}]`, x + 4, y + 12);

        } else {
            ctx.fillStyle = isSelected ? 'rgba(0, 255, 102, 0.28)' : 'rgba(4, 16, 10, 0.88)';
            ctx.strokeStyle = isSelected ? '#FFFF00' : 'rgba(0, 255, 102, 0.45)';
            ctx.lineWidth = isSelected ? 2 : 1.2;
            ctx.fillRect(x, y, boxSize, boxSize);
            ctx.strokeRect(x, y, boxSize, boxSize);

            const iconColor = isSelected ? '#FFFF00' : '#00FF66';

            // 已解锁精细枪械图形
            drawWeaponSilhouette(ctx, w.id, x, y, boxSize, boxSize, iconColor, isSelected);

            ctx.fillStyle = iconColor;
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`[${w.id}]`, x + 4, y + 12);
        }

        ctx.restore();
        index++;
    }
}

function drawCamera(cam) {
    ctx.save();
    ctx.translate(cam.x, cam.y);
    
    // 1. 监控扇区视觉：显著加强的半透明锥形光，保留高对比度原色且十分凸显 (Highly visible scan cone)
    ctx.fillStyle = cam.detecting ? 'rgba(255, 51, 51, 0.32)' : 'rgba(0, 255, 102, 0.16)';
    ctx.beginPath(); 
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 320, cam.currentAngle - 0.45, cam.currentAngle + 0.45);
    ctx.closePath(); 
    ctx.fill();

    // 绘制清晰的扇区边缘线与轮廓弧线，使视野边界分外凸显
    ctx.strokeStyle = cam.detecting ? 'rgba(255, 51, 51, 0.75)' : 'rgba(0, 255, 102, 0.45)';
    ctx.lineWidth = 1.5;
    
    // 左边界
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(cam.currentAngle - 0.45) * 320, Math.sin(cam.currentAngle - 0.45) * 320);
    ctx.stroke();
    
    // 右边界
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(cam.currentAngle + 0.45) * 320, Math.sin(cam.currentAngle + 0.45) * 320);
    ctx.stroke();
    
    // 最外圈扇区弧线
    ctx.beginPath();
    ctx.arc(0, 0, 320, cam.currentAngle - 0.45, cam.currentAngle + 0.45);
    ctx.stroke();

    // 扫描扇区中间的同心雷达辅助线
    ctx.strokeStyle = cam.detecting ? 'rgba(255, 51, 51, 0.45)' : 'rgba(0, 255, 102, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 160, cam.currentAngle - 0.45, cam.currentAngle + 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 260, cam.currentAngle - 0.45, cam.currentAngle + 0.45);
    ctx.stroke();

    // 2. 墙体壁挂支架结构 (Camera Mounting Bracket - opposite to camera angle for realism)
    const oppositeAngle = cam.currentAngle + Math.PI;
    ctx.save();
    ctx.rotate(oppositeAngle);
    // 支架底座
    ctx.fillStyle = '#2A312D';
    ctx.strokeStyle = '#0B110E';
    ctx.lineWidth = 1.5;
    ctx.fillRect(16, -7, 5, 14);
    ctx.strokeRect(16, -7, 5, 14);
    // 伸缩双关节悬臂
    ctx.fillStyle = '#3E4742';
    ctx.fillRect(0, -3, 17, 6);
    ctx.strokeRect(0, -3, 17, 6);
    ctx.restore();

    // 3. 监控器本体（3D视角俯瞰质感）
    ctx.rotate(cam.currentAngle);
    
    // 3.1 球形旋转阻尼云台 (Swivel Joint Base)
    ctx.fillStyle = '#48524C';
    ctx.strokeStyle = '#0F1612';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3.2 枪机型枪式监控机身与遮阳雨罩 (Main Bullet Camera Housing & Sun Shield)
    // 底部暗色散热格栅阴影
    ctx.fillStyle = '#080E0A';
    ctx.fillRect(-6, -7, 24, 14);

    // 主机身外壳（哑光战术银灰/白）
    ctx.fillStyle = '#E3EAE5';
    ctx.strokeStyle = cam.detecting ? '#FF3344' : '#57615B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-4, -6, 21, 12, [2, 4, 4, 2]);
    ctx.fill();
    ctx.stroke();

    // 机顶一体化遮阳防护板 (Sun Shield Overlay)
    ctx.fillStyle = '#1D2420';
    ctx.fillRect(-7, -7, 25, 2.5);

    // 3.3 镜头组与红外传感器
    // 暗色光学玻璃面罩
    ctx.fillStyle = '#060B08';
    ctx.fillRect(15, -4, 3, 8);

    // 镜片中心蓝色镀膜反光 (Glossy Camera Lens Optics)
    ctx.fillStyle = '#00CCFF';
    ctx.shadowColor = '#00CCFF';
    ctx.shadowBlur = cam.detecting ? 4 : 1;
    ctx.beginPath();
    ctx.arc(16.5, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3.4 动态状态指示灯 (Pulsing Rec LED)
    // 根据系统毫秒进行红/绿闪烁，增强实机工作感
    const isLedOn = Date.now() % 900 < 450;
    if (cam.detecting) {
        ctx.fillStyle = isLedOn ? '#FF1133' : '#770011';
    } else {
        ctx.fillStyle = isLedOn ? '#00FF66' : '#004411';
    }
    ctx.beginPath();
    ctx.arc(4, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawDropItems() {
    dropItems.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.shadowBlur = 12;

        if (item.type === 'medkit') {
            ctx.fillStyle = '#00FF66'; ctx.shadowColor = '#00FF66';
            ctx.fillRect(-9, -9, 18, 18);
            ctx.fillStyle = '#000'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4);
        } else if (item.type === 'battery') {
            ctx.fillStyle = '#00CCFF'; ctx.shadowColor = '#00CCFF';
            ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.fillRect(-4, -4, 8, 8);
        } else if (item.type === 'weapon') {
            const wp = item.weaponData || WEAPONS.RIFLE;
            ctx.fillStyle = 'rgba(10, 20, 15, 0.9)';
            ctx.shadowColor = '#FFFF00';
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 1.5;

            // 掉落框
            ctx.fillRect(-22, -15, 44, 30);
            ctx.strokeRect(-22, -15, 44, 30);

            // 武器矢量图案
            drawWeaponSilhouette(ctx, wp.id, -22, -15, 44, 30, '#FFFF00', true);
        } else if (item.type === 'classified_drive' || item.type === 'gold_vault_crown') {
            // High-Tech Cyber Classified Drive
            ctx.fillStyle = '#0f172a';
            ctx.shadowColor = '#00CCFF';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1.5;

            // Sleek metallic drive casing
            ctx.fillRect(-14, -10, 28, 20);
            ctx.strokeRect(-14, -10, 28, 20);

            // Diagonal inner chip bed
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-10, -7, 20, 14);

            // Holographic data core dot
            ctx.fillStyle = '#00FF66';
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Cyber trace lines
            ctx.strokeStyle = '#00CCFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-8, 0); ctx.lineTo(-3.5, 0);
            ctx.moveTo(3.5, 0); ctx.lineTo(8, 0);
            ctx.moveTo(0, -5); ctx.lineTo(0, -3.5);
            ctx.moveTo(0, 3.5); ctx.lineTo(0, 5);
            ctx.stroke();

            // Status LEDs
            ctx.fillStyle = '#10b981';
            ctx.fillRect(-12, -7, 2, 2);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-12, -4, 2, 2);

            ctx.fillStyle = '#00CCFF';
            ctx.font = 'bold 8px monospace';
            ctx.fillText("CLASSIFIED DRIVE", -28, 18);
        }
        ctx.restore();
    });
}

function drawAgent(x, y, angle, isPlayer, walkCycle, hitFlash, hp, maxHp, pendingDamage, alpha = 1.0, isObserver = false, enemyShield = 0, maxShield = 80, alert = false, flashTimer = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    const isInBlind = !isPlayer && inBlindZone(x, y);

    // ------------------- 1. 头顶血条与护盾 -------------------
    if ((hp < maxHp || !isPlayer) && hp > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(-20, -36, 40, 5);
        ctx.fillStyle = isPlayer ? '#00FF66' : (isInBlind ? '#FFFF00' : '#FF3344');
        ctx.fillRect(-20, -36, (Math.max(0, hp) / maxHp) * 40, 5);
        
        if (enemyShield > 0) {
            ctx.fillStyle = '#00CCFF';
            ctx.fillRect(-20, -42, (enemyShield / maxShield) * 40, 4);
        }
    }

    ctx.rotate(angle);
    
    // 决定色彩与动态战术主题配色组 (Dynamic Tactical Color Palettes based on Faction)
    let mainColor = '#FF3344';
    
    // 我们将所有角色的基础衣着、防弹衣和重型装备调整为专业的、无绿色/红色偏差的深灰色/暗碳色，
    // 并适当调浅（从接近纯黑到极具质感的碳灰、钢灰），以便看清其细节。
    const baseTacticalColor = '#2F3336'; // 战术衣物基底：深碳灰色 (Dark Charcoal Gray)
    const vestColor = '#3A4146';          // 战术防弹衣：碳灰色 (Carbon Gray)
    const plateColor = '#464E54';         // 防弹重型插板：深钢灰色 (Steel Gray)
    const gearColor = '#535B62';          // 头盔、背背包、弹匣包、耳机等挂载装备：中深灰色 (Slate Gray)
    const gearColor2 = '#202326';         // 枪支机匣、枪托、战术靴底、墨镜镜框：哑光石墨灰 (Matte Graphite Gray)
    
    if (isPlayer) {
        mainColor = '#00FF66';
    } else if (isInBlind) {
        mainColor = '#FFFF00';
    } else if (isObserver) {
        mainColor = alert ? '#FF3344' : '#00CCFF';
    } else if (hitFlash) {
        mainColor = '#FFFFFF';
    }

    // ------------------- 2. 四肢：精细军用战术靴 & 步态动画 -------------------
    const legOffset = Math.sin(walkCycle) * 5.5;
    
    // 战术靴底部边缘（双层橡胶鞋底质感 - 调浅细节）
    ctx.fillStyle = gearColor2;
    ctx.beginPath(); ctx.roundRect(-9, -11.5 + legOffset, 8, 6, 2.5); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-9, 5.5 - legOffset, 8, 6, 2.5); ctx.fill();
    
    // 战术靴绑带与正面皮革 (调浅细节)
    ctx.fillStyle = gearColor;
    ctx.beginPath(); ctx.roundRect(-8, -10.5 + legOffset, 6.5, 4, 1.5); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-8, 6.5 - legOffset, 6.5, 4, 1.5); ctx.fill();

    // ------------------- 3. 躯干：重型战术防弹衣 & MOLLE挂载系统 -------------------
    // 3.1 战术防弹护甲基底 (Plate Carrier Base)
    ctx.fillStyle = baseTacticalColor; 
    ctx.strokeStyle = mainColor; 
    ctx.lineWidth = isInBlind ? 2.8 : 1.8;
    ctx.beginPath(); 
    ctx.roundRect(-10, -10, 18, 20, 4.5); 
    ctx.fill(); 
    ctx.stroke();

    // 3.2 背部战术电台、背包装备包与天线 (Tactical Radio Back Unit & Antenna - 调浅细节)
    ctx.fillStyle = gearColor;
    ctx.fillRect(-13, -5, 4, 10);
    ctx.strokeStyle = gearColor2;
    ctx.lineWidth = 1;
    ctx.strokeRect(-13, -5, 4, 10);
    
    // 战术防折电台鞭状天线 (Flexible Whip Antenna)
    ctx.strokeStyle = gearColor2;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, -3);
    ctx.quadraticCurveTo(-18, -4, -14, -12); // 微弯的天线形态
    ctx.stroke();

    // 3.3 胸前战术重插板 (Ballistic Insert Plates - 调浅细节)
    ctx.fillStyle = plateColor;
    ctx.beginPath(); ctx.roundRect(-7, -7.5, 12, 15, 2.5); ctx.fill();

    // 3.4 战术防弹衣 MOLLE 织带 (MOLLE Webbing Straps)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i += 3.5) {
        ctx.beginPath();
        ctx.moveTo(-6, i);
        ctx.lineTo(4, i);
        ctx.stroke();
    }

    // 3.5 战术弹匣快拔套与投掷物挂包 (Magazine Pouches & Grenades - 调浅细节)
    ctx.fillStyle = gearColor;
    // 前方挂载两个弹匣包
    ctx.fillRect(-1.5, -8.5, 4, 2);
    ctx.fillRect(3.5, -8.5, 4, 2);
    // 后方挂载两个杂物包
    ctx.fillRect(-1.5, 6.5, 4, 2);
    ctx.fillRect(3.5, 6.5, 4, 2);

    // 3.6 战术肩章
    ctx.fillStyle = mainColor;
    ctx.fillRect(-4, -9.2, 4, 1.5);
    ctx.fillRect(-4, 7.7, 4, 1.5);

    // ------------------- 4. 技能与状态光环 -------------------
    if (isInBlind && hp > 0) {
        ctx.strokeStyle = '#FFFF00'; ctx.lineWidth = 2; ctx.shadowColor = '#FFFF00'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    if (isObserver && enemyShield > 0) {
        ctx.strokeStyle = '#00CCFF'; ctx.lineWidth = 2; ctx.shadowColor = '#00CCFF'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    if (isPlayer && player.shield > 0) {
        ctx.strokeStyle = '#00CCFF';
        ctx.shadowColor = '#00CCFF';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ------------------- 5. 特种部队精密枪械 (Custom Assault Rifle Details) -------------------
    ctx.save();
    ctx.translate(4, 3); // 枪械基底偏移

    // 5.1 战术伸缩枪托 (Collapsible Stock - 调浅细节)
    ctx.fillStyle = gearColor2;
    ctx.fillRect(-4, -1.5, 4, 3);
    // 枪托托腮板细节 (调浅细节)
    ctx.fillStyle = gearColor;
    ctx.fillRect(-3, -2, 2.5, 1);

    // 5.2 精密枪身与机匣 (Upper Receiver & Handguard - 调浅细节)
    ctx.fillStyle = gearColor2;
    ctx.fillRect(0, -2, 17, 4);

    // 5.3 弯曲战术弹匣 (Tactical Curved Magazine)
    // 弹匣朝前方微弯突显真枪感觉 (调浅细节)
    ctx.fillStyle = gearColor;
    ctx.beginPath();
    ctx.moveTo(7, 1);
    ctx.quadraticCurveTo(8, 5, 10, 8);
    ctx.lineTo(8, 8.5);
    ctx.quadraticCurveTo(6, 5, 5, 1);
    ctx.closePath();
    ctx.fill();

    // 5.4 顶部全息/红点战术瞄具 (EoTech Holographic Sight - 调浅细节)
    ctx.fillStyle = gearColor2;
    ctx.fillRect(2, -3.2, 7, 1.5);
    ctx.fillStyle = mainColor; // 全息瞄具激光分划点
    ctx.fillRect(4.5, -3.6, 2, 1);

    // 5.5 侧挂激光瞄准器 (PEQ-15 Laser Designator - 调浅细节)
    ctx.fillStyle = gearColor;
    ctx.fillRect(6, 1.8, 4.5, 1.5);

    // 5.6 战术快拆消音器 (QD Suppressor - 调浅细节)
    ctx.fillStyle = gearColor2;
    ctx.fillRect(17, -2.5, 6, 5);

    // 5.7 枪口极微弱消焰指示
    ctx.fillStyle = mainColor;
    ctx.fillRect(22.5, -0.8, 1.5, 1.6);

    ctx.restore();

    // ------------------- 6. 战术双手 & 护甲手套 (Oakley Combat Gloves - 调浅细节) -------------------
    ctx.fillStyle = gearColor;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;

    // 左手 (抓握前部导轨护木)
    ctx.beginPath(); ctx.arc(14, -2, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 右手 (握持后握把与扳机)
    ctx.beginPath(); ctx.arc(5, 5, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 开火枪口焰 (枪口火光一律橙色)
    const showFlash = isPlayer ? (player.flashTimer > 0) : (flashTimer > 0);
    if (showFlash) {
        ctx.fillStyle = '#FF9900'; ctx.shadowColor = '#FF6600'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(28, 3, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }

    // ------------------- 7. 战术头盔、拾音降噪耳机 & GPNVG-18 四目夜视仪 -------------------
    // 7.1 特种兵降噪降温拾音耳机 (Peltor Tactical Earmuffs - 调浅细节)
    // 头部两侧的椭圆耳机结构
    ctx.fillStyle = gearColor;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-1.5, -9.5, 3.5, 2.5, 1); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-1.5, 7.0, 3.5, 2.5, 1); ctx.fill(); ctx.stroke();

    // 7.2 模块化 FAST 战术头盔 (FAST Base Jump Helmet - 调浅细节)
    ctx.fillStyle = gearColor; 
    ctx.beginPath(); ctx.arc(-0.5, 0, 8.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mainColor; ctx.lineWidth = 1.6; ctx.stroke();

    // 头盔两侧战术导轨 (ARC Helmet Rails - 调浅细节)
    ctx.fillStyle = gearColor2;
    ctx.fillRect(-3, -8.2, 4.5, 1.2);
    ctx.fillRect(-3, 7.0, 4.5, 1.2);

    // 7.3 防弹护目镜/墨镜 (Oakley Tactical Goggles - 调浅细节)
    ctx.fillStyle = gearColor2;
    ctx.fillRect(3.2, -5.2, 2.2, 10.4);

    // 7.4 标志性的 GPNVG-18 四目全景夜视仪 (Panoramic Quad-Eye Night Vision Goggles)
    // 连接额头墨镜的固定墨镜架 (调浅细节)
    ctx.fillStyle = gearColor;
    ctx.fillRect(4.5, -1.5, 1.8, 3);

    // 扇形展开的四组镜筒结构 (调浅细节)
    ctx.fillStyle = gearColor;
    // 1号、2号镜筒 (左侧外展与内直)
    ctx.fillRect(5.5, -5.0, 4, 2.2);
    ctx.fillRect(5.8, -2.4, 4, 2.2);
    // 3号、4号镜筒 (右侧内直与外展)
    ctx.fillRect(5.8, 0.2, 4, 2.2);
    ctx.fillRect(5.5, 2.8, 4, 2.2);

    // 7.5 四个镀膜镜头发光镜片 (4 GPNVG Glowing Lenses)
    // 经典的 Tier-1 幽灵绿/天蓝荧光镜片，增强画面特种作战科技感
    ctx.fillStyle = mainColor;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(9.7, -3.9, 1.2, 0, Math.PI * 2); // 1
    ctx.arc(10.0, -1.3, 1.2, 0, Math.PI * 2); // 2
    ctx.arc(10.0, 1.3, 1.2, 0, Math.PI * 2);  // 3
    ctx.arc(9.7, 3.9, 1.2, 0, Math.PI * 2);  // 4
    ctx.fill();
    ctx.shadowBlur = 0; // 恢复 shadowBlur

    ctx.restore();

    // ------------------- 8. 文字标识 (不随视角旋转) -------------------
    if (isInBlind && hp > 0) {
        ctx.fillStyle = '#FFFF00'; ctx.font = 'bold 10px monospace';
        ctx.fillText("[IN BLIND ZONE]", x - 35, y - 46);
    } else if (!isPlayer && isObserver && hp > 0) {
        ctx.fillStyle = alert ? '#FF3344' : '#00CCFF'; ctx.font = 'bold 9px monospace';
        ctx.fillText("[OBSERVER]", x - 26, y - 46);
    }

    if (!isPlayer && pendingDamage > 0 && hp > 0) {
        ctx.fillStyle = '#00FF66'; ctx.font = 'bold 10px monospace';
        ctx.fillText(`[DEBT: ${pendingDamage}]`, x - 26, y - (isInBlind ? 58 : 46));
    }
}

function draw() {
    if (!ensureCanvas()) return;
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    
    ctx.clearRect(0, 0, width, height);
    
    if (levelId === 'level1_airport') {
        // 1. 机场关卡：现代大理石感灰色瓷砖地板（底色显著加深为精致的高端深钢灰色，使角色和各种战术指示界线格外清晰凸显）
        ctx.fillStyle = '#4B5358'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.48)'; // 高对比度的深色瓷砖缝隙，使网格格外出众
        ctx.lineWidth = 1.3;
        for(let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    } else if (levelId === 'level4_test') {
        // 4. 测试关卡：赛博暗紫暗黑霓虹风格 (音效测试专区，呈现独特紫光网格)
        ctx.fillStyle = '#1B1328'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)'; // 炫酷亮粉色瓷砖缝隙
        ctx.lineWidth = 1.2;
        for(let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    } else if (levelId === 'level3_bank') {
        // 3. 银行与金库关卡：夜间行动模式，深海极夜蓝底色与暗蓝战术瓷砖格纹
        ctx.fillStyle = '#0B132B'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)'; // 柔和暗蓝网格缝
        ctx.lineWidth = 1.0;
        for(let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    } else {
        // 2. 地铁关卡：浅沙褐色车站防滑地板（主色调调浅，保持极高透光度与高对比度）
        ctx.fillStyle = '#A88E7D'; // 比原本的深棕褐色明显调浅的暖沙褐
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(78, 59, 47, 0.28)'; // 褐咖啡色网格瓷砖缝
        ctx.lineWidth = 1.2;
        for(let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    }
    
    drawZones();
    drawProps();
    drawTraps();
    obstacles.forEach(drawObstacle);
    drawSecurityGates();

    if (levelId === 'level3_bank') {
        drawNightShadowMask();
    }

    if (blindActive && blindZone) {
        ctx.save();
        ctx.fillStyle = 'rgba(4, 14, 9, 0.92)';
        ctx.beginPath(); ctx.arc(blindZone.x, blindZone.y, blindZone.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00FF66'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    }

    if (player.hp > 0) {
        // 主角视野范围：先绘制盲区，再在盲区之上绘制主角视锥，确保盲区内主角自己的视角清晰可见
        drawTacticalFOV(player.x, player.y, player.angle, player.fov, player.viewDistance, 'rgba(0, 255, 102, 0.28)', 'rgba(0, 255, 102, 0.85)');
    }

    enemies.forEach(e => {
    if (e.hp <= 0 && e.deathAlpha <= 0) return;

    // 1. 玩家视角与射线遮挡计算
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    let angleDiff = Math.atan2(dy, dx) - player.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    // 2. 判断敌人是否在玩家视角扇形内且无障碍物遮挡
    const inSight = dist <= player.viewDistance && Math.abs(angleDiff) <= player.fov / 2 && canSee(player.x, player.y, e.x, e.y);

    // 3. 判断敌人是否处于警戒或开火状态（发现玩家/向玩家射击）
    const isAttackingOrAlert = e.alert || e.state === 'attack' || e.state === 'shoot' || e.shootTimer > 0;

    // 条件：只有在【玩家视野内】或者【敌人主动警戒/攻击】时，才渲染该敌人
    if (inSight || isAttackingOrAlert) {
        if (e.hp > 0) {
            const playerInBlind = inBlindZone(player.x, player.y);
            let fovAngle = Math.PI / 3;
            let fovRange = 260;
            if (e.isObserver && playerInBlind) {
                fovAngle = Math.PI / 6; // restricted to 30 degrees (Math.PI / 6)
                fovRange = 110; // restricted range
            }
            // 敌人视野范围：保留红/黄/蓝原色，在深色地面上大幅提升填充不透明度，并辅以高亮边界线
            let fovFill = e.alert ? 'rgba(255, 51, 51, 0.26)' : (e.isObserver ? 'rgba(0, 204, 255, 0.22)' : 'rgba(255, 185, 0, 0.16)');
            let fovStroke = e.alert ? 'rgba(255, 51, 51, 0.8)' : (e.isObserver ? 'rgba(0, 204, 255, 0.75)' : 'rgba(255, 185, 0, 0.65)');
            drawTacticalFOV(e.x, e.y, e.angle, fovAngle, fovRange, fovFill, fovStroke);
        }
        drawAgent(e.x, e.y, e.angle, false, e.walkCycle, e.hitTimer > 0, e.hp, e.maxHp, e.pendingDamage, e.deathAlpha, e.isObserver, e.shield, e.maxShield, e.alert, e.flashTimer || 0);
    }
});

    cameras.forEach(cam => {
        if (levelId === 'level3_bank') {
            if (typeof isObjectRevealed === 'function' && !isObjectRevealed(cam.x, cam.y, 1, 1)) {
                return;
            }
        }
        drawCamera(cam);
    });
    if (levelId === 'level3_bank' && typeof drawLasers === 'function') {
        drawLasers();
    }
    drawDropItems();
    
    if (player.hp > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        ctx.strokeStyle = '#00FF66'; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
        drawAgent(player.x, player.y, player.angle, true, player.walkCycle, false, player.hp, player.maxHp, 0, 1.0);
    }
    
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.maxLife ? p.life / p.maxLife : 1));
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    grenades.forEach(g => {
        ctx.save();
        ctx.fillStyle = '#FF9900'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    ctx.fillStyle = '#FF9900'; ctx.shadowColor = '#FF6600'; ctx.shadowBlur = 10;
    playerBullets.forEach(b => { 
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius || 3.5, 0, Math.PI*2); ctx.fill(); 
    });
    
    enemyBullets.forEach(eb => { ctx.beginPath(); ctx.arc(eb.x, eb.y, 3.5, 0, Math.PI*2); ctx.fill(); });
    
    ctx.shadowBlur = 0;

    drawWeaponIcons();

    if (levelId === 'level3_bank') {
        ctx.save();
        const progress = scannableBankCellsCount > 0 
            ? Math.min(100, Math.floor((revealedBankCellsCount / scannableBankCellsCount) * 100)) 
            : 100;
        
        const x = width / 2;
        const y = 35;
        
        ctx.textAlign = 'center';
        ctx.font = '10px monospace';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText("TACTICAL MAP DECODING // 战术平面图载入进度", x, y);
        
        const barW = 160;
        const barH = 5;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(x - barW / 2, y + 6, barW, barH);
        
        ctx.fillStyle = allBankCellsRevealed ? '#00FF66' : '#FF9900';
        ctx.fillRect(x - barW / 2, y + 6, barW * (progress / 100), barH);
        
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = allBankCellsRevealed ? '#00FF66' : '#FF9900';
        ctx.fillText(`${progress}% SYNCED`, x, y + 24);
        ctx.restore();
    }
}

function gameLoop() {
    if (ensureCanvas()) {
        update(); draw();
    }
    requestAnimationFrame(gameLoop);
}

// 挂载全局方法到 window
window.resetGame = resetGame;
window.initMapLayout = initMapLayout;
window.switchWeapon = switchWeapon;
window.togglePause = togglePause;
window.resizeCanvas = resizeCanvas;
window.WEAPONS = WEAPONS;

// 初始化运行
ensureCanvas();
resizeCanvas();
spawnWave();
gameLoop();
