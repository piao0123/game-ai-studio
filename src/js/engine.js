if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        if (typeof radii === 'number') radii = [radii];
        if (!Array.isArray(radii)) radii = [0];
        const r = Math.min(Math.abs(w) / 2, Math.abs(h) / 2, radii[0] || 0);
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

let canvas = document.getElementById('canvas');
let ctx = canvas ? canvas.getContext('2d') : null;
let listenersAttached = false;

function ensureCanvas() {
    if (!canvas) {
        canvas = document.getElementById('canvas');
        if (canvas) {
            ctx = canvas.getContext('2d');
            width = window.innerWidth || 1280;
            height = window.innerHeight || 720;
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
    if (canvas) {
        const targetW = window.innerWidth || 1280;
        const targetH = window.innerHeight || 720;
        if (targetW > 0 && targetH > 0 && (canvas.width !== targetW || canvas.height !== targetH)) {
            width = targetW;
            height = targetH;
            canvas.width = targetW;
            canvas.height = targetH;
            initMapLayout();
        }
    }
    return canvas && ctx;
}

var width = window.innerWidth;
var height = window.innerHeight;
window.width = width;
window.height = height;

function getCurrentLevelId() {
    if (typeof levelManager !== 'undefined' && levelManager && levelManager.getCurrentLevel) {
        const lvl = levelManager.getCurrentLevel();
        if (lvl && lvl.id) return lvl.id;
    }
    return 'level1_airport';
}

// --- 武器系统 ---
const WEAPONS = {
    RIFLE:       { id: 1, name: "步枪",       range: 650, cooldown: 9,  damage: 28, speed: 17, radius: 3.5, type: 'bullet' },
    PISTOL:      { id: 2, name: "手枪",      range: 450, cooldown: 11, damage: 34, speed: 16, radius: 4.0, type: 'bullet' },
    SMG:         { id: 3, name: "冲锋枪",     range: 380, cooldown: 6,  damage: 16, speed: 18, radius: 2.8, type: 'bullet' },
    SNIPER:      { id: 4, name: "狙击枪",     range: 1100,cooldown: 45, damage: 140,speed: 26, radius: 3.0, type: 'bullet' },
    GRENADE:     { id: 5, name: "手榴弹",     range: 400, cooldown: 65, damage: 130,speed: 9,  radius: 6.0, type: 'grenade', blastRadius: 120 },
    MACHINE_GUN: { id: 6, name: "机枪",       range: 800, cooldown: 7,  damage: 42, speed: 19, radius: 4.0, type: 'bullet' },
    UAV:         { id: 7, name: "UAV空袭",    range: 2000,cooldown: 20, damage: 99999,speed:30, radius: 10.0, type: 'uav', blastRadius: 180 }
};

let currentWeapon = WEAPONS.RIFLE;
let unlockedWeapons = [WEAPONS.RIFLE.id];

function isKillstreakSupportedLevel(levelId) {
    return true;
}

// 连杀奖励机制专有变量 (在 level0_test 与 level1_airport 关卡测试生效，绝不影响 level2/3/4)
let level0StreakCount = 0;
let level0MgAmmo = 0;
let level0MgFirstUseDone = false;
let level0UavAmmo = 0;
let level0UavFirstUseDone = false;
let level0InfiniteBlindTimer = 0;
let level0InfiniteBlindActiveLast = false;
let level0InfiniteBlindPaused = false;

function settleAllPendingDamage() {
    let totalSettled = 0;
    if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
        enemies.forEach(e => {
            if (e.pendingDamage > 0) {
                applyDamageToEnemy(e, e.pendingDamage);
                e.pendingDamage = 0;
                e.hitTimer = 8;
                createExplosion(e.x, e.y, 20, '#00FF66');
                totalSettled++;
            }
        });
    }
    return totalSettled;
}

function pauseInfiniteBlindZone() {
    blindActive = false;
    blindZone = null;
    level0InfiniteBlindPaused = true;
    level0InfiniteBlindActiveLast = false;
    if (typeof soundManager !== 'undefined') {
        soundManager.stopBlindZone();
    }
    
    // 盲区暂停时，立刻结算盲区内积累的所有延迟伤害 (pendingDamage)
    let totalSettled = settleAllPendingDamage();

    if (typeof addLog === 'function') {
        const secLeft = (level0InfiniteBlindTimer / 60).toFixed(1);
        if (totalSettled > 0) {
            addLog(`⚡ [全图盲区暂停/结算] 剩余 ${secLeft}s，结算盲区延迟伤害 (${totalSettled} 个敌人)`);
        } else {
            addLog(`⏸ [全图盲区已暂停] 剩余 ${secLeft}s (按 Space 或 8 键可随时重新开启)`);
        }
    }
}

function resumeInfiniteBlindZone() {
    blindActive = true;
    blindEnergy = MAX_BLIND_ENERGY;
    blindZone = { x: player.x, y: player.y, radius: 4000 };
    level0InfiniteBlindPaused = false;
    if (level0StreakCount >= 7) {
        level0StreakCount = 0;
        if (typeof addLog === 'function') addLog("⚡ [连杀数重置] 全图盲区开启，连杀数归零");
    }
    if (typeof soundManager !== 'undefined') {
        soundManager.playBlindZone();
    }
    if (typeof addLog === 'function') {
        const secLeft = (level0InfiniteBlindTimer / 60).toFixed(1);
        addLog(`⚡ [全图盲区已手动开启] 剩余 ${secLeft}s`);
    }
}

function activateLevel0KillstreakReward(num) {
    const currentLevelId = getCurrentLevelId();
    if (!isKillstreakSupportedLevel(currentLevelId)) return;

    if (num === 1) {
        // 机枪 (3 连杀) -> 30 发子弹
        if (level0StreakCount >= 3 || level0MgAmmo > 0) {
            if (!unlockedWeapons.includes(WEAPONS.MACHINE_GUN.id)) {
                unlockedWeapons.push(WEAPONS.MACHINE_GUN.id);
            }
            if (currentWeapon.id === WEAPONS.MACHINE_GUN.id) {
                if (level0StreakCount >= 3 && level0MgFirstUseDone) {
                    level0MgAmmo += 30;
                    level0MgFirstUseDone = false;
                    if (typeof addLog === 'function') addLog(`⚡ [再次解锁连杀] 补充 30 发机枪弹药！(当前弹药: ${level0MgAmmo})`);
                    createExplosion(player.x, player.y, 18, '#FF9900');
                } else {
                    if (typeof addLog === 'function') addLog(`机枪装备中 (当前弹药: ${level0MgAmmo})`);
                }
            } else {
                if (level0MgAmmo <= 0 && level0StreakCount >= 3) {
                    level0MgAmmo = 30;
                    level0MgFirstUseDone = false;
                    if (typeof addLog === 'function') addLog("⚡ 已装备 [机枪] (30发子弹)。首次开火时将重置连杀数");
                } else if (level0MgAmmo > 0 && level0StreakCount >= 3 && level0MgFirstUseDone) {
                    level0MgAmmo += 30;
                    level0MgFirstUseDone = false;
                    if (typeof addLog === 'function') addLog(`⚡ 再次达到 3 连杀！装备机枪并补充 30 发子弹 (当前: ${level0MgAmmo})`);
                } else {
                    if (typeof addLog === 'function') addLog(`装备机枪 (剩余弹药: ${level0MgAmmo})`);
                }
                switchWeapon(WEAPONS.MACHINE_GUN);
                createExplosion(player.x, player.y, 18, '#FF9900');
            }
        } else {
            if (typeof addLog === 'function') addLog(`❌ [机枪] 未解锁！需 3 连杀 (当前: ${level0StreakCount}/3)`);
        }
    } else if (num === 2) {
        // UAV 打击 (5 连杀) -> 5 次爆破打击
        if (level0StreakCount >= 5 || level0UavAmmo > 0) {
            if (!unlockedWeapons.includes(WEAPONS.UAV.id)) {
                unlockedWeapons.push(WEAPONS.UAV.id);
            }
            if (currentWeapon.id === WEAPONS.UAV.id) {
                if (level0StreakCount >= 5 && level0UavFirstUseDone) {
                    level0UavAmmo += 5;
                    level0UavFirstUseDone = false;
                    if (typeof addLog === 'function') addLog(`⚡ [再次解锁连杀] 补充 5 次 UAV 爆破打击！(当前次数: ${level0UavAmmo})`);
                    createExplosion(player.x, player.y, 22, '#00E5FF');
                } else {
                    if (typeof addLog === 'function') addLog(`UAV 打击准备中 (当前剩余: ${level0UavAmmo} 次)`);
                }
            } else {
                if (level0UavAmmo <= 0 && level0StreakCount >= 5) {
                    level0UavAmmo = 5;
                    level0UavFirstUseDone = false;
                    if (typeof addLog === 'function') addLog("⚡ 已装备 [UAV打击] (5次爆破)。首次打击时将重置连杀数");
                } else if (level0UavAmmo > 0 && level0StreakCount >= 5 && level0UavFirstUseDone) {
                    level0UavAmmo += 5;
                    level0UavFirstUseDone = false;
                    if (typeof addLog === 'function') addLog(`⚡ 再次达到 5 连杀！装备 UAV 并补充 5 次爆破打击 (当前: ${level0UavAmmo})`);
                } else {
                    if (typeof addLog === 'function') addLog(`装备 UAV打击 (剩余次数: ${level0UavAmmo})`);
                }
                switchWeapon(WEAPONS.UAV);
                createExplosion(player.x, player.y, 22, '#00E5FF');
            }
        } else {
            if (typeof addLog === 'function') addLog(`❌ [UAV打击] 未解锁！需 5 连杀 (当前: ${level0StreakCount}/5)`);
        }
    } else if (num === 3) {
        // 全图无限盲区 (7 连杀) -> 选中仅就绪，开启需手动操作 (开启时才扣除连杀数)
        if (level0InfiniteBlindTimer > 0) {
            if (level0StreakCount >= 7) {
                level0InfiniteBlindTimer = 420; // 刷新 7 秒
                level0InfiniteBlindPaused = true;
                blindActive = false;
                if (typeof addLog === 'function') addLog("⚡ 再次达到 7 连杀！刷新 [全图无限盲区] 预备时间为 7 秒！(按 Space 键或 8 键开启)");
                createExplosion(player.x, player.y, 28, '#E024FF');
            } else {
                if (blindActive) {
                    pauseInfiniteBlindZone();
                } else {
                    resumeInfiniteBlindZone();
                }
            }
        } else if (level0StreakCount >= 7) {
            level0InfiniteBlindTimer = 420; // 7秒 (420帧)
            level0InfiniteBlindPaused = true;
            blindActive = false;
            if (typeof addLog === 'function') addLog("⚡ 已选中 [全图无限盲区] (7秒就绪)！(按 Space 键或 8 键手动开启)");
            createExplosion(player.x, player.y, 28, '#E024FF');
        } else {
            if (typeof addLog === 'function') addLog(`❌ [全图无限盲区] 未解锁！需 7 连杀 (当前: ${level0StreakCount}/7)`);
        }
    }
}

function triggerLevel0KillstreakReward(num) {
    activateLevel0KillstreakReward(num);
}
window.activateLevel0KillstreakReward = activateLevel0KillstreakReward;
window.triggerLevel0KillstreakReward = triggerLevel0KillstreakReward;

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
let cachedIsPlayerInPool = false;

const mouse = { x: width / 2, y: height / 2 };
function getWorldMouse() {
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    if (levelId === 'level4_yacht' || levelId === 'level0_test') {
        return { x: mouse.x + (window.cameraX || 0), y: mouse.y - (window.cameraY || 0) };
    }
    return mouse;
}
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
    if (typeof levelManager === 'undefined' || !levelManager.getCurrentLevel || !levelManager.getCurrentLevel() || levelManager.getCurrentLevel().id !== 'level3_bank') return;
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

let cachedVisionSegments = null;

function setMapData(obs, sec, prp, zns, way, cam, lsr) {
    obstacles = obs || [];
    securityGates = sec || [];
    props = prp || [];
    zones = zns || [];
    waypoints = way || [];
    cameras = cam || [];
    lasers = lsr || [];
    cachedVisionSegments = null;
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
    if (currentLevelId === 'level0_test') {
        unlockedWeapons = [
            WEAPONS.RIFLE.id,
            WEAPONS.PISTOL.id,
            WEAPONS.SMG.id,
            WEAPONS.SNIPER.id,
            WEAPONS.GRENADE.id
        ];
    } else {
        unlockedWeapons = [WEAPONS.RIFLE.id];
    }
    if (!currentWeapon || (currentWeapon.id === WEAPONS.MACHINE_GUN.id || currentWeapon.id === WEAPONS.UAV.id)) {
        currentWeapon = WEAPONS.RIFLE;
    }
    level0StreakCount = 0;
    level0MgAmmo = 0;
    level0MgFirstUseDone = false;
    level0UavAmmo = 0;
    level0UavFirstUseDone = false;
    level0InfiniteBlindTimer = 0;
    level0InfiniteBlindPaused = false;
    level0InfiniteBlindActiveLast = false;
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
    clampEntitiesOnResize();
}

function resizeCanvas() {
    if (!ensureCanvas()) return;
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width; canvas.height = height;
    initMapLayout();
    clampEntitiesOnResize();
}
window.addEventListener('resize', resizeCanvas);

function getRayIntersection(ray, segment) {
    const r_px = ray.x, r_py = ray.y, r_dx = ray.dx, r_dy = ray.dy;
    const s_px = segment.x1, s_py = segment.y1, s_dx = segment.x2 - segment.x1, s_dy = segment.y2 - segment.y1;

    const denom = s_dx * r_dy - s_dy * r_dx;
    if (denom > -1e-6 && denom < 1e-6) return null;

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / denom;
    if (T2 < 0 || T2 > 1) return null;

    let T1;
    if (Math.abs(r_dx) > 1e-6) {
        T1 = (s_px + s_dx * T2 - r_px) / r_dx;
    } else if (Math.abs(r_dy) > 1e-6) {
        T1 = (s_py + s_dy * T2 - r_py) / r_dy;
    } else {
        return null;
    }

    if (T1 < 0) return null;
    return { x: r_px + r_dx * T1, y: r_py + r_dy * T1, param: T1 };
}

function getVisionBlockingSegments() {
    if (cachedVisionSegments) return cachedVisionSegments;
    const segments = [];
    obstacles.forEach(obs => {
        if (obs.type === 'solid' || obs.type === 'low_wall') {
            const x1 = obs.x, y1 = obs.y, x2 = obs.x + obs.w, y2 = obs.y + obs.h;
            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
            segments.push(
                { x1: x1, y1: y1, x2: x2, y2: y1, minX: minX, maxX: maxX, minY: y1, maxY: y1 },
                { x1: x2, y1: y1, x2: x2, y2: y2, minX: x2, maxX: x2, minY: minY, maxY: maxY },
                { x1: x2, y1: y2, x2: x1, y2: y2, minX: minX, maxX: maxX, minY: y2, maxY: y2 },
                { x1: x1, y1: y2, x2: x1, y2: y1, minX: x1, maxX: x1, minY: minY, maxY: maxY }
            );
        }
    });
    cachedVisionSegments = segments;
    return segments;
}

function drawTacticalFOV(x, y, angle, fovAngle, maxDist, fillColor, strokeColor) {
    const allSegments = getVisionBlockingSegments();
    
    // Filter segments to only those within range of this field of view to vastly improve performance
    const segments = allSegments.filter(seg => {
        if (seg.maxX < x - maxDist - 10 || seg.minX > x + maxDist + 10) return false;
        if (seg.maxY < y - maxDist - 10 || seg.minY > y + maxDist + 10) return false;
        return true;
    });

    const rayCount = 64;
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

        for (let j = 0; j < segments.length; j++) {
            const hit = getRayIntersection(ray, segments[j]);
            if (hit && hit.param < minParam) {
                minParam = hit.param;
                closestHit = hit;
            }
        }

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
    
    // Filter segments to only those within range of this field of view to vastly improve performance
    const filteredSegments = segments.filter(seg => {
        if (seg.maxX < originX - maxDist - 10 || seg.minX > originX + maxDist + 10) return false;
        if (seg.maxY < originY - maxDist - 10 || seg.minY > originY + maxDist + 10) return false;
        return true;
    });

    if (!rayCount) rayCount = 64;
    const startAngle = angle - fovAngle / 2;
    const step = fovAngle / rayCount;
    const poly = [{ x: originX, y: originY }];

    for (let i = 0; i <= rayCount; i++) {
        const a = startAngle + step * i;
        const ray = { x: originX, y: originY, dx: Math.cos(a) * maxDist, dy: Math.sin(a) * maxDist };

        let closestHit = null;
        let minParam = 1;

        for (let j = 0; j < filteredSegments.length; j++) {
            const hit = getRayIntersection(ray, filteredSegments[j]);
            if (hit && hit.param < minParam) {
                minParam = hit.param;
                closestHit = hit;
            }
        }

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

// ⚠️ 核心规则 (CORE RULE)：本关卡（Level 0 / level0_test）中的所有内容、配置和修改皆与已有的 Level 1, 2, 3 完美隔离！
function getLevelBounds() {
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    if (levelId === 'level3_bank') {
        return {
            minX: 24 + 14,
            maxX: width - 24 - 14,
            minY: 80 + 14,
            maxY: height - 110 - 14
        };
    } else if (levelId === 'level0_test') {
        const mapWidth = window.level0MapWidth || 7200;
        const mapHeight = window.level0MapHeight || 240;
        return {
            minX: 20,
            maxX: mapWidth - 20,
            minY: 10,
            maxY: mapHeight - 10
        };
    } else if (levelId === 'level5_hotel') {
        return {
            minX: 40 + 12,
            maxX: width - 40 - 12,
            minY: 40 + 12,
            maxY: height - 40 - 12
        };
    } else if (levelId === 'level4_yacht') {
        const mapWidth = window.level4MapWidth || 2400;
        return {
            minX: 40 + 12,
            maxX: mapWidth - 40 - 12,
            minY: 40 + 12,
            maxY: 720 - 40 - 12
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
        if (obs.type === 'pool') continue; // Allow player and enemies to walk in
        if (x > obs.x - radius && x < obs.x + obs.w + radius && y > obs.y - radius && y < obs.y + obs.h + radius) {
            return true;
        }
    }
    for (let p of props) {
        if (p.noCollision) continue;
        if (p.w && p.h) {
            if (x > p.x - radius && x < p.x + p.w + radius && y > p.y - radius && y < p.y + p.h + radius) {
                return true;
            }
        }
    }
    return false;
}

function ensureEntityInBounds(e, radius = 16) {
    if (!e || (typeof e.hp === 'number' && e.hp <= 0)) return;
    const bounds = getLevelBounds();
    let clampedX = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, e.x));
    let clampedY = Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, e.y));

    if (clampedX !== e.x || clampedY !== e.y || checkObstacleCollision(clampedX, clampedY, radius)) {
        let found = false;
        const searchAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
        for (let dist = 4; dist <= 240 && !found; dist += 6) {
            for (let angle of searchAngles) {
                const tx = clampedX + Math.cos(angle) * dist;
                const ty = clampedY + Math.sin(angle) * dist;
                if (!checkObstacleCollision(tx, ty, radius)) {
                    clampedX = tx;
                    clampedY = ty;
                    found = true;
                    break;
                }
            }
        }
        e.x = clampedX;
        e.y = clampedY;
    }
}

function clampEntitiesOnResize() {
    if (typeof player !== 'undefined' && player) {
        ensureEntityInBounds(player, 20);
    }
    if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
        enemies.forEach(e => {
            ensureEntityInBounds(e, 16);
            if (typeof waypoints !== 'undefined' && waypoints && waypoints.length > 0) {
                if (e.targetWaypoint >= waypoints.length) {
                    e.targetWaypoint = Math.floor(Math.random() * waypoints.length);
                }
            }
        });
    }
}

function turnAngleTowards(current, target, maxStep = 0.18) {
    let diff = target - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
}

function tryMoveEnemy(e, moveX, moveY, radius = 16) {
    if (moveX === 0 && moveY === 0) return false;
    const nextX = e.x + moveX;
    const nextY = e.y + moveY;
    
    // 1. 直行全向移动
    if (!checkObstacleCollision(nextX, nextY, radius)) {
        e.x = nextX;
        e.y = nextY;
        return true;
    }
    
    // 2. 沿 X / Y 轴滑动
    const canMoveX = moveX !== 0 && !checkObstacleCollision(nextX, e.y, radius);
    const canMoveY = moveY !== 0 && !checkObstacleCollision(e.x, nextY, radius);
    
    if (canMoveX && canMoveY) {
        if (Math.abs(moveX) >= Math.abs(moveY)) {
            e.x = nextX;
        } else {
            e.y = nextY;
        }
        return true;
    } else if (canMoveX) {
        e.x = nextX;
        return true;
    } else if (canMoveY) {
        e.y = nextY;
        return true;
    }

    // 3. 切线与切角偏转平滑避障 (+45°, -45°, +90°, -90°)
    const speed = Math.hypot(moveX, moveY);
    const baseAngle = Math.atan2(moveY, moveX);
    const testOffsets = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    for (let offset of testOffsets) {
        const testAngle = baseAngle + offset;
        const tx = e.x + Math.cos(testAngle) * speed;
        const ty = e.y + Math.sin(testAngle) * speed;
        if (!checkObstacleCollision(tx, ty, radius)) {
            e.x = tx;
            e.y = ty;
            return true;
        }
    }
    
    return false;
}

function adjustEnemyFacingToAvoidWalls(e) {
    const checkDist = 28;
    const frontX = e.x + Math.cos(e.angle) * checkDist;
    const frontY = e.y + Math.sin(e.angle) * checkDist;
    if (checkObstacleCollision(frontX, frontY, 12)) {
        const testOffsets = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, Math.PI];
        for (let offset of testOffsets) {
            const testA = e.angle + offset;
            const tx = e.x + Math.cos(testA) * checkDist;
            const ty = e.y + Math.sin(testA) * checkDist;
            if (!checkObstacleCollision(tx, ty, 12)) {
                e.angle = turnAngleTowards(e.angle, testA, 0.15);
                break;
            }
        }
    }
}

function selectNextWaypoint(e) {
    if (typeof waypoints === 'undefined' || !waypoints || waypoints.length === 0) return;
    if (waypoints.length === 1) {
        e.targetWaypoint = 0;
        return;
    }
    const visibleCandidates = [];
    for (let i = 0; i < waypoints.length; i++) {
        if (i === e.targetWaypoint) continue;
        if (canSee(e.x, e.y, waypoints[i].x, waypoints[i].y)) {
            visibleCandidates.push(i);
        }
    }
    if (visibleCandidates.length > 0) {
        e.targetWaypoint = visibleCandidates[Math.floor(Math.random() * visibleCandidates.length)];
    } else {
        let nextIndex;
        do { nextIndex = Math.floor(Math.random() * waypoints.length); } while(nextIndex === e.targetWaypoint && waypoints.length > 1);
        e.targetWaypoint = nextIndex;
    }
    e.stuckFrames = 0;
}

function checkLineObstacleIntersection(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let obs of obstacles) {
        if (obs.type === 'pool') continue; // Bullets fly over water
        if (obs.x + obs.w < minX || obs.x > maxX || obs.y + obs.h < minY || obs.y > maxY) {
            continue;
        }
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
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    const minY = Math.min(fromY, toY);
    const maxY = Math.max(fromY, toY);
    
    for (let obs of obstacles) {
        if (obs.type === 'solid' || obs.type === 'low_wall') {
            if (obs.x + obs.w < minX || obs.x > maxX || obs.y + obs.h < minY || obs.y > maxY) {
                continue;
            }
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
        const isEn = (window.__gameLang === 'en');
        const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
        if (levelId === 'level3_bank') {
            banner.innerText = isEn ? "🚨 VAULT SECURITY ALARM - BANK IN FULL LOCKDOWN 🚨" : "🚨 金库安全警报 - 中央银行已进入全面封锁 🚨";
        } else if (levelId === 'level2_subway') {
            banner.innerText = isEn ? "🚨 STATION SECURITY ALARM - SUBWAY IN FULL LOCKDOWN 🚨" : "🚨 地铁安全警报 - 地铁站已进入全面封锁 🚨";
        } else if (levelId === 'level4_yacht') {
            banner.innerText = isEn ? "🚨 VESSEL SECURITY ALARM - YACHT IN FULL LOCKDOWN 🚨" : "🚨 游艇安全警报 - 游艇全舰进入全面封锁 🚨";
        } else {
            banner.innerText = isEn ? "🚨 AIRPORT SECURITY ALARM - TERMINAL ON HIGH ALERT 🚨" : "🚨 机场安全警报 - 航站楼全区域戒备 🚨";
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
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';

    if (levelId === 'level0_test') {
        enemies = [];
        addLog(`测试关卡 - 远东极寒装甲列车地图已载入，所有敌人已移除，可自由探索测试。`);
        return;
    }

    const count = 2 + wave;
    const bounds = getLevelBounds();
    const minSpawnX = bounds.minX + 24;
    const maxSpawnX = bounds.maxX - 24;
    const minSpawnY = bounds.minY + 24;
    const maxSpawnY = bounds.maxY - 24;

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

        const newEnemy = {
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
        };
        ensureEntityInBounds(newEnemy, 16);
        enemies.push(newEnemy);
    }
    addLog(`第 ${wave} 波开始，检测到 ${count} 名敌军。`);
}

window.addEventListener('keydown', e => { 
    if (window.__viewState && window.__viewState !== 'playing') return;

    if (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
        return;
    }
    if (isPaused) return;

    if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); toggleBlindZone(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        addLog("防弹衣默认持续生效中");
    }
    if (e.code === 'Digit1' && unlockedWeapons.includes(WEAPONS.RIFLE.id)) switchWeapon(WEAPONS.RIFLE);
    if (e.code === 'Digit2' && unlockedWeapons.includes(WEAPONS.PISTOL.id)) switchWeapon(WEAPONS.PISTOL);
    if (e.code === 'Digit3' && unlockedWeapons.includes(WEAPONS.SMG.id)) switchWeapon(WEAPONS.SMG);
    if (e.code === 'Digit4' && unlockedWeapons.includes(WEAPONS.SNIPER.id)) switchWeapon(WEAPONS.SNIPER);
    if (e.code === 'Digit5' && unlockedWeapons.includes(WEAPONS.GRENADE.id)) switchWeapon(WEAPONS.GRENADE);
    if (e.code === 'Digit6') {
        const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
        if (isKillstreakSupportedLevel(currentLevelId)) {
            activateLevel0KillstreakReward(1);
        } else if (WEAPONS.MACHINE_GUN && unlockedWeapons.includes(WEAPONS.MACHINE_GUN.id)) {
            switchWeapon(WEAPONS.MACHINE_GUN);
        }
    }
    if (e.code === 'Digit7') {
        const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
        if (isKillstreakSupportedLevel(currentLevelId)) {
            activateLevel0KillstreakReward(2);
        } else if (WEAPONS.UAV && unlockedWeapons.includes(WEAPONS.UAV.id)) {
            switchWeapon(WEAPONS.UAV);
        }
    }
    if (e.code === 'Digit8') {
        const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
        if (isKillstreakSupportedLevel(currentLevelId)) {
            activateLevel0KillstreakReward(3);
        }
    }

    if (e.code === 'KeyR' || e.key === 'r') { if(isGameOver) resetGame(); }
    keys[e.code] = true; keys[e.key.toLowerCase()] = true;
});

function togglePause(forcedState) {
    if (window.__viewState && window.__viewState !== 'playing') {
        isPaused = true;
        if (typeof window.onGamePauseChange === 'function') {
            window.onGamePauseChange(isPaused);
        }
        return true;
    }
    if (forcedState !== undefined) {
        isPaused = forcedState;
    } else {
        isPaused = !isPaused;
    }
    if (isPaused) {
        addLog("游戏已暂停");
    } else {
        addLog("游戏已继续");
    }
    if (typeof window.onGamePauseChange === 'function') {
        window.onGamePauseChange(isPaused);
    }
    return isPaused;
}

let isMouseDown = false;
window.addEventListener('keyup', e => { keys[e.code] = false; keys[e.key.toLowerCase()] = false; });
window.addEventListener('mouseup', e => { if (e.button === 0) isMouseDown = false; });
window.addEventListener('blur', () => { isMouseDown = false; });

function setupCanvasListeners() {
    if (!canvas) return;
    canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', e => { 
        if (e.button === 0) {
            isMouseDown = true;
            const currentLevelId = getCurrentLevelId();
            if (isKillstreakSupportedLevel(currentLevelId)) {
                const mx = e.clientX;
                const my = e.clientY;
                const startY = height - 62;
                const ksStartX = width - 180;

                // Bottom-Right Killstreak HUD Icons Click Detection
                if (my >= startY && my <= startY + 46) {
                    if (mx >= ksStartX && mx <= ksStartX + 46) {
                        activateLevel0KillstreakReward(1);
                        return;
                    }
                    if (mx >= ksStartX + 56 && mx <= ksStartX + 102) {
                        activateLevel0KillstreakReward(2);
                        return;
                    }
                    if (mx >= ksStartX + 112 && mx <= ksStartX + 158) {
                        activateLevel0KillstreakReward(3);
                        return;
                    }
                }
            }
            shoot(); 
        }
    });

    canvas.addEventListener('dblclick', e => {
        if (blindActive && blindZone) {
            const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
            const tx = e.clientX + ((levelId === 'level4_yacht' || levelId === 'level0_test') ? (window.cameraX || 0) : 0);
            const ty = e.clientY - ((levelId === 'level4_yacht' || levelId === 'level0_test') ? (window.cameraY || 0) : 0);

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
                    addLog("无法在目标附近瞬移");
                    return;
                }

                const oldX = player.x;
                const oldY = player.y;

                let targetX = tx;
                let targetY = ty;

                // Check if destination is in an obstacle and needs adjustment
                if (checkObstacleCollision(targetX, targetY, 22)) {
                    let found = false;
                    const maxXBound = (levelId === 'level4_yacht') ? (window.level4MapWidth || 2400) - 25 : (levelId === 'level0_test' ? (window.level0MapWidth || 7200) - 25 : width - 25);
                    const maxYBound = (levelId === 'level0_test') ? (window.level0MapHeight || 240) - 25 : height - 25;
                    for (let d = 8; d <= 120 && !found; d += 8) {
                        for (let angleIdx = 0; angleIdx < 24; angleIdx++) {
                            const angle = (angleIdx / 24) * Math.PI * 2;
                            const cx = targetX + Math.cos(angle) * d;
                            const cy = targetY + Math.sin(angle) * d;

                            if (cx >= 25 && cx <= maxXBound && cy >= 25 && cy <= maxYBound) {
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
                addLog("盲区瞬移成功");
            }
        }
    });

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (blindActive && blindZone && currentWeapon.id === WEAPONS.GRENADE.id) {
            const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
            const tx = e.clientX + ((levelId === 'level4_yacht' || levelId === 'level0_test') ? (window.cameraX || 0) : 0);
            const ty = e.clientY - ((levelId === 'level4_yacht' || levelId === 'level0_test') ? (window.cameraY || 0) : 0);
            if (inBlindZone(tx, ty)) {
                if (!checkObstacleCollision(tx, ty, 12)) {
                    traps.push({ x: tx, y: ty, pulseTimer: 0 });
                    if (typeof soundManager !== 'undefined') soundManager.playTrap();
                    createExplosion(tx, ty, 8, '#FF6600');
                    addLog("诱饵陷阱部署成功");
                } else {
                    addLog("无法在掩体上部署陷阱");
                }
            } else {
                addLog("只能在盲区内部署陷阱");
            }
        }
    });
}

function switchWeapon(wp) {
    currentWeapon = wp;
    addLog(`已装备: ${wp.name}`);
    if (typeof soundManager !== 'undefined') {
        soundManager.playReload();
    }
}

const WEAPON_NAME_MAP = {
    "步枪": "Rifle",
    "手枪": "Pistol",
    "散弹枪": "Shotgun",
    "霰弹枪": "Shotgun",
    "冲锋枪": "SMG",
    "狙击枪": "Sniper Rifle",
    "手榴弹": "Grenade",
    "机枪": "Machine Gun",
    "M240": "M240",
    "UAV": "UAV Strike",
    "UAV空袭": "UAV Strike",
    "UAV打击": "UAV Strike",
    "全图盲区": "Full Blind Zone"
};

const LEVEL_NAME_MAP = {
    "测试靶场": "Test Arena",
    "测试战区": "Test Arena",
    "平滑视口与音效基准": "Test Arena",
    "第 5 关 · 酒店大堂": "Level 05 · Hotel Lobby",
    "酒店大堂": "Hotel Lobby",
    "机场航站楼": "Airport Terminal",
    "地下铁站台": "Subway Station",
    "地铁站台": "Subway Station",
    "银行金库": "Bank Vault",
    "中央银行金库": "Bank Vault",
    "豪华游艇": "Luxury Yacht",
    "超级游艇": "Luxury Yacht"
};

const LOG_TRANSLATION_MAP = {
    "游戏已暂停": "Game paused",
    "游戏已继续": "Game resumed",
    "战术行动已就绪": "Tactical operation ready",
    "防弹衣默认持续生效中": "Armor active",
    "泳池内无法使用枪械": "Firearms disabled inside water",
    "盲区已开启": "Blind Zone activated",
    "能量不足，无法开启盲区！": "Insufficient energy for Blind Zone!",
    "全图警报！": "SECTOR ALARM TRIGGERED!",
    "安检门警报触发！所有区域戒备！": "Security gate alarm triggered! High alert!",
    "战术平面图 100% 同步，完整地图已载入": "Tactical schematic synced, full map loaded",
    "机枪弹药用尽！": "Machine Gun ammo depleted!",
    "手榴弹无法扔出泳池外": "Grenades cannot exit pool area",
    "盲区瞬移成功": "Teleport successful",
    "无法在目标附近瞬移": "Cannot teleport near threat",
    "诱饵陷阱部署成功": "Decoy trap deployed",
    "无法在掩体上部署陷阱": "Cannot deploy trap on cover",
    "只能在盲区内部署陷阱": "Decoy trap must be placed inside Blind Zone",
    "观察者已被陷阱消灭": "Observer eliminated by decoy trap",
    "拾取医疗包 (+35 生命值)": "Medkit acquired (+35 HP)",
    "拾取补给 (+50 防弹衣 / +40 能量)": "Supplies acquired (+50 Armor / +40 Energy)",
    "💾 已获取绝密数据芯片！区域主电源已重启，照明系统恢复。": "💾 Classified data secured! Main power restored, full lighting enabled.",
    "全图盲区效果已到期": "Full Blind Zone duration expired",
    "UAV 轰炸次数已用尽": "UAV Strike charges depleted",
    "⚡ [连杀数重置] 全图盲区开启，连杀数归零": "⚡ [Streak Reset] Full Blind Zone active, streak reset to 0",
    "⚡ 已装备 [机枪] (30发子弹)。首次开火时将重置连杀数": "⚡ Equipped [Machine Gun] (30 rounds). Streak resets on first shot",
    "⚡ 已装备 [UAV打击] (5次爆破)。首次打击时将重置连杀数": "⚡ Equipped [UAV Strike] (5 charges). Streak resets on first strike",
    "⚡ [机枪首次开火] 连杀数重置为0": "⚡ [MG First Shot] Streak reset to 0",
    "⚡ [UAV首次打击] 连杀数重置为0": "⚡ [UAV First Strike] Streak reset to 0",
    "⚡ 已选中 [全图无限盲区] (7秒就绪)！(按 Space 键或 8 键手动开启)": "⚡ Selected [Full Blind Zone] (7s ready)! Press Space or 8 to activate",
    "⚡ [3连杀达成] 机枪已就绪！按数字键 6 或点击右下角图标使用": "⚡ [3 Kills] Machine Gun ready! Press 6 or click icon",
    "⚡ [5连杀达成] UAV打击已就绪！按数字键 7 或点击右下角图标使用": "⚡ [5 Kills] UAV Strike ready! Press 7 or click icon",
    "⚡ [7连杀达成] 全图无限盲区已就绪！按数字键 8 或点击右下角图标使用": "⚡ [7 Kills] Full Blind Zone ready! Press 8 or click icon",
    "⚡ 再次达到 7 连杀！刷新 [全图无限盲区] 预备时间为 7 秒！(按 Space 键或 8 键开启)": "⚡ [7 Kills Again] Refreshed Full Blind Zone to 7s! (Press Space or 8)"
};

function translateLogMessage(msg) {
    if (window.__gameLang !== 'en') return msg;
    if (LOG_TRANSLATION_MAP[msg]) return LOG_TRANSLATION_MAP[msg];
    
    // Level loading
    if (msg.startsWith("已加载地图: ")) {
        const rawName = msg.replace("已加载地图: ", "").trim();
        const enName = LEVEL_NAME_MAP[rawName] || rawName;
        return `Level loaded: ${enName}`;
    }

    // Equipment & pickups
    if (msg.startsWith("已装备: ")) {
        const rawName = msg.replace("已装备: ", "").trim();
        const enName = WEAPON_NAME_MAP[rawName] || rawName;
        return `Equipped: ${enName}`;
    }
    if (msg.startsWith("拾取武器: ")) {
        let rawName = msg.replace("拾取武器: ", "").replace(/\[|\]/g, "").trim();
        const enName = WEAPON_NAME_MAP[rawName] || rawName;
        return `Weapon acquired: [${enName}]`;
    }
    if (msg.startsWith("解锁新武器: ")) {
        let rawName = msg.replace("解锁新武器: ", "").replace(/\[|\]|！/g, "").trim();
        const enName = WEAPON_NAME_MAP[rawName] || rawName;
        return `New weapon unlocked: [${enName}]!`;
    }

    // Wave announcements
    if (msg.startsWith("第 ") && msg.includes(" 波开始，检测到 ") && msg.includes(" 名敌军。")) {
        return msg.replace("第 ", "Wave ").replace(" 波开始，检测到 ", " started, detected ").replace(" 名敌军。", " hostiles.");
    }
    if (msg.startsWith("测试靶场第 ") && msg.includes(" 波: 生成 ") && msg.includes(" 个巡逻靶标。")) {
        return msg.replace("测试靶场第 ", "Test Arena Wave ").replace(" 波: 生成 ", ": Spawned ").replace(" 个巡逻靶标。", " patrol targets.");
    }

    // Killstreaks unlock/lock
    if (msg.includes("未解锁！需 3 连杀")) {
        return msg.replace("❌ [机枪] 未解锁！需 3 连杀 (当前: ", "❌ [Machine Gun] Locked! Requires 3 kills (Current: ").replace(")", ")");
    }
    if (msg.includes("未解锁！需 5 连杀")) {
        return msg.replace("❌ [UAV打击] 未解锁！需 5 连杀 (当前: ", "❌ [UAV Strike] Locked! Requires 5 kills (Current: ").replace(")", ")");
    }
    if (msg.includes("未解锁！需 7 连杀")) {
        return msg.replace("❌ [全图无限盲区] 未解锁！需 7 连杀 (当前: ", "❌ [Full Blind Zone] Locked! Requires 7 kills (Current: ").replace(")", ")");
    }

    // Killstreak repeats
    if (msg.includes("再次达到 3 连杀！")) {
        return msg.replace("⚡ 再次达到 3 连杀！装备机枪并补充 30 发子弹 (当前: ", "⚡ [3 Kills Again] Equipped Machine Gun (+30 rounds, Total: ").replace(")", ")");
    }
    if (msg.includes("再次达到 5 连杀！")) {
        return msg.replace("⚡ 再次达到 5 连杀！装备 UAV 并补充 5 次爆破打击 (当前: ", "⚡ [5 Kills Again] Equipped UAV Strike (+5 charges, Total: ").replace(")", ")");
    }
    if (msg.includes("补充 30 发机枪弹药！")) {
        return msg.replace("⚡ [再次解锁连杀] 补充 30 发机枪弹药！(当前弹药: ", "⚡ [Streak Reward] +30 Machine Gun ammo! (Current: ").replace(")", ")");
    }
    if (msg.includes("补充 5 次 UAV 爆破打击！")) {
        return msg.replace("⚡ [再次解锁连杀] 补充 5 次 UAV 爆破打击！(当前次数: ", "⚡ [Streak Reward] +5 UAV Strikes! (Current: ").replace(")", ")");
    }

    // Ammo / Status
    if (msg.includes("机枪装备中")) {
        return msg.replace("机枪装备中 (当前弹药: ", "Machine Gun equipped (Ammo: ").replace(")", ")");
    }
    if (msg.includes("装备机枪")) {
        return msg.replace("装备机枪 (剩余弹药: ", "Equipped Machine Gun (Ammo: ").replace(")", ")");
    }
    if (msg.includes("UAV 打击准备中")) {
        return msg.replace("UAV 打击准备中 (当前剩余: ", "UAV Strike ready (Remaining: ").replace(" 次)", "x)");
    }
    if (msg.includes("装备 UAV打击")) {
        return msg.replace("装备 UAV打击 (剩余次数: ", "Equipped UAV Strike (Remaining: ").replace(")", ")");
    }

    // UAV Hit
    if (msg.includes("UAV 打击命中坐标")) {
        return msg.replace("⚡ UAV 打击命中坐标 (", "⚡ UAV Strike hit at (")
                  .replace(")！(剩余 ", ") (Remaining: ")
                  .replace(" 次)", "x)");
    }

    // Blind zone toggles
    if (msg.startsWith("盲区已关闭")) {
        return msg.replace("盲区已关闭 (能量耗尽)", "Blind Zone collapsed (Energy Depleted)")
                  .replace("盲区已关闭 (手动关闭)", "Blind Zone deactivated (Manual)")
                  .replace("盲区已关闭 (已瓦解)", "Blind Zone collapsed");
    }
    if (msg.includes("全图盲区已手动开启")) {
        return msg.replace("⚡ [全图盲区已手动开启] 剩余 ", "⚡ [Full Blind Zone active] Remaining ");
    }
    if (msg.includes("全图盲区已暂停")) {
        return msg.replace("⏸ [全图盲区已暂停] 剩余 ", "⏸ [Full Blind Zone paused] Remaining ")
                  .replace(" (按 Space 或 8 键可随时重新开启)", " (Press Space or 8 to resume)");
    }
    if (msg.includes("全图盲区暂停/结算")) {
        return msg.replace("⚡ [全图盲区暂停/结算] 剩余 ", "⚡ [Full Blind Zone settled] Remaining ")
                  .replace("，结算盲区延迟伤害 (", ", settled delayed damage on ")
                  .replace(" 个敌人)", " enemies");
    }

    // Fallback: replace any lingering standard terms
    let out = msg;
    for (const [zh, en] of Object.entries(WEAPON_NAME_MAP)) {
        out = out.split(zh).join(en);
    }
    for (const [zh, en] of Object.entries(LEVEL_NAME_MAP)) {
        out = out.split(zh).join(en);
    }
    return out;
}

function addLog(text) {
    const log = document.getElementById('log-panel');
    if (!log) return;
    const line = document.createElement('div');
    line.innerText = "> " + translateLogMessage(text);
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
    if (particles.length > 120) {
        particles.splice(0, particles.length - 120);
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
    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (isKillstreakSupportedLevel(currentLevelId) && level0InfiniteBlindTimer > 0) {
        if (blindActive) {
            pauseInfiniteBlindZone();
        } else {
            resumeInfiniteBlindZone();
        }
        return;
    }
    if (!blindActive) {
        if (blindEnergy >= 15) {
            blindActive = true;
            blindZone = { x: player.x, y: player.y, radius: 240 };
            addLog("盲区已开启");
            if (typeof soundManager !== 'undefined') {
                soundManager.playBlindZone();
            }
        } else {
            addLog("能量不足，无法开启盲区！");
        }
    } else {
        closeBlindZone("MANUAL DEACTIVATION");
    }
}

function closeBlindZone(reason = "COLLAPSED") {
    if (!blindActive && level0InfiniteBlindTimer <= 0) return;
    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (isKillstreakSupportedLevel(currentLevelId) && level0InfiniteBlindTimer > 0 && reason === "MANUAL DEACTIVATION") {
        pauseInfiniteBlindZone();
        return;
    }
    blindActive = false;
    blindZone = null;
    level0InfiniteBlindTimer = 0;
    level0InfiniteBlindPaused = false;
    level0InfiniteBlindActiveLast = false;
    addLog(`盲区已关闭 (${reason === "ENERGY DEPLETED" ? "能量耗尽" : (reason === "MANUAL DEACTIVATION" ? "手动关闭" : "已瓦解")})`);
    if (typeof soundManager !== 'undefined') {
        soundManager.stopBlindZone();
    }
    
    enemies.forEach(e => {
        if (e.pendingDamage > 0) {
            applyDamageToEnemy(e, e.pendingDamage);
            e.pendingDamage = 0;
            if (currentLevelId !== 'level0_test') {
                e.alert = true; e.alertCooldown = 300;
            }
            e.hitTimer = 8;
            createExplosion(e.x, e.y, 20);
        }
    });
}

function applyDamageToEnemy(enemy, amount) {
    const wasAlive = enemy.hp > 0;
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

    if (wasAlive && enemy.hp <= 0) {
        killCount++;
        const currentLevelId = getCurrentLevelId();
        if (isKillstreakSupportedLevel(currentLevelId)) {
            const isUsingReward = (currentWeapon.id === WEAPONS.MACHINE_GUN.id || currentWeapon.id === WEAPONS.UAV.id || (level0InfiniteBlindTimer > 0 && blindActive));
            if (!isUsingReward) {
                level0StreakCount++;
                if (level0StreakCount === 3) {
                    if (typeof addLog === 'function') addLog("⚡ [3连杀达成] 机枪已就绪！按数字键 6 或点击右下角图标使用");
                    createExplosion(player.x, player.y, 16, '#FF9900');
                } else if (level0StreakCount === 5) {
                    if (typeof addLog === 'function') addLog("⚡ [5连杀达成] UAV打击已就绪！按数字键 7 或点击右下角图标使用");
                    createExplosion(player.x, player.y, 20, '#00E5FF');
                } else if (level0StreakCount === 7) {
                    if (typeof addLog === 'function') addLog("⚡ [7连杀达成] 全图无限盲区已就绪！按数字键 8 或点击右下角图标使用");
                    createExplosion(player.x, player.y, 24, '#E024FF');
                }
            }
        }
        createExplosion(enemy.x, enemy.y, 18);
        spawnDropItem(enemy.x, enemy.y);
    }
}

function inBlindZone(x, y) {
    if (!blindActive) return false;
    if (level0InfiniteBlindTimer > 0) {
        return true;
    }
    if (!blindZone) return false;
    const dx = x - blindZone.x, dy = y - blindZone.y;
    return (dx*dx + dy*dy) <= blindZone.radius * blindZone.radius;
}

function isEntityInPool(x, y) {
    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (currentLevelId !== 'level4_yacht' && currentLevelId !== 'level0_test') return false;
    for (let obs of obstacles) {
        if (obs.type === 'pool' || obs.label === 'SWIMMING POOL') {
            if (x >= obs.x && x <= obs.x + obs.w && y >= obs.y && y <= obs.y + obs.h) {
                return true;
            }
        }
    }
    return false;
}

function shoot() {
    if (player.hp <= 0 || isGameOver || isPaused || shootCooldownTimer > 0) return;
    
    if (cachedIsPlayerInPool && currentWeapon.type !== 'grenade') {
        if (typeof addLog === 'function') {
            addLog("泳池内无法使用枪械");
        }
        return;
    }

    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';

    if (isKillstreakSupportedLevel(currentLevelId) && currentWeapon.id === WEAPONS.MACHINE_GUN.id) {
        if (level0MgAmmo <= 0) {
            if (typeof addLog === 'function') addLog("机枪弹药用尽！");
            switchWeapon(WEAPONS.RIFLE);
            return;
        }
        if (!level0MgFirstUseDone) {
            level0StreakCount = 0;
            level0MgFirstUseDone = true;
            if (typeof addLog === 'function') addLog("⚡ [机枪首次开火] 连杀数重置为0");
        }
        level0MgAmmo--;
    }

    if (isKillstreakSupportedLevel(currentLevelId) && currentWeapon.type === 'uav') {
        if (level0UavAmmo <= 0) {
            if (typeof addLog === 'function') addLog("UAV 轰炸次数已用尽");
            if (unlockedWeapons.includes(WEAPONS.MACHINE_GUN.id) && level0MgAmmo > 0) {
                switchWeapon(WEAPONS.MACHINE_GUN);
            } else {
                switchWeapon(WEAPONS.RIFLE);
            }
            return;
        }

        if (!level0UavFirstUseDone) {
            level0StreakCount = 0;
            level0UavFirstUseDone = true;
            if (typeof addLog === 'function') addLog("⚡ [UAV首次打击] 连杀数重置为0");
        }

        level0UavAmmo--;
        shootCooldownTimer = currentWeapon.cooldown;
        const worldMouse = getWorldMouse();
        const tx = worldMouse.x;
        const ty = worldMouse.y;

        if (typeof soundManager !== 'undefined') {
            soundManager.playShoot('grenade');
        }

        createExplosion(tx, ty, 30, '#00FF66');
        createExplosion(tx, ty, 25, '#FF5500');
        createExplosion(tx, ty, 15, '#FFFFFF');

        for (let i = 0; i < 25; i++) {
            particles.push({
                x: tx + (Math.random() - 0.5) * 40,
                y: ty + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color: Math.random() < 0.5 ? '#00FF66' : '#00E5FF'
            });
        }

        if (typeof addLog === 'function') {
            addLog(`⚡ UAV 打击命中坐标 (${Math.round(tx)}, ${Math.round(ty)})！(剩余 ${level0UavAmmo} 次)`);
        }

        enemies.forEach(e => {
            if (e.hp <= 0) return;
            const dist = Math.hypot(e.x - tx, e.y - ty);
            if (dist <= (currentWeapon.blastRadius || 180)) {
                e.shield = 0;
                applyDamageToEnemy(e, 99999);
                e.hitTimer = 10;
                createExplosion(e.x, e.y, 25, '#FF3344');
            }
        });

        if (level0UavAmmo <= 0) {
            setTimeout(() => {
                if (currentWeapon.id === WEAPONS.UAV.id) {
                    if (unlockedWeapons.includes(WEAPONS.MACHINE_GUN.id)) {
                        switchWeapon(WEAPONS.MACHINE_GUN);
                    } else {
                        switchWeapon(WEAPONS.RIFLE);
                    }
                }
            }, 500);
        }
        return;
    }
    
    if (cachedIsPlayerInPool && currentWeapon.type !== 'grenade') {
        if (typeof addLog === 'function') {
            addLog("泳池内无法使用枪械");
        }
        return;
    }
    
    if (typeof soundManager !== 'undefined') {
        soundManager.playShoot(currentWeapon.type);
    }
    
    shootCooldownTimer = currentWeapon.cooldown;
    if (currentWeapon.type !== 'grenade') {
        player.flashTimer = 3;
    } else {
        player.flashTimer = 0;
    }
    const worldMouse = getWorldMouse();
    const angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);

    if (currentWeapon.type === 'grenade') {
        grenades.push({
            x: player.x, y: player.y,
            targetX: worldMouse.x, targetY: worldMouse.y,
            startX: player.x, startY: player.y,
            vx: Math.cos(angle) * currentWeapon.speed,
            vy: Math.sin(angle) * currentWeapon.speed,
            traveled: 0,
            maxDist: Math.min(currentWeapon.range, Math.hypot(worldMouse.x - player.x, worldMouse.y - player.y)),
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
    if (!success) {
        const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
        if (currentLevelId === 'level0_test') {
            player.hp = player.maxHp;
            player.shield = player.maxShield;
            return;
        }
    }
    isGameOver = true;
    const isEn = (window.__gameLang === 'en');
    const screen = document.getElementById('game-over-screen');
    const title = document.getElementById('over-title');
    const desc = document.getElementById('over-desc');
    if (screen) screen.style.display = 'flex';
    if(success) {
        if (title) { 
            title.innerText = isEn ? "LEVEL CLEARED" : "关卡完成"; 
            title.style.color = "#00FF66"; 
        }
        if (desc) desc.innerText = isEn ? `Area fully secured. Total Kills: ${killCount}` : `区域已完全肃清。总击杀数: ${killCount}`;
    } else {
        if (title) { 
            title.innerText = isEn ? "MISSION FAILED" : "任务失败"; 
            title.style.color = "#FF3344"; 
        }
        if (desc) desc.innerText = isEn ? `Operative eliminated on Wave ${wave}. Total Kills: ${killCount}` : `特工在第 ${wave} 波行动中阵亡。总击杀数: ${killCount}`;
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
    if (window.__viewState && window.__viewState !== 'playing') {
        isPaused = true;
        if (typeof soundManager !== 'undefined') {
            soundManager.updateGameState(isGameOver, true);
        }
        return;
    }
    if (typeof soundManager !== 'undefined') {
        soundManager.updateGameState(isGameOver, isPaused);
    }
    if (isGameOver || isPaused) return;
    if (shootCooldownTimer > 0) {
        shootCooldownTimer--;
    } else if (isMouseDown) {
        shoot();
    }
    if (gateAlarmCooldown > 0) gateAlarmCooldown--;
    if (typeof laserAlarmCooldown !== 'undefined' && laserAlarmCooldown > 0) laserAlarmCooldown--;

    const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : '';
    if (currentLevelId === 'level0_test') {
        player.hp = player.maxHp;
        player.shield = player.maxShield;
    }
    cachedIsPlayerInPool = isEntityInPool(player.x, player.y);
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
                            addLog("全图警报！");
                        }
                        // Continuous damage to player
                        player.lastHitTimer = 180; // Delay health regen
                        if (player.shield > 0) {
                            const isPlayerInPool = cachedIsPlayerInPool;
                            const shieldLoss = isPlayerInPool ? 0.8 * 1.5 : 0.8;
                            player.shield = Math.max(0, player.shield - shieldLoss);
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
                    addLog("战术平面图 100% 同步，完整地图已载入");
                }
            }
        }
    }

    let moveSpeed = player.speed;
    const isPlayerInPool = cachedIsPlayerInPool;
    if (isPlayerInPool) {
        moveSpeed *= 0.5;
    }
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
                        addLog("全图警报！");
                        createExplosion(player.x, player.y, 12, '#FF3344');
                    }
                }
            }
        });
    }

    if (!checkObstacleCollision(nextX, nextY, 18) && !collidesWithLaser) {
        const maxXVal = (currentLevelId === 'level4_yacht') ? (window.level4MapWidth || 2400) - 20 : (currentLevelId === 'level0_test' ? (window.level0MapWidth || 7200) - 20 : width - 20);
        const maxYVal = (currentLevelId === 'level4_yacht') ? 700 : (currentLevelId === 'level0_test' ? (window.level0MapHeight || 240) - 15 : height - 20);
        player.x = Math.max(20, Math.min(maxXVal, nextX));
        player.y = Math.max(15, Math.min(maxYVal, nextY));
    }
    const worldMouse = getWorldMouse();
    player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
    if (player.flashTimer > 0) player.flashTimer--;

    if (gateAlarmCooldown <= 0) {
        securityGates.forEach(gate => {
            if (player.x > gate.x - 12 && player.x < gate.x + gate.w + 12 &&
                player.y > gate.y && player.y < gate.y + gate.h) {
                triggerGlobalAlarm();
                gateAlarmCooldown = 120;
                addLog("安检门警报触发！所有区域戒备！");
                createExplosion(player.x, player.y, 8, '#FF3344');
            }
        });
    }

    if (player.lastHitTimer > 0) {
        player.lastHitTimer--;
    } else if (player.shield < player.maxShield) {
        const isPlayerInPool = cachedIsPlayerInPool;
        const shieldRegen = isPlayerInPool ? 0.15 * 0.33 : 0.15;
        player.shield = Math.min(player.maxShield, player.shield + shieldRegen);
    }
    
    if (isKillstreakSupportedLevel(currentLevelId)) {
        if (level0InfiniteBlindTimer > 0) {
            if (!level0InfiniteBlindPaused) {
                level0InfiniteBlindTimer--;
                blindActive = true;
                blindEnergy = MAX_BLIND_ENERGY;
                blindZone = { x: player.x, y: player.y, radius: 4000 };
            } else {
                blindActive = false;
                blindZone = null;
            }
            level0InfiniteBlindActiveLast = true;
        } else if (level0InfiniteBlindActiveLast) {
            blindActive = false;
            blindZone = null;
            level0InfiniteBlindPaused = false;
            level0InfiniteBlindActiveLast = false;
            if (typeof addLog === 'function') {
                addLog("全图盲区效果已到期");
            }
        }
    }

    if (blindActive) {
        if (isKillstreakSupportedLevel(currentLevelId) && level0InfiniteBlindTimer > 0) {
            blindEnergy = MAX_BLIND_ENERGY;
        } else {
            blindEnergy = Math.max(0, blindEnergy - BLIND_CONSUME_RATE);
            if (blindEnergy <= 0) closeBlindZone("ENERGY DEPLETED");
        }
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
                addLog("拾取医疗包 (+35 生命值)");
                createExplosion(player.x, player.y, 10, '#00FF66');
            } else if (item.type === 'battery') {
                player.shield = Math.min(player.maxShield, player.shield + 50);
                blindEnergy = Math.min(MAX_BLIND_ENERGY, blindEnergy + 40);
                addLog("拾取补给 (+50 防弹衣 / +40 能量)");
                createExplosion(player.x, player.y, 10, '#00CCFF');
            } else if (item.type === 'weapon') {
                const wp = item.weaponData;
                if (!unlockedWeapons.includes(wp.id)) {
                    unlockedWeapons.push(wp.id);
                    addLog(`解锁新武器: [${wp.name}]！`);
                } else {
                    addLog(`拾取武器: [${wp.name}]`);
                }
                switchWeapon(wp);
                createExplosion(player.x, player.y, 12, '#FFFF00');
            } else if (item.type === 'classified_drive' || item.type === 'gold_vault_crown') {
                level3TargetSecured = true;
                addLog("💾 已获取绝密数据芯片！区域主电源已重启，照明系统恢复。");
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
                if (p.noCollision) continue;
                if (p.w && p.h && lineIntersectsRect(g.x, g.y, nextGPointX, nextGPointY, p)) {
                    hitProp = p;
                    break;
                }
            }
        }

        // Restrict grenade throwing so it cannot leave the pool if started inside
        const startsInPool = isEntityInPool(g.startX, g.startY);
        const endsInPool = isEntityInPool(nextGPointX, nextGPointY);
        if (startsInPool && !endsInPool) {
            hitBoundary = true;
            if (typeof addLog === 'function') {
                addLog("手榴弹无法扔出泳池外");
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
            const isExplosionInPool = isEntityInPool(g.x, g.y);
            createExplosion(g.x, g.y, isExplosionInPool ? 15 : 35, isExplosionInPool ? '#00E5FF' : '#FF5500');
            if (typeof soundManager !== 'undefined') {
                soundManager.playExplosion();
            }
            enemies.forEach(e => {
                if (e.hp <= 0) return;
                const d = Math.hypot(e.x - g.x, e.y - g.y);
                if (d <= g.blastRadius) {
                    let finalDmg = g.damage;
                    if (isExplosionInPool) {
                        finalDmg *= 0.15; // Heavily discounted
                    }
                    const dmg = Math.floor(finalDmg * (1 - d / g.blastRadius * 0.4));
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

        const bounds = getLevelBounds();
        if (b.traveled >= b.maxRange || b.x < bounds.minX - 100 || b.x > bounds.maxX + 100 || b.y < bounds.minY - 100 || b.y > bounds.maxY + 100) {
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

        const bounds = getLevelBounds();
        if (eb.x < bounds.minX - 100 || eb.x > bounds.maxX + 100 || eb.y < bounds.minY - 100 || eb.y > bounds.maxY + 100) {
            enemyBullets.splice(i, 1); continue;
        }
        if (Math.hypot(eb.x - player.x, eb.y - player.y) < 20) {
            if (typeof soundManager !== 'undefined') soundManager.playHit();
            player.lastHitTimer = 180; // set 3 second delay on regeneration
            if (player.shield > 0) {
                const isPlayerInPool = cachedIsPlayerInPool;
                const shieldLoss = isPlayerInPool ? 15 * 1.5 : 15;
                player.shield = Math.max(0, player.shield - shieldLoss);
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
        if (typeof soundManager !== 'undefined') {
            soundManager.stopAlarm();
        }
    }
    
    let aliveCount = 0;
    enemies.forEach(e => {
        if (e.hp <= 0) {
            if (e.deathAlpha > 0) e.deathAlpha -= 0.08;
            return;
        }
        aliveCount++;
        ensureEntityInBounds(e, 16);
        if (e.hitTimer > 0) e.hitTimer--;
        if (e.flashTimer > 0) e.flashTimer--;
        if (e.shootCooldown > 0) e.shootCooldown--;
        if (e.spawnGraceTimer > 0) e.spawnGraceTimer--;

        // 盲区推迟伤害结算校验：若盲区不处于激活状态，或敌人已离开盲区，立即重挫并结算推迟伤害！
        if (e.pendingDamage > 0) {
            if (!blindActive || !inBlindZone(e.x, e.y)) {
                applyDamageToEnemy(e, e.pendingDamage);
                e.pendingDamage = 0;
                e.hitTimer = 8;
                createExplosion(e.x, e.y, 20, '#00FF66');
                if (currentLevelId !== 'level0_test') {
                    e.alert = true;
                    e.alertCooldown = 300;
                }
            }
        }

        if (currentLevelId === 'level0_test') {
            e.alert = false;
            e.alertCooldown = 0;
            e.shootCooldown = 999999;
            if (typeof waypoints !== 'undefined' && waypoints && waypoints.length > 0) {
                if (e.targetWaypoint === undefined || e.targetWaypoint >= waypoints.length) {
                    e.targetWaypoint = 0;
                }
                const wp = waypoints[e.targetWaypoint % waypoints.length];
                const tdx = wp.x - e.x, tdy = wp.y - e.y;
                const distToWp = Math.hypot(tdx, tdy);
                if (distToWp < 25) {
                    selectNextWaypoint(e);
                } else {
                    const moveAngle = Math.atan2(tdy, tdx);
                    const spd = e.patrolSpeed || 1.2;
                    const oldX = e.x, oldY = e.y;
                    let moved = tryMoveEnemy(e, Math.cos(moveAngle) * spd, Math.sin(moveAngle) * spd, 16);
                    const movedDist = Math.hypot(e.x - oldX, e.y - oldY);
                    if (movedDist > 0.15) {
                        const actualMoveAngle = Math.atan2(e.y - oldY, e.x - oldX);
                        e.angle = turnAngleTowards(e.angle, actualMoveAngle, 0.12);
                        e.walkCycle += 0.12;
                    } else {
                        e.stuckFrames = (e.stuckFrames || 0) + 1;
                        if (e.stuckFrames > 12) selectNextWaypoint(e);
                    }
                    adjustEnemyFacingToAvoidWalls(e);
                }
            }
            return;
        }

        const enemyInPool = isEntityInPool(e.x, e.y);

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
        
        let _visibleCached = null;
        const checkVisible = () => {
            if (_visibleCached === null) {
                _visibleCached = canSee(e.x, e.y, player.x, player.y);
            }
            return _visibleCached;
        };
        
        const playerInBlind = inBlindZone(player.x, player.y);
        let playerIsHidden = playerInBlind && !e.isObserver;

        // 视角度数与观察距离必须与渲染的黄色/红光战术 FOV 完全一致
        let fovAngle = Math.PI / 3; // 60 度视角扇形
        let fovRange = 260;
        if (e.isObserver && playerInBlind) {
            fovAngle = Math.PI / 6; // 30 度受限视角
            fovRange = 110;
        }

        let inEnemyFOV = false;
        if (dist <= fovRange) {
            const angleToPlayer = Math.atan2(pdy, pdx);
            let diff = angleToPlayer - e.angle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            // 只有处于视锥扇形区域内或极近接触距离(<32px)才判定为在视野内
            if (Math.abs(diff) <= fovAngle / 2 || dist < 32) {
                inEnemyFOV = true;
            }
        }

        if (e.isObserver && playerInBlind) {
            playerIsHidden = !inEnemyFOV;
        }

        // 敌人未戒备时，只有当玩家【进入视锥扇形】且【未隐藏】且【无障碍物阻挡】时，才会触发警报！
        if (e.spawnGraceTimer <= 0 && inEnemyFOV && !playerIsHidden && checkVisible()) {
            if (!e.alert && typeof soundManager !== 'undefined') soundManager.playAlert();
            e.alert = true;
            e.alertCooldown = 300; 
        }
        
        if (e.alert) {
            if (!checkVisible() || playerIsHidden) {
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
                addLog("观察者已被陷阱消灭");
            } else {
                const moveAngle = Math.atan2(tdy, tdx);
                
                let speed = e.patrolSpeed * 1.3;
                if (playerInBlind) speed = 0.55;
                if (enemyInPool) speed *= 0.5;
                
                const oldX = e.x, oldY = e.y;
                let moved = tryMoveEnemy(e, Math.cos(moveAngle) * speed, Math.sin(moveAngle) * speed, 16);
                const movedDist = Math.hypot(e.x - oldX, e.y - oldY);
                if (movedDist > 0.15) {
                    const actualMoveAngle = Math.atan2(e.y - oldY, e.x - oldX);
                    e.angle = turnAngleTowards(e.angle, actualMoveAngle, 0.15);
                    e.walkCycle += 0.12;
                }
                adjustEnemyFacingToAvoidWalls(e);
            }
        } else if (e.alert && !playerIsHidden && e.spawnGraceTimer <= 0) {
            const targetAngle = Math.atan2(pdy, pdx);
            
            // Speed penalty: slower move speed for observers if the player is in the blind spot
            let moveSpeed = 1.5;
            if (e.isObserver && playerInBlind) moveSpeed = 0.5;
            if (enemyInPool) moveSpeed *= 0.5;
            
            const stopDistance = 45;
            if (dist > stopDistance) {
                const mx = Math.cos(targetAngle) * moveSpeed;
                const my = Math.sin(targetAngle) * moveSpeed;
                const oldX = e.x, oldY = e.y;
                let moved = tryMoveEnemy(e, mx, my, 16);
                const movedDist = Math.hypot(e.x - oldX, e.y - oldY);
                if (movedDist > 0.15) {
                    const actualMoveAngle = Math.atan2(e.y - oldY, e.x - oldX);
                    e.angle = turnAngleTowards(e.angle, actualMoveAngle, 0.18);
                    e.walkCycle += 0.15;
                } else {
                    e.angle = turnAngleTowards(e.angle, targetAngle, 0.18);
                }
            } else {
                e.angle = turnAngleTowards(e.angle, targetAngle, 0.18);
            }

            adjustEnemyFacingToAvoidWalls(e);

            if (checkVisible() && e.shootCooldown <= 0 && !enemyInPool) {
                e.shootCooldown = Math.max(38, 60 - wave * 2);
                e.flashTimer = 3;
                if (typeof soundManager !== 'undefined') soundManager.playEnemyShoot();
                enemyBullets.push({
                    x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
                    vx: Math.cos(e.angle) * 8.5, vy: Math.sin(e.angle) * 8.5,
                    penetrations: 1
                });
            }
        } else if (typeof waypoints !== 'undefined' && waypoints && waypoints.length > 0) {
            if (e.targetWaypoint === undefined || e.targetWaypoint >= waypoints.length) {
                e.targetWaypoint = 0;
            }
            const target = waypoints[e.targetWaypoint];
            const tdx = target.x - e.x, tdy = target.y - e.y;
            const distToTarget = Math.hypot(tdx, tdy);

            if (distToTarget < 20) {
                selectNextWaypoint(e);
            } else {
                const moveAngle = Math.atan2(tdy, tdx);
                let speed = e.patrolSpeed || 1.2;
                if ((e.isObserver && playerInBlind) || inBlindZone(e.x, e.y)) {
                    speed = 0.35;
                }
                if (enemyInPool) speed *= 0.5;

                const mx = Math.cos(moveAngle) * speed;
                const my = Math.sin(moveAngle) * speed;
                const oldX = e.x, oldY = e.y;

                let moved = tryMoveEnemy(e, mx, my, 16);
                const movedDist = Math.hypot(e.x - oldX, e.y - oldY);

                if (movedDist > 0.15) {
                    const actualMoveAngle = Math.atan2(e.y - oldY, e.x - oldX);
                    e.scanAngle = (e.scanAngle || 0) + 0.02;
                    const targetFacing = actualMoveAngle + Math.sin(e.scanAngle) * 0.18;
                    e.angle = turnAngleTowards(e.angle, targetFacing, 0.12);
                    e.walkCycle += 0.1;
                    e.stuckFrames = 0;
                } else {
                    e.stuckFrames = (e.stuckFrames || 0) + 1;
                    if (e.stuckFrames > 12) {
                        selectNextWaypoint(e);
                    }
                }

                adjustEnemyFacingToAvoidWalls(e);
            }
        }
    });

    // Helicopter tail rotor contact damage logic
    if (typeof props !== 'undefined' && (typeof currentLevelId !== 'undefined' ? currentLevelId === 'level4_yacht' : false)) {
        const heli = props.find(p => p.type === 'helicopter');
        if (heli) {
            const cx = heli.x + heli.w / 2;
            const cy = heli.y + heli.h / 2;
            const bodyWidth = heli.h * 0.22;
            const dx_local = -heli.w * 0.68;
            const dy_local = -bodyWidth * 0.3;
            const angle = heli.angle || 0;
            const tailRotorWorld = {
                x: cx + dx_local * Math.cos(angle) - dy_local * Math.sin(angle),
                y: cy + dx_local * Math.sin(angle) + dy_local * Math.cos(angle)
            };

            // Player contact
            if (player.hp > 0) {
                const distPlayer = Math.hypot(player.x - tailRotorWorld.x, player.y - tailRotorWorld.y);
                if (distPlayer < 28) {
                    player.lastHitTimer = 180;
                    if (player.shield > 0) {
                        player.shield = Math.max(0, player.shield - 1.2);
                        player.hp = Math.max(0, player.hp - 0.3);
                    } else {
                        player.hp = Math.max(0, player.hp - 1.0);
                    }
                    if (Math.random() < 0.25) {
                        createExplosion(player.x, player.y, 4, '#ef4444');
                        if (typeof soundManager !== 'undefined') {
                            soundManager.playHit();
                        }
                    }
                    if (player.hp <= 0) {
                        triggerGameOver(false);
                        return;
                    }
                }
            }

            // Enemies contact
            enemies.forEach(e => {
                if (e.hp > 0) {
                    const distEnemy = Math.hypot(e.x - tailRotorWorld.x, e.y - tailRotorWorld.y);
                    if (distEnemy < 28) {
                        applyDamageToEnemy(e, 1.2);
                        e.alert = true;
                        e.alertCooldown = 300;
                        e.hitTimer = 2;
                    }
                }
            });
        }
    }

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
    
    const isEn = (window.__gameLang === 'en');
    const label = document.getElementById('blind-label');
    if (label) {
        if (blindActive) {
            label.innerText = isEn ? "BLIND ZONE ACTIVE [SPACE]" : "盲区开启中 [SPACE]";
            label.style.color = "#FF3344";
        } else {
            label.innerText = isEn ? "BLIND ZONE [SPACE]" : "盲区能量 [SPACE]";
            label.style.color = "#00FF66";
        }
    }

    const waveTitle = document.getElementById('wave-title');
    if (waveTitle) waveTitle.innerText = isEn ? `WAVE: ${wave}` : `波次: ${wave}`;

    const enemiesLeft = document.getElementById('enemies-left');
    if (enemiesLeft) enemiesLeft.innerText = aliveCount > 0 ? (isEn ? `HOSTILES: ${aliveCount}` : `剩余敌人: ${aliveCount}`) : (isEn ? "NEXT WAVE INCOMING..." : "下一波即将到来...");

    const scoreCount = document.getElementById('score-count');
    if (scoreCount) scoreCount.innerText = isEn ? `KILLS: ${killCount}` : `击杀数: ${killCount}`;
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
        } else if (levelId === 'level0_test') {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.fillStyle = 'rgba(14, 165, 233, 0.04)';
        } else if (levelId === 'level5_hotel' || levelId === 'level4_test') {
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
            ctx.fillStyle = 'rgba(236, 72, 153, 0.015)';
        } else if (levelId === 'level4_yacht') {
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
            ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
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
        ctx.strokeStyle = levelId === 'level1_airport' ? 'rgba(0,255,102,0.4)' : (levelId === 'level0_test' ? 'rgba(56,189,248,0.6)' : ((levelId === 'level5_hotel' || levelId === 'level4_test') ? 'rgba(236,72,153,0.6)' : (levelId === 'level4_yacht' ? 'rgba(6,182,212,0.5)' : (levelId === 'level2_subway' ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.4)'))));
        ctx.lineWidth = 0.8;
        ctx.setLineDash([]);
        ctx.strokeRect(badgeX - 5, labelY - 8, txtW + 10, 12);

        ctx.fillStyle = levelId === 'level1_airport' ? '#00FF66' : (levelId === 'level0_test' ? '#38BDF8' : ((levelId === 'level5_hotel' || levelId === 'level4_test') ? '#F43F5E' : (levelId === 'level4_yacht' ? '#06B6D4' : (levelId === 'level2_subway' ? '#FBBF24' : '#93C5FD'))));
        ctx.textAlign = align;
        ctx.fillText(z.name, labelX, labelY);
        ctx.restore();
    });
}

function drawPropTagLabel(p) {
    if (p.hideLabel) return;
    const text = p.displayName !== undefined ? p.displayName : p.label;
    if (!text) return;

    ctx.save();

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

    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    const limitWidth = levelId === 'level4_yacht' ? (window.level4MapWidth || 2400) : (levelId === 'level0_test' ? (window.level0MapWidth || 7200) : width);
    tagX = Math.max(4, Math.min(limitWidth - txtW - 6, tagX));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(tagX - 4, tagY - 7, txtW + 8, 10);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(tagX - 4, tagY - 7, txtW + 8, 10);

    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.fillText(text, tagX, tagY);

    ctx.restore();
}

function drawProps() {
    props.forEach(p => {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(p.x, p.y, p.w || 1, p.h || 1)) {
            return;
        }
        const camX = window.cameraX || 0;
        if (p.x + (p.w || 50) < camX - 150 || p.x > camX + width + 150) {
            return;
        }
        ctx.save();
        const lbl = (p.label || '').toUpperCase();

        const currentLevelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
        const isHotelLevel = (currentLevelId === 'level0_test' || currentLevelId === 'level5_hotel');

        if (p.type === 'baggage_cart' || (isHotelLevel && (lbl.includes('BAGGAGE CART') || lbl.includes('LUGGAGE CART') || lbl.includes('行李车')))) {
            // Executive Grand Hotel Bellman Trolley (Birdcage Brass Baggage Cart)
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // 1. Rubber-tired brass castor wheels at 4 corners
            const wheelSize = Math.max(4, Math.min(6, Math.min(p.w, p.h) * 0.22));
            ctx.fillStyle = '#0f172a'; // rubber tire
            ctx.fillRect(p.x, p.y, wheelSize, wheelSize);
            ctx.fillRect(p.x + p.w - wheelSize, p.y, wheelSize, wheelSize);
            ctx.fillRect(p.x, p.y + p.h - wheelSize, wheelSize, wheelSize);
            ctx.fillRect(p.x + p.w - wheelSize, p.y + p.h - wheelSize, wheelSize, wheelSize);
            ctx.fillStyle = '#f59e0b'; // brass hub
            ctx.fillRect(p.x + 1, p.y + 1, wheelSize - 2, wheelSize - 2);
            ctx.fillRect(p.x + p.w - wheelSize + 1, p.y + 1, wheelSize - 2, wheelSize - 2);
            ctx.fillRect(p.x + 1, p.y + p.h - wheelSize + 1, wheelSize - 2, wheelSize - 2);
            ctx.fillRect(p.x + p.w - wheelSize + 1, p.y + p.h - wheelSize + 1, wheelSize - 2, wheelSize - 2);

            // 2. Base platform deck: Rich Crimson Velvet Carpet
            const deckPad = 2;
            ctx.fillStyle = '#881337'; // Deep hotel velvet crimson
            ctx.fillRect(p.x + deckPad, p.y + deckPad, p.w - deckPad * 2, p.h - deckPad * 2);

            // 3. Heavy Polished Brass Bumper Rail
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.0;
            ctx.strokeRect(p.x + deckPad, p.y + deckPad, p.w - deckPad * 2, p.h - deckPad * 2);

            // Inner gold trim thread
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(p.x + deckPad + 2, p.y + deckPad + 2, p.w - deckPad * 2 - 4, p.h - deckPad * 2 - 4);

            // 4. Stacked Vintage Luxury Suitcases on the platform deck
            // Trunk 1 (Rich Mahogany Leather)
            ctx.fillStyle = '#78350f';
            ctx.fillRect(p.x + 4, p.y + 4, p.w * 0.44, p.h - 8);
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 4, p.y + 4, p.w * 0.44, p.h - 8);
            ctx.fillStyle = '#d97706';
            ctx.fillRect(p.x + 4 + p.w * 0.18, p.y + 4, p.w * 0.08, p.h - 8);

            // Suitcase 2 (Deep Navy Blue)
            ctx.fillStyle = '#1e3a8a';
            ctx.fillRect(p.x + p.w * 0.51, p.y + 5, p.w * 0.42, p.h - 10);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + p.w * 0.51, p.y + 5, p.w * 0.42, p.h - 10);

            // 5. Birdcage Canopy Tubular Brass Frame (Top-down view)
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(p.x + p.w / 2, p.y + 2);
            ctx.lineTo(p.x + p.w / 2, p.y + p.h - 2);
            ctx.moveTo(p.x + 2, p.y + p.h / 2);
            ctx.lineTo(p.x + p.w - 2, p.y + p.h / 2);
            ctx.stroke();

            // Corner vertical brass support posts
            ctx.fillStyle = '#fde047';
            ctx.beginPath(); ctx.arc(p.x + 3, p.y + 3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(p.x + p.w - 3, p.y + 3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(p.x + 3, p.y + p.h - 3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(p.x + p.w - 3, p.y + p.h - 3, 2, 0, Math.PI * 2); ctx.fill();

            // Center Top Ring / Finial Knob
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 1.2, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'display_cabinet' || lbl.includes('DISPLAY CABINET') || lbl.includes('SHOWCASE') || lbl.includes('VIP DISPLAY')) {
            // Executive Glass Display Cabinet for VIP Salon
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // Rich Mahogany Frame Base
            ctx.fillStyle = '#2c1a04';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#d97706'; 
            ctx.lineWidth = 1.8;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Glass Enclosure Window Interior
            const glassPad = 2;
            const gx = p.x + glassPad;
            const gy = p.y + glassPad;
            const gw = p.w - glassPad * 2;
            const gh = p.h - glassPad * 2;

            // Black mirrored interior background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(gx, gy, gw, gh);

            // Illuminated LED Spotlights (2 LED lights glowing from top edge)
            const ledGrad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
            ledGrad.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
            ledGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.18)');
            ledGrad.addColorStop(1, 'rgba(253, 224, 71, 0.05)');
            ctx.fillStyle = ledGrad;
            ctx.fillRect(gx, gy, gw, gh);

            // Glass Shelves (translucent icy blue horizontal shelf line)
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gx + 2, gy + gh * 0.45);
            ctx.lineTo(gx + gw - 2, gy + gh * 0.45);
            ctx.stroke();

            // Displayed Antiques / Treasures on Showcase Shelves:
            // 1. Golden Trophy / Antique Brass Urn (Left)
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(gx + gw * 0.12, gy + 3, 5, gh - 6);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(gx + gw * 0.12 + 1, gy + 4, 3, 2);

            // 2. Crystal Decanter with Fine Wine (Center)
            ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.fillRect(gx + gw * 0.42, gy + 2, 6, gh - 4);
            ctx.fillStyle = '#ef4444'; // Red wine inside crystal bottle
            ctx.fillRect(gx + gw * 0.42 + 1, gy + gh * 0.4, 4, gh * 0.45);

            // 3. Vintage Porcelain Vase (Right)
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(gx + gw * 0.72, gy + 3, 5, gh - 6);
            ctx.fillStyle = '#2563eb'; // Blue porcelain pattern
            ctx.fillRect(gx + gw * 0.72 + 1, gy + gh * 0.3, 3, 3);

            // Diagonal Glass Door Glare / Reflection across cabinet
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + gw * 0.35, gy);
            ctx.lineTo(gx, gy + gh);
            ctx.closePath();
            ctx.fill();

            // Brass Frame Trim & Center Door Split
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1;
            ctx.strokeRect(gx, gy, gw, gh);
            ctx.beginPath();
            ctx.moveTo(gx + gw / 2, gy);
            ctx.lineTo(gx + gw / 2, gy + gh);
            ctx.stroke();

            // Brass Door Handles
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(gx + gw / 2 - 2, gy + gh / 2 - 2, 1.5, 4);
            ctx.fillRect(gx + gw / 2 + 0.5, gy + gh / 2 - 2, 1.5, 4);

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'key_rack' || lbl.includes('KEY RACK') || lbl.includes('KEY CABINET') || lbl.includes('CONCIERGE KEY')) {
            // Grand Hotel Front Desk Concierge Room Key & Mail Cabinet
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // Rich mahogany cabinet backing
            ctx.fillStyle = '#2c1a04';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#d97706'; 
            ctx.lineWidth = 1.8;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Top Header: Engraved Brass Plate "KEYS"
            const headerH = Math.min(6, p.h * 0.25);
            ctx.fillStyle = '#b45309';
            ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, headerH);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, headerH);

            // Pigeonhole grid for Room Keys
            const gridY = p.y + 2 + headerH + 1;
            const gridH = p.h - headerH - 5;
            const cols = Math.max(2, Math.floor((p.w - 4) / 5));
            const rows = Math.max(2, Math.floor(gridH / 5));
            const cellW = (p.w - 4) / cols;
            const cellH = gridH / rows;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cx = p.x + 2 + c * cellW;
                    const cy = gridY + r * cellH;
                    
                    ctx.fillStyle = '#1c0f03';
                    ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
                    ctx.strokeStyle = '#543f33';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);

                    if ((r + c * 2) % 3 !== 0) {
                        ctx.fillStyle = '#fbbf24';
                        ctx.fillRect(cx + cellW * 0.3, cy + cellH * 0.2, 1.5, Math.max(2, cellH * 0.5));
                        ctx.fillStyle = '#dc2626';
                        ctx.fillRect(cx + cellW * 0.5, cy + cellH * 0.3, 2, Math.max(2, cellH * 0.4));
                    }
                }
            }
            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'luggage_stack' || lbl.includes('LUGGAGE STACK') || lbl.includes('行李堆叠') || lbl.includes('LUGGAGE RACK') || lbl.includes('行李架')) {
            // High-fidelity hotel luggage storage rack & stacked leather trunks
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // Heavy dark teak/mahogany luggage rack frame
            ctx.fillStyle = '#2c1a04';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#b45309'; 
            ctx.lineWidth = 1.6;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Parallel brass rack slats/bars
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 0.8;
            for (let sy = p.y + 4; sy < p.y + p.h - 3; sy += 5) {
                ctx.beginPath();
                ctx.moveTo(p.x + 2, sy);
                ctx.lineTo(p.x + p.w - 2, sy);
                ctx.stroke();
            }

            // Stacked luxury trunks/suitcases on top of the rack
            if (p.w >= 24) {
                const t1w = p.w * 0.46;
                const t1h = p.h - 6;
                ctx.fillStyle = '#7f1d1d'; // Crimson leather trunk
                ctx.fillRect(p.x + 3, p.y + 3, t1w, t1h);
                ctx.strokeStyle = '#991b1b';
                ctx.strokeRect(p.x + 3, p.y + 3, t1w, t1h);
                // Leather straps across trunk A
                ctx.fillStyle = '#451a03';
                ctx.fillRect(p.x + 3 + t1w * 0.25, p.y + 3, 2.5, t1h);
                ctx.fillRect(p.x + 3 + t1w * 0.70, p.y + 3, 2.5, t1h);
                // Brass corner caps
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(p.x + 3, p.y + 3, 3, 3);
                ctx.fillRect(p.x + 3 + t1w - 3, p.y + 3, 3, 3);
                ctx.fillRect(p.x + 3, p.y + 3 + t1h - 3, 3, 3);
                ctx.fillRect(p.x + 3 + t1w - 3, p.y + 3 + t1h - 3, 3, 3);

                // Trunk B: Navy Blue luxury suitcase
                const t2x = p.x + 3 + t1w + 2;
                const t2w = p.w - (t1w + 8);
                const t2h = p.h - 6;
                if (t2w > 8) {
                    ctx.fillStyle = '#1e3a8a'; // Midnight blue
                    ctx.fillRect(t2x, p.y + 3, t2w, t2h);
                    ctx.strokeStyle = '#3b82f6';
                    ctx.strokeRect(t2x, p.y + 3, t2w, t2h);
                    // Center brass latch
                    ctx.fillStyle = '#f59e0b';
                    ctx.fillRect(t2x + t2w / 2 - 2, p.y + 3 + t2h / 2 - 2, 4, 4);
                }
            }
            ctx.restore();
            drawPropTagLabel(p);

        } else if (lbl.includes('TRAIN')) {
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

        } else if (lbl.includes('TV') || lbl.includes('TELEVISION')) {
            // High-fidelity wall-mounted TV
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);

            ctx.fillStyle = '#0f172a'; // Matte black bezel
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#475569'; // Charcoal border
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Glowing blue screen
            ctx.fillStyle = '#0f172a'; // Screen glass
            ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
            
            const tvGrad = ctx.createLinearGradient(p.x + 3, p.y + 3, p.x + 3, p.y + p.h - 3);
            tvGrad.addColorStop(0, '#0284c7');
            tvGrad.addColorStop(0.5, '#06b6d4');
            tvGrad.addColorStop(1, '#0284c7');
            ctx.fillStyle = tvGrad;
            ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);

            // Reflection line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x + 4, p.y + 4);
            ctx.lineTo(p.x + p.w - 4, p.y + p.h - 4);
            ctx.stroke();

            // Status LED
            ctx.fillStyle = '#00FF66';
            ctx.beginPath();
            ctx.arc(p.x + p.w - 8, p.y + p.h - 6, 1.2, 0, Math.PI * 2);
            ctx.fill();

            drawPropTagLabel(p);

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

            const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
            if (levelId === 'level4_yacht') {
                // Luxury Yacht Bar Counter with Teak Wood, cocktails, and stools!
                ctx.fillStyle = '#7c2d12'; // Warm mahogany wood base
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#a16207'; // Polished gold/wood edge
                ctx.lineWidth = 1.8;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                // Shiny polished countertop overlay
                ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
                ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);

                // Cocktail glasses / bottles on the counter
                // Cocktail A (Teal drink with lemon)
                ctx.fillStyle = '#06b6d4';
                ctx.beginPath(); ctx.arc(p.x + 12, p.y + p.h/2, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fef08a'; // lemon wedge
                ctx.fillRect(p.x + 14, p.y + p.h/2 - 2, 1.5, 1.5);

                // Cocktail B (Cherry red drink)
                ctx.fillStyle = '#f43f5e';
                ctx.beginPath(); ctx.arc(p.x + p.w - 12, p.y + p.h/2, 2.5, 0, Math.PI * 2); ctx.fill();

                // 3 Bar Stools aligned (either above or below the counter depending on Y coordinate!)
                const stoolsBelow = (p.y < 350);
                const stoolY = stoolsBelow ? (p.y + p.h + 8) : (p.y - 8);

                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1;
                const stoolCount = 3;
                const stoolStep = p.w / (stoolCount + 1);
                for (let i = 1; i <= stoolCount; i++) {
                    const stoolX = p.x + i * stoolStep;
                    // Draw stool leg line
                    ctx.beginPath();
                    ctx.moveTo(stoolX, p.y + p.h / 2);
                    ctx.lineTo(stoolX, stoolY);
                    ctx.stroke();

                    // Draw circular stool seat (luxury red leather)
                    ctx.fillStyle = '#991b1b'; // Red leather seat
                    ctx.beginPath();
                    ctx.arc(stoolX, stoolY, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.stroke();
                }
            } else {
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
            }

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

        } else if (p.type === 'bed' || lbl.includes('BED')) {
            // High-fidelity bed drawing (Standard vs Luxury with 4-way orientation support)
            // 1. Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            const isLuxury = lbl.includes('OWNER') || lbl.includes('MASTER') || lbl.includes('GUEST') || lbl.includes('VIP') || lbl.includes('KING') || lbl.includes('豪华') || lbl.includes('欧式');
            
            // 2. Bed Base (Teak wood frame for staff, rich royal mahogany wood for luxury)
            ctx.fillStyle = isLuxury ? '#2a1205' : '#78350f'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = isLuxury ? '#d97706' : '#451a03';
            ctx.lineWidth = isLuxury ? 2 : 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 3. Mattress / Bed Sheet (Clean white for staff, premium silk ivory/champagne for luxury)
            ctx.fillStyle = isLuxury ? '#fdfbf7' : '#f8fafc'; 
            ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);

            // Determine facing
            let face = p.facing || 'up';

            if (face === 'left') {
                // Headboard on the left
                if (isLuxury) {
                    ctx.fillStyle = '#3b1a0e';
                    ctx.fillRect(p.x - 2, p.y - 1, 5, p.h + 2);
                    ctx.strokeStyle = '#d97706';
                    ctx.strokeRect(p.x - 2, p.y - 1, 5, p.h + 2);

                    // Two luxury pillows
                    ctx.fillStyle = '#f1f5f9';
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    const pillH = (p.h - 10) / 2;
                    ctx.fillRect(p.x + 4, p.y + 4, 11, pillH);
                    ctx.strokeRect(p.x + 4, p.y + 4, 11, pillH);
                    ctx.fillRect(p.x + 4, p.y + 6 + pillH, 11, pillH);
                    ctx.strokeRect(p.x + 4, p.y + 6 + pillH, 11, pillH);
                } else {
                    ctx.fillStyle = '#cbd5e1'; 
                    ctx.fillRect(p.x + 4, p.y + 4, 10, p.h - 8);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.strokeRect(p.x + 4, p.y + 4, 10, p.h - 8);
                }

                // 5. Folded Blanket / Duvet (Burgundy / Royal Wine Red silk for luxury)
                const blanketColor = isLuxury ? '#7f1d1d' : '#1e3a8a';
                ctx.fillStyle = blanketColor;
                ctx.fillRect(p.x + p.w - 20, p.y + 2, 18, p.h - 4);
                if (isLuxury) {
                    // Golden elegant details on royal wine red blanket
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(p.x + p.w - 16, p.y + 4, 2, p.h - 8);
                    ctx.fillRect(p.x + p.w - 10, p.y + 4, 2, p.h - 8);
                } else {
                    ctx.fillStyle = '#3b82f6';
                    ctx.fillRect(p.x + p.w - 14, p.y + 4, 3, p.h - 8);
                }
            } else if (face === 'right') {
                // Headboard on the right
                if (isLuxury) {
                    ctx.fillStyle = '#3b1a0e';
                    ctx.fillRect(p.x + p.w - 3, p.y - 1, 5, p.h + 2);
                    ctx.strokeStyle = '#d97706';
                    ctx.strokeRect(p.x + p.w - 3, p.y - 1, 5, p.h + 2);

                    ctx.fillStyle = '#f1f5f9';
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    const pillH = (p.h - 10) / 2;
                    ctx.fillRect(p.x + p.w - 15, p.y + 4, 11, pillH);
                    ctx.strokeRect(p.x + p.w - 15, p.y + 4, 11, pillH);
                    ctx.fillRect(p.x + p.w - 15, p.y + 6 + pillH, 11, pillH);
                    ctx.strokeRect(p.x + p.w - 15, p.y + 6 + pillH, 11, pillH);
                } else {
                    ctx.fillStyle = '#cbd5e1'; 
                    ctx.fillRect(p.x + p.w - 14, p.y + 4, 10, p.h - 8);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.strokeRect(p.x + p.w - 14, p.y + 4, 10, p.h - 8);
                }

                const blanketColor = isLuxury ? '#7f1d1d' : '#1e3a8a';
                ctx.fillStyle = blanketColor;
                ctx.fillRect(p.x + 2, p.y + 2, 18, p.h - 4);
                if (isLuxury) {
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(p.x + 6, p.y + 4, 2, p.h - 8);
                    ctx.fillRect(p.x + 12, p.y + 4, 2, p.h - 8);
                } else {
                    ctx.fillStyle = '#3b82f6';
                    ctx.fillRect(p.x + 6, p.y + 4, 3, p.h - 8);
                }
            } else if (face === 'down') {
                if (isLuxury) {
                    ctx.fillStyle = '#3b1a0e';
                    ctx.fillRect(p.x - 1, p.y + p.h - 2, p.w + 2, 5);
                    ctx.strokeStyle = '#d97706';
                    ctx.strokeRect(p.x - 1, p.y + p.h - 2, p.w + 2, 5);

                    ctx.fillStyle = '#f1f5f9';
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    const pillW = (p.w - 10) / 2;
                    ctx.fillRect(p.x + 4, p.y + p.h - 15, pillW, 11);
                    ctx.strokeRect(p.x + 4, p.y + p.h - 15, pillW, 11);
                    ctx.fillRect(p.x + 6 + pillW, p.y + p.h - 15, pillW, 11);
                    ctx.strokeRect(p.x + 6 + pillW, p.y + p.h - 15, pillW, 11);
                } else {
                    ctx.fillStyle = '#cbd5e1'; 
                    ctx.fillRect(p.x + 4, p.y + p.h - 14, p.w - 8, 10);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.strokeRect(p.x + 4, p.y + p.h - 14, p.w - 8, 10);
                }

                const blanketColor = isLuxury ? '#7f1d1d' : '#1e3a8a';
                ctx.fillStyle = blanketColor;
                ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 18);
                if (isLuxury) {
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(p.x + 4, p.y + 6, p.w - 8, 2);
                    ctx.fillRect(p.x + 4, p.y + 12, p.w - 8, 2);
                } else {
                    ctx.fillStyle = '#3b82f6';
                    ctx.fillRect(p.x + 4, p.y + 6, p.w - 8, 3);
                }
            } else {
                if (isLuxury) {
                    ctx.fillStyle = '#3b1a0e';
                    ctx.fillRect(p.x - 1, p.y - 3, p.w + 2, 5);
                    ctx.strokeStyle = '#d97706';
                    ctx.strokeRect(p.x - 1, p.y - 3, p.w + 2, 5);

                    ctx.fillStyle = '#f1f5f9';
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    const pillW = (p.w - 10) / 2;
                    ctx.fillRect(p.x + 4, p.y + 4, pillW, 11);
                    ctx.strokeRect(p.x + 4, p.y + 4, pillW, 11);
                    ctx.fillRect(p.x + 6 + pillW, p.y + 4, pillW, 11);
                    ctx.strokeRect(p.x + 6 + pillW, p.y + 4, pillW, 11);
                } else {
                    ctx.fillStyle = '#cbd5e1'; 
                    ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, 10);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, 10);
                }

                const blanketColor = isLuxury ? '#7f1d1d' : '#1e3a8a';
                ctx.fillStyle = blanketColor;
                ctx.fillRect(p.x + 2, p.y + p.h - 20, p.w - 4, 18);
                if (isLuxury) {
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(p.x + 4, p.y + p.h - 16, p.w - 8, 2);
                    ctx.fillRect(p.x + 4, p.y + p.h - 10, p.w - 8, 2);
                } else {
                    ctx.fillStyle = '#3b82f6';
                    ctx.fillRect(p.x + 4, p.y + p.h - 14, p.w - 8, 3);
                }
            }

            drawPropTagLabel(p);

        } else if (p.type === 'elevator' || lbl.includes('ELEVATOR') || lbl.includes('电梯')) {
            // High-fidelity luxury brass & marble hotel elevator cab
            ctx.save();
            
            // 1. Drop Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);
            
            // Outer Elevator Cab Frame (Polished dark mahogany & brass border)
            ctx.fillStyle = '#1e1b18';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#d97706'; // Gold outer trim
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Cab Floor Interior (Dark granite floor with brass inlay)
            ctx.fillStyle = '#292524';
            ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
            ctx.strokeStyle = '#78350f';
            ctx.strokeRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10);

            // Brass Handrails inside cab
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(p.x + 6, p.y + 6, p.w - 12, 2); // North rail
            ctx.fillRect(p.x + 6, p.y + 6, 2, p.h - 12); // West rail
            ctx.fillRect(p.x + p.w - 8, p.y + 6, 2, p.h - 12); // East rail

            // Sliding Brushed Steel Doors (Split doors with center gap)
            const doorW = (p.w - 12) / 2;
            const doorH = p.h - 10;
            
            // Left Door
            ctx.fillStyle = '#475569';
            ctx.fillRect(p.x + 6, p.y + 5, doorW, doorH);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x + 6, p.y + 5, doorW, doorH);

            // Right Door
            ctx.fillStyle = '#475569';
            ctx.fillRect(p.x + 6 + doorW, p.y + 5, doorW, doorH);
            ctx.strokeRect(p.x + 6 + doorW, p.y + 5, doorW, doorH);

            // Door Center Seam & Glint Line
            ctx.strokeStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.moveTo(p.x + 6 + doorW, p.y + 5);
            ctx.lineTo(p.x + 6 + doorW, p.y + 5 + doorH);
            ctx.stroke();

            // Elevator Header Floor Indicator Box (Display: "1F ▲")
            const indW = Math.min(36, p.w - 12);
            const indH = 8;
            const indX = p.x + (p.w - indW) / 2;
            const indY = p.y + 1;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(indX, indY, indW, indH);
            ctx.strokeStyle = '#b45309';
            ctx.strokeRect(indX, indY, indW, indH);

            // Green LED text "1F ▲"
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('1F ▲', indX + indW / 2, indY + indH / 2);

            // Call button panel on the right outer frame
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(p.x + p.w - 4, p.y + p.h / 2 - 4, 3, 8);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(p.x + p.w - 3, p.y + p.h / 2 - 3, 1, 2);

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'sofa' || lbl.includes('SOFA') || lbl.includes('CHAIR') || lbl.includes('COUCH')) {
            // High-fidelity luxury leather sofa drawing
            // 1. Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);

            // 2. Base cushion / main couch body color selection
            const isWhite = (p.color === 'white' || (lbl.includes('WHITE') && p.color !== 'brown') || (lbl.includes('CHAIR') && !lbl.includes('STUDY') && p.color !== 'brown')) && !lbl.includes('OWNER') && !lbl.includes('MASTER') && !lbl.includes('VIP');
            const baseColor = isWhite ? '#f8fafc' : '#451a03'; // White leather vs Dark brown leather
            const strokeColor = isWhite ? '#cbd5e1' : '#d97706'; // Slate vs Golden brown stitching
            const accentColor = isWhite ? '#e2e8f0' : '#78350f'; // Shaded backrest/armrest

            ctx.fillStyle = baseColor;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 3. Backrest & Armrest depending on custom facing orientation
            let face = p.facing;
            if (!face) {
                face = (p.w >= p.h) ? 'down' : 'right'; // fallback
            }

            ctx.fillStyle = accentColor;
            if (face === 'down') {
                // Backrest at top, arms on left/right
                ctx.fillRect(p.x, p.y, p.w, 4); // backrest
                ctx.strokeRect(p.x, p.y, p.w, 4);
                ctx.fillRect(p.x, p.y, 4, p.h); // left arm
                ctx.strokeRect(p.x, p.y, 4, p.h);
                ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h); // right arm
                ctx.strokeRect(p.x + p.w - 4, p.y, 4, p.h);

                // Cushion split line
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x + p.w / 2, p.y + 4);
                ctx.lineTo(p.x + p.w / 2, p.y + p.h);
                ctx.stroke();
            } else if (face === 'up') {
                // Backrest at bottom, arms on left/right
                ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4); // backrest
                ctx.strokeRect(p.x, p.y + p.h - 4, p.w, 4);
                ctx.fillRect(p.x, p.y, 4, p.h); // left arm
                ctx.strokeRect(p.x, p.y, 4, p.h);
                ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h); // right arm
                ctx.strokeRect(p.x + p.w - 4, p.y, 4, p.h);

                // Cushion split line
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x + p.w / 2, p.y);
                ctx.lineTo(p.x + p.w / 2, p.y + p.h - 4);
                ctx.stroke();
            } else if (face === 'right') {
                // Backrest at left, arms on top/bottom
                ctx.fillRect(p.x, p.y, 4, p.h); // backrest
                ctx.strokeRect(p.x, p.y, 4, p.h);
                ctx.fillRect(p.x, p.y, p.w, 4); // top arm
                ctx.strokeRect(p.x, p.y, p.w, 4);
                ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4); // bottom arm
                ctx.strokeRect(p.x, p.y + p.h - 4, p.w, 4);

                // Cushion split line
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x + 4, p.y + p.h / 2);
                ctx.lineTo(p.x + p.w, p.y + p.h / 2);
                ctx.stroke();
            } else if (face === 'left') {
                // Backrest at right, arms on top/bottom
                ctx.fillRect(p.x + p.w - 4, p.y, 4, p.h); // backrest
                ctx.strokeRect(p.x + p.w - 4, p.y, 4, p.h);
                ctx.fillRect(p.x, p.y, p.w, 4); // top arm
                ctx.strokeRect(p.x, p.y, p.w, 4);
                ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4); // bottom arm
                ctx.strokeRect(p.x, p.y + p.h - 4, p.w, 4);

                // Cushion split line
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y + p.h / 2);
                ctx.lineTo(p.x + p.w - 4, p.y + p.h / 2);
                ctx.stroke();
            }

            // 4. Luxurious decorative details for high-end owner/master/VIP sofas
            const isLuxurySofa = lbl.includes('STUDY') || lbl.includes('OWNER') || lbl.includes('MASTER') || lbl.includes('VIP');
            if (isLuxurySofa) {
                // Button tufting / stitching pattern on the cushions
                ctx.fillStyle = '#1c0a00'; // Dark leather tuft button
                ctx.strokeStyle = '#d97706'; // Golden stitch circle
                ctx.lineWidth = 0.5;

                // Tufting positions based on size
                if (p.w > p.h) {
                    // Horizontal sofa
                    const tuftCount = p.w > 80 ? 4 : 2;
                    const step = p.w / (tuftCount + 1);
                    for (let i = 1; i <= tuftCount; i++) {
                        const tx = p.x + i * step;
                        const ty = p.y + p.h / 2;
                        ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    }
                } else {
                    // Vertical sofa
                    const tuftCount = p.h > 80 ? 4 : 2;
                    const step = p.h / (tuftCount + 1);
                    for (let i = 1; i <= tuftCount; i++) {
                        const tx = p.x + p.w / 2;
                        const ty = p.y + i * step;
                        ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    }
                }

                // Add unique colorful throw pillows to make each room's sofa look different!
                if (lbl.includes('MASTER') && lbl.includes('LONG')) {
                    // Master Long Couch gets two gold silk throw pillows at both ends
                    ctx.fillStyle = '#fbbf24'; // Gold
                    ctx.strokeStyle = '#d97706';
                    ctx.lineWidth = 1;
                    // Pillow Left
                    ctx.fillRect(p.x + 8, p.y + 6, 10, 10);
                    ctx.strokeRect(p.x + 8, p.y + 6, 10, 10);
                    // Pillow Right
                    ctx.fillRect(p.x + p.w - 18, p.y + 6, 10, 10);
                    ctx.strokeRect(p.x + p.w - 18, p.y + 6, 10, 10);
                } else if (lbl.includes('MASTER')) {
                    // Master couch gets a single crimson red throw pillow
                    ctx.fillStyle = '#ef4444'; // Crimson
                    ctx.strokeStyle = '#b91c1c';
                    ctx.lineWidth = 1;
                    if (p.w > p.h) {
                        ctx.fillRect(p.x + p.w/2 - 5, p.y + 6, 10, 10);
                        ctx.strokeRect(p.x + p.w/2 - 5, p.y + 6, 10, 10);
                    } else {
                        ctx.fillRect(p.x + 6, p.y + p.h/2 - 5, 10, 10);
                        ctx.strokeRect(p.x + 6, p.y + p.h/2 - 5, 10, 10);
                    }
                } else if (lbl.includes('VIP')) {
                    // VIP couch gets an emerald green silk throw pillow
                    ctx.fillStyle = '#10b981'; // Emerald
                    ctx.strokeStyle = '#047857';
                    ctx.lineWidth = 1;
                    if (p.w > p.h) {
                        ctx.fillRect(p.x + p.w/2 - 5, p.y + 6, 10, 10);
                        ctx.strokeRect(p.x + p.w/2 - 5, p.y + 6, 10, 10);
                    } else {
                        ctx.fillRect(p.x + 6, p.y + p.h/2 - 5, 10, 10);
                        ctx.strokeRect(p.x + 6, p.y + p.h/2 - 5, 10, 10);
                    }
                } else if (lbl.includes('STUDY')) {
                    // Study chairs are rounded executive armchairs!
                    ctx.strokeStyle = '#fbbf24'; // Shiny gold rivets
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    if (face === 'right') {
                        ctx.arc(p.x + 4, p.y + p.h/2, p.h/3, -Math.PI/2, Math.PI/2);
                    } else {
                        ctx.arc(p.x + p.w - 4, p.y + p.h/2, p.h/3, Math.PI/2, -Math.PI/2);
                    }
                    ctx.stroke();
                }
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

        } else if (lbl.includes('WARDROBE') || lbl.includes('CLOSET') || lbl.includes('CABINET') || lbl.includes('SUPPLIES')) {
            // High-fidelity luxury wardrobe/closet with clothes, hangers, and shelves of daily supplies
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // 1. Solid Mahogany/Teak wood outer body
            ctx.fillStyle = '#2c1a04'; // Deep luxurious wood
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#d97706'; // Golden wood-grain/brass trim
            ctx.lineWidth = 1.8;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // 2. Wardrobe split into clothes-hanging bay (left) and shelves bay (right)
            const dividerX = p.x + p.w * 0.58;
            ctx.strokeStyle = '#543f33';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dividerX, p.y);
            ctx.lineTo(dividerX, p.y + p.h);
            ctx.stroke();

            // === LEFT BAY: CLOTHES AND HANGERS ===
            // Hanging rod
            ctx.strokeStyle = '#94a3b8'; // Metal hanger pole
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x + 6, p.y + p.h/2);
            ctx.lineTo(dividerX - 4, p.y + p.h/2);
            ctx.stroke();

            // Hanging clothes
            const garmentColors = ['#ef4444', '#3b82f6', '#10b981', '#fbbf24', '#ec4899', '#f8fafc'];
            let currentCX = p.x + 10;
            const leftLimit = dividerX - 8;
            let index = 0;
            while (currentCX < leftLimit) {
                // Little hanger hook (thin curved grey stroke above rod)
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(currentCX, p.y + p.h/2 - 2, 1.8, Math.PI, 0);
                ctx.stroke();

                // Colored garment rect below rod
                ctx.fillStyle = garmentColors[index % garmentColors.length];
                ctx.fillRect(currentCX - 3, p.y + p.h/2 + 1, 6, p.h * 0.45);
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(currentCX - 3, p.y + p.h/2 + 1, 6, p.h * 0.45);

                currentCX += 10;
                index++;
            }

            // === RIGHT BAY: SHELVES & FOLDED LINENS ===
            // 2 Stacked supply sections on right side
            // Horizontal shelf divider
            ctx.strokeStyle = '#543f33';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dividerX, p.y + p.h/2);
            ctx.lineTo(p.x + p.w, p.y + p.h/2);
            ctx.stroke();

            // Shelf 1 (Top-Right): Neatly folded white/cream luxury bath towels
            ctx.fillStyle = '#f8fafc'; // Ivory towels
            ctx.fillRect(dividerX + 4, p.y + 3, p.w * 0.3, 3);
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(dividerX + 4, p.y + 7, p.w * 0.3, 3);

            // Shelf 2 (Bottom-Right): Neatly folded silk lavender/blue linens
            ctx.fillStyle = '#bae6fd'; // Light blue sheets
            ctx.fillRect(dividerX + 4, p.y + p.h/2 + 3, p.w * 0.3, 3);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(dividerX + 4, p.y + p.h/2 + 7, p.w * 0.3, 3);

            // 3. Sliding Glass reflection overlay & handles
            // Elegant gold sliding door handles
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(p.x + p.w/2 - 3, p.y + 4, 1.5, p.h - 8);
            ctx.fillRect(p.x + p.w/2 + 1.5, p.y + 4, 1.5, p.h - 8);

            // Diagonal high-gloss glass reflection lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x + 8, p.y + 2);
            ctx.lineTo(p.x + p.w - 8, p.y + p.h - 2);
            ctx.stroke();

            drawPropTagLabel(p);

        } else if (p.type === 'stair' || p.type === 'stairs' || lbl.includes('STAIR') || lbl.includes('楼梯') || lbl.includes('STEP')) {
            // Elegant wooden stairs
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
            ctx.fillStyle = '#341a04'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#1e0c02';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            const stepCount = Math.max(4, Math.floor(p.h / 14));
            const stepH = p.h / stepCount;
            for (let i = 0; i < stepCount; i++) {
                const sy = p.y + i * stepH;
                ctx.fillStyle = i % 2 === 0 ? '#512d11' : '#45220c';
                ctx.fillRect(p.x, sy, p.w, stepH);
                ctx.fillStyle = '#fbbf24'; 
                ctx.fillRect(p.x, sy + stepH - 1.5, p.w, 1.5);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(p.x, sy, p.w, 1.5);
            }
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x + p.w/2, p.y + p.h - 10);
            ctx.lineTo(p.x + p.w/2, p.y + 10);
            ctx.stroke();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(p.x + p.w/2 - 4, p.y + 14);
            ctx.lineTo(p.x + p.w/2, p.y + 8);
            ctx.lineTo(p.x + p.w/2 + 4, p.y + 14);
            ctx.closePath();
            ctx.fill();
            drawPropTagLabel(p);

        } else if (p.type === 'piano' || lbl.includes('PIANO') || lbl.includes('钢琴')) {
            // High-fidelity Grand Piano
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);
            ctx.fillStyle = '#090d16'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#b45309'; 
            ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 0.5;
            for (let i = p.x + 8; i < p.x + p.w - 8; i += 3) {
                ctx.beginPath();
                ctx.moveTo(i, p.y + 6);
                ctx.lineTo(i, p.y + p.h - 6);
                ctx.stroke();
            }
            ctx.fillStyle = '#1e293b'; 
            ctx.fillRect(p.x, p.y, p.w * 0.22, p.h); 
            ctx.fillRect(p.x, p.y, p.w, p.h * 0.2); 
            const keyH = 8;
            ctx.fillStyle = '#f8fafc'; 
            ctx.fillRect(p.x + 2, p.y + p.h - keyH - 2, p.w - 4, keyH);
            ctx.strokeStyle = '#cbd5e1';
            for (let k = p.x + 5; k < p.x + p.w - 5; k += 4) {
                ctx.beginPath();
                ctx.moveTo(k, p.y + p.h - keyH - 2);
                ctx.lineTo(k, p.y + p.h - 2);
                ctx.stroke();
            }
            ctx.fillStyle = '#020617';
            for (let k = p.x + 7; k < p.x + p.w - 7; k += 8) {
                ctx.fillRect(k - 1, p.y + p.h - keyH - 2, 2, keyH * 0.6);
            }
            ctx.fillStyle = '#78350f';
            ctx.fillRect(p.x + p.w * 0.25, p.y + p.h * 0.35, p.w * 0.5, 2.5);
            ctx.strokeStyle = '#94a3b8';
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            drawPropTagLabel(p);

        } else if (p.type === 'plant' || lbl.includes('PLANT') || lbl.includes('POTTED') || lbl.includes('椰子') || lbl.includes('绿植') || lbl.includes('盆栽')) {
            // Elegant Lobby Potted Plant
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(p.x + p.w/2 + 2, p.y + p.h/2 + 2, Math.min(p.w, p.h)/2, 0, Math.PI * 2);
            ctx.fill();
            const cx = p.x + p.w/2;
            const cy = p.y + p.h/2;
            const radius = Math.min(p.w, p.h) * 0.35;
            ctx.fillStyle = '#c2410c'; 
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#451a03'; 
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#15803d'; 
            ctx.lineWidth = 2.5;
            const leafLength = Math.min(p.w, p.h) * 0.65;
            const angles = [0, Math.PI/3, 2*Math.PI/3, Math.PI, 4*Math.PI/3, 5*Math.PI/3];
            angles.forEach((ang) => {
                const lx = cx + Math.cos(ang) * leafLength;
                const ly = cy + Math.sin(ang) * leafLength;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.quadraticCurveTo(cx + Math.cos(ang + 0.2) * (leafLength * 0.5), cy + Math.sin(ang + 0.2) * (leafLength * 0.5), lx, ly);
                ctx.stroke();
            });
            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();
            drawPropTagLabel(p);

        } else if (p.type === 'toilet' || lbl.includes('TOILET') || lbl.includes('马桶')) {
            // Elegant white ceramic toilet
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);
            ctx.fillStyle = '#f8fafc'; 
            ctx.fillRect(p.x, p.y, p.w, p.h * 0.35);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x, p.y, p.w, p.h * 0.35);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(p.x + 2, p.y + p.h * 0.35, p.w - 4, p.h * 0.65, 8);
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.stroke();
            ctx.fillStyle = '#bae6fd'; 
            ctx.beginPath();
            ctx.roundRect(p.x + 5, p.y + p.h * 0.45, p.w - 10, p.h * 0.45, 6);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();
            drawPropTagLabel(p);

        } else if (p.type === 'sink' || lbl.includes('SINK') || lbl.includes('盥洗台')) {
            // High-fidelity marble vanity with sink
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
            ctx.fillStyle = '#f1f5f9'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + 4); ctx.lineTo(p.x + p.w * 0.4, p.y + p.h);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            const sinkW = p.w * 0.65;
            const sinkH = p.h * 0.55;
            const sinkX = p.x + p.w/2 - sinkW/2;
            const sinkY = p.y + p.h/2 - sinkH/2;
            ctx.beginPath();
            ctx.roundRect(sinkX, sinkY, sinkW, sinkH, 5);
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.stroke();
            ctx.fillStyle = '#bae6fd'; 
            ctx.beginPath();
            ctx.roundRect(sinkX + 2, sinkY + 2, sinkW - 4, sinkH - 4, 3);
            ctx.fill();
            drawPropTagLabel(p);

        } else if (p.type === 'bathtub' || lbl.includes('BATHTUB') || lbl.includes('浴缸') || lbl.includes('浴盆')) {
            // Elegant clawfoot porcelain & brass bathtub
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);
            
            // Outer clawfoot porcelain rim
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h, 10);
            ctx.fill();
            ctx.strokeStyle = '#d97706'; // Gold accent trim
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Inner tub basin (Clear blue water)
            ctx.fillStyle = '#38bdf8'; 
            ctx.beginPath();
            ctx.roundRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10, 6);
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Water shimmer highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.roundRect(p.x + 8, p.y + 7, (p.w - 16) * 0.4, (p.h - 14) * 0.4, 3);
            ctx.fill();

            // Polished brass faucet and taps at top edge
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(p.x + p.w / 2 - 3, p.y + 1, 6, 4);
            ctx.fillStyle = '#d97706';
            ctx.fillRect(p.x + p.w / 2 - 5, p.y + 1, 3, 2);
            ctx.fillRect(p.x + p.w / 2 + 2, p.y + 1, 3, 2);

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'office_chair' || lbl.includes('OFFICE CHAIR') || lbl.includes('办公椅') || lbl.includes('转椅')) {
            // High-fidelity executive hotel reception office chair (Rotatable leather office chair)
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);

            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;

            // 1. Five-star wheeled base (Metal brass/chrome legs)
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.8;
            for (let i = 0; i < 5; i++) {
                const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * (p.w * 0.45), cy + Math.sin(angle) * (p.h * 0.45));
                ctx.stroke();
            }

            // Central Stem
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();

            // 2. Leather Seat Cushion (Rich mahogany / dark brown leather)
            const seatW = p.w * 0.7;
            const seatH = p.h * 0.65;
            ctx.fillStyle = '#451a03';
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(cx - seatW / 2, cy - seatH / 2 + 1, seatW, seatH, 4);
            ctx.fill();
            ctx.stroke();

            // 3. Ergonomic High Backrest (Top end depending on facing or default down)
            const backW = p.w * 0.72;
            const backH = 6;
            let backY = cy - seatH / 2 - 2;
            if (p.facing === 'down') {
                backY = cy - seatH / 2 - 3;
            } else if (p.facing === 'up') {
                backY = cy + seatH / 2 - 3;
            }

            ctx.fillStyle = '#270e02';
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(cx - backW / 2, backY, backW, backH, 2);
            ctx.fill();
            ctx.stroke();

            // Armrests (Left & Right)
            ctx.fillStyle = '#78350f';
            ctx.fillRect(cx - seatW / 2 - 2, cy - 3, 2, 8);
            ctx.fillRect(cx + seatW / 2, cy - 3, 2, 8);

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'reception_desk' || lbl.includes('RECEPTION DESK') || lbl.includes('RECEPTION COUNTER') || lbl.includes('前台')) {
            // High-fidelity luxury hotel mahogany front desk
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // Rich polished mahogany wood texture
            const deskGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
            deskGrad.addColorStop(0, '#5C1D0F'); 
            deskGrad.addColorStop(1, '#300E06'); 
            ctx.fillStyle = deskGrad;
            ctx.fillRect(p.x, p.y, p.w, p.h);

            // Brass inlay outer trim
            ctx.strokeStyle = '#fbbf24'; 
            ctx.lineWidth = 1.4;
            ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);

            const face = p.facing || 'up'; // Default 'up' as staff stands on North side

            if (face === 'up') {
                // Raised guest privacy counter on bottom (facing the lobby/guests)
                ctx.fillStyle = '#451208';
                ctx.fillRect(p.x + 2, p.y + p.h - 4, p.w - 4, 3);
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(p.x + 2, p.y + p.h - 4, p.w - 4, 3);

                // Staff Computer Terminals (Screen facing UP towards receptionist chairs)
                const numStations = p.w > 70 ? 2 : 1;
                for (let i = 0; i < numStations; i++) {
                    const stX = p.w > 70 ? (p.x + p.w * (0.22 + i * 0.48)) : (p.x + p.w * 0.35);
                    
                    // Keyboard on staff side (top)
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(stX - 6, p.y + 2, 12, 3);

                    // Monitor bezel and screen (facing UP toward north)
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(stX - 7, p.y + 6, 14, 3);
                    // Glowing monitor screen edge facing UP
                    ctx.fillStyle = '#06b6d4';
                    ctx.fillRect(stX - 6, p.y + 6, 12, 1.2);
                }

                // Check-in Guest Ledger Book (on left side of desk, oriented toward staff)
                ctx.fillStyle = '#f8fafc'; 
                ctx.fillRect(p.x + 6, p.y + 2.5, 10, 6);
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 0.6;
                ctx.strokeRect(p.x + 6, p.y + 2.5, 10, 6);
                // Golden spine bookmark
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(p.x + 10.5, p.y + 2.5, 1, 6);

                // Classic Black Hotel Telephone on right side (keypad facing up toward staff)
                ctx.fillStyle = '#020617'; 
                ctx.fillRect(p.x + p.w - 18, p.y + 2.5, 9, 6);
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(p.x + p.w - 16, p.y + 3.2, 5, 2); // LCD display facing up

                // Polished Brass Service Call Bell (placed on counter ledge for lobby guests)
                ctx.fillStyle = '#eab308'; 
                ctx.beginPath();
                ctx.arc(p.x + p.w * 0.50, p.y + p.h - 5, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#78350f';
                ctx.fillRect(p.x + p.w * 0.50 - 1.5, p.y + p.h - 3.5, 3, 1.2);

            } else {
                // Default / Downwards facing (staff on bottom, guests on top)
                ctx.fillStyle = '#451208';
                ctx.fillRect(p.x + 2, p.y + 1, p.w - 4, 3);

                ctx.fillStyle = '#0f172a';
                ctx.fillRect(p.x + p.w * 0.35 - 6, p.y + p.h - 5, 12, 3);
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(p.x + p.w * 0.35 - 7, p.y + p.h - 9, 14, 3);
                ctx.fillStyle = '#06b6d4';
                ctx.fillRect(p.x + p.w * 0.35 - 6, p.y + p.h - 7.5, 12, 1.2);

                ctx.fillStyle = '#f8fafc'; 
                ctx.fillRect(p.x + 6, p.y + p.h - 8.5, 10, 6);
                ctx.fillStyle = '#020617'; 
                ctx.fillRect(p.x + p.w - 18, p.y + p.h - 8.5, 9, 6);

                ctx.fillStyle = '#eab308'; 
                ctx.beginPath();
                ctx.arc(p.x + p.w * 0.50, p.y + 4, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'luggage_stack' || lbl.includes('LUGGAGE STACK') || lbl.includes('行李堆叠') || lbl.includes('LUGGAGE RACK') || lbl.includes('行李架')) {
            // High-fidelity hotel luggage storage rack & stacked leather trunks
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // Heavy dark teak/mahogany luggage rack frame
            ctx.fillStyle = '#2c1a04';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#b45309'; 
            ctx.lineWidth = 1.6;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Parallel brass rack slats/bars
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 0.8;
            for (let sy = p.y + 4; sy < p.y + p.h - 3; sy += 5) {
                ctx.beginPath();
                ctx.moveTo(p.x + 2, sy);
                ctx.lineTo(p.x + p.w - 2, sy);
                ctx.stroke();
            }

            // Stacked luxury trunks/suitcases on top of the rack
            if (p.w >= 24) {
                const t1w = p.w * 0.46;
                const t1h = p.h - 6;
                ctx.fillStyle = '#7f1d1d'; // Crimson leather trunk
                ctx.fillRect(p.x + 3, p.y + 3, t1w, t1h);
                ctx.strokeStyle = '#991b1b';
                ctx.strokeRect(p.x + 3, p.y + 3, t1w, t1h);
                // Leather straps across trunk A
                ctx.fillStyle = '#451a03';
                ctx.fillRect(p.x + 3 + t1w * 0.25, p.y + 3, 2.5, t1h);
                ctx.fillRect(p.x + 3 + t1w * 0.70, p.y + 3, 2.5, t1h);
                // Brass corner caps
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(p.x + 3, p.y + 3, 3, 3);
                ctx.fillRect(p.x + 3 + t1w - 3, p.y + 3, 3, 3);
                ctx.fillRect(p.x + 3, p.y + 3 + t1h - 3, 3, 3);
                ctx.fillRect(p.x + 3 + t1w - 3, p.y + 3 + t1h - 3, 3, 3);

                // Trunk B: Navy Blue luxury suitcase
                const t2x = p.x + 3 + t1w + 2;
                const t2w = p.w - (t1w + 8);
                const t2h = p.h - 6;
                if (t2w > 8) {
                    ctx.fillStyle = '#1e3a8a'; // Midnight blue
                    ctx.fillRect(t2x, p.y + 3, t2w, t2h);
                    ctx.strokeStyle = '#3b82f6';
                    ctx.strokeRect(t2x, p.y + 3, t2w, t2h);
                    // Center brass latch
                    ctx.fillStyle = '#f59e0b';
                    ctx.fillRect(t2x + t2w / 2 - 2, p.y + 3 + t2h / 2 - 2, 4, 4);
                }
            }
            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'rug' || lbl.includes('RUG') || lbl.includes('CARPET') || lbl.includes('地毯') || lbl.includes('织毯')) {
            // Ornamental carpet/rug
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);
            ctx.fillStyle = lbl.includes('EMERALD') || p.x % 2 === 0 ? '#064e3b' : '#7f1d1d'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;
            const r = Math.min(p.w, p.h) * 0.28;
            ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            for (let ly = p.y + 2; ly < p.y + p.h - 2; ly += 4) {
                ctx.strokeStyle = '#f3f4f6';
                ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(p.x, ly); ctx.lineTo(p.x - 3, ly); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(p.x + p.w, ly); ctx.lineTo(p.x + p.w + 3, ly); ctx.stroke();
            }
            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'lamp' || lbl.includes('LAMP') || lbl.includes('LIGHT') || lbl.includes('灯')) {
            // Standing floor lamp with radial light glow
            ctx.save();
            const cx = p.x + p.w/2;
            const cy = p.y + p.h/2;
            const glowRadius = Math.max(80, Math.min(p.w, p.h) * 5);
            const radialGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRadius);
            radialGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)'); 
            radialGrad.addColorStop(0.3, 'rgba(253, 224, 71, 0.15)'); 
            radialGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');      
            ctx.fillStyle = radialGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath(); ctx.arc(cx + 2, cy + 2, p.w/2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d97706'; 
            ctx.beginPath(); ctx.arc(cx, cy, p.w/2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath(); ctx.arc(cx, cy, p.w/6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'wardrobe' || lbl.includes('WARDROBE') || lbl.includes('CLOSET') || lbl.includes('衣柜') || lbl.includes('柜子')) {
            // Executive luxury mahogany wardrobe with brass hardware & paneled doors
            ctx.save();
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
            
            // Outer cabinet frame (Rich mahogany)
            ctx.fillStyle = '#3c1806';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            
            // Top crown molding / edge highlight
            ctx.fillStyle = '#5a250a';
            ctx.fillRect(p.x + 1, p.y + 1, p.w - 2, Math.min(3, p.h * 0.2));
            
            // Outer border
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            // Door panels
            const doorCount = p.w >= 40 ? 2 : 1;
            const doorW = (p.w - 6 - (doorCount - 1) * 2) / doorCount;
            const doorH = p.h - 6;

            for (let d = 0; d < doorCount; d++) {
                const dx = p.x + 3 + d * (doorW + 2);
                const dy = p.y + 3;
                
                // Door face base
                ctx.fillStyle = '#4c1e08';
                ctx.fillRect(dx, dy, doorW, doorH);
                
                // Recessed panel border
                ctx.strokeStyle = '#270e02';
                ctx.lineWidth = 1;
                ctx.strokeRect(dx + 2, dy + 2, doorW - 4, doorH - 4);
                
                // Inner wood panel
                ctx.fillStyle = '#3a1605';
                ctx.fillRect(dx + 3, dy + 3, doorW - 6, doorH - 6);

                // Subtle panel slats / detail
                if (doorH > 14) {
                    ctx.strokeStyle = 'rgba(124, 45, 18, 0.5)';
                    ctx.beginPath();
                    ctx.moveTo(dx + 4, dy + doorH / 2);
                    ctx.lineTo(dx + doorW - 4, dy + doorH / 2);
                    ctx.stroke();
                }

                // Polished brass handle
                const handleX = d === 0 ? (dx + doorW - 4) : (dx + 3);
                const handleY = dy + doorH / 2 - 3;
                
                // Handle shadow
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(handleX + 0.5, handleY + 0.5, 1.5, 6);
                
                // Handle brass metal
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(handleX, handleY, 1.5, 6);
                
                // Specular glint
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(handleX, handleY + 1, 1.5, 2);
            }

            // Central partition seam if double door
            if (doorCount === 2) {
                ctx.strokeStyle = '#1e0a01';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x + p.w / 2, p.y + 1);
                ctx.lineTo(p.x + p.w / 2, p.y + p.h - 1);
                ctx.stroke();
            }

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'coffee_table' || p.type === 'tea_table' || lbl.includes('茶几') || lbl.includes('茶台')) {
            // Luxury hotel tea/coffee table with a clay teapot and cups
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
            ctx.fillStyle = '#5c2d11'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#3b1d0a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = 'rgba(224, 242, 254, 0.2)';
            ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;
            ctx.fillStyle = '#9a3412'; 
            ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(cx - 7, cy - 1, 3, 2); 
            ctx.strokeStyle = '#7c2d12';
            ctx.beginPath(); ctx.arc(cx + 5, cy, 1.8, -Math.PI/2, Math.PI/2); ctx.stroke();
            ctx.fillStyle = '#f8fafc'; 
            const cupOffsets = [[-7, -7], [7, -7], [-7, 7], [7, 7]];
            cupOffsets.forEach(([ox, oy]) => {
                ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 2, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 0.5; ctx.stroke();
            });
            drawPropTagLabel(p);

        } else if (p.type === 'writing_desk' || lbl.includes('写字台')) {
            // Executive writing desk with leather blotter and modern laptop
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);
            ctx.fillStyle = '#27160c'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.strokeStyle = '#1a0d06';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#14532d'; 
            ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, p.h - 6);
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 0.5; ctx.strokeRect(p.x + 4, p.y + 3, p.w - 8, p.h - 6);
            const lW = Math.min(22, p.w * 0.55);
            const lH = Math.min(16, p.h * 0.65);
            ctx.fillStyle = '#cbd5e1'; 
            ctx.fillRect(p.x + p.w/2 - lW/2, p.y + p.h/2 - lH/2, lW, lH);
            ctx.fillStyle = '#38bdf8'; 
            ctx.fillRect(p.x + p.w/2 - lW/2 + 2, p.y + p.h/2 - lH/2 + 2, lW - 4, 2);
            ctx.fillStyle = '#eab308'; 
            ctx.beginPath(); ctx.arc(p.x + 7, p.y + 7, 2.5, 0, Math.PI * 2); ctx.fill();
            drawPropTagLabel(p);

        } else if (p.type === 'pillar' || lbl.includes('大理石柱') || lbl.includes('立柱')) {
            // Grand lobby Support Column
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath(); ctx.arc(p.x + p.w/2 + 2, p.y + p.h/2 + 2, Math.min(p.w, p.h)/2, 0, Math.PI * 2); ctx.fill();
            const cx = p.x + p.w/2;
            const cy = p.y + p.h/2;
            const radius = Math.min(p.w, p.h)/2;
            ctx.fillStyle = '#7f1d1d'; 
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#450a0a'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.strokeStyle = '#eab308'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'fountain' || lbl.includes('景观喷泉') || lbl.includes('喷泉')) {
            // Lobby Water Fountain
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath(); ctx.arc(p.x + p.w/2 + 4, p.y + p.h/2 + 4, p.w/2, 0, Math.PI * 2); ctx.fill();
            const cx = p.x + p.w/2;
            const cy = p.y + p.h/2;
            const r = p.w/2;
            ctx.fillStyle = '#475569'; 
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#334155'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.fillStyle = '#06b6d4'; 
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'desk' || p.type === 'table' || p.type === 'counter' || lbl.includes('DESK') || lbl.includes('TABLE') || lbl.includes('RECEPTION') || lbl.includes('PANTRY') || lbl.includes('TELLER') || lbl.includes('COUNTER')) {
            // Custom Office Workspace Desk / Conference Table / Pantry Leisure Table
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            const isLeisure = lbl.includes('PANTRY') || lbl.includes('COFFEE') || lbl.includes('TEA') || lbl.includes('LOUNGE') || lbl.includes('SOFA') || lbl.includes('REST') || lbl.includes('BREAK') || lbl.includes('SIDE') || lbl.includes('DINING') || lbl.includes('VANITY') || lbl.includes('LEISURE') || p.type === 'table';
            const isConference = lbl.includes('CONF') || p.w > 120;
            const isKitchen = lbl.includes('GALLEY') || lbl.includes('COOKING') || lbl.includes('KITCHEN') || lbl.includes('STOVE') || lbl.includes('OVEN');
            const isOwnerDesk = (lbl.includes('OWNER') || lbl.includes('MASTER') || lbl.includes('CHIEF')) && !lbl.includes('VANITY');

            if (isKitchen) {
                // High-end Yacht Galley Cooking Station (Stainless steel top with glowing orange burners and cutting board)
                ctx.fillStyle = '#cbd5e1'; // Stainless steel base
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#64748b'; // Sleek slate border
                ctx.lineWidth = 1.8;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                // Draw burners (stove top)
                ctx.fillStyle = '#1e293b'; // Burner grates
                ctx.strokeStyle = '#ea580c'; // Glowing orange coil
                ctx.lineWidth = 1.2;
                
                if (p.h > p.w) {
                    // Vertical stove top layout
                    ctx.beginPath(); ctx.arc(p.x + p.w/2, p.y + 20, p.w * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.beginPath(); ctx.arc(p.x + p.w/2, p.y + p.h - 20, p.w * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

                    // Wooden cutting board in the middle
                    ctx.fillStyle = '#b45309'; // Warm bamboo wood cutting board
                    ctx.fillRect(p.x + 3, p.y + p.h/2 - 12, p.w - 6, 24);
                    ctx.strokeStyle = '#78350f';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(p.x + 3, p.y + p.h/2 - 12, p.w - 6, 24);
                    
                    // Tiny steel knife on board
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(p.x + p.w/2 - 1, p.y + p.h/2 - 6, 2, 12);
                } else {
                    // Horizontal stove top layout
                    ctx.beginPath(); ctx.arc(p.x + 20, p.y + p.h/2, p.h * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.beginPath(); ctx.arc(p.x + p.w - 20, p.y + p.h/2, p.h * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

                    ctx.fillStyle = '#b45309';
                    ctx.fillRect(p.x + p.w/2 - 12, p.y + 3, 24, p.h - 6);
                    ctx.strokeStyle = '#78350f';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(p.x + p.w/2 - 12, p.y + 3, 24, p.h - 6);

                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(p.x + p.w/2 - 6, p.y + p.h/2 - 1, 12, 2);
                }

            } else if (isOwnerDesk) {
                // Luxurious mahogany study desk (No standard office look!)
                ctx.fillStyle = '#2c1a04'; // Dark mahogany
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#fbbf24'; // Premium golden/brass border
                ctx.lineWidth = 1.8;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                // High-end leather desk mat (dark forest green) in center
                ctx.fillStyle = '#064e3b';
                const matW = p.w * 0.6;
                const matH = p.h * 0.6;
                ctx.fillRect(p.x + p.w/2 - matW/2, p.y + p.h/2 - matH/2, matW, matH);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(p.x + p.w/2 - matW/2, p.y + p.h/2 - matH/2, matW, matH);

                // Curved ultra-wide monitor with glowing cyan screen & golden desk lamp based on facing direction
                let face = p.facing || 'left';
                const screenH = Math.min(22, p.h * 0.5);
                const screenW = Math.min(22, p.w * 0.5);

                ctx.fillStyle = '#1e293b'; // Premium matte black monitor bezel
                
                // Draw 3 gold-handled office desk drawers on left/right edges for custom executive detail
                ctx.fillStyle = '#1c0a00'; // Dark drawer face
                ctx.fillRect(p.x + 2, p.y + 2, 8, p.h - 4);
                ctx.fillRect(p.x + p.w - 10, p.y + 2, 8, p.h - 4);
                ctx.fillStyle = '#fbbf24'; // Gold handles
                ctx.fillRect(p.x + 6, p.y + p.h/2 - 4, 1.5, 8);
                ctx.fillRect(p.x + p.w - 7.5, p.y + p.h/2 - 4, 1.5, 8);

                // Add an elegant leather notepad / writing pad on the desk corner
                ctx.fillStyle = '#f8fafc'; // Ivory paper
                ctx.fillRect(p.x + p.w/2 - 12, p.y + 4, 10, 8);
                ctx.strokeStyle = '#b45309'; // Wood rim holder
                ctx.strokeRect(p.x + p.w/2 - 12, p.y + 4, 10, 8);
                ctx.fillStyle = '#1e3a8a'; // Tiny fountain pen
                ctx.fillRect(p.x + p.w/2 - 4, p.y + 6, 1.5, 6);

                if (face === 'left') {
                    const monitorX = p.x + p.w - 16;
                    const monitorY = p.y + p.h/2 - screenH/2;
                    ctx.fillRect(monitorX, monitorY, 4, screenH);
                    
                    ctx.fillStyle = '#06b6d4'; // Cyan display glow
                    ctx.fillRect(monitorX - 2, monitorY + 2, 2, screenH - 4);

                    // Keyboard to the left (perfectly aligned under the study chair)
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(p.x + 14, p.y + p.h/2 - 8, 4, 16);
                    
                    // Gold executive desk lamp on the top-left
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath(); ctx.arc(p.x + p.w/2 + 6, p.y + 6, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fef08a'; // Glowing yellow cone
                    ctx.beginPath(); ctx.arc(p.x + p.w/2 + 10, p.y + 6, 1.5, 0, Math.PI * 2); ctx.fill();
                } else if (face === 'right') {
                    const monitorX = p.x + 12;
                    const monitorY = p.y + p.h/2 - screenH/2;
                    ctx.fillRect(monitorX, monitorY, 4, screenH);

                    ctx.fillStyle = '#06b6d4';
                    ctx.fillRect(monitorX + 4, monitorY + 2, 2, screenH - 4);

                    // Keyboard to the right (perfectly aligned under the guest study chair)
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(p.x + p.w - 18, p.y + p.h/2 - 8, 4, 16);

                    // Gold desk lamp on the top-right
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath(); ctx.arc(p.x + p.w/2 - 6, p.y + 6, 2.5, 0, Math.PI * 2); ctx.fill();
                } else if (face === 'down') {
                    const monitorX = p.x + p.w/2 - screenW/2;
                    const monitorY = p.y + p.h - 12;
                    ctx.fillRect(monitorX, monitorY, screenW, 4);

                    ctx.fillStyle = '#06b6d4';
                    ctx.fillRect(monitorX + 2, monitorY - 2, screenW - 4, 2);

                    // Keyboard above
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(p.x + p.w/2 - 8, monitorY - 12, 16, 4);

                    // Gold lamp on top-right
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath(); ctx.arc(p.x + p.w - 16, p.y + 6, 2.5, 0, Math.PI * 2); ctx.fill();
                } else {
                    const monitorX = p.x + p.w/2 - screenW/2;
                    const monitorY = p.y + 12;
                    ctx.fillRect(monitorX, monitorY, screenW, 4);

                    ctx.fillStyle = '#06b6d4';
                    ctx.fillRect(monitorX + 2, monitorY + 4, screenW - 4, 2);

                    // Keyboard below
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(p.x + p.w/2 - 8, monitorY + 8, 16, 4);

                    // Gold lamp on top-right
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath(); ctx.arc(p.x + p.w - 16, p.y + p.h - 12, 2.5, 0, Math.PI * 2); ctx.fill();
                }

            } else if (isLeisure) {
                const isDining = lbl.includes('DINING');
                const isVanity = lbl.includes('VANITY');

                if (isDining) {
                    // Luxurious Yacht Dining Table (No computers, with plates, wine glasses and flower vase)
                    ctx.fillStyle = '#451a03'; // Rich dark mahogany oak wood
                    ctx.fillRect(p.x, p.y, p.w, p.h);
                    ctx.strokeStyle = '#d97706';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(p.x, p.y, p.w, p.h);

                    // Central white flower runner
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(p.x + 10, p.y + p.h/2 - 2, p.w - 20, 4);

                    // Draw elegant dining plates and tiny wine glasses
                    ctx.fillStyle = '#f8fafc'; // White ceramic plates
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.lineWidth = 0.5;
                    const plateCount = Math.max(2, Math.floor(p.w / 30));
                    const plateStep = p.w / (plateCount + 1);
                    for (let i = 1; i <= plateCount; i++) {
                        const plateX = p.x + i * plateStep;
                        // Top plate
                        ctx.fillStyle = '#f8fafc';
                        ctx.beginPath(); ctx.arc(plateX, p.y + 6, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                        // Top wine glass (tiny ruby red circle)
                        ctx.fillStyle = '#991b1b';
                        ctx.beginPath(); ctx.arc(plateX + 6, p.y + 6, 1.2, 0, Math.PI * 2); ctx.fill();

                        // Bottom plate
                        ctx.fillStyle = '#f8fafc';
                        ctx.beginPath(); ctx.arc(plateX, p.y + p.h - 6, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                        // Bottom wine glass
                        ctx.fillStyle = '#991b1b';
                        ctx.beginPath(); ctx.arc(plateX - 6, p.y + p.h - 6, 1.2, 0, Math.PI * 2); ctx.fill();
                    }

                    // Central Rose Vase
                    ctx.fillStyle = '#10b981'; // Green stem/leaves
                    ctx.fillRect(p.x + p.w / 2 - 1, p.y + p.h / 2 - 2, 2, 4);
                    ctx.fillStyle = '#ef4444'; // Red rose petals
                    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2 - 3, 2, 0, Math.PI * 2); ctx.fill();

                } else if (isVanity) {
                    // Luxurious Toilet Vanity (White marble with glossy sinks and faucets)
                    ctx.fillStyle = '#f1f5f9'; // Clean white Carrara marble
                    ctx.fillRect(p.x, p.y, p.w, p.h);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(p.x, p.y, p.w, p.h);

                    // Luxury gold back splash / mirror line at the top
                    ctx.fillStyle = '#fbbf24'; // Golden brass border
                    ctx.fillRect(p.x, p.y, p.w, 2);

                    // 2 circular porcelain sink bowls
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    const sinkCount = Math.max(1, Math.floor(p.w / 30));
                    const sinkStep = p.w / (sinkCount + 1);
                    for (let i = 1; i <= sinkCount; i++) {
                        const sinkX = p.x + i * sinkStep;
                        const sinkY = p.y + p.h/2;
                        // Outer bowl
                        ctx.beginPath(); ctx.arc(sinkX, sinkY, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                        // Water center (cyan)
                        ctx.fillStyle = '#e0f2fe';
                        ctx.beginPath(); ctx.arc(sinkX, sinkY, 2.5, 0, Math.PI * 2); ctx.fill();
                        // Chrome faucet (golden or silver line)
                        ctx.strokeStyle = '#d97706'; // brass faucet
                        ctx.lineWidth = 1.2;
                        ctx.beginPath();
                        ctx.moveTo(sinkX, sinkY - 6);
                        ctx.lineTo(sinkX, sinkY - 2);
                        ctx.stroke();
                    }

                    // Highly visible, beautiful luxury toiletries on the sides
                    // 1. Hand Soap Lotion Pump (Left side of vanity counter)
                    ctx.fillStyle = '#10b981'; // Emerald green glass base
                    ctx.fillRect(p.x + 4, p.y + p.h/2 - 3, 5, 8);
                    ctx.strokeStyle = '#047857';
                    ctx.strokeRect(p.x + 4, p.y + p.h/2 - 3, 5, 8);
                    ctx.fillStyle = '#fbbf24'; // Golden brass pump head
                    ctx.fillRect(p.x + 5, p.y + p.h/2 - 6, 3, 3);
                    ctx.fillRect(p.x + 3, p.y + p.h/2 - 6, 3, 1.5); // nozzle pointing left

                    // 2. French Perfume Atomizer (Right side of vanity counter)
                    ctx.fillStyle = '#ec4899'; // Ruby pink glass bottle
                    ctx.beginPath(); ctx.ellipse(p.x + p.w - 7, p.y + p.h/2 + 1, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#be185d';
                    ctx.beginPath(); ctx.ellipse(p.x + p.w - 7, p.y + p.h/2 + 1, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = '#fbbf24'; // Gold cap
                    ctx.fillRect(p.x + p.w - 8.5, p.y + p.h/2 - 5, 3, 2.5);

                    // 3. Toothbrush Cup with red and blue toothbrushes (Next to the soap lotion pump)
                    ctx.fillStyle = '#ffffff'; // White porcelain cup
                    ctx.fillRect(p.x + 12, p.y + p.h/2 - 1, 5, 7);
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.strokeRect(p.x + 12, p.y + p.h/2 - 1, 5, 7);
                    // Toothbrushes angled out
                    ctx.strokeStyle = '#ef4444'; // Red toothbrush
                    ctx.lineWidth = 1.2;
                    ctx.beginPath(); ctx.moveTo(p.x + 13, p.y + p.h/2 + 2); ctx.lineTo(p.x + 10, p.y + p.h/2 - 5); ctx.stroke();
                    ctx.strokeStyle = '#3b82f6'; // Blue toothbrush
                    ctx.beginPath(); ctx.moveTo(p.x + 15, p.y + p.h/2 + 2); ctx.lineTo(p.x + 18, p.y + p.h/2 - 5); ctx.stroke();

                } else {
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

        } else if (p.type === 'sunbed' || lbl.includes('SUNBED') || lbl.includes('LOUNGER') || lbl.includes('CHAISE')) {
            // High-fidelity luxury sunbed/sunlounger
            // 1. Shadow (Draw simple rect shadow)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(p.x + 3, p.y + 3, p.w, p.h);

            // If an angle or custom rotation is provided, we can rotate centered at the prop
            if (p.angle !== undefined) {
                ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
                ctx.rotate(p.angle);
                const cx = -p.w / 2;
                const cy = -p.h / 2;

                // 2. Teak Wood Base / Frame
                ctx.fillStyle = '#b45309'; // Warm teak wood color
                ctx.fillRect(cx, cy, p.w, p.h);
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx, cy, p.w, p.h);

                // Wood slats lines
                ctx.strokeStyle = 'rgba(120, 53, 15, 0.4)';
                for (let sl = cx + 4; sl < cx + p.w - 4; sl += 6) {
                    ctx.beginPath(); ctx.moveTo(sl, cy); ctx.lineTo(sl, cy + p.h); ctx.stroke();
                }

                // 3. Crisp white/cyan luxury cushion on top
                ctx.fillStyle = p.color || '#bae6fd'; // Light blue / Cyan cushion
                ctx.fillRect(cx + 3, cy + 2, p.w - 6, p.h - 4);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(cx + 3, cy + 2, p.w - 6, p.h - 4);

                // Cushion ribbing (stitching lines across)
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
                for (let rx = cx + 8; rx < cx + p.w - 8; rx += 4) {
                    ctx.beginPath(); ctx.moveTo(rx, cy + 2); ctx.lineTo(rx, cy + p.h - 2); ctx.stroke();
                }

                // 4. Headrest / Pillow (at left end or right end based on facing/default)
                ctx.fillStyle = '#f8fafc'; // White fluffy pillow
                ctx.fillRect(cx + 4, cy + 4, 8, p.h - 8);
                ctx.strokeStyle = '#e2e8f0';
                ctx.strokeRect(cx + 4, cy + 4, 8, p.h - 8);

                // 5. Tiny side glass of cocktail with orange slice!
                ctx.fillStyle = '#f59e0b'; // Orange juice
                ctx.beginPath();
                ctx.arc(cx + p.w - 8, cy + p.h / 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff'; // Glass rim
                ctx.stroke();
                ctx.strokeStyle = '#ef4444'; // Red straw
                ctx.beginPath();
                ctx.moveTo(cx + p.w - 8, cy + p.h / 2);
                ctx.lineTo(cx + p.w - 11, cy + p.h / 2 - 3);
                ctx.stroke();

            } else {
                // Axis-aligned draw
                // 2. Teak Wood Base / Frame
                ctx.fillStyle = '#b45309'; // Warm teak wood color
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 1;
                ctx.strokeRect(p.x, p.y, p.w, p.h);

                // Wood slats lines
                ctx.strokeStyle = 'rgba(120, 53, 15, 0.4)';
                if (p.w > p.h) {
                    for (let sl = p.x + 4; sl < p.x + p.w - 4; sl += 6) {
                        ctx.beginPath(); ctx.moveTo(sl, p.y); ctx.lineTo(sl, p.y + p.h); ctx.stroke();
                    }
                } else {
                    for (let sl = p.y + 4; sl < p.y + p.h - 4; sl += 6) {
                        ctx.beginPath(); ctx.moveTo(p.x, sl); ctx.lineTo(p.x + p.w, sl); ctx.stroke();
                    }
                }

                // 3. Crisp white/cyan luxury cushion on top
                ctx.fillStyle = p.color || '#bae6fd'; // Light blue / Cyan cushion
                ctx.fillRect(p.x + 3, p.y + 2, p.w - 6, p.h - 4);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(p.x + 3, p.y + 2, p.w - 6, p.h - 4);

                // Cushion ribbing (stitching lines across)
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
                if (p.w > p.h) {
                    for (let rx = p.x + 8; rx < p.x + p.w - 8; rx += 4) {
                        ctx.beginPath(); ctx.moveTo(rx, p.y + 2); ctx.lineTo(rx, p.y + p.h - 2); ctx.stroke();
                    }
                } else {
                    for (let ry = p.y + 8; ry < p.y + p.h - 8; ry += 4) {
                        ctx.beginPath(); ctx.moveTo(p.x + 2, ry); ctx.lineTo(p.x + p.w - 2, ry); ctx.stroke();
                    }
                }

                // 4. Headrest / Pillow
                ctx.fillStyle = '#f8fafc'; // White fluffy pillow
                if (p.facing === 'right') {
                    ctx.fillRect(p.x + p.w - 12, p.y + 4, 8, p.h - 8);
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.strokeRect(p.x + p.w - 12, p.y + 4, 8, p.h - 8);
                } else {
                    ctx.fillRect(p.x + 4, p.y + 4, 8, p.h - 8);
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.strokeRect(p.x + 4, p.y + 4, 8, p.h - 8);
                }

                // 5. Tiny side glass of cocktail with orange slice!
                ctx.fillStyle = '#f59e0b'; // Orange juice
                const glX = p.facing === 'right' ? p.x + 8 : p.x + p.w - 8;
                ctx.beginPath();
                ctx.arc(glX, p.y + p.h / 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff'; // Glass rim
                ctx.stroke();
                ctx.strokeStyle = '#ef4444'; // Red straw
                ctx.beginPath();
                ctx.moveTo(glX, p.y + p.h / 2);
                ctx.lineTo(glX - 3, p.y + p.h / 2 - 3);
                ctx.stroke();
            }

            drawPropTagLabel(p);

        } else if (p.type === 'helicopter' || lbl.includes('HELICOPTER')) {
            // High-fidelity executive/military tactical helicopter (top-down view)
            ctx.save();
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
            if (p.angle !== undefined) {
                ctx.rotate(p.angle);
            }

            // Dimensions relative to center
            const bodyLength = p.w * 0.45; // core cabin body length
            const bodyWidth = p.h * 0.22;  // core cabin body width (made sleeker/skinnier as requested)

            // 1. Landing Skids (underneath, drawn first)
            ctx.strokeStyle = '#475569'; // Steel dark grey
            ctx.lineWidth = 3;
            // Left Skid
            ctx.beginPath();
            ctx.moveTo(-bodyLength * 0.7, -bodyWidth * 0.75);
            ctx.lineTo(bodyLength * 0.7, -bodyWidth * 0.75);
            ctx.stroke();
            // Right Skid
            ctx.beginPath();
            ctx.moveTo(-bodyLength * 0.7, bodyWidth * 0.75);
            ctx.lineTo(bodyLength * 0.7, bodyWidth * 0.75);
            ctx.stroke();

            // Skid Struts (connectors to body)
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-bodyLength * 0.3, -bodyWidth * 0.75); ctx.lineTo(-bodyLength * 0.3, -bodyWidth * 0.5);
            ctx.moveTo(bodyLength * 0.3, -bodyWidth * 0.75); ctx.lineTo(bodyLength * 0.3, -bodyWidth * 0.5);
            ctx.moveTo(-bodyLength * 0.3, bodyWidth * 0.75); ctx.lineTo(-bodyLength * 0.3, bodyWidth * 0.5);
            ctx.moveTo(bodyLength * 0.3, bodyWidth * 0.75); ctx.lineTo(bodyLength * 0.3, bodyWidth * 0.5);
            ctx.stroke();

            // 2. Tail Boom
            ctx.fillStyle = '#1e293b'; // Slate charcoal grey
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-bodyLength * 0.4, -bodyWidth * 0.25);
            ctx.lineTo(-p.w * 0.65, -bodyWidth * 0.08);
            ctx.lineTo(-p.w * 0.65, bodyWidth * 0.08);
            ctx.lineTo(-bodyLength * 0.4, bodyWidth * 0.25);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // Tail Fin & Rotor
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-p.w * 0.72, -bodyWidth * 0.35, 8, bodyWidth * 0.7);
            ctx.strokeRect(-p.w * 0.72, -bodyWidth * 0.35, 8, bodyWidth * 0.7);

            // Tail Rotor Blades
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.2;
            const tailRotorTime = (Date.now() / 60) % (Math.PI * 2);
            ctx.save();
            ctx.translate(-p.w * 0.68, -bodyWidth * 0.3);
            ctx.rotate(tailRotorTime);
            ctx.beginPath();
            ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
            ctx.moveTo(0, -12); ctx.lineTo(0, 12);
            ctx.stroke();
            ctx.restore();

            // Tail warning decals (diagonal yellow/black stripes)
            ctx.fillStyle = '#fbbf24'; // Yellow
            ctx.fillRect(-p.w * 0.55, -bodyWidth * 0.08, 12, bodyWidth * 0.16);
            ctx.fillStyle = '#0f172a'; // Black stripes
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-p.w * 0.55, -bodyWidth * 0.08); ctx.lineTo(-p.w * 0.51, bodyWidth * 0.08);
            ctx.moveTo(-p.w * 0.51, -bodyWidth * 0.08); ctx.lineTo(-p.w * 0.47, bodyWidth * 0.08);
            ctx.stroke();

            // 3. Main Fuselage Cabin
            const cabinGrad = ctx.createLinearGradient(-bodyLength, 0, bodyLength, 0);
            cabinGrad.addColorStop(0, '#0f172a');
            cabinGrad.addColorStop(0.4, '#1e293b');
            cabinGrad.addColorStop(1, '#334155');
            ctx.fillStyle = cabinGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, bodyLength, bodyWidth, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // 4. Cockpit Windshield
            ctx.fillStyle = '#0891b2'; // Rich glossy cyan
            ctx.beginPath();
            ctx.arc(bodyLength * 0.4, 0, bodyWidth * 0.72, -Math.PI * 0.4, Math.PI * 0.4);
            ctx.lineTo(bodyLength, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Cockpit sheen reflection
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bodyLength * 0.5, -bodyWidth * 0.1, bodyWidth * 0.4, -Math.PI * 0.25, Math.PI * 0.15);
            ctx.stroke();

            // Side passenger windows
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.roundRect(-bodyLength * 0.3, -bodyWidth * 0.65, bodyLength * 0.5, bodyWidth * 0.18, 2);
            ctx.roundRect(-bodyLength * 0.3, bodyWidth * 0.47, bodyLength * 0.5, bodyWidth * 0.18, 2);
            ctx.fill();

            // 5. Main Rotor Hub & Mast
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Secondary shiny center bolt
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            // 6. 4 Massive Main Rotor Blades
            const mainRotorTime = (Date.now() / 250) % (Math.PI * 2);
            ctx.save();
            ctx.rotate(mainRotorTime);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3.5;
            const bladeLen = p.w * 0.72;

            for (let b = 0; b < 4; b++) {
                const angle = (b * Math.PI) / 2;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(8, 0);
                ctx.lineTo(bladeLen, 0);
                ctx.stroke();

                ctx.fillStyle = '#ef4444';
                ctx.fillRect(bladeLen - 8, -1.8, 8, 3.6);
                ctx.restore();
            }
            ctx.restore();

            // 7. Tactical flashing anti-collision strobe beacon
            const strobeOn = (Date.now() % 1000 < 150);
            if (strobeOn) {
                ctx.fillStyle = '#ef4444';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(-bodyLength * 0.25, 0, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.restore();
            drawPropTagLabel(p);

        } else if (p.type === 'jetski' || lbl.includes('JETSKI') || lbl.includes('JET SKI')) {
            // High-fidelity racing jet ski (top-down view)
            ctx.save();
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
            
            // Set rotation based on facing or angle
            let rot = 0;
            if (p.angle !== undefined) {
                rot = p.angle;
            } else if (p.facing === 'left') {
                rot = Math.PI;
            } else if (p.facing === 'up') {
                rot = -Math.PI / 2;
            } else if (p.facing === 'down') {
                rot = Math.PI / 2;
            }
            ctx.rotate(rot);

            const hw = p.w / 2;
            const hh = p.h / 2;

            // 1. Water wake & Ripple shadow (since it floats in swimming pool)
            ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(-hw * 0.2, 0, hh * 1.5, 0, Math.PI * 2);
            ctx.fill();

            // 2. Hull Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.moveTo(-hw, -hh * 0.7);
            ctx.quadraticCurveTo(-hw * 0.5, -hh, hw, 0);
            ctx.quadraticCurveTo(-hw * 0.5, hh, -hw, hh * 0.7);
            ctx.closePath();
            ctx.fill();

            // 3. Sleek Jet Ski Hull Base (Aerodynamic design)
            // Royal deep blue & metallic silver color palette
            const hullGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
            hullGrad.addColorStop(0, '#0f172a'); // Dark slate navy back
            hullGrad.addColorStop(0.4, '#1e3a8a'); // Rich deep navy blue
            hullGrad.addColorStop(1, '#1d4ed8'); // Vibrant royal navy blue nose
            
            ctx.fillStyle = hullGrad;
            ctx.strokeStyle = '#e2e8f0'; // Bright metallic silver outline
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.moveTo(-hw, -hh * 0.75);
            ctx.quadraticCurveTo(-hw * 0.5, -hh * 0.95, hw, 0); // Upper curved nose
            ctx.quadraticCurveTo(-hw * 0.5, hh * 0.95, -hw, hh * 0.75); // Lower curved nose
            ctx.lineTo(-hw * 0.95, hh * 0.3);
            ctx.lineTo(-hw * 0.95, -hh * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 4. Center Seat Saddle (Leathery textured saddle)
            ctx.fillStyle = '#0f172a'; // Black leather
            ctx.strokeStyle = '#94a3b8'; // Metallic silver seam
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(-hw * 0.65, -hh * 0.28, hw * 0.75, hh * 0.56, 4);
            ctx.fill();
            ctx.stroke();

            // 5. Handlebars & Steering Column (chrome / black)
            ctx.strokeStyle = '#94a3b8'; // Silver steel bracket
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(hw * 0.25, 0); // Stem
            ctx.stroke();

            // Handlebar bar
            ctx.strokeStyle = '#0f172a'; // Handlebars
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hw * 0.25, -hh * 0.65);
            ctx.lineTo(hw * 0.25, hh * 0.65);
            ctx.stroke();

            // Handlebar rubber grips
            ctx.fillStyle = '#cbd5e1'; // Silver grips
            ctx.fillRect(hw * 0.25 - 1.5, -hh * 0.65, 3, 4);
            ctx.fillRect(hw * 0.25 - 1.5, hh * 0.65 - 4, 3, 4);

            // 6. Windshield / Control Console (Glass reflection)
            ctx.fillStyle = '#0f172a'; // Deep console body
            ctx.beginPath();
            ctx.moveTo(hw * 0.2, -hh * 0.4);
            ctx.lineTo(hw * 0.45, -hh * 0.25);
            ctx.lineTo(hw * 0.45, hh * 0.25);
            ctx.lineTo(hw * 0.2, hh * 0.4);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#38bdf8'; // Glowing ice blue HUD / windshield screen
            ctx.beginPath();
            ctx.moveTo(hw * 0.32, -hh * 0.25);
            ctx.lineTo(hw * 0.48, -hh * 0.15);
            ctx.lineTo(hw * 0.48, hh * 0.15);
            ctx.lineTo(hw * 0.32, hh * 0.25);
            ctx.closePath();
            ctx.fill();

            // 7. Footwells (Traction pads)
            ctx.fillStyle = '#020617'; // Grip tape black
            ctx.fillRect(-hw * 0.55, -hh * 0.62, hw * 0.5, hh * 0.22);
            ctx.fillRect(-hw * 0.55, hh * 0.4, hw * 0.5, hh * 0.22);

            // 8. Jet Nozzle at the back
            ctx.fillStyle = '#475569'; // Silver metallic nozzle
            ctx.fillRect(-hw - 6, -hh * 0.2, 6, hh * 0.4);
            ctx.strokeStyle = '#94a3b8';
            ctx.strokeRect(-hw - 6, -hh * 0.2, 6, hh * 0.4);

            // 9. Sponsor/Racing decals on the side hull (Metallic silver stripes)
            ctx.fillStyle = '#f8fafc'; // Silver/white metallic stripes
            ctx.beginPath();
            ctx.moveTo(hw * 0.1, -hh * 0.82);
            ctx.lineTo(hw * 0.5, -hh * 0.55);
            ctx.lineTo(hw * 0.3, -hh * 0.5);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(hw * 0.1, hh * 0.82);
            ctx.lineTo(hw * 0.5, hh * 0.55);
            ctx.lineTo(hw * 0.3, hh * 0.5);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
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
    const camX = window.cameraX || 0;
    if (obs.x + obs.w < camX - 150 || obs.x > camX + width + 150) {
        return;
    }
    const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
    if (levelId === 'level3_bank' && !obs.isOuterBorder) {
        if (typeof isObjectRevealed === 'function' && !isObjectRevealed(obs.x, obs.y, obs.w, obs.h)) {
            return;
        }
    }
    if (obs.invisible) {
        return;
    }
    if (obs.isOceanMask) {
        ctx.save();
        if (levelId === 'level0_test' || levelId === 'level4_yacht') {
            let isUpper = obs.y < 360;
            let grad;
            if (isUpper) {
                grad = ctx.createLinearGradient(obs.x, obs.y + obs.h, obs.x, obs.y);
            } else {
                grad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
            }
            
            // Outer fade to deep night-sea blue
            grad.addColorStop(0, 'rgba(34, 211, 238, 0.45)'); // Intense cyan at the hull edge
            grad.addColorStop(0.15, 'rgba(13, 148, 136, 0.28)'); // Rich teal
            grad.addColorStop(0.45, 'rgba(6, 182, 212, 0.12)'); // Soft glow
            grad.addColorStop(1, '#051429'); // Deep sea background
            
            ctx.fillStyle = grad;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            
            // Draw an extremely bright neon line along the inner jagged edge
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 15;
            
            // 1. Layer of thick cyan glow line
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            if (isUpper) {
                ctx.moveTo(obs.x, obs.y + obs.h);
                ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
                if (obs.x < 2250) {
                    ctx.lineTo(obs.x + obs.w, obs.y + obs.h + 80);
                } else if (obs.x === 2250) {
                    ctx.lineTo(obs.x + obs.w, 360);
                }
            } else {
                ctx.moveTo(obs.x, obs.y);
                ctx.lineTo(obs.x + obs.w, obs.y);
                if (obs.x < 2250) {
                    ctx.lineTo(obs.x + obs.w, obs.y - 80);
                } else if (obs.x === 2250) {
                    ctx.lineTo(obs.x + obs.w, 360);
                }
            }
            ctx.stroke();

            // 2. Layer of intense white-cyan core line for superb brightness (发光感)
            ctx.save();
            ctx.strokeStyle = '#E0F7FA';
            ctx.lineWidth = 3.5;
            ctx.shadowBlur = 5;
            ctx.stroke();
            ctx.restore();
        } else {
            // Keep original level4 behavior (solid ocean mask)
            ctx.fillStyle = '#051429';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        }
        ctx.restore();
        return;
    }
    ctx.save();

    if (obs.type === 'solid' || obs.type === 'pool') {
        const levelId = (typeof levelManager !== 'undefined' && levelManager.getCurrentLevel) ? levelManager.getCurrentLevel().id : 'level1_airport';
        
        // 实体墙：阴影 + 渐变墙体
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w, obs.h);

        let grad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
        let wallStroke, gridStroke;
        
        if (obs.type === 'pool' || obs.label === 'SWIMMING POOL') {
            grad.addColorStop(0, '#0284c7'); // 湛蓝水体
            grad.addColorStop(1, '#0c4a6e'); // 深蓝底
            wallStroke = '#00e5ff'; // 亮青高光池边
            gridStroke = 'rgba(0, 229, 255, 0.25)'; // 水波网格线
        } else if (levelId === 'level0_test' || levelId === 'level5_hotel') {
            // 闪灵红酒店大堂：奢华暗红色实心墙（深度极高，极易辨识）
            grad.addColorStop(0, '#360407'); // 深绛红色/红褐玛瑙
            grad.addColorStop(1, '#1A0102'); // 深沉血影红
            wallStroke = '#A81C21'; // 高饱和红色霓虹感轮廓，清晰脱俗
            gridStroke = 'rgba(168, 28, 33, 0.24)'; // 对应红线暗隔缝
        } else if (levelId === 'level1_airport') {
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
        } else if (levelId === 'level4_yacht') {
            // 豪华游艇关卡：船身外框和全船实体墙改为尊贵亮白色（豪华游艇烤漆质感）
            grad.addColorStop(0, '#ffffff'); // 顶级亮白钢琴烤漆（游艇白）
            grad.addColorStop(1, '#f1f5f9'); // 渐变浅灰白色，增加立体光影
            wallStroke = '#cbd5e1'; // 钢银高精描边
            gridStroke = 'rgba(148, 163, 184, 0.12)'; // 船舱板拼缝
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
        if (levelId === 'level0_test' || levelId === 'level5_hotel') {
            // 闪灵红酒店大厅：高级拉丝钢/银灰色防弹玻璃屏风 (不遮挡视线/阻挡枪弹与玩家)
            ctx.fillStyle = 'rgba(226, 232, 240, 0.16)'; // 银灰反光底色
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            // 银灰色反光斜条纹
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.3)';
            ctx.lineWidth = 1.2;
            for (let sx = obs.x - obs.h; sx < obs.x + obs.w; sx += 12) {
                ctx.beginPath();
                ctx.moveTo(Math.max(obs.x, sx), obs.y);
                ctx.lineTo(Math.min(obs.x + obs.w, sx + obs.h), obs.y + obs.h);
                ctx.stroke();
            }

            ctx.strokeStyle = '#94A3B8'; // 银灰色高光边框
            ctx.lineWidth = 1.6;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            ctx.setLineDash([]);

            // 四边不锈钢银灰色加固底夹
            ctx.fillStyle = '#CBD5E1';
            const cs = 4;
            ctx.fillRect(obs.x - 1, obs.y - 1, cs, cs);
            ctx.fillRect(obs.x + obs.w - cs + 1, obs.y - 1, cs, cs);
            ctx.fillRect(obs.x - 1, obs.y + obs.h - cs + 1, cs, cs);
            ctx.fillRect(obs.x + obs.w - cs + 1, obs.y + obs.h - cs + 1, cs, cs);
        } else if (levelId === 'level3_bank') {
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
        if (levelId === 'level0_test' || levelId === 'level5_hotel') {
            // 闪灵红酒店大堂：高级古典实木胡桃色矮墙/前台 (视线遮挡/阻挡枪弹/可抛越手雷)
            counterGrad.addColorStop(0, '#5A3825'); // 暖调胡桃木
            counterGrad.addColorStop(1, '#341D12'); // 深黑古董红木
            ctx.fillStyle = counterGrad;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            // 仿木质年轮年纹雕刻拉丝理
            ctx.strokeStyle = 'rgba(28, 14, 8, 0.45)';
            ctx.lineWidth = 1.2;
            if (obs.w > obs.h) {
                // 横向木纹
                for (let wy = obs.y + 2; wy < obs.y + obs.h; wy += 4) {
                    ctx.beginPath();
                    ctx.moveTo(obs.x, wy);
                    ctx.lineTo(obs.x + obs.w, wy);
                    ctx.stroke();
                }
            } else {
                // 纵向木纹
                for (let wx = obs.x + 2; wx < obs.x + obs.w; wx += 4) {
                    ctx.beginPath();
                    ctx.moveTo(wx, obs.y);
                    ctx.lineTo(wx, obs.y + obs.h);
                    ctx.stroke();
                }
            }

            // 精美实木哑光金边包边
            ctx.strokeStyle = '#8E5E3C'; // 饱满的黄花梨/橡木棕
            ctx.lineWidth = 1.8;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (levelId === 'level3_bank') {
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
        } else if (levelId === 'level4_yacht') {
            // 豪华游艇特殊属性低墙/护栏：深邃钛合金银灰，搭配精细拉丝钢格栅与极地冰蓝LED发光指示线
            counterGrad.addColorStop(0, '#334155'); // 磨砂钢灰 (Slate 700)
            counterGrad.addColorStop(1, '#0f172a'); // 深邃钛黑 (Slate 900)
            ctx.fillStyle = counterGrad;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            // 亮银钢边包围
            ctx.strokeStyle = '#94a3b8'; // 尊贵不锈钢银灰
            ctx.lineWidth = 2.5;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

            // 绘制精细的拉丝格栅肋条与铆钉，提供明显的工业外观和深度区分
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1.2;
            if (obs.w > obs.h) {
                // 横向板：绘制密集纵向金属格栅
                for (let px = obs.x + 10; px < obs.x + obs.w - 5; px += 20) {
                    ctx.beginPath();
                    ctx.moveTo(px, obs.y + 2);
                    ctx.lineTo(px, obs.y + obs.h - 2);
                    ctx.stroke();

                    // 顶部与底部小铆钉点缀
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillRect(px - 1, obs.y + 1, 2, 2);
                    ctx.fillRect(px - 1, obs.y + obs.h - 3, 2, 2);
                }
            } else {
                // 纵向板：绘制密集横向金属格栅
                for (let py = obs.y + 10; py < obs.y + obs.h - 5; py += 20) {
                    ctx.beginPath();
                    ctx.moveTo(obs.x + 2, py);
                    ctx.lineTo(obs.x + obs.w - 2, py);
                    ctx.stroke();

                    // 左侧与右侧小铆钉点缀
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillRect(obs.x + 1, py - 1, 2, 2);
                    ctx.fillRect(obs.x + obs.w - 3, py - 1, 2, 2);
                }
            }

            // 绘制极地冰蓝LED指示发光条，凸显这是一个有“特殊物理属性（可抛雷/视线遮挡/阻挡枪弹）”的战术隔断
            ctx.save();
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 4;
            ctx.strokeStyle = '#00e5ff'; // 极地亮青发光
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (obs.w > obs.h) {
                ctx.moveTo(obs.x + 4, obs.y + obs.h / 2);
                ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h / 2);
            } else {
                ctx.moveTo(obs.x + obs.w / 2, obs.y + 4);
                ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h - 4);
            }
            ctx.stroke();
            ctx.restore();
        } else {
            // 低墙：警戒黄线条纹
            ctx.fillStyle = 'rgba(255, 153, 0, 0.18)';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            ctx.strokeStyle = '#FF9900';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        }
    }

    if (obs.label && !obs.hideLabel) {
        const text = obs.displayName !== undefined ? obs.displayName : obs.label;
        ctx.font = 'bold 7.5px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const txtW = ctx.measureText(text).width;
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
        ctx.fillText(text, labelX, labelY);
    }

    const isInfiniteBlind = (level0InfiniteBlindTimer > 0);
    if (blindActive && !isInfiniteBlind && (obs.type === 'pool' || obs.label === 'SWIMMING POOL' || inBlindZone(obs.x + obs.w / 2, obs.y + obs.h / 2))) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(obs.x - 1, obs.y - 1, obs.w + 2, obs.h + 2);
        ctx.restore();
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
        ctx.textAlign = 'left';
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
    } else if (weaponId === 6) {
        // --- 6: M240 GENERAL PURPOSE MACHINE GUN (通用机枪) ---
        ctx.fillStyle = color;
        ctx.fillRect(cx - 12, cy - 2, 30, 3.5); // 长枪管
        ctx.fillRect(cx + 18, cy - 3.5, 4, 6.5); // 消焰制退器
        ctx.fillRect(cx + 12, cy - 6, 2, 4); // 准星

        // 折叠脚架
        ctx.beginPath();
        ctx.moveTo(cx + 12, cy + 1.5); ctx.lineTo(cx + 17, cy + 10);
        ctx.moveTo(cx + 12, cy + 1.5); ctx.lineTo(cx + 8, cy + 10);
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();

        // 提把
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - 2); ctx.lineTo(cx - 1, cy - 8);
        ctx.lineTo(cx + 7, cy - 8); ctx.lineTo(cx + 8, cy - 2);
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();

        // 机匣与顶盖
        ctx.fillRect(cx - 16, cy - 5, 14, 8);
        ctx.fillRect(cx - 14, cy - 7, 10, 2);

        // 下挂方形软弹药包
        ctx.fillRect(cx - 10, cy + 3, 10, 8);

        // 枪托与握把
        ctx.fillRect(cx - 24, cy - 3, 9, 5);
        ctx.fillRect(cx - 24, cy - 5, 2, 9);
        ctx.fillRect(cx - 14, cy + 3, 3, 7);
    } else if (weaponId === 7) {
        // --- 7: UAV - 战术无人机/高空爆破 ---
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
        ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
        ctx.stroke();
        [[-8,-8], [8,-8], [-8,8], [8,8]].forEach(([ox, oy]) => {
            ctx.beginPath();
            ctx.arc(cx + ox, cy + oy, 2.8, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    ctx.restore();
}

function drawWeaponIcons() {
    const boxSize = 46;
    const gap = 10;
    const startX = 25;
    const startY = height - 62;

    const normalWeapons = [WEAPONS.RIFLE, WEAPONS.PISTOL, WEAPONS.SMG, WEAPONS.SNIPER, WEAPONS.GRENADE];
    normalWeapons.forEach((w, index) => {
        let x = startX + index * (boxSize + gap);
        let y = startY;
        let isUnlocked = unlockedWeapons.includes(w.id);
        let isSelected = !!(currentWeapon && w.id === currentWeapon.id);

        ctx.save();
        if (!isUnlocked) {
            ctx.fillStyle = 'rgba(12, 18, 15, 0.65)';
            ctx.strokeStyle = 'rgba(80, 100, 90, 0.3)';
            ctx.lineWidth = 1;
            ctx.fillRect(x, y, boxSize, boxSize);
            ctx.strokeRect(x, y, boxSize, boxSize);

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
            drawWeaponSilhouette(ctx, w.id, x, y, boxSize, boxSize, iconColor, isSelected);

            ctx.fillStyle = iconColor;
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`[${w.id}]`, x + 4, y + 12);
        }

        ctx.restore();
    });

    const currentLevelId = getCurrentLevelId();
    if (isKillstreakSupportedLevel(currentLevelId)) {
        const ksBoxSize = 46;
        const ksGap = 10;
        const ksStartX = width - 180;

        const isEn = (window.__gameLang === 'en');
        ctx.save();
        ctx.fillStyle = '#FF9900';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(isEn ? `⚡ STREAK [${level0StreakCount}]` : `⚡ 连杀奖励 [当前: ${level0StreakCount}]`, ksStartX, startY - 8);
        ctx.restore();

        const ksRewards = [
            {
                num: 1,
                id: WEAPONS.MACHINE_GUN.id,
                reqKills: 3,
                name: 'M240',
                keyStr: '[6]',
                isUnlocked: level0StreakCount >= 3 || level0MgAmmo > 0,
                isSelected: !!(currentWeapon && currentWeapon.id === WEAPONS.MACHINE_GUN.id),
                ammoText: level0MgAmmo > 0 ? `${level0MgAmmo}` : (level0StreakCount >= 3 ? '30' : '0')
            },
            {
                num: 2,
                id: WEAPONS.UAV.id,
                reqKills: 5,
                name: 'UAV',
                keyStr: '[7]',
                isUnlocked: level0StreakCount >= 5 || level0UavAmmo > 0,
                isSelected: !!(currentWeapon && currentWeapon.id === WEAPONS.UAV.id),
                ammoText: level0UavAmmo > 0 ? `${level0UavAmmo}x` : (level0StreakCount >= 5 ? '5x' : '0x')
            },
            {
                num: 3,
                id: 'BLINDZONE',
                reqKills: 7,
                name: isEn ? 'BLIND' : '盲区',
                keyStr: '[8]',
                isUnlocked: level0StreakCount >= 7 || level0InfiniteBlindTimer > 0,
                isSelected: level0InfiniteBlindTimer > 0,
                ammoText: level0InfiniteBlindTimer > 0 ? `${(level0InfiniteBlindTimer/60).toFixed(0)}s` : '7s'
            }
        ];

        ksRewards.forEach((r, idx) => {
            let x = ksStartX + idx * (ksBoxSize + ksGap);
            let y = startY;

            ctx.save();
            if (!r.isUnlocked) {
                // 1. 未解锁状态
                ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
                ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
                ctx.lineWidth = 1;
                ctx.fillRect(x, y, ksBoxSize, ksBoxSize);
                ctx.strokeRect(x, y, ksBoxSize, ksBoxSize);

                if (r.id === 'BLINDZONE') {
                    ctx.beginPath();
                    ctx.arc(x + ksBoxSize/2, y + ksBoxSize/2, 8, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
                    ctx.stroke();
                } else {
                    drawWeaponSilhouette(ctx, r.id, x, y, ksBoxSize, ksBoxSize, 'rgba(100, 116, 139, 0.4)', false);
                }

                ctx.fillStyle = '#64748B';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(isEn ? `${r.reqKills} K` : `${r.reqKills} 杀`, x + 3, y + 11);

                ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(r.keyStr, x + ksBoxSize - (r.keyStr.length * 5 + 3), y + ksBoxSize - 4);

            } else if (!r.isSelected) {
                // 2. 解锁但未选中状态 -> 灰色，显示连杀数和按键提示
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = '#94A3B8';
                ctx.lineWidth = 1.5;
                ctx.fillRect(x, y, ksBoxSize, ksBoxSize);
                ctx.strokeRect(x, y, ksBoxSize, ksBoxSize);

                const grayColor = '#94A3B8';

                if (r.id === 'BLINDZONE') {
                    ctx.beginPath();
                    ctx.arc(x + ksBoxSize/2, y + ksBoxSize/2, 9, 0, Math.PI * 2);
                    ctx.strokeStyle = grayColor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x + ksBoxSize/2, y + ksBoxSize/2, 3, 0, Math.PI * 2);
                    ctx.fillStyle = grayColor;
                    ctx.fill();
                } else {
                    drawWeaponSilhouette(ctx, r.id, x, y, ksBoxSize, ksBoxSize, grayColor, false);
                }

                ctx.fillStyle = grayColor;
                ctx.font = 'bold 9px monospace';
                ctx.fillText(isEn ? `${r.reqKills} K` : `${r.reqKills} 杀`, x + 3, y + 11);

                ctx.fillStyle = grayColor;
                ctx.font = 'bold 9px monospace';
                ctx.fillText(r.keyStr, x + ksBoxSize - (r.keyStr.length * 5 + 3), y + ksBoxSize - 4);

            } else {
                // 3. 选中状态 -> 橙色高亮，显示名称和弹药数/剩余数
                ctx.fillStyle = 'rgba(255, 153, 0, 0.2)';
                ctx.strokeStyle = '#FF9900';
                ctx.lineWidth = 2.2;
                ctx.fillRect(x, y, ksBoxSize, ksBoxSize);
                ctx.strokeRect(x, y, ksBoxSize, ksBoxSize);

                const orangeColor = '#FF9900';

                if (r.id === 'BLINDZONE') {
                    ctx.beginPath();
                    ctx.arc(x + ksBoxSize/2, y + ksBoxSize/2, 9, 0, Math.PI * 2);
                    ctx.strokeStyle = orangeColor;
                    ctx.lineWidth = 2.0;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x + ksBoxSize/2, y + ksBoxSize/2, 3, 0, Math.PI * 2);
                    ctx.fillStyle = orangeColor;
                    ctx.fill();
                } else {
                    drawWeaponSilhouette(ctx, r.id, x, y, ksBoxSize, ksBoxSize, orangeColor, true);
                }

                ctx.fillStyle = orangeColor;
                ctx.font = 'bold 9px monospace';
                ctx.fillText(r.name, x + 3, y + 11);

                ctx.fillStyle = orangeColor;
                ctx.font = 'bold 9px monospace';
                const label = r.ammoText;
                ctx.fillText(label, x + ksBoxSize - (label.length * 5 + 3), y + ksBoxSize - 4);
            }
            ctx.restore();
        });
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
    if (window.__viewState && window.__viewState !== 'playing') {
        ctx.fillStyle = '#020403';
        ctx.fillRect(0, 0, width, height);
        return;
    }
    const levelId = getCurrentLevelId();
    
    // Calculate smooth camera scroll position for Level 4 Yacht and Level 0 Test
    if (levelId === 'level4_yacht') {
        const mapWidth = window.level4MapWidth || 2400;
        const targetCamX = player.x - width / 2;
        window.cameraX = Math.max(0, Math.min(mapWidth - width, targetCamX));
        window.cameraY = height > 720 ? (height - 720) / 2 : 0;
    } else if (levelId === 'level0_test') {
        const mapWidth = window.level0MapWidth || 7200;
        const mapHeight = window.level0MapHeight || 240;
        const targetCamX = player.x - width / 2;
        window.cameraX = Math.max(0, Math.min(mapWidth - width, targetCamX));
        window.cameraY = (height - mapHeight) / 2;
    } else {
        window.cameraX = 0;
        window.cameraY = 0;
    }

    ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    if (levelId === 'level4_yacht' || levelId === 'level0_test') {
        ctx.translate(-(window.cameraX || 0), window.cameraY || 0);
    }
    
    if (levelId === 'level1_airport') {
        // 1. 机场关卡：现代大理石感灰色瓷砖地板（底色显著加深为精致的高端深钢灰色，使角色和各种战术指示界线格外清晰凸显）
        ctx.fillStyle = '#4B5358'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.48)'; // 高对比度的深色瓷砖缝隙，使网格格外出众
        ctx.lineWidth = 1.3;
        for(let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    } else if (levelId === 'level0_test') {
        // 0. 测试关卡：远东装甲列车与西伯利亚极寒雪原（7200px × 240px，长宽比 30:1）
        const mapW = window.level0MapWidth || 7200;
        const mapH = window.level0MapHeight || 240;
        const viewH = height || 720;
        const camY = window.cameraY || (viewH - mapH) / 2;

        // =========================================================================
        // 1. 远东极寒积雪雪原背景（Far East Snowy Tundra - 柔和冷调渐变与自然雪原）
        // =========================================================================
        // 北侧远景雪原 (y < 0)
        const northSnowGrad = ctx.createLinearGradient(0, -camY - 80, 0, 0);
        northSnowGrad.addColorStop(0, '#7b93ab');     // 远景极寒灰蓝冻原
        northSnowGrad.addColorStop(0.35, '#97acc2');  // 中景冷杉雪雾层
        northSnowGrad.addColorStop(0.75, '#b9ccd9');  // 浅灰蓝积雪层
        northSnowGrad.addColorStop(1, '#d5e2ec');     // 近轨积雪层
        ctx.fillStyle = northSnowGrad;
        ctx.fillRect(-800, -camY - 120, mapW + 1600, camY + 120);

        // 南侧近景雪原 (y > mapH)
        const southSnowGrad = ctx.createLinearGradient(0, mapH, 0, mapH + camY + 120);
        southSnowGrad.addColorStop(0, '#d5e2ec');     // 近轨积雪层
        southSnowGrad.addColorStop(0.3, '#b9ccd9');   // 浅灰蓝积雪层
        southSnowGrad.addColorStop(0.7, '#97acc2');   // 冻原雪地
        southSnowGrad.addColorStop(1, '#7b93ab');     // 远景极寒灰蓝
        ctx.fillStyle = southSnowGrad;
        ctx.fillRect(-800, mapH, mapW + 1600, camY + 120);

        // 远东雪原细节装饰：远景针叶林剪影、风吹雪纹理、冻原积雪丘陵起伏
        ctx.save();
        // (A) 远景针叶冷杉林剪影 (北侧远景)
        ctx.fillStyle = 'rgba(70, 95, 120, 0.42)';
        for (let treeX = -600; treeX < mapW + 600; treeX += 42) {
            const treeH = 34 + Math.abs((treeX * 17) % 28);
            const treeY = -camY + 16 + Math.abs((treeX * 7) % 24);
            ctx.beginPath();
            ctx.moveTo(treeX, treeY);
            ctx.lineTo(treeX - 10, treeY + treeH);
            ctx.lineTo(treeX + 10, treeY + treeH);
            ctx.closePath();
            ctx.fill();
        }
        // (B) 柔和风吹雪痕与积雪起伏线条 (North & South)
        ctx.strokeStyle = 'rgba(240, 246, 252, 0.45)';
        ctx.lineWidth = 1.8;
        for (let dy = -camY + 55; dy < -26; dy += 32) {
            ctx.beginPath();
            for (let dx = -600; dx < mapW + 600; dx += 100) {
                const waveY = dy + Math.sin((dx + dy) * 0.012) * 7;
                if (dx === -600) ctx.moveTo(dx, waveY);
                else ctx.lineTo(dx, waveY);
            }
            ctx.stroke();
        }
        for (let dy = mapH + 34; dy < mapH + camY + 60; dy += 32) {
            ctx.beginPath();
            for (let dx = -600; dx < mapW + 600; dx += 100) {
                const waveY = dy + Math.sin((dx - dy) * 0.012) * 7;
                if (dx === -600) ctx.moveTo(dx, waveY);
                else ctx.lineTo(dx, waveY);
            }
            ctx.stroke();
        }
        ctx.restore();

        // =========================================================================
        // 2. 铁道重型碎石路基、防腐枕木与双轨钢轨 (Ballast & Heavy Rails)
        // =========================================================================
        // 北侧铁道路基碎石带 (y: -26 ~ 0)
        ctx.fillStyle = '#243b53';
        ctx.fillRect(-800, -26, mapW + 1600, 26);
        ctx.fillStyle = 'rgba(217, 226, 236, 0.25)'; // 碎石积雪点缀
        for (let sx = -700; sx < mapW + 700; sx += 24) {
            ctx.fillRect(sx + Math.abs((sx * 3) % 12), -22 + Math.abs((sx * 7) % 18), 4, 3);
        }

        // 南侧铁道路基碎石带 (y: mapH ~ mapH + 26)
        ctx.fillStyle = '#243b53';
        ctx.fillRect(-800, mapH, mapW + 1600, 26);
        ctx.fillStyle = 'rgba(217, 226, 236, 0.25)';
        for (let sx = -700; sx < mapW + 700; sx += 24) {
            ctx.fillRect(sx + Math.abs((sx * 5) % 12), mapH + 4 + Math.abs((sx * 3) % 18), 4, 3);
        }

        // 重型防腐木枕木 (Sleepers)
        ctx.fillStyle = '#102a43';
        ctx.strokeStyle = '#0b1d30';
        ctx.lineWidth = 1;
        for (let tieX = -800; tieX < mapW + 800; tieX += 28) {
            // 上侧枕木
            ctx.fillRect(tieX, -24, 12, 24);
            ctx.strokeRect(tieX, -24, 12, 24);
            // 下侧枕木
            ctx.fillRect(tieX, mapH, 12, 24);
            ctx.strokeRect(tieX, mapH, 12, 24);
        }

        // 重型工字防冻钢轨 (Heavy Steel Rails)
        ctx.fillStyle = '#627d98';
        ctx.fillRect(-800, -10, mapW + 1600, 4);
        ctx.fillStyle = '#9fb3c8'; // 钢轨反光
        ctx.fillRect(-800, -9, mapW + 1600, 1.5);

        ctx.fillStyle = '#627d98';
        ctx.fillRect(-800, mapH + 6, mapW + 1600, 4);
        ctx.fillStyle = '#9fb3c8';
        ctx.fillRect(-800, mapH + 7, mapW + 1600, 1.5);

        // =========================================================================
        // 3. 装甲列车车身甲板与车厢内部地面 (Armored Train Floor & Steel Plates)
        // =========================================================================
        // 车厢内部军工重型钢板地面 (Deep Tactical Gunmetal Blue)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, mapW, mapH);

        // 工业防滑钢板与铆钉接缝方格
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1.0;
        for (let x = 0; x < mapW; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mapH); ctx.stroke();
        }
        for (let y = 0; y < mapH; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mapW, y); ctx.stroke();
        }

        // 车厢中央防滑战术通道地胶带 (Central Traction Runner)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, mapH / 2 - 28, mapW, 56);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(0, mapH / 2 - 28, mapW, 56);

        // 中轴行进指示引导线
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(0, mapH / 2);
        ctx.lineTo(mapW, mapH / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // =========================================================================
        // 4. 车厢间风挡贯通处与工业黄黑警戒条纹 (Vestibule Gangways at car junctions)
        // =========================================================================
        const carJunctions = [1200, 2400, 3600, 4800, 6000];
        carJunctions.forEach(jx => {
            // 风挡重型密封橡胶框
            ctx.fillStyle = '#0b1329';
            ctx.fillRect(jx - 18, 0, 36, mapH);
            
            // 黄黑警戒斜纹 (Hazard Stripes)
            ctx.save();
            ctx.beginPath();
            ctx.rect(jx - 12, 10, 24, mapH - 20);
            ctx.clip();
            ctx.fillStyle = '#eab308';
            ctx.fillRect(jx - 12, 10, 24, mapH - 20);
            ctx.fillStyle = '#0f172a';
            for (let sy = -20; sy < mapH + 30; sy += 16) {
                ctx.beginPath();
                ctx.moveTo(jx - 14, sy);
                ctx.lineTo(jx + 14, sy + 16);
                ctx.lineTo(jx + 14, sy + 24);
                ctx.lineTo(jx - 14, sy + 8);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // 风挡两侧液压减震立柱与门框
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = 2.0;
            ctx.strokeRect(jx - 16, 8, 32, mapH - 16);
        });

        // =========================================================================
        // 5. 车头重型除雪排障装甲犁与强光探照灯 (Locomotive Cowcatcher & Headlights)
        // =========================================================================
        // 车头 (x = mapW = 7200): V形重装除雪铲
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(mapW, 10);
        ctx.lineTo(mapW + 65, mapH / 2);
        ctx.lineTo(mapW, mapH - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 强光探照灯光锥 (Twin High-Intensity Beam)
        const lightGrad = ctx.createLinearGradient(mapW + 65, mapH / 2, mapW + 350, mapH / 2);
        lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
        lightGrad.addColorStop(0.3, 'rgba(250, 204, 21, 0.25)');
        lightGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(mapW + 65, mapH / 2 - 15);
        ctx.lineTo(mapW + 350, mapH / 2 - 85);
        ctx.lineTo(mapW + 350, mapH / 2 + 85);
        ctx.lineTo(mapW + 65, mapH / 2 + 15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // =========================================================================
        // 6. 暴风雪动态粒子系统 (Optimized Dynamic Blizzards Particle System)
        // =========================================================================
        // 初始化视口雪花粒子池（仅首次初始化 160 颗粒子，零 GC，极致性能）
        if (!window.level0SnowParticles) {
            window.level0SnowParticles = [];
            for (let i = 0; i < 160; i++) {
                window.level0SnowParticles.push({
                    relX: Math.random() * (width + 300) - 100, // 视口相对 X
                    y: -camY - 80 + Math.random() * (height + 160),
                    speedX: 5.5 + Math.random() * 8.5,        // 向左高速疾驰速度
                    speedY: 1.2 + Math.random() * 3.2,        // 向下飘落速度
                    size: 1.0 + Math.random() * 2.2,          // 雪花尺寸
                    alpha: 0.28 + Math.random() * 0.52,       // 透明度
                    trail: 6 + Math.random() * 12             // 运动模糊拖尾长度
                });
            }
        }

        // 仅在车身外部雪原（y < 12 或 y > mapH - 12 或 车头光锥前）绘制飘落雪花
        ctx.save();
        ctx.lineCap = 'round';
        const snowPool = window.level0SnowParticles;
        const currentCamX = window.cameraX || 0;
        const totalW = width + 300;
        const minY = -camY - 100;
        const maxY = mapH + camY + 100;

        for (let i = 0; i < snowPool.length; i++) {
            const p = snowPool[i];
            
            // 更新雪花位置（列车向右高速行驶，雪花相对向左下极速飞掠）
            p.relX -= p.speedX;
            p.y += p.speedY;

            // 循环回绕逻辑 (Wrap Around)
            if (p.relX < -150) {
                p.relX = width + Math.random() * 150;
                p.y = minY + Math.random() * (maxY - minY);
            }
            if (p.y > maxY) {
                p.y = minY;
                p.relX = Math.random() * totalW - 100;
            }

            const worldX = currentCamX + p.relX;
            const worldY = p.y;

            // 物理遮蔽：只在列车外侧雪地（y < 12 或 y > mapH - 12）以及车头前方（worldX > mapW）渲染
            if (worldY < 12 || worldY > mapH - 12 || worldX > mapW) {
                ctx.strokeStyle = `rgba(240, 248, 255, ${p.alpha})`;
                ctx.lineWidth = p.size;
                ctx.beginPath();
                ctx.moveTo(worldX, worldY);
                // 迎风 55° 斜拉拖尾，强化列车破雪疾驰的速度感
                ctx.lineTo(worldX + p.trail, worldY - p.trail * 0.35);
                ctx.stroke();
            }
        }
        ctx.restore();
    } else if (levelId === 'level5_hotel') {
        // 5. 闪灵红 (The Shining) 酒店大堂经典红色配色与橙黄几何格纹
        ctx.fillStyle = '#5C060B'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.32)'; // 暖橙色格缝
        ctx.lineWidth = 1.4;
        for(let x = 0; x < width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        
        // 对角线编织，重现《闪灵》地毯的几何图腾质感
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.12)';
        ctx.lineWidth = 1.0;
        for (let x = -height; x < width; x += 120) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height, height);
            ctx.stroke();
        }
    } else if (levelId === 'level3_bank') {
        // 3. 银行与金库关卡：夜间行动模式，深海极夜蓝底色与暗蓝战术瓷砖格纹
        ctx.fillStyle = '#0B132B'; 
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)'; // 柔和暗蓝网格缝
        ctx.lineWidth = 1.0;
        for(let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for(let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    } else if (levelId === 'level4_yacht') {
        // 4. 豪华超级游艇：深海蔚蓝海水背景 + 船头船尾蓝绿色低灯渐变发光 + 尊贵金褐色柚木甲板 (Teak Deck)
        const mapWidth = window.level4MapWidth || 2400;
        
        // Deep Sea ocean background (gorgeous deep night-sea blue)
        ctx.fillStyle = '#051429'; 
        ctx.fillRect(0, 0, mapWidth, height);
        
        // Draw subtle wave patterns in the ocean
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
        ctx.lineWidth = 1.5;
        for (let row = 20; row < height; row += 40) {
            ctx.beginPath();
            for (let col = 0; col < mapWidth; col += 80) {
                ctx.arc(col + (row % 80), row, 20, 0, Math.PI);
            }
            ctx.stroke();
        }

        // ==========================================
        // 船头与船尾的蓝绿色（Teal/Cyan）低灯（Underwater LED Lights）渐变发光效果
        // ==========================================
        ctx.save();
        
        // Helper to draw an extremely bright, multi-layered underwater light beam (fanned out with high neon bloom)
        function drawLightBeam(bx, by, angleDeg, length) {
            const rad = angleDeg * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            // 1. Draw outer ambient cone (wide, vibrant cyan-teal glow)
            ctx.save();
            ctx.beginPath();
            
            const startW_outer = 15;
            const endW_outer = 210; // wider cone for immense atmospheric scatter
            
            const sx1 = bx + (startW_outer / 2) * -sin;
            const sy1 = by + (startW_outer / 2) * cos;
            const sx2 = bx - (startW_outer / 2) * -sin;
            const sy2 = by - (startW_outer / 2) * cos;
            
            const ex = bx + length * cos;
            const ey = by + length * sin;
            const ex1 = ex + (endW_outer / 2) * -sin;
            const ey1 = ey + (endW_outer / 2) * cos;
            const ex2 = ex - (endW_outer / 2) * -sin;
            const ey2 = ey - (endW_outer / 2) * cos;
            
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(ex1, ey1);
            ctx.lineTo(ex2, ey2);
            ctx.lineTo(sx2, sy2);
            ctx.closePath();
            
            const outerGrad = ctx.createLinearGradient(bx, by, ex, ey);
            outerGrad.addColorStop(0, 'rgba(34, 211, 238, 0.7)');  // Extremely intense cyan
            outerGrad.addColorStop(0.2, 'rgba(13, 148, 136, 0.45)'); // Beautiful rich teal
            outerGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.18)');  // Indigo/cyan scattering
            outerGrad.addColorStop(1, 'rgba(5, 20, 41, 0)');
            
            ctx.fillStyle = outerGrad;
            ctx.fill();
            ctx.restore();

            // 2. Draw inner intense core beam (narrower and brighter)
            ctx.save();
            ctx.beginPath();
            
            const startW_inner = 8;
            const endW_inner = 90;
            
            const isx1 = bx + (startW_inner / 2) * -sin;
            const isy1 = by + (startW_inner / 2) * cos;
            const isx2 = bx - (startW_inner / 2) * -sin;
            const isy2 = by - (startW_inner / 2) * cos;
            
            const iex1 = ex + (endW_inner / 2) * -sin;
            const iey1 = ey + (endW_inner / 2) * cos;
            const iex2 = ex - (endW_inner / 2) * -sin;
            const iey2 = ey - (endW_inner / 2) * cos;
            
            ctx.moveTo(isx1, isy1);
            ctx.lineTo(iex1, iey1);
            ctx.lineTo(iex2, iey2);
            ctx.lineTo(isx2, isy2);
            ctx.closePath();
            
            const innerGrad = ctx.createLinearGradient(bx, by, ex, ey);
            innerGrad.addColorStop(0, '#FFFFFF'); // Hot white core
            innerGrad.addColorStop(0.12, '#E0F7FA'); // Aqua neon white
            innerGrad.addColorStop(0.35, 'rgba(34, 211, 238, 0.88)'); // Vivid glowing cyan
            innerGrad.addColorStop(0.7, 'rgba(13, 148, 136, 0.35)'); // Mid-teal
            innerGrad.addColorStop(1, 'rgba(5, 20, 41, 0)');
            
            ctx.fillStyle = innerGrad;
            ctx.fill();
            ctx.restore();

            // 3. Ultra-bright high-intensity laser line down the center for ray look
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(ex, ey);
            ctx.lineWidth = 3.5;
            const lineGrad = ctx.createLinearGradient(bx, by, ex, ey);
            lineGrad.addColorStop(0, '#FFFFFF');
            lineGrad.addColorStop(0.35, 'rgba(34, 211, 238, 0.95)');
            lineGrad.addColorStop(1, 'rgba(5, 20, 41, 0)');
            ctx.strokeStyle = lineGrad;
            ctx.stroke();
            ctx.restore();

            // 4. Draw source lens flare (spotlight fixture)
            ctx.save();
            const sourceGlow = ctx.createRadialGradient(bx, by, 1, bx, by, 25);
            sourceGlow.addColorStop(0, '#FFFFFF');
            sourceGlow.addColorStop(0.25, '#E0F7FA');
            sourceGlow.addColorStop(0.55, 'rgba(34, 211, 238, 0.9)');
            sourceGlow.addColorStop(0.85, 'rgba(13, 148, 136, 0.45)');
            sourceGlow.addColorStop(1, 'rgba(13, 148, 136, 0)');
            ctx.fillStyle = sourceGlow;
            ctx.beginPath();
            ctx.arc(bx, by, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // A. 船尾低灯围合光幕 (Stern Surrounding Lights Wrap)
        // 绘制一个三面抱合船尾的大型高亮霓虹光幕 (Wraps top, left, and bottom sides of the stern!)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(380, 44);
        ctx.lineTo(44, 44);
        ctx.lineTo(44, 676);
        ctx.lineTo(380, 676);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Set neon shadow for maximum bloom/glow effect (超强发光感)
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 25;

        // Layer 1: Ambient super-wide soft cyan glow (extremely atmospheric)
        ctx.lineWidth = 140;
        ctx.strokeStyle = 'rgba(13, 148, 136, 0.22)';
        ctx.stroke();

        // Layer 2: Medium glowing cyan
        ctx.lineWidth = 75;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.38)';
        ctx.stroke();

        // Layer 3: High intensity neon cyan
        ctx.lineWidth = 30;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
        ctx.stroke();

        // Layer 4: Bright inner neon core (looks white-hot)
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(224, 247, 250, 0.95)';
        ctx.stroke();
        ctx.restore();

        // 船尾的多角度散射光束
        // 两个后角向外45度角散射
        drawLightBeam(50, 50, -135, 340);
        drawLightBeam(50, 670, 135, 340);

        // 左舷直射后方光束
        drawLightBeam(44, 180, 175, 320);
        drawLightBeam(44, 300, 180, 360);
        drawLightBeam(44, 420, 180, 360);
        drawLightBeam(44, 540, 185, 320);

        // 船尾上缘向上散射
        drawLightBeam(160, 44, -105, 300);
        drawLightBeam(280, 44, -95, 300);

        // 船尾下缘向下散射
        drawLightBeam(160, 676, 105, 300);
        drawLightBeam(280, 676, 95, 300);

        // B. 船头低灯与锯齿融为一体的散射光束 (Bow Lights & Sawtooth Integrated Rays)
        // 沿着锯齿的内外边缘节点散射多根强力光柱，完美符合手绘示意图
        // 上半部锯齿节点 (Upper Taper Sawteeth)
        drawLightBeam(1800, 60, -115, 300);   // Step 1 Corner
        drawLightBeam(1950, 140, -95, 320);   // Step 2 Corner
        drawLightBeam(2100, 220, -75, 340);   // Step 3 Corner
        drawLightBeam(2250, 300, -55, 360);   // Step 4 Corner

        // 下半部锯齿节点 (Lower Taper Sawteeth)
        drawLightBeam(1800, 660, 115, 300);   // Step 1 Corner
        drawLightBeam(1950, 580, 95, 320);    // Step 2 Corner
        drawLightBeam(2100, 500, 75, 340);    // Step 3 Corner
        drawLightBeam(2250, 420, 55, 360);    // Step 4 Corner

        // 船头正前方最前端 (x=2350, y=360) 的3根强力扇形探照灯，穿透深海
        drawLightBeam(2350, 352, -15, 380);   // Upward fanned
        drawLightBeam(2350, 360, 0, 440);     // Straight forward core
        drawLightBeam(2350, 368, 15, 380);    // Downward fanned
        
        ctx.restore();
        // ==========================================

        // Draw Yacht Steel Hull outline base shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.moveTo(56, 56);
        ctx.lineTo(1804, 56);
        ctx.lineTo(2354, 360);
        ctx.lineTo(1804, 674);
        ctx.lineTo(56, 674);
        ctx.closePath();
        ctx.fill();

        // Draw Yacht Steel Hull base structure
        ctx.fillStyle = '#334155'; // Steel blue gray
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(1800, 50);
        ctx.lineTo(2350, 360);
        ctx.lineTo(1800, 670);
        ctx.lineTo(50, 670);
        ctx.closePath();
        ctx.fill();

        // Draw Yacht Luxury Teak Deck
        ctx.fillStyle = '#be8c54'; // Rich golden brown wood
        ctx.beginPath();
        ctx.moveTo(52, 52);
        ctx.lineTo(1798, 52);
        ctx.lineTo(2346, 360);
        ctx.lineTo(1798, 668);
        ctx.lineTo(52, 668);
        ctx.closePath();
        ctx.fill();

        // Draw Teak Plank seams
        ctx.strokeStyle = 'rgba(67, 43, 21, 0.28)';
        ctx.lineWidth = 1;
        for (let rawTy = 60; rawTy < 660; rawTy += 14) {
            let ty = rawTy;
            ctx.beginPath();
            if (rawTy <= 360) {
                let tFrac = (rawTy - 52) / 308;
                let xLimit = 1798 + tFrac * 548;
                ctx.moveTo(52, ty);
                ctx.lineTo(xLimit, ty);
            } else {
                let tFrac = (rawTy - 360) / 308;
                let xLimit = 2346 - tFrac * 548;
                ctx.moveTo(52, ty);
                ctx.lineTo(xLimit, ty);
            }
            ctx.stroke();
        }

        // Draw Yacht swimming pool beautifully (Horizontal as requested)
        ctx.fillStyle = 'rgba(6, 182, 212, 0.22)'; // Translucent aquatic cyan
        ctx.fillRect(110, 280, 300, 160);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(110, 280, 300, 160);
        
        // Swimming pool steps (horizontal style steps)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(114, 284, 30, 152);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let stepY = 300; stepY < 440; stepY += 24) {
            ctx.beginPath(); ctx.moveTo(114, stepY); ctx.lineTo(144, stepY); ctx.stroke();
        }

        // Helicopter Landing pad circle visual overlay
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(1950, 360, 80, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.font = 'bold 32px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("H", 1950, 360);
        ctx.textBaseline = 'alphabetic'; // Reset
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
    // 1. 先绘制游泳池/水体表面障碍物（作为底层水面）
    obstacles.filter(o => o.type === 'pool' || o.label === 'SWIMMING POOL').forEach(drawObstacle);
    // 2. 绘制道具（包含漂浮在水面上的摩托艇）
    drawProps();
    drawTraps();
    // 3. 绘制普通墙体与遮挡建筑物
    obstacles.filter(o => o.type !== 'pool' && o.label !== 'SWIMMING POOL').forEach(drawObstacle);
    drawSecurityGates();

    if (levelId === 'level3_bank') {
        drawNightShadowMask();
    }

    if (blindActive && blindZone) {
        ctx.save();
        if (level0InfiniteBlindTimer > 0) {
            // 在 Level 3 银行关卡遮罩未关闭 (!level3TargetSecured) 时，不叠加全图盲区的黑化填充，仅保留绿色战术外框
            const isLevel3MaskActive = (levelId === 'level3_bank' && !level3TargetSecured && player.hp > 0);
            const mapW = (levelId === 'level4_yacht') ? (window.level4MapWidth || 2400) : (levelId === 'level0_test' ? (window.level0MapWidth || 7200) : width);
            const mapH = (levelId === 'level0_test') ? (window.level0MapHeight || 240) : height;
            if (!isLevel3MaskActive) {
                ctx.fillStyle = 'rgba(4, 14, 9, 0.88)';
                ctx.fillRect(0, 0, mapW, mapH);
            }
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(2, 2, mapW - 4, mapH - 4);
        } else {
            ctx.fillStyle = 'rgba(4, 14, 9, 0.92)';
            ctx.beginPath(); ctx.arc(blindZone.x, blindZone.y, blindZone.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#00FF66'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.stroke();
        }
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
        const isInBlindTarget = inBlindZone(e.x, e.y);

        // 条件：在【玩家视野内】、【敌人主动警戒/攻击】或【处于盲区高亮状态】时，渲染该敌人
        if (inSight || isAttackingOrAlert || isInBlindTarget) {
            if (e.hp > 0) {
                const playerInBlind = inBlindZone(player.x, player.y);
                let fovAngle = Math.PI / 3;
                let fovRange = 260;
                if (e.isObserver && playerInBlind) {
                    fovAngle = Math.PI / 6; // restricted to 30 degrees (Math.PI / 6)
                    fovRange = 110; // restricted range
                }
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
    
    // UAV 敌人战术锁定框 (仅当非暂停、且手持 UAV 且剩余弹药 > 0 时生效，标注敌人类型如 OBSERVER)
    if (!isPaused && isKillstreakSupportedLevel(levelId) && currentWeapon && currentWeapon.id === WEAPONS.UAV.id && level0UavAmmo > 0) {
        let tgtIdx = 1;
        enemies.forEach(e => {
            if (e.hp <= 0) return;
            ctx.save();
            ctx.translate(e.x, e.y);

            const isObs = e.isObserver;
            let typeTag = isObs ? 'OBSERVER' : 'PATROL';
            const boxColor = isObs ? '#00E5FF' : '#00FF66';

            ctx.strokeStyle = boxColor;
            ctx.fillStyle = boxColor;
            ctx.shadowColor = boxColor;
            ctx.shadowBlur = 10;
            ctx.lineWidth = 1.8;

            const boxSize = 42;
            const half = boxSize / 2;
            const cornerLen = 10;

            ctx.beginPath();
            ctx.moveTo(-half, -half + cornerLen); ctx.lineTo(-half, -half); ctx.lineTo(-half + cornerLen, -half);
            ctx.moveTo(half - cornerLen, -half); ctx.lineTo(half, -half); ctx.lineTo(half, -half + cornerLen);
            ctx.moveTo(half - cornerLen, half); ctx.lineTo(half, half); ctx.lineTo(half, half - cornerLen);
            ctx.moveTo(-half + cornerLen, half); ctx.lineTo(-half, half); ctx.lineTo(-half, half - cornerLen);
            ctx.stroke();

            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`TGT-0${tgtIdx} [${typeTag}]`, 0, -half - 6);
            tgtIdx++;

            ctx.restore();
        });
    }

    if (player.hp > 0) {
        ctx.save();
        const worldMouse = getWorldMouse();

        if (!isPaused && isKillstreakSupportedLevel(levelId) && currentWeapon && currentWeapon.id === WEAPONS.UAV.id) {
            // Level 0 UAV 专用战术卫星瞄准准星
            ctx.translate(worldMouse.x, worldMouse.y);
            const now = Date.now() * 0.003;
            ctx.strokeStyle = '#00FF66';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = '#00FF66';
            ctx.shadowBlur = 10;
            
            ctx.beginPath();
            ctx.arc(0, 0, 26, now, now + Math.PI * 1.5);
            ctx.stroke();
            
            ctx.strokeStyle = '#00E5FF';
            ctx.beginPath();
            ctx.arc(0, 0, 34, -now, -now + Math.PI * 1.2);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, -10); ctx.lineTo(10, 0); ctx.lineTo(0, 10); ctx.lineTo(-10, 0); ctx.closePath();
            ctx.stroke();

            ctx.fillStyle = '#00FF66';
            ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();

            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`[UAV STRIKE LOCK]`, 0, -42);
            ctx.fillStyle = '#00E5FF';
            ctx.fillText(`STRIKES: ${level0UavAmmo}`, 0, 48);
        } else {
            ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(worldMouse.x, worldMouse.y); ctx.stroke();
            ctx.strokeStyle = '#00FF66'; ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(worldMouse.x, worldMouse.y, 6, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        drawAgent(player.x, player.y, player.angle, true, player.walkCycle, false, player.hp, player.maxHp, 0, 1.0);
    }

    particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.maxLife ? p.life / p.maxLife : 1));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1.0;

    grenades.forEach(g => {
        ctx.save();
        ctx.fillStyle = '#FF9900';
        ctx.beginPath(); ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    // Batched Player Bullets
    ctx.fillStyle = '#FF9900';
    ctx.beginPath();
    playerBullets.forEach(b => { 
        ctx.moveTo(b.x + (b.radius || 3.5), b.y);
        ctx.arc(b.x, b.y, b.radius || 3.5, 0, Math.PI * 2); 
    });
    ctx.fill();
    
    // Batched Enemy Bullets
    ctx.fillStyle = '#FF9900';
    ctx.beginPath();
    enemyBullets.forEach(eb => { 
        ctx.moveTo(eb.x + 3.5, eb.y);
        ctx.arc(eb.x, eb.y, 3.5, 0, Math.PI * 2); 
    });
    ctx.fill();

    ctx.restore(); // 恢复相机平移状态，准备在屏幕固定空间绘制 HUD

    drawWeaponIcons();
}

window.__gameLoopId = (window.__gameLoopId || 0) + 1;
const myLoopId = window.__gameLoopId;

function gameLoop() {
    if (window.__gameLoopId !== myLoopId) {
        return; // Prevent duplicate concurrent loops
    }
    requestAnimationFrame(gameLoop);
    if (ensureCanvas()) {
        try {
            update();
            draw();
        } catch (e) {
            console.error("Engine loop error caught:", e);
        }
    }
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
if (!window.__gameEngineSpawned) {
    window.__gameEngineSpawned = true;
    spawnWave();
}
gameLoop();
