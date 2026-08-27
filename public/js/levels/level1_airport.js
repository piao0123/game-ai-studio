// 机场关卡地图数据与配置 (关卡 1：机场航站楼 - 逼真机场掩体与设施细节版)
const LEVEL_AIRPORT = {
    id: "level1_airport",
    name: "ZONE A // AIRPORT TERMINAL",
    playerStart: { x: 100, y: 350 },
    
    getMapLayout: (width, height) => {
        const margin = 40;
        const w = width - margin * 2;
        const h = height - margin * 2;

        return {
            obstacles: [
                // 1. 航站楼外墙
                { x: margin, y: margin, w: w, h: 12, type: 'solid' },
                { x: margin, y: height - margin - 12, w: w, h: 12, type: 'solid' },
                { x: margin, y: margin, w: 12, h: h, type: 'solid' },
                { x: width - margin - 12, y: margin, w: 12, h: h, type: 'solid' },

                // 2. 安检前厅与候机厅隔离墙
                { x: margin + w * 0.28, y: margin, w: 12, h: h * 0.30, type: 'solid' },
                { x: margin + w * 0.28, y: margin + h * 0.60, w: 12, h: h * 0.40, type: 'solid' },

                // 3. 登机闸口矮墙隔离带
                { x: margin + w * 0.18, y: margin + h * 0.15, w: 12, h: h * 0.25, type: 'low_wall', label: 'GATE A1' },
                { x: margin + w * 0.18, y: margin + h * 0.55, w: 12, h: h * 0.25, type: 'low_wall', label: 'GATE A2' },

                // 4. VIP 贵宾室与观景隔音玻璃墙
                { x: margin + w * 0.42, y: margin + h * 0.32, w: w * 0.30, h: 10, type: 'glass', label: 'OBSERVATION GLASS' },
                { x: margin + w * 0.72, y: margin, w: 10, h: h * 0.32, type: 'glass', label: 'VIP GLASS' },
                { x: margin + w * 0.55, y: margin, w: 10, h: h * 0.18, type: 'solid' },

                // 5. 行李提取区(Zone C)隔离墙
                { x: margin + w * 0.68, y: margin + h * 0.48, w: 12, h: h * 0.52, type: 'solid' },
                { x: margin + w * 0.68, y: margin + h * 0.48, w: w * 0.18, h: 12, type: 'solid' },

                // 6. 廊桥登机通道坡道矮墙
                { x: margin + w * 0.28, y: margin + h * 0.82, w: w * 0.25, h: 10, type: 'low_wall', label: 'JETBRIDGE RAMP' }
            ],

            // 安全检查站与金属检测门 (Security Checkpoint Metal Detectors)
            securityGates: [
                { x: margin + w * 0.28, y: margin + h * 0.45 - 20, w: 12, h: 40, label: 'CHECKPOINT A' },
                { x: margin + w * 0.68, y: margin + h * 0.38, w: 12, h: 40, label: 'CHECKPOINT B' }
            ],

            // 道具与掩体设施 (Props & Cover Facilities)
            props: [
                // 值机区打票与值机柜台 (Check-in Desks with Scale & Monitor)
                { type: 'desk', x: margin + w * 0.08, y: margin + h * 0.20, w: 80, h: 26, label: 'CHECK-IN DESK 01' },
                { type: 'desk', x: margin + w * 0.08, y: margin + h * 0.65, w: 80, h: 26, label: 'CHECK-IN DESK 02' },

                // 安检 X 光扫描机与传送带 (Security X-Ray Scanners)
                { type: 'desk', x: margin + w * 0.21, y: margin + h * 0.20, w: 55, h: 32, label: 'X-RAY SCANNER A' },
                { type: 'desk', x: margin + w * 0.21, y: margin + h * 0.60, w: 55, h: 32, label: 'X-RAY SCANNER B' },

                // 中央大型航班信息屏立柱 (Flight Info Board Column)
                { type: 'desk', x: margin + w * 0.30, y: margin + h * 0.45, w: 36, h: 36, label: 'FLIGHT BOARD' },

                // 候机排椅 (Airport Waiting Lounge Benches)
                { type: 'chair_group', x: margin + w * 0.45, y: margin + h * 0.12 },
                { type: 'chair_group', x: margin + w * 0.60, y: margin + h * 0.12 },
                { type: 'chair_group', x: margin + w * 0.45, y: margin + h * 0.68 },

                // 免税店与 VIP 饮品吧台 (Duty Free & Lounge Bar Counter)
                { type: 'desk', x: margin + w * 0.46, y: margin + h * 0.22, w: 85, h: 26, label: 'VIP BAR COUNTER', tagPosition: 'bottom' },
                { type: 'desk', x: margin + w * 0.60, y: margin + h * 0.22, w: 42, h: 28, label: 'DUTY FREE KIOSK', tagPosition: 'bottom' },

                // 行李提取大厅转盘 (Baggage Claim Carousels)
                { type: 'conveyor', x: margin + w * 0.73, y: margin + h * 0.64, w: 140, h: 44, label: 'CAROUSEL #01', tagPosition: 'top' },
                { type: 'conveyor', x: margin + w * 0.73, y: margin + h * 0.81, w: 140, h: 44, label: 'CAROUSEL #02', tagPosition: 'top' },

                // 航空货物集装箱与运货手推车 (Cargo Container & Baggage Carts)
                { type: 'desk', x: margin + w * 0.75, y: margin + h * 0.52, w: 42, h: 26, label: 'BAGGAGE CARTS', tagPosition: 'bottom' },
                { type: 'desk', x: margin + w * 0.90, y: margin + h * 0.52, w: 38, h: 36, label: 'CARGO CONTAINER', tagPosition: 'bottom' }
            ],

            // 区域标注
            zones: [
                { name: "ZONE A // CHECK-IN & SECURITY", x: margin + 20, y: margin + 20, w: w * 0.25, h: h - 40, labelX: margin + 28, labelY: margin + 105, align: 'left' },
                { name: "ZONE B // VIP LOUNGE & DUTY FREE", x: margin + w * 0.31, y: margin + 20, w: w * 0.39, h: h * 0.28, labelX: margin + w * 0.32, labelY: margin + 30, align: 'left' },
                { name: "ZONE C // BAGGAGE CLAIM & CARGO", x: margin + w * 0.71, y: margin + h * 0.48, w: w * 0.26, h: h * 0.48, labelX: margin + w * 0.70, labelY: margin + h * 0.48 - 14, align: 'left' },
                { name: "ZONE D // JET BRIDGE & BOARDING", x: margin + w * 0.31, y: margin + h * 0.85, w: w * 0.35, h: h * 0.10, labelX: margin + w * 0.32, labelY: margin + h * 0.85 + 16, align: 'left' }
            ],

            // AI 巡逻航点
            waypoints: [
                { x: margin + w * 0.12, y: margin + h * 0.25 },
                { x: margin + w * 0.12, y: margin + h * 0.75 },
                { x: margin + w * 0.50, y: margin + h * 0.18 },
                { x: margin + w * 0.50, y: margin + h * 0.60 },
                { x: margin + w * 0.82, y: margin + h * 0.25 },
                { x: margin + w * 0.82, y: margin + h * 0.75 }
            ],

            // 监控摄像头
            cameras: [
                { 
                    x: margin + w * 0.42, y: margin + h * 0.32, 
                    baseAngle: Math.PI * 0.75, currentAngle: Math.PI * 0.75,
                    sweepTimer: 0, sweepSpeed: 0.02, sweepRange: Math.PI / 2.2, 
                    detecting: false, cooldownTimer: 0 
                },
                { 
                    x: margin + w * 0.72, y: margin + 40, 
                    baseAngle: Math.PI * 0.8, currentAngle: Math.PI * 0.8,
                    sweepTimer: 1.0, sweepSpeed: 0.018, sweepRange: Math.PI / 2.0, 
                    detecting: false, cooldownTimer: 0 
                }
            ]
        };
    }
};

window.LEVEL_AIRPORT = LEVEL_AIRPORT;
