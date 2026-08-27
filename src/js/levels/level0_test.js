// =========================================================================
// LEVEL 0: 远东极寒装甲列车战术关卡 (7200px × 240px ARMORED TRAIN TACTICAL RUN)
// =========================================================================
// 🚂 关卡设定与战术背景 (LORE & SPECIFICATIONS):
// 1. 本关卡设定在穿行于西伯利亚远东极寒雪原的重型军工装甲列车内部。
// 2. 地图规格：全长 7200px，宽度 240px，长宽比达到极致的 30 : 1。
// 3. 外部背景：西伯利亚远东积雪雪原（柔和冷灰蓝渐变、针叶松林、铁道碎石路基与枕木）。
// 4. 六大装甲车厢分区 (6 ARMORED CARRIAGES / SECTORS):
//    - CAR 01 (0 ~ 1200): 车尾装甲守卫舱与战术登车风挡 (REAR GUARD & AIRLOCK)
//    - CAR 02 (1200 ~ 2400): 乘员兵营与防冻物资整备车厢 (TROOP BARRACKS & LOGISTICS)
//    - CAR 03 (2400 ~ 3600): 战地医务所与高级军官沙龙 (FIELD MEDICAL & OFFICER SALON)
//    - CAR 04 (3600 ~ 4800): 战术指挥中心与雷达通讯枢纽 (TACTICAL COMMAND & COMMS)
//    - CAR 05 (4800 ~ 6000): 重型动力反应堆与装甲火控车厢 (POWER REACTOR & FIRE CONTROL)
//    - CAR 06 (6000 ~ 7200): 车头重装驾驶舱与紧急制动阀 (ARMORED LOCOMOTIVE & OVERRIDE)
// 5. 严格确保所有走廊和转角净通行宽度 >= 95px，角色（半径18px）流畅无阻畅通全图。
// =========================================================================

window.level0MapWidth = 7200;
window.level0MapHeight = 240;

const LEVEL_TEST = {
    id: "level0_test",
    name: "测试关卡 - 远东装甲列车",
    themeColor: "#0f172a",
    gridColor: "rgba(56, 189, 248, 0.25)",
    accentColor: "#38bdf8",
    playerStart: { x: 80, y: 120 }, // 起始于最西侧 CAR 01 车尾登车中轴线
    
    getMapLayout: (width, height) => {
        const mapW = window.level0MapWidth || 7200;
        const mapH = window.level0MapHeight || 240;
        
        return {
            obstacles: [
                // =========================================================
                // 1. 全局列车重装甲外壳外墙 (Heavy Outer Hull Armor Plates)
                // =========================================================
                // 北侧列车装甲外壳 (y: 0~10)
                { x: 0, y: 0, w: mapW, h: 10, type: 'solid', label: 'NORTH ARMORED HULL', hideLabel: true },
                // 南侧列车装甲外壳 (y: 230~240)
                { x: 0, y: mapH - 10, w: mapW, h: 10, type: 'solid', label: 'SOUTH ARMORED HULL', hideLabel: true },
                // 车尾装甲防爆后舱门 (x: 0~10)
                { x: 0, y: 0, w: 10, h: mapH, type: 'solid', label: 'REAR AIRLOCK DOOR', hideLabel: true },
                // 车头前端防弹装甲壁 (x: 7190~7200)
                { x: mapW - 10, y: 0, w: 10, h: mapH, type: 'solid', label: 'FRONT ARMORED BULKHEAD', hideLabel: true },

                // =========================================================
                // 2. CAR 01: 车尾装甲守卫舱与战术登车风挡 (x: 0 ~ 1200)
                // =========================================================
                // 登车气闸检视隔断（上下对称，中央净宽 110px 畅通通道）
                { x: 320, y: 10, w: 12, h: 55, type: 'solid' },
                { x: 320, y: 175, w: 12, h: 55, type: 'solid' },
                // 弹药与防弹矮掩体
                { x: 480, y: 35, w: 14, h: 45, type: 'low_wall' },
                { x: 480, y: 160, w: 14, h: 45, type: 'low_wall' },
                // 车尾守卫间过渡隔离墙
                { x: 800, y: 10, w: 12, h: 60, type: 'solid' },
                { x: 800, y: 170, w: 12, h: 60, type: 'solid' },
                { x: 960, y: 68, w: 45, h: 10, type: 'low_wall' },
                { x: 960, y: 162, w: 45, h: 10, type: 'low_wall' },
                // 1号至2号车厢气密连接门框
                { x: 1180, y: 10, w: 14, h: 65, type: 'solid' },
                { x: 1180, y: 165, w: 14, h: 65, type: 'solid' },

                // =========================================================
                // 3. CAR 02: 乘员兵营与防冻物资整备车厢 (x: 1200 ~ 2400)
                // =========================================================
                // 双侧极寒防爆透明保暖观察窗栈道
                { x: 1280, y: 65, w: 320, h: 8, type: 'glass', label: 'THERMAL GLASS', hideLabel: true },
                { x: 1280, y: 167, w: 320, h: 8, type: 'glass', label: 'THERMAL GLASS', hideLabel: true },
                
                // 中段 S 型兵营隔断（走道净宽均在 100px 以上，极佳掩护推进）
                { x: 1750, y: 10, w: 12, h: 110, type: 'solid' },   // 上部延伸
                { x: 1950, y: 120, w: 12, h: 110, type: 'solid' },  // 下部延伸
                
                // 兵营生活物资区矮挡板
                { x: 2150, y: 55, w: 60, h: 10, type: 'low_wall' },
                { x: 2150, y: 175, w: 60, h: 10, type: 'low_wall' },
                // 2号至3号车厢气密隔离门
                { x: 2380, y: 10, w: 14, h: 65, type: 'solid' },
                { x: 2380, y: 165, w: 14, h: 65, type: 'solid' },

                // =========================================================
                // 4. CAR 03: 战地医务所与高级军官沙龙 (x: 2400 ~ 3600)
                // =========================================================
                // 急救所外部重装隔离门墙
                { x: 2580, y: 10, w: 12, h: 55, type: 'solid' },
                { x: 2580, y: 175, w: 12, h: 55, type: 'solid' },
                // 医务救治床防菌矮护栏
                { x: 2780, y: 40, w: 14, h: 45, type: 'low_wall' },
                { x: 2780, y: 155, w: 14, h: 45, type: 'low_wall' },
                // 军官沙龙战略透明防弹玻璃隔断
                { x: 3020, y: 75, w: 10, h: 90, type: 'glass' },
                // 沙龙休息厅外侧阻隔墙
                { x: 3260, y: 10, w: 12, h: 60, type: 'solid' },
                { x: 3260, y: 170, w: 12, h: 60, type: 'solid' },
                // 3号至4号车厢风挡联结门
                { x: 3580, y: 10, w: 14, h: 65, type: 'solid' },
                { x: 3580, y: 165, w: 14, h: 65, type: 'solid' },

                // =========================================================
                // 5. CAR 04: 战术指挥中心与雷达通讯枢纽 (x: 3600 ~ 4800)
                // =========================================================
                // 全息雷达主控台半高战术矮墙
                { x: 3880, y: 45, w: 90, h: 10, type: 'low_wall' },
                { x: 3880, y: 185, w: 90, h: 10, type: 'low_wall' },
                // 指挥舱重型防震承重主钢柱
                { x: 4120, y: 40, w: 20, h: 45, type: 'solid' },
                { x: 4120, y: 155, w: 20, h: 45, type: 'solid' },
                // 加密电台终端通透幕墙
                { x: 4380, y: 75, w: 10, h: 90, type: 'glass' },
                { x: 4560, y: 45, w: 50, h: 10, type: 'low_wall' },
                { x: 4560, y: 185, w: 50, h: 10, type: 'low_wall' },
                // 4号至5号车厢动力隔离门
                { x: 4780, y: 10, w: 14, h: 65, type: 'solid' },
                { x: 4780, y: 165, w: 14, h: 65, type: 'solid' },

                // =========================================================
                // 6. CAR 05: 重型动力反应堆与装甲火控车厢 (x: 4800 ~ 6000)
                // =========================================================
                // 中央动力主龙骨长隔离实体墙 (y: 115~125)
                { x: 4980, y: 115, w: 220, h: 10, type: 'solid', label: 'REACTOR SPINE', hideLabel: true },
                // 火控伺服上路隘口掩体
                { x: 5080, y: 35, w: 40, h: 10, type: 'low_wall' },
                // 重炮输弹下路隘口掩体
                { x: 5080, y: 195, w: 40, h: 10, type: 'low_wall' },
                // 涡轮发电机错位分流墙
                { x: 5380, y: 10, w: 12, h: 70, type: 'solid' },
                { x: 5560, y: 160, w: 12, h: 70, type: 'solid' },
                // 动力舱高压屏障矮墙
                { x: 5780, y: 50, w: 60, h: 10, type: 'low_wall' },
                { x: 5780, y: 180, w: 60, h: 10, type: 'low_wall' },
                // 5号至6号车头主驾驶舱隔离重门
                { x: 5980, y: 10, w: 14, h: 65, type: 'solid' },
                { x: 5980, y: 165, w: 14, h: 65, type: 'solid' },

                // =========================================================
                // 7. CAR 06: 车头重装驾驶舱与紧急制动阀 (x: 6000 ~ 7200)
                // =========================================================
                // 驾驶舱入口安全门廊
                { x: 6220, y: 10, w: 12, h: 55, type: 'low_wall' },
                { x: 6220, y: 175, w: 12, h: 55, type: 'low_wall' },
                // 车头主驾驶位防冲撞护栏
                { x: 6550, y: 50, w: 120, h: 10, type: 'low_wall' },
                { x: 6550, y: 180, w: 120, h: 10, type: 'low_wall' },
                // 紧急制动阀保护立柱
                { x: 6980, y: 20, w: 14, h: 60, type: 'solid' },
                { x: 6980, y: 160, w: 14, h: 60, type: 'solid' }
            ],
            securityGates: [],
            props: [
                // === CAR 01: 车尾装甲守卫舱与战术登车风挡 ===
                { type: 'desk', x: 80, y: 22, w: 50, h: 18, label: 'GUARD CONSOLE', displayName: 'GUARD DESK', tagPosition: 'bottom' },
                { type: 'desk', x: 80, y: 200, w: 50, h: 18, label: 'EQUIPMENT RACK', displayName: 'EQUIPMENT', tagPosition: 'top' },
                { type: 'display_cabinet', x: 200, y: 22, w: 38, h: 16, label: 'ARMORY RACK', displayName: 'ARMORY', tagPosition: 'bottom' },
                { type: 'baggage_cart', x: 560, y: 22, w: 42, h: 18, label: 'AMMO CRATES', displayName: 'AMMO CRATES', tagPosition: 'bottom' },
                { type: 'baggage_cart', x: 560, y: 200, w: 42, h: 18, label: 'SUPPLY CARGO', displayName: 'CARGO', tagPosition: 'top' },
                { type: 'office_chair', x: 145, y: 22, w: 16, h: 16, facing: 'down', label: 'SENTRY SEAT', hideLabel: true },
                { type: 'lamp', x: 300, y: 22, w: 14, h: 14, label: 'RED BEACON', hideLabel: true },

                // === CAR 02: 乘员兵营与防冻物资整备车厢 ===
                { type: 'sofa', x: 1420, y: 22, w: 52, h: 18, facing: 'down', label: 'BARRACKS BUNK', displayName: 'BUNK', tagPosition: 'bottom' },
                { type: 'sofa', x: 1420, y: 200, w: 52, h: 18, facing: 'up', label: 'BARRACKS BUNK', displayName: 'BUNK', tagPosition: 'top' },
                { type: 'coffee_table', x: 1520, y: 24, w: 28, h: 14, label: 'MESS TABLE', displayName: 'MESS TABLE', tagPosition: 'bottom' },
                { type: 'coffee_table', x: 1520, y: 202, w: 28, h: 14, label: 'MESS TABLE', displayName: 'MESS TABLE', tagPosition: 'top' },
                { type: 'display_cabinet', x: 1640, y: 22, w: 38, h: 16, label: 'CREW LOCKERS', displayName: 'LOCKERS', tagPosition: 'bottom' },
                { type: 'fountain', x: 1860, y: 98, w: 44, h: 44, label: 'THERMAL HEATER CORE', displayName: 'HEATER CORE' },
                { type: 'desk', x: 2260, y: 22, w: 46, h: 16, label: 'SUPPLY DESK', displayName: 'SUPPLY DESK', tagPosition: 'bottom' },

                // === CAR 03: 战地医务所与高级军官沙龙 ===
                { type: 'desk', x: 2680, y: 22, w: 48, h: 16, label: 'TRIAGE STATION', displayName: 'MEDIC STATION', tagPosition: 'bottom' },
                { type: 'display_cabinet', x: 2680, y: 202, w: 40, h: 16, label: 'CRYO MEDICINE VAULT', displayName: 'CRYO MEDS', tagPosition: 'top' },
                { type: 'sofa', x: 3120, y: 22, w: 52, h: 18, facing: 'down', label: 'OFFICER LOUNGE', displayName: 'OFFICER SOFA', tagPosition: 'bottom' },
                { type: 'coffee_table', x: 3120, y: 202, w: 36, h: 16, label: 'WAR STRATEGY MAP', displayName: 'MAP TABLE', tagPosition: 'top' },
                { type: 'plant', x: 3450, y: 24, w: 16, h: 16, label: 'BIO SPECIMEN', displayName: 'BIO FLORA', tagPosition: 'right' },
                { type: 'plant', x: 3450, y: 200, w: 16, h: 16, label: 'BIO SPECIMEN', displayName: 'BIO FLORA', tagPosition: 'right' },

                // === CAR 04: 战术指挥中心与雷达通讯枢纽 ===
                { type: 'reception_desk', x: 3950, y: 110, w: 64, h: 20, facing: 'up', label: 'MASTER COMMAND CONSOLE', displayName: 'COMMAND CONSOLE', tagPosition: 'bottom' },
                { type: 'office_chair', x: 3974, y: 88, w: 16, h: 16, facing: 'down', label: 'COMMANDER SEAT', hideLabel: true },
                { type: 'fountain', x: 4240, y: 98, w: 44, h: 44, label: 'QUANTUM RADAR CORE', displayName: 'RADAR CORE' },
                { type: 'desk', x: 4480, y: 22, w: 48, h: 16, label: 'ENCRYPTED RADIO RACK', displayName: 'RADIO RACK', tagPosition: 'bottom' },
                { type: 'lamp', x: 4680, y: 202, w: 14, h: 14, label: 'TACTICAL BEACON', hideLabel: true },

                // === CAR 05: 重型动力反应堆与装甲火控车厢 ===
                { type: 'fountain', x: 5120, y: 98, w: 44, h: 44, label: 'TURBINE REACTOR ENGINE', displayName: 'REACTOR ENGINE' },
                { type: 'desk', x: 5320, y: 22, w: 48, h: 16, label: 'FIRE CONTROL BENCH', displayName: 'FIRE CONTROL', tagPosition: 'bottom' },
                { type: 'display_cabinet', x: 5320, y: 202, w: 42, h: 16, label: 'ARTILLERY SHELLS', displayName: 'HEAVY AMMO', tagPosition: 'top' },
                { type: 'pillar', x: 5680, y: 45, w: 16, h: 16, label: 'BULKHEAD PILLAR', displayName: 'STEEL PILLAR', tagPosition: 'bottom' },
                { type: 'lamp', x: 5880, y: 24, w: 14, h: 14, label: 'HIGH VOLTAGE LAMP', hideLabel: true },

                // === CAR 06: 车头重装驾驶舱与紧急制动阀 ===
                { type: 'reception_desk', x: 6420, y: 110, w: 62, h: 20, facing: 'up', label: 'THROTTLE CONSOLE', displayName: 'LOCOMOTIVE CONSOLE', tagPosition: 'bottom' },
                { type: 'office_chair', x: 6444, y: 88, w: 16, h: 16, facing: 'down', label: 'PILOT CHAIR', hideLabel: true },
                { type: 'display_cabinet', x: 6680, y: 22, w: 40, h: 16, label: 'BRAKE OVERRIDE UNIT', displayName: 'BRAKE OVERRIDE', tagPosition: 'bottom' },
                { type: 'rug', x: 6720, y: 70, w: 180, h: 100, noCollision: true, label: 'EXTRACTION PAD', displayName: 'EVAC PAD' },
                { type: 'stair', x: 7080, y: 85, w: 38, h: 70, label: 'EMERGENCY HATCH', displayName: 'EXTRACTION' }
            ],
            zones: [
                { name: "CAR 01: REAR GUARD & AIRLOCK", x: 20, y: 12, w: 1160, h: mapH - 24, labelX: 80, labelY: 26, align: 'left' },
                { name: "CAR 02: TROOP BARRACKS & MESS", x: 1200, y: 12, w: 1180, h: mapH - 24, labelX: 1260, labelY: 26, align: 'left' },
                { name: "CAR 03: FIELD MEDICAL & SALON", x: 2400, y: 12, w: 1180, h: mapH - 24, labelX: 2460, labelY: 26, align: 'left' },
                { name: "CAR 04: COMMAND & RADAR HUB", x: 3600, y: 12, w: 1180, h: mapH - 24, labelX: 3660, labelY: 26, align: 'left' },
                { name: "CAR 05: REACTOR & FIRE CONTROL", x: 4800, y: 12, w: 1180, h: mapH - 24, labelX: 4860, labelY: 26, align: 'left' },
                { name: "CAR 06: LOCOMOTIVE & OVERRIDE", x: 6000, y: 12, w: 1180, h: mapH - 24, labelX: 6060, labelY: 26, align: 'left' }
            ],
            waypoints: [
                { x: 100, y: 120 },
                { x: 600, y: 120 },
                { x: 1100, y: 120 },
                { x: 1550, y: 120 },
                { x: 1850, y: 70 },
                { x: 2050, y: 170 },
                { x: 2500, y: 120 },
                { x: 3000, y: 120 },
                { x: 3500, y: 120 },
                { x: 4000, y: 120 },
                { x: 4500, y: 120 },
                { x: 4900, y: 120 },
                { x: 5180, y: 75 },
                { x: 5180, y: 165 },
                { x: 5500, y: 120 },
                { x: 6100, y: 120 },
                { x: 6650, y: 120 },
                { x: 7100, y: 120 }
            ],
            cameras: [
                { 
                    x: 1180, y: 70, 
                    baseAngle: Math.PI, currentAngle: Math.PI,
                    sweepRange: Math.PI / 3.5, sweepSpeed: 0.015, sweepTimer: 0 
                },
                { 
                    x: 2380, y: 120, 
                    baseAngle: 0, currentAngle: 0,
                    sweepRange: Math.PI / 4, sweepSpeed: 0.012, sweepTimer: 0 
                },
                { 
                    x: 3580, y: 70, 
                    baseAngle: Math.PI, currentAngle: Math.PI,
                    sweepRange: Math.PI / 3.5, sweepSpeed: 0.015, sweepTimer: 0 
                },
                { 
                    x: 4780, y: 120, 
                    baseAngle: 0, currentAngle: 0,
                    sweepRange: Math.PI / 4, sweepSpeed: 0.012, sweepTimer: 0 
                },
                { 
                    x: 5980, y: 70, 
                    baseAngle: Math.PI, currentAngle: Math.PI,
                    sweepRange: Math.PI / 3.5, sweepSpeed: 0.015, sweepTimer: 0 
                }
            ],
            lasers: []
        };
    }
};

window.LEVEL_TEST = LEVEL_TEST;
