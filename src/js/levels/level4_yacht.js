// =========================================================================
// LEVEL 4: 皇家豪华超级游艇 (ROYAL SUPER YACHT) - 移步换景正式关卡
// =========================================================================
// 严格参照手绘平面图，采用 2400px 横向超长地图自适应平滑滚动高精设计
// =========================================================================

window.level4MapWidth = 2400; // 设定游艇关卡世界实际总宽度

const LEVEL_YACHT = {
    id: "level4_yacht",
    name: "豪华超级游艇",
    themeColor: "#051429",
    gridColor: "rgba(6, 182, 212, 0.25)",
    accentColor: "#06B6D4",
    playerStart: { x: 80, y: 360 }, // 玩家从尾部开放式甲板开始，完美避开泳池
    
    getMapLayout: (width, height) => {
        const mapWidth = window.level4MapWidth || 2400;

        const rawObstacles = [
                // ==========================================
                // 1. 船身外侧护栏与收缩结构 (Outer Hull & Railings)
                // ==========================================
                { x: 50, y: 50, w: 500, h: 12, type: 'low_wall', label: 'STERN PORT BALUSTRADE', displayName: 'STERN RAIL', labelX: 250, labelY: 44 },
                { x: 50, y: 658, w: 500, h: 12, type: 'low_wall', label: 'STERN STARBOARD BALUSTRADE', hideLabel: true },
                { x: 38, y: 60, w: 12, h: 600, type: 'low_wall', label: 'STERN TRANSOM BALUSTRADE', hideLabel: true },

                // 船首斜向收拢的物理碰撞楼梯 (Bow Taper)
                { x: 1800, y: 0, w: 150, h: 60, type: 'solid', isOceanMask: true },
                { x: 1950, y: 0, w: 150, h: 140, type: 'solid', isOceanMask: true },
                { x: 2100, y: 0, w: 150, h: 220, type: 'solid', isOceanMask: true },
                { x: 2250, y: 0, w: 110, h: 300, type: 'solid', isOceanMask: true },
                { x: 1800, y: 660, w: 150, h: 60, type: 'solid', isOceanMask: true },
                { x: 1950, y: 580, w: 150, h: 140, type: 'solid', isOceanMask: true },
                { x: 2100, y: 500, w: 150, h: 220, type: 'solid', isOceanMask: true },
                { x: 2250, y: 420, w: 110, h: 300, type: 'solid', isOceanMask: true },
                { x: 2360, y: 0, w: 40, h: 720, type: 'solid', isOceanMask: true },

                // 船首外舷护栏 (Bow Railings)
                { x: 1800, y: 60, w: 150, h: 12, type: 'low_wall', label: 'BOW PORT RAIL', isOceanMask: true, hideLabel: true },
                { x: 1950, y: 140, w: 150, h: 12, type: 'low_wall', label: 'BOW PORT RAIL', isOceanMask: true, hideLabel: true },
                { x: 2100, y: 220, w: 150, h: 12, type: 'low_wall', label: 'BOW PORT RAIL', isOceanMask: true, hideLabel: true },
                { x: 2250, y: 300, w: 110, h: 12, type: 'low_wall', label: 'BOW PORT RAIL', isOceanMask: true, hideLabel: true },
                { x: 1800, y: 648, w: 150, h: 12, type: 'low_wall', label: 'BOW STARBOARD RAIL', isOceanMask: true, hideLabel: true },
                { x: 1950, y: 568, w: 150, h: 12, type: 'low_wall', label: 'BOW STARBOARD RAIL', isOceanMask: true, hideLabel: true },
                { x: 2100, y: 488, w: 150, h: 12, type: 'low_wall', label: 'BOW STARBOARD RAIL', isOceanMask: true, hideLabel: true },
                { x: 2250, y: 408, w: 110, h: 12, type: 'low_wall', label: 'BOW STARBOARD RAIL', isOceanMask: true, hideLabel: true },

                // 船舱外围钢板墙 (Cabin Superstructure Outer Boundary)
                { x: 550, y: 60, w: 1250, h: 12, type: 'solid', label: 'CABIN PORT SUPERSTRUCTURE', hideLabel: true },
                { x: 550, y: 648, w: 1250, h: 12, type: 'solid', label: 'CABIN STARBOARD SUPERSTRUCTURE', hideLabel: true },

                // ==========================================
                // 2. ZONE A: 尾甲板休闲与恒温泳池 (Strict Hand-drawn layout)
                // ==========================================
                // 恒温游泳池 (Swimming Pool - Horizontal & Perfectly Centered Vertically & Horizontally in Zone A)
                { x: 110, y: 280, w: 300, h: 160, type: 'pool', label: 'SWIMMING POOL', labelX: 220, labelY: 360 },

                // 右上对称的 L 型墙：从新边界 x=550 往左，并转折向下 (吧台/前廊设计，严格与下方对称，每一道杠都不准改)
                { x: 550, y: 72, w: 12, h: 108, type: 'solid' },  // 边界垂直段 (y: 72 -> 180)
                { x: 460, y: 180, w: 102, h: 12, type: 'solid' },  // 水平段 (x: 460 -> 562)
                { x: 460, y: 180, w: 12, h: 50, type: 'solid' },   // 左侧垂直下折 (y: 180 -> 230，与下方 y: 478 -> 528 完全对称)

                // 右下对称的 L 型墙：从边界 x=550 往左连通吧台 (严格按图：保留 460 向上长出的小竖墙，以及 550 垂直外墙底段，去除 y=420-528 段)
                { x: 460, y: 478, w: 12, h: 50, type: 'solid' },   // 左侧垂直上折 (y: 478 -> 528)
                { x: 460, y: 528, w: 102, h: 12, type: 'solid' },  // 水平段 (x: 460 -> 562, 吧台)

                // ==========================================
                // 3. ZONE B: 公共卫浴、书房、吧台、沙龙、餐厅 (Strict Hand-drawn layout)
                // ==========================================
                // --- ZONE B 顶层：公共卫生间 & 书房间 & 前厅走廊 ---
                // (A) 公共卫生间与左侧前厅的分隔墙 X: 785，根据图纸在中间留出开口 ("开在这里") - 缩减开口到 72px，拉长墙体
                { x: 785, y: 72, w: 12, h: 56, type: 'solid' },
                { x: 785, y: 200, w: 12, h: 100, type: 'solid' }, // 留出 y: 128 -> 200 的 72px 门洞，非常顺畅

                // 卫生间底壁：根据图纸完全封闭，不留任何开口 ("这里没有开口")
                { x: 785, y: 300, w: 125, h: 12, type: 'solid' },

                // (B) 书房间 (Study Room) 的左右垂直分隔墙
                // 中隔墙在 X: 910，自顶向下直达 Y: 300 (完全封闭无开口)
                { x: 910, y: 72, w: 12, h: 228, type: 'solid' },

                // 右壁在 X: 1040 (这是 Zone B 到 Zone C 的分界墙 / 书房左墙)
                // 留出 Y: 140 到 220 之间的 80px 门洞
                { x: 1040, y: 72, w: 12, h: 68, type: 'solid' },
                { x: 1040, y: 220, w: 12, h: 80, type: 'solid' },

                // 卫生间内侧水平分隔墙：从 X: 910 往左延伸到 X: 855 (在左侧 785-855 留出 70px 通畅门洞，拉长墙体)
                { x: 855, y: 180, w: 55, h: 12, type: 'solid' },
                // 书房底壁：从 X: 910 往右延伸到 X: 970，在右侧 970-1040 留出 70px 通畅门洞，拉长墙体
                { x: 910, y: 300, w: 60, h: 12, type: 'solid' },

                // --- ZONE B 底层：沙龙 & 餐厅 ---
                // 左侧垂直外墙在 X: 550, 仅保留底部 y: 528 到 y: 648 的 120px 长度 (与左侧吧台构成完整的底部 L-wall)
                { x: 550, y: 528, w: 12, h: 120, type: 'low_wall' },

                // 中间垂直分界墙在 X: 785, 自底向上直达 Y: 420 (全封闭)
                { x: 785, y: 420, w: 12, h: 228, type: 'low_wall' },

                // 沙龙 (左侧房间) 顶壁完全敞开 (无 y: 420 的墙)，方便行走
                // 餐厅 (右侧房间) 顶壁横墙：从 X: 855 到 X: 1040 (在左侧 785-855 紧邻中隔墙留出 70px 通畅门洞，拉长墙体)
                { x: 855, y: 420, w: 185, h: 12, type: 'low_wall' },

                // 右侧垂直分界墙在 X: 1040 (这是 Zone B 到 Zone C 的分界墙 / 厨房左墙)
                // 留出 Y: 490 到 570 之间的 80px 门洞
                { x: 1040, y: 420, w: 12, h: 70, type: 'low_wall' },
                { x: 1040, y: 570, w: 12, h: 78, type: 'low_wall' },

                // ==========================================
                // 4. ZONE C: OWNER MASTER SUITE & VIP CABINS (Strict hand-drawn map layout)
                // ==========================================
                // --- Row 1: TOP ROW (Y: 72 - 300) ---
                // Vertical divider between Study and Master Bedroom: X: 1420, Y: 72 to 300 (door at Y: 150 - 220)
                { x: 1420, y: 72, w: 12, h: 78, type: 'solid' },
                { x: 1420, y: 220, w: 12, h: 80, type: 'solid' },

                // Right boundary wall at X: 1800, Y: 72 to 300 (solid)
                { x: 1800, y: 72, w: 12, h: 228, type: 'solid' },

                // Study bottom wall (Y: 300, X: 1040 - 1420): Completely solid (no door to corridor)
                { x: 1040, y: 300, w: 380, h: 12, type: 'solid' },

                // Master Bedroom bottom wall (Y: 300, X: 1420 - 1800): Doorway at X: 1450 - 1530
                { x: 1420, y: 300, w: 30, h: 12, type: 'solid' },
                { x: 1530, y: 300, w: 270, h: 12, type: 'solid' },

                // Master Bathroom (top-right L-shaped wall): partitioned inside Master Bedroom X: 1620 - 1800, Y: 72 - 180
                // Vertical part
                { x: 1620, y: 72, w: 12, h: 108, type: 'solid' },
                // Horizontal part (leaving door at X: 1740 - 1800)
                { x: 1680, y: 180, w: 120, h: 12, type: 'solid' },

                // --- Row 2: BOTTOM ROW (Y: 420 - 648) ---
                // Vertical divider between Kitchen and Guest Room: X: 1260, Y: 420 to 648 (solid)
                { x: 1260, y: 420, w: 12, h: 228, type: 'solid' },

                // Vertical divider between Guest Room and VIP Suite: X: 1480, Y: 420 to 648 (solid)
                { x: 1480, y: 420, w: 12, h: 228, type: 'solid' },

                // Right boundary wall at X: 1800, Y: 420 to 648 (solid)
                { x: 1800, y: 420, w: 12, h: 228, type: 'solid' },

                // Kitchen top wall (Y: 420, X: 1040 - 1260): completely solid
                { x: 1040, y: 420, w: 220, h: 12, type: 'low_wall' },

                // Guest Room top wall (Y: 420, X: 1260 - 1480): Doorway at X: 1330 - 1410
                { x: 1260, y: 420, w: 70, h: 12, type: 'solid' },
                { x: 1410, y: 420, w: 70, h: 12, type: 'solid' },

                // VIP Suite top wall (Y: 420, X: 1480 - 1800): Doorway at X: 1500 - 1580
                { x: 1480, y: 420, w: 20, h: 12, type: 'solid' },
                { x: 1580, y: 420, w: 220, h: 12, type: 'solid' },

                // VIP Bathroom (top-right L-shaped wall): partitioned inside VIP Suite X: 1620 - 1800, Y: 420 - 530
                // Vertical part
                { x: 1620, y: 420, w: 12, h: 110, type: 'solid' },
                // Horizontal part (leaving door at X: 1740 - 1800)
                { x: 1680, y: 530, w: 120, h: 12, type: 'solid' }
            ];

            const rawProps = [
                // === ZONE A: 休闲区 (Leisure Area) ===
                // Top-left Leisure Area (above swimming pool, shifted down to y: 190 to avoid player HUD)
                { type: 'sofa', x: 180, y: 190, w: 45, h: 22, label: 'WHITE LOUNGE CHAIR', displayName: 'LOUNGER', facing: 'down', color: 'white', tagPosition: 'bottom' },
                { type: 'desk', x: 240, y: 190, w: 20, h: 20, label: 'LEISURE SIDE TABLE', hideLabel: true, tagPosition: 'bottom' },
                // Bottom-left Leisure Area (below swimming pool, oriented up towards pool)
                { type: 'sofa', x: 180, y: 510, w: 45, h: 22, label: 'WHITE LOUNGE CHAIR', displayName: 'LOUNGER', facing: 'up', color: 'white', tagPosition: 'top' },
                { type: 'desk', x: 240, y: 510, w: 20, h: 20, label: 'LEISURE SIDE TABLE', hideLabel: true, tagPosition: 'top' },
                { type: 'jetski', x: 220, y: 340, w: 80, h: 40, label: 'RACER JET SKI', displayName: 'RACER JET SKI', facing: 'right', tagPosition: 'top' },

                // === ZONE A/B 分界: 吧台 (Bar Counters) ===
                // Upper Bar Counter (near the top L-wall)
                { type: 'desk', x: 480, y: 195, w: 60, h: 20, label: 'BAR COUNTER', tagPosition: 'bottom' },
                // Lower Bar Counter (near the bottom L-wall)
                { type: 'desk', x: 480, y: 500, w: 60, h: 20, label: 'BAR COUNTER', tagPosition: 'top' },

                // === ZONE B: 沙龙 (Grand Salon) ===
                // Top-middle Salon (lobby/lounge space)
                { type: 'sofa', x: 580, y: 100, w: 60, h: 25, label: 'SALON COUCH', displayName: 'SALON SOFA', facing: 'down', tagPosition: 'bottom' },
                { type: 'desk', x: 660, y: 100, w: 30, h: 25, label: 'SALON COFFEE TABLE', hideLabel: true, tagPosition: 'bottom' },
                // Bottom-middle Salon (lower lounge space, oriented up to face the room)
                { type: 'sofa', x: 580, y: 600, w: 60, h: 25, label: 'SALON COUCH', displayName: 'SALON SOFA', facing: 'up', tagPosition: 'top' },
                { type: 'desk', x: 660, y: 600, w: 30, h: 25, label: 'SALON COFFEE TABLE', hideLabel: true, tagPosition: 'top' },

                // === ZONE B: 卫生间 (Public Toilets) ===
                // 男厕所 (Men's Toilet - upper section)
                { type: 'desk', x: 860, y: 90, w: 35, h: 18, label: 'MENS VANITY', tagPosition: 'bottom' },
                // 女厕所 (Women's Toilet - lower section)
                { type: 'desk', x: 860, y: 240, w: 35, h: 18, label: 'WOMENS VANITY', tagPosition: 'top' },

                // === ZONE B: 员工房间 (Staff Room / Crew Cabin) ===
                // Located at upper-right of Zone B (X: 910 - 1040, Y: 72 - 300)
                { type: 'bed', x: 928, y: 90, w: 35, h: 55, label: 'STAFF BED A', tagPosition: 'bottom' },
                { type: 'bed', x: 980, y: 90, w: 35, h: 55, label: 'STAFF BED B', tagPosition: 'bottom' },
                { type: 'desk', x: 928, y: 170, w: 35, h: 22, label: 'STAFF DESK A', tagPosition: 'top' },
                { type: 'desk', x: 928, y: 220, w: 35, h: 22, label: 'STAFF DESK B', tagPosition: 'bottom' },

                // === ZONE B: 餐厅 (Restaurant) ===
                // Located at bottom-right of Zone B (X: 785 - 1040, Y: 420 - 648)
                { type: 'desk', x: 900, y: 520, w: 90, h: 40, label: 'DINING TABLE', tagPosition: 'bottom' },

                // === NEW ZONE C: OWNER MASTER SUITE & VIP CABINS ===
                // 1. 书房 (Study Room) [X: 1040 - 1420, Y: 72 - 300]
                { type: 'sofa', x: 1060, y: 84, w: 25, h: 25, label: 'STUDY CHAIR', hideLabel: true, facing: 'right', color: 'brown', tagPosition: 'bottom' },
                { type: 'desk', x: 1105, y: 84, w: 50, h: 25, label: 'OWNERS STUDY DESK', displayName: 'STUDY DESK', facing: 'up', tagPosition: 'bottom' },
                { type: 'sofa', x: 1175, y: 84, w: 25, h: 25, label: 'STUDY CHAIR', hideLabel: true, facing: 'left', color: 'brown', tagPosition: 'bottom' },
                { type: 'desk', x: 1210, y: 84, w: 120, h: 12, label: 'STUDY WALL TV', facing: 'down', tagPosition: 'bottom' },
                { type: 'sofa', x: 1200, y: 263, w: 140, h: 25, label: 'STUDY LONG COUCH', facing: 'up', tagPosition: 'top' },

                // 2. 主卧 (Master Bedroom) [X: 1420 - 1800, Y: 72 - 300]
                { type: 'table', x: 1440, y: 84, w: 160, h: 22, label: 'MASTER WARDROBE', tagPosition: 'bottom' },
                { type: 'sofa', x: 1440, y: 238, w: 25, h: 50, label: 'MASTER COUCH', facing: 'right', tagPosition: 'top' },
                { type: 'bed', x: 1700, y: 218, w: 85, h: 70, label: 'OWNERS KING BED', facing: 'right', tagPosition: 'bottom' },

                // 3. 主卧卫生间 (Master Bathroom) [X: 1620 - 1800, Y: 72 - 180]
                { type: 'desk', x: 1690, y: 84, w: 55, h: 24, label: 'MASTER VANITY', facing: 'down', tagPosition: 'bottom' },

                // 4. 厨房 (Galley/Kitchen) [X: 1040 - 1260, Y: 420 - 648]
                { type: 'desk', x: 1235, y: 460, w: 25, h: 80, label: 'GALLEY COOKING STATION', tagPosition: 'left' },
                { type: 'desk', x: 1060, y: 600, w: 120, h: 25, label: 'GALLEY COUNTER', facing: 'up', tagPosition: 'top' },

                // 5. 客房 (Guest Room) [X: 1260 - 1480, Y: 420 - 648]
                { type: 'bed', x: 1330, y: 510, w: 75, h: 50, label: 'GUEST BED', facing: 'right', tagPosition: 'bottom' },

                // 6. VIP套房 (VIP Suite) [X: 1480 - 1800, Y: 420 - 648]
                { type: 'sofa', x: 1495, y: 445, w: 25, h: 50, label: 'VIP COUCH', facing: 'right', tagPosition: 'right' },
                { type: 'bed', x: 1690, y: 570, w: 90, h: 65, label: 'VIP BED', facing: 'right', tagPosition: 'bottom' },

                // 7. VIP卫 (VIP Bathroom) [X: 1620 - 1800, Y: 420 - 530]
                { type: 'desk', x: 1710, y: 470, w: 45, h: 22, label: 'VIP VANITY', tagPosition: 'bottom' },

                // === ZONE D: HELIPAD & BOW LOUNGE [X: 1800 - 2400, Y: 62 - 648] ===
                { type: 'helicopter', x: 1875, y: 310, w: 150, h: 100, label: 'AW139 HELICOPTER', noCollision: false, tagPosition: 'bottom' },
                { type: 'sunbed', x: 2080, y: 250, w: 52, h: 22, angle: 0.513, label: 'BOW LOUNGER 1', color: '#bae6fd', tagPosition: 'bottom' },
                { type: 'sunbed', x: 2080, y: 448, w: 52, h: 22, angle: -0.513, label: 'BOW LOUNGER 2', color: '#bae6fd', tagPosition: 'top' }
            ];

            const rawZones = [
                { name: "ZONE A // STERN & POOL", x: 50, y: 62, w: 500, h: 586, labelX: 100, labelY: 100, align: 'left' },
                { name: "ZONE B // GRAND SALON", x: 550, y: 62, w: 490, h: 586, labelX: 600, labelY: 340, align: 'left' },
                { name: "ZONE C // VIP & MASTER", x: 1040, y: 62, w: 760, h: 586, labelX: 1100, labelY: 340, align: 'left' },
                { name: "ZONE D // HELIPAD", x: 1800, y: 62, w: 600, h: 586, labelX: 1850, labelY: 100, align: 'left' }
            ];

            const rawWaypoints = [
                { x: 80, y: 360 },    // 尾部开放甲板
                { x: 260, y: 360 },   // 恒温泳池内部
                { x: 260, y: 150 },   // 泳池上方休闲区
                { x: 260, y: 570 },   // 泳池下方休闲区
                { x: 500, y: 360 },   // 舱内中央主通道前
                { x: 670, y: 180 },   // Zone B Top Front-hall
                { x: 850, y: 140 },   // Zone B Public Restroom
                { x: 970, y: 180 },   // Zone B Study Room
                { x: 670, y: 530 },   // Zone B Bottom Left Salon
                { x: 910, y: 530 },   // Zone B Bottom Right Dining Room
                
                // ZONE C Corridor & Rooms
                { x: 1150, y: 360 },  // 走廊左
                { x: 1370, y: 360 },  // 走廊中
                { x: 1540, y: 360 },  // 走廊右
                { x: 1710, y: 360 },  // 走廊最右
                { x: 1140, y: 180 },  // 顶级书房
                { x: 1260, y: 240 },  // 书房门内
                { x: 1490, y: 240 },  // 主卧门内
                { x: 1600, y: 180 },  // 主卧中部
                { x: 1710, y: 130 },  // 主卧卫生间
                { x: 1140, y: 530 },  // 顶级厨房
                { x: 1370, y: 530 },  // 精致客房
                { x: 1540, y: 530 },  // 尊贵VIP套房
                { x: 1710, y: 480 },  // VIP套房卫生间
                
                { x: 1950, y: 360 },  // 直升机停机坪
                { x: 2200, y: 360 }   // 船首露台
            ];

            const rawCameras = [
                // Zone A Camera
                {
                    x: 480, y: 80,
                    baseAngle: Math.PI * 0.9, currentAngle: Math.PI * 0.9,
                    sweepTimer: 0, sweepSpeed: 0.015, sweepRange: Math.PI / 4,
                    detecting: false, cooldownTimer: 0
                },
                // Zone B Camera
                {
                    x: 770, y: 350,
                    baseAngle: Math.PI, currentAngle: Math.PI,
                    sweepTimer: 1.2, sweepSpeed: 0.018, sweepRange: Math.PI / 4,
                    detecting: false, cooldownTimer: 0
                },
                // Zone D Camera
                {
                    x: 1815, y: 160,
                    baseAngle: 0, currentAngle: 0,
                    sweepTimer: 0.6, sweepSpeed: 0.012, sweepRange: Math.PI / 4.5,
                    detecting: false, cooldownTimer: 0
                }
            ];

        return { obstacles: rawObstacles, securityGates: [], props: rawProps, zones: rawZones, waypoints: rawWaypoints, cameras: rawCameras, lasers: [] };
    }
};

window.LEVEL_YACHT = LEVEL_YACHT;
