// 地铁站关卡地图数据与配置（关卡 2：多房间与战术掩体布局 - 无重叠/无UI遮挡/全区通畅/可绕过闸门版）
const LEVEL_SUBWAY = {
    id: "level2_subway",
    name: "ZONE B // METRO SUBWAY STATION",
    playerStart: { x: 100, y: 350 },
    
    getMapLayout: (width, height) => {
        const margin = 40;
        const w = width - margin * 2;
        const h = height - margin * 2;

        return {
            // 外墙、隔墙与房间布局
            obstacles: [
                // 1. 站台主边界外墙 (Solid Outer Boundaries)
                { x: margin, y: margin, w: w, h: 12, type: 'solid' },
                { x: margin, y: height - margin - 12, w: w, h: 12, type: 'solid' },
                { x: margin, y: margin, w: 12, h: h, type: 'solid' },
                { x: width - margin - 12, y: margin, w: 12, h: h, type: 'solid' },

                // 2. 西侧客服/售票小屋墙体 (Ticket Office Booth Room - 避开顶UI & 宽门)
                { x: margin + 16, y: margin + 130, w: 90, h: 10, type: 'solid' },
                { x: margin + 16, y: margin + 130, w: 10, h: 80, type: 'solid' },
                { x: margin + 16, y: margin + 210, w: 90, h: 10, type: 'solid' },
                { x: margin + 96, y: margin + 130, w: 10, h: 45, type: 'glass', label: 'TICKET WINDOW' },

                // 3. 进站闸机隔断主墙 (Turnstile Gateway Partition Wall - 开口扩大，中间留出宽大通道绕过闸门)
                // 墙段 1: Top (y: margin + 12 ~ margin + h * 0.20)
                { x: margin + w * 0.25, y: margin + 12, w: 10, h: h * 0.20 - 12, type: 'solid' },
                // 开口 1 (Gap 1): margin + h * 0.20 到 margin + h * 0.42 (高度约 140px, Gate A 居中)

                // 墙段 2: Middle (y: margin + h * 0.42 ~ margin + h * 0.58)
                { x: margin + w * 0.25, y: margin + h * 0.42, w: 10, h: h * 0.16, type: 'solid' },
                // 开口 2 (Gap 2): margin + h * 0.58 到 margin + h * 0.80 (高度约 140px, Gate B 居中)

                // 墙段 3: Bottom (y: margin + h * 0.80 ~ margin + h - 12)
                { x: margin + w * 0.25, y: margin + h * 0.80, w: 10, h: h * 0.20 - 12, type: 'solid' },

                // 4. 站台玻璃挡风墙/屏蔽屏风 (Platform Glass Barriers - 分段留出宽敞通道，绝不卡人)
                { x: margin + w * 0.35, y: margin + h * 0.18, w: w * 0.11, h: 8, type: 'glass', label: 'GLASS A' },
                { x: margin + w * 0.60, y: margin + h * 0.18, w: w * 0.11, h: 8, type: 'glass', label: 'GLASS B' },
                { x: margin + w * 0.35, y: margin + h * 0.80, w: w * 0.11, h: 8, type: 'glass', label: 'GLASS C' },
                { x: margin + w * 0.60, y: margin + h * 0.80, w: w * 0.11, h: 8, type: 'glass', label: 'GLASS D' },

                // 5. 站台中央支撑水泥柱群 (Platform Concrete Pillars)
                { x: margin + w * 0.40, y: margin + h * 0.32, w: 22, h: 22, type: 'solid' },
                { x: margin + w * 0.66, y: margin + h * 0.32, w: 22, h: 22, type: 'solid' },
                { x: margin + w * 0.40, y: margin + h * 0.66, w: 22, h: 22, type: 'solid' },
                { x: margin + w * 0.66, y: margin + h * 0.66, w: 22, h: 22, type: 'solid' },

                // 6. 战术橙色低矮掩体群 (Tactical Orange Low Wall Barriers - 手雷能过 / 枪穿不了 / 人看不见)
                // 安检区与售票厅掩体 (Zone A)
                { x: margin + w * 0.08, y: margin + h * 0.68, w: w * 0.12, h: 10, type: 'low_wall', label: 'CHECKPOINT A' },
                { x: margin + w * 0.08, y: margin + h * 0.48, w: w * 0.12, h: 10, type: 'low_wall', label: 'CHECKPOINT B' },
                { x: margin + w * 0.18, y: margin + h * 0.28, w: 10, h: h * 0.12, type: 'low_wall', label: 'TICKET BARRIER', tagXOffset: 12, tagYOffset: 30 },

                // 闸机两侧进站防冲掩体 (Zone B)
                { x: margin + w * 0.28, y: margin + h * 0.15, w: w * 0.05, h: 10, type: 'low_wall', label: 'GATE BARRICADE A', tagYOffset: 16 },
                { x: margin + w * 0.28, y: margin + h * 0.82, w: w * 0.05, h: 10, type: 'low_wall', label: 'GATE BARRICADE B' },

                // 东侧主控室与设备间防突掩体 (Zone D & E)
                { x: margin + w * 0.80, y: margin + h * 0.38, w: w * 0.08, h: 10, type: 'low_wall', label: 'CONSOLE SHIELD' },
                { x: margin + w * 0.82, y: margin + h * 0.72, w: w * 0.08, h: 10, type: 'low_wall', label: 'GEAR BARRICADE' },

                // 7. 东侧主控室(Zone D)与设备间(Zone E)隔墙 (带 OBSERVATION GLASS 与 宽大门口通道)
                { x: margin + w * 0.76, y: margin + 12, w: 10, h: h * 0.12, type: 'solid' },
                { x: margin + w * 0.76, y: margin + 12 + h * 0.12, w: 10, h: h * 0.12, type: 'glass', label: 'OBSERVATION GLASS' },
                { x: margin + w * 0.76, y: margin + h * 0.44, w: 10, h: h * 0.06, type: 'solid' },

                // Zone D与Zone E横向隔墙 (带有内部互通门)
                { x: margin + w * 0.76, y: margin + h * 0.50, w: w * 0.08, h: 10, type: 'solid' },
                { x: margin + w * 0.90, y: margin + h * 0.50, w: w * 0.09, h: 10, type: 'solid' },

                // Zone E 西墙
                { x: margin + w * 0.76, y: margin + h * 0.50, w: 10, h: h * 0.10, type: 'solid' },
                { x: margin + w * 0.76, y: margin + h * 0.78, w: 10, h: h * 0.20, type: 'solid' }
            ],

            // 自动验票闸机 (Security / Turnstile Gates - 位于各自开口的正中央，两侧留有充足通行空隙)
            securityGates: [
                // Gap 1 (h*0.20 ~ h*0.42) 正中央 Y = margin + h * 0.31
                { x: margin + w * 0.25, y: margin + h * 0.31 - 16, w: 10, h: 32, label: 'GATE A', tagXOffset: 24, tagYOffset: 0 },
                // Gap 2 (h*0.58 ~ h*0.80) 正中央 Y = margin + h * 0.69
                { x: margin + w * 0.25, y: margin + h * 0.69 - 16, w: 10, h: 32, label: 'GATE B', tagXOffset: 24, tagYOffset: 0 }
            ],

            // 道具与方形掩体设施 (Props & Covers - 具备丰富外观细节)
            props: [
                // 客服小屋内部服务台 (Ticket Booth Desk)
                { type: 'desk', x: margin + 30, y: margin + 152, w: 52, h: 38, label: 'TICKET BOOTH', tagPosition: 'bottom' },

                // 西侧站厅自助售票机 (Ticket Kiosks)
                { type: 'desk', x: margin + w * 0.15, y: margin + h * 0.26, w: 38, h: 36, label: 'KIOSK 1', tagPosition: 'top' },
                { type: 'desk', x: margin + w * 0.15, y: margin + h * 0.38, w: 38, h: 36, label: 'KIOSK 2', tagPosition: 'bottom' },

                // 安检区安检扫描机与行李堆 (X-Ray & Baggage Scanners)
                { type: 'desk', x: margin + w * 0.08, y: margin + h * 0.54, w: 42, h: 38, label: 'X-RAY', tagPosition: 'top' },
                { type: 'desk', x: margin + w * 0.17, y: margin + h * 0.54, w: 36, h: 36, label: 'BAGGAGE', tagPosition: 'bottom' },

                // 上下行列车车体 (Subway Train Cars - 贴紧上下外墙)
                { type: 'conveyor', x: margin + w * 0.38, y: margin + 12, w: w * 0.34, h: 28, label: 'NORTHBOUND TRAIN #02', tagPosition: 'bottom' },
                { type: 'conveyor', x: margin + w * 0.38, y: height - margin - 40, w: w * 0.34, h: 28, label: 'SOUTHBOUND TRAIN #01', tagPosition: 'top' },

                // 站台中央候车排椅 (Waiting Bench Groups)
                { type: 'chair_group', x: margin + w * 0.36, y: margin + h * 0.48 },
                { type: 'chair_group', x: margin + w * 0.58, y: margin + h * 0.48 },

                // 站台中央方形便利服务亭 (Platform Kiosk)
                { type: 'desk', x: margin + w * 0.48, y: margin + h * 0.46, w: 40, h: 40, label: 'KIOSK', tagPosition: 'bottom' },

                // 东侧主控室(Zone D)操控台与服务器柜
                { type: 'desk', x: margin + w * 0.79, y: margin + h * 0.20, w: 46, h: 36, label: 'CONSOLE', tagPosition: 'bottom' },
                { type: 'desk', x: margin + w * 0.89, y: margin + h * 0.16, w: 34, h: 32, label: 'SERVER A', tagPosition: 'bottom' },
                { type: 'desk', x: margin + w * 0.89, y: margin + h * 0.32, w: 34, h: 32, label: 'SERVER B', tagPosition: 'bottom' },

                // 东侧设备维护间(Zone E)物资箱与备用发电机
                { type: 'desk', x: margin + w * 0.81, y: margin + h * 0.60, w: 38, h: 36, label: 'CRATES', tagPosition: 'bottom' },
                { type: 'desk', x: margin + w * 0.89, y: margin + h * 0.60, w: 34, h: 34, label: 'GEAR', tagPosition: 'bottom' },
                { type: 'desk', x: margin + w * 0.85, y: margin + h * 0.78, w: 44, h: 36, label: 'GENERATOR', tagPosition: 'top' }
            ],

            // 区域标注 (Zones)
            zones: [
                { name: "ZONE A // TICKETING & SECURITY", x: margin + 18, y: margin + 18, w: w * 0.22, h: h - 36, labelX: margin + 28, labelY: margin + 105, align: 'left' },
                { name: "ZONE B // TURNSTILES", x: margin + w * 0.26, y: margin + 18, w: w * 0.08, h: h - 36, labelX: margin + w * 0.26 + 4, labelY: margin + 45, align: 'left' },
                { name: "ZONE C // PLATFORM & TRACKS", x: margin + w * 0.35, y: margin + 18, w: w * 0.39, h: h - 36, labelX: margin + w * 0.38, labelY: margin + 105, align: 'left' },
                { name: "ZONE D // CONTROL CENTER", x: margin + w * 0.78, y: margin + 18, w: w * 0.20, h: h * 0.45, labelX: margin + w * 0.78 + 4, labelY: margin + 105, align: 'left' },
                { name: "ZONE E // EQUIPMENT ROOM", x: margin + w * 0.78, y: margin + h * 0.53, w: w * 0.20, h: h * 0.42, labelX: margin + w * 0.79, labelY: margin + h * 0.53 + 18, align: 'left' }
            ],

            // 巡逻航点 (Waypoints for AI)
            waypoints: [
                { x: margin + w * 0.10, y: margin + h * 0.35 },
                { x: margin + w * 0.10, y: margin + h * 0.70 },
                { x: margin + w * 0.30, y: margin + h * 0.35 },
                { x: margin + w * 0.30, y: margin + h * 0.65 },
                { x: margin + w * 0.48, y: margin + h * 0.22 },
                { x: margin + w * 0.48, y: margin + h * 0.78 },
                { x: margin + w * 0.70, y: margin + h * 0.40 },
                { x: margin + w * 0.86, y: margin + h * 0.30 },
                { x: margin + w * 0.86, y: margin + h * 0.68 }
            ],

            // 监控摄像头 (Security Cameras)
            cameras: [
                { 
                    x: margin + w * 0.25 + 18, y: margin + h * 0.31, 
                    baseAngle: Math.PI * 0.25, currentAngle: Math.PI * 0.25,
                    sweepTimer: 0, sweepSpeed: 0.02, sweepRange: Math.PI / 2.5, 
                    detecting: false, cooldownTimer: 0 
                },
                { 
                    x: margin + w * 0.50, y: margin + 20, 
                    baseAngle: Math.PI * 0.50, currentAngle: Math.PI * 0.50,
                    sweepTimer: 0.6, sweepSpeed: 0.015, sweepRange: Math.PI / 2.0, 
                    detecting: false, cooldownTimer: 0 
                },
                { 
                    x: margin + w * 0.76 + 20, y: margin + h * 0.30, 
                    baseAngle: Math.PI * 0.75, currentAngle: Math.PI * 0.75,
                    sweepTimer: 1.2, sweepSpeed: 0.018, sweepRange: Math.PI / 2.2, 
                    detecting: false, cooldownTimer: 0 
                }
            ]
        };
    }
};

window.LEVEL_SUBWAY = LEVEL_SUBWAY;
