// =========================================================================
// LEVEL 5: 酒店大堂正式关卡 (HOTEL LOBBY - FULL PORT FROM LEVEL 0)
// =========================================================================

const LEVEL_HOTEL = {
    id: "level5_hotel",
    name: "第 5 关 · 酒店大堂",
    nameEn: "Level 05 · Hotel Lobby",
    themeColor: "#5C060B",
    gridColor: "rgba(234, 88, 12, 0.25)",
    accentColor: "#ea580c",
    playerStart: { x: 120, y: 350 }, // 玩家初始位于客房走廊开阔区域，与周围设施保持安全距离
    
    getMapLayout: (width, height) => {
        const margin = 40;
        const w = width - margin * 2;
        const h = height - margin * 2;
        
        return {
            obstacles: [
                // 1. 酒店外围坚固边界墙 (Hotel Outer Solid Walls)
                // 左侧外墙
                { x: margin, y: margin, w: 12, h: h, type: 'solid' },
                // 右侧外墙
                { x: width - margin - 12, y: margin, w: 12, h: h, type: 'solid' },
                // 北侧外墙 (大门开口置中)
                { x: margin, y: margin, w: w * 0.43, h: 12, type: 'solid' },
                { x: margin + w * 0.57, y: margin, w: w * 0.43, h: 12, type: 'solid' },
                // 南侧外墙 (大门开口置中)
                { x: margin, y: height - margin - 12, w: w * 0.43, h: 12, type: 'solid' },
                { x: margin + w * 0.57, y: height - margin - 12, w: w * 0.43, h: 12, type: 'solid' },

                // 2. 客房区域分割墙与通道 Separator between Guest Rooms and Lobby
                // 客房区分割墙（实体墙，保证客房不是玻璃墙）
                { x: margin + w * 0.28, y: margin, w: 12, h: h * 0.41, type: 'solid', label: 'GUEST ROOM WALL', hideLabel: true },
                // 客房区下半段分界墙 -> 替换为橙色属性墙 (Orange Low Wall)
                { x: margin + w * 0.28, y: margin + h * 0.59, w: 12, h: h * 0.41, type: 'low_wall', label: 'GUEST ROOM LOW WALL', hideLabel: true },

                // 3. 客房内部间隔墙 Inside Guest Rooms
                // 客房 1 (Top-Left Room)
                { x: margin, y: margin + h * 0.38, w: w * 0.20, h: 12, type: 'solid' },
                { x: margin + w * 0.26, y: margin + h * 0.38, w: w * 0.02, h: 12, type: 'solid' },
                
                // 客房 2 (Bottom-Left Room)
                { x: margin, y: margin + h * 0.62, w: w * 0.20, h: 12, type: 'solid' },
                { x: margin + w * 0.26, y: margin + h * 0.62, w: w * 0.02, h: 12, type: 'solid' },

                // 4. 行李寄存 (Luggage Storage divider low wall)
                { x: margin + w * 0.28, y: margin + h * 0.22, w: w * 0.12, h: 10, type: 'low_wall', label: 'LUGGAGE STORAGE', hideLabel: true },

                // 5. 前台接待 (Front Desk L-shape Reception counter -> 替换为玻璃墙)
                { x: margin + w * 0.58, y: margin + h * 0.24, w: w * 0.26, h: 10, type: 'glass', label: 'FRONT DESK GLASS', hideLabel: true },
                { x: margin + w * 0.58, y: margin + h * 0.10, w: 10, h: h * 0.14, type: 'glass', label: 'FRONT DESK SIDE GLASS', hideLabel: true },

                // 6. 电梯井 (Elevator Shaft block - 开放电梯门通道供玩家进入)
                { x: margin + w * 0.60, y: margin + h * 0.78, w: 12, h: h * 0.22, type: 'solid' },
                { x: margin + w * 0.74, y: margin + h * 0.78, w: 12, h: h * 0.22, type: 'solid' },
                { x: margin + w * 0.60, y: margin + h * 0.78, w: w * 0.02, h: 12, type: 'solid', label: 'ELEVATOR LEFT WALL', hideLabel: true },
                { x: margin + w * 0.72, y: margin + h * 0.78, w: w * 0.02, h: 12, type: 'solid', label: 'ELEVATOR RIGHT WALL', hideLabel: true },

                // 7. 卫生间外部隔离墙 (Restroom Solid Wall and Shield - Aligned with the smaller elevator)
                { x: margin + w * 0.74, y: margin + h * 0.78, w: w * 0.15, h: 12, type: 'solid' },
                { x: margin + w * 0.89, y: margin + h * 0.78, w: 10, h: h * 0.10, type: 'solid' },

                // 8. 贵宾沙龙独立房间隔墙 (VIP Salon Room Walls left of corridor)
                // 北墙
                { x: margin + w * 0.70, y: margin + h * 0.32, w: w * 0.17, h: 10, type: 'solid', label: 'SALON NORTH WALL', hideLabel: true },
                // 南墙
                { x: margin + w * 0.70, y: margin + h * 0.74, w: w * 0.17, h: 10, type: 'solid', label: 'SALON SOUTH WALL', hideLabel: true },
                // 东墙 (与走廊隔开)
                { x: margin + w * 0.87, y: margin + h * 0.32, w: 10, h: h * 0.42, type: 'solid', label: 'SALON CORRIDOR WALL', hideLabel: true },
                // 西墙 (面向大堂，中段留出门洞通道)
                { x: margin + w * 0.70, y: margin + h * 0.32, w: 10, h: h * 0.15, type: 'solid', label: 'SALON WEST WALL NORTH', hideLabel: true },
                { x: margin + w * 0.70, y: margin + h * 0.57, w: 10, h: h * 0.17, type: 'solid', label: 'SALON WEST WALL SOUTH', hideLabel: true }
            ],
            securityGates: [],
            props: [
                // === 1. 客房 1 (Room 1 - Top Left) ===
                { type: 'wardrobe', x: margin + w * 0.28 - 104, y: margin + 12, w: 56, h: 22, label: 'LUXURY WARDROBE', displayName: 'WARDROBE' },
                { type: 'bed', x: margin + 36, y: margin + h * 0.16, w: 72, h: 46, facing: 'left', label: 'VIP KING BED', displayName: 'KING BED', tagPosition: 'inside' },
                { type: 'rug', x: margin + w * 0.28 - 110, y: margin + h * 0.16, w: 68, h: 46, noCollision: true, label: 'PERSIAN RUG', hideLabel: true },
                { type: 'desk', x: margin + w * 0.28 - 14, y: margin + h * 0.15, w: 10, h: 54, label: 'TELEVISION', displayName: 'TV DESK', tagPosition: 'left' },
                { type: 'lamp', x: margin + 18, y: margin + h * 0.38 - 30, w: 16, h: 16, label: 'VINTAGE FLOOR LAMP', hideLabel: true, tagPosition: 'left' },
                { type: 'sofa', x: margin + 80, y: margin + h * 0.38 - 36, w: 32, h: 28, facing: 'up', label: 'VELVET SOFA', displayName: 'SOFA', tagPosition: 'bottom' },
                { type: 'tea_table', x: margin + 130, y: margin + h * 0.38 - 32, w: 24, h: 24, label: 'TEA TABLE', displayName: 'TEA TABLE', tagPosition: 'top' },

                // === 1b. 左侧中间廊厅 (Middle Corridor Room) ===
                { type: 'plant', x: margin + 16, y: margin + h * 0.38 + 16, w: 16, h: 16, label: 'CORRIDOR BONSAI', hideLabel: true },
                { type: 'plant', x: margin + w * 0.28 - 32, y: margin + h * 0.38 + 16, w: 16, h: 16, label: 'CORRIDOR BONSAI', hideLabel: true },
                { type: 'plant', x: margin + 16, y: margin + h * 0.62 - 32, w: 16, h: 16, label: 'CORRIDOR BONSAI', hideLabel: true },
                { type: 'plant', x: margin + w * 0.28 - 32, y: margin + h * 0.62 - 32, w: 16, h: 16, label: 'CORRIDOR BONSAI', hideLabel: true },

                // === 2. 客房 2 (Room 2 - Bottom Left) ===
                { type: 'lamp', x: margin + 20, y: margin + h * 0.62 + 20, w: 16, h: 16, label: 'VINTAGE FLOOR LAMP', hideLabel: true, tagPosition: 'right' },
                // 欧式陶瓷浴缸：位于客房2内部靠墙处（深处，离门口远）
                { type: 'bathtub', x: margin + 42, y: margin + h * 0.62 + 16, w: 46, h: 26, label: 'CERAMIC BATHTUB', displayName: 'BATHTUB', tagPosition: 'bottom' },
                { type: 'bed', x: margin + 36, y: margin + h * 0.72, w: 72, h: 46, facing: 'left', label: 'VIP KING BED', displayName: 'KING BED' },
                { type: 'rug', x: margin + w * 0.28 - 110, y: margin + h * 0.72, w: 68, h: 46, noCollision: true, label: 'CLASSIC CARPET', hideLabel: true },
                { type: 'desk', x: margin + w * 0.28 - 14, y: margin + h * 0.70, w: 10, h: 54, label: 'TELEVISION', displayName: 'TV DESK', tagPosition: 'left' },

                // === 3. 行李寄存 (Luggage Storage) ===
                { type: 'reception_desk', x: margin + w * 0.285, y: margin + h * 0.22, w: 38, h: 12, facing: 'up', label: 'RECEPTION COUNTER', hideLabel: true },
                { type: 'luggage_stack', x: margin + w * 0.295, y: margin + h * 0.08, w: 38, h: 18, label: 'LUGGAGE RACK', displayName: 'LUGGAGE', tagPosition: 'top' },
                { type: 'luggage_stack', x: margin + w * 0.30, y: margin + h * 0.15, w: 34, h: 16, label: 'LUGGAGE STACK', hideLabel: true },
                { type: 'baggage_cart', x: margin + w * 0.355, y: margin + h * 0.12, w: 26, h: 28, label: 'GOLDEN BAGGAGE CART', displayName: 'CART', tagPosition: 'bottom' },

                // === 4. 前台接待 (Front Desk) ===
                { type: 'reception_desk', x: margin + w * 0.60, y: margin + h * 0.24, w: w * 0.22, h: 14, facing: 'up', label: 'RECEPTION DESK', displayName: 'FRONT DESK', tagPosition: 'bottom' },
                { type: 'office_chair', x: margin + w * 0.62, y: margin + h * 0.16, w: 18, h: 18, facing: 'down', label: 'OFFICE CHAIR', hideLabel: true },
                { type: 'office_chair', x: margin + w * 0.68, y: margin + h * 0.16, w: 18, h: 18, facing: 'down', label: 'OFFICE CHAIR', hideLabel: true },
                { type: 'office_chair', x: margin + w * 0.74, y: margin + h * 0.16, w: 18, h: 18, facing: 'down', label: 'OFFICE CHAIR', hideLabel: true },
                { type: 'plant', x: margin + w * 0.825, y: margin + h * 0.22, w: 18, h: 18, label: 'POTTED PLANT', displayName: 'PLANT', tagPosition: 'right' },
                { type: 'key_rack', x: margin + w * 0.81, y: margin + h * 0.10, w: 14, h: 24, label: 'CONCIERGE KEY RACK', displayName: 'KEY RACK', tagPosition: 'right' },

                // === 5. 大堂休息区 (Lobby Lounge) ===
                { type: 'piano', x: margin + w * 0.44, y: margin + h * 0.43, w: 44, h: 36, label: 'GRAND PIANO', displayName: 'GRAND PIANO' },
                { type: 'sofa', x: margin + w * 0.38, y: margin + h * 0.54, w: 18, h: 42, facing: 'right', label: 'LEATHER SOFA', displayName: 'SOFA', tagPosition: 'left' },
                { type: 'sofa', x: margin + w * 0.54, y: margin + h * 0.54, w: 18, h: 42, facing: 'left', label: 'LEATHER SOFA', displayName: 'SOFA', tagPosition: 'right' },
                { type: 'plant', x: margin + w * 0.36, y: margin + h * 0.43, w: 20, h: 20, label: 'COCONUT PLANT', hideLabel: true, tagPosition: 'left' },
                { type: 'plant', x: margin + w * 0.56, y: margin + h * 0.43, w: 20, h: 20, label: 'COCONUT PLANT', hideLabel: true, tagPosition: 'right' },
                { type: 'coffee_table', x: margin + w * 0.465, y: margin + h * 0.56, w: 32, h: 22, label: 'COFFEE TABLE', displayName: 'COFFEE TABLE', tagPosition: 'bottom' },

                // === 5a. 大堂中心与立柱景观 ===
                { type: 'fountain', x: margin + w * 0.43, y: margin + h * 0.77, w: 64, h: 64, label: 'ROYAL LOBBY FOUNTAIN', displayName: 'FOUNTAIN' },
                { type: 'pillar', x: margin + w * 0.36, y: margin + h * 0.71, w: 24, h: 24, label: 'MAIN MARBLE PILLAR', hideLabel: true, tagPosition: 'left' },
                { type: 'pillar', x: margin + w * 0.59, y: margin + h * 0.71, w: 24, h: 24, label: 'MAIN MARBLE PILLAR', hideLabel: true, tagPosition: 'right' },
                { type: 'pillar', x: margin + w * 0.285 + 16, y: margin + h * 0.12, w: 20, h: 20, label: 'CORRIDOR PILLAR', hideLabel: true, tagPosition: 'right' },
                { type: 'pillar', x: margin + w * 0.285 - 12, y: margin + h * 0.52, w: 20, h: 20, label: 'CORRIDOR PILLAR', hideLabel: true, tagPosition: 'left' },
                { type: 'pillar', x: margin + w * 0.44 - 10, y: margin + h * 0.21, w: 20, h: 20, label: 'LOBBY PILLAR', hideLabel: true, tagPosition: 'top' },
                { type: 'pillar', x: margin + w * 0.58, y: margin + h * 0.21, w: 20, h: 20, label: 'LOBBY PILLAR', hideLabel: true, tagPosition: 'top' },
                { type: 'plant', x: margin + w * 0.43 - 28, y: margin + h * 0.77 + 22, w: 20, h: 20, label: 'LOBBY PALMS', hideLabel: true, tagPosition: 'left' },
                { type: 'plant', x: margin + w * 0.43 + 72, y: margin + h * 0.77 + 22, w: 20, h: 20, label: 'LOBBY PALMS', hideLabel: true, tagPosition: 'right' },

                // === 5b. 贵宾独立沙龙房间 (VIP Executive Salon) ===
                { type: 'rug', x: margin + w * 0.715, y: margin + h * 0.36, w: w * 0.14, h: h * 0.34, noCollision: true, label: 'ROYAL BUSINESS CARPET', hideLabel: true },
                { type: 'display_cabinet', x: margin + w * 0.74, y: margin + h * 0.335, w: 34, h: 16, label: 'VIP GLASS DISPLAY CABINET', displayName: 'DISPLAY CABINET', tagPosition: 'bottom' },
                { type: 'plant', x: margin + w * 0.83, y: margin + h * 0.345, w: 16, h: 16, label: 'SALON PLANT', displayName: 'PLANT', tagPosition: 'right' },
                { type: 'sofa', x: margin + w * 0.725, y: margin + h * 0.46, w: 20, h: 20, facing: 'right', label: 'VELVET ARMCHAIR', displayName: 'ARMCHAIR', tagPosition: 'left' },
                { type: 'sofa', x: margin + w * 0.825, y: margin + h * 0.46, w: 20, h: 20, facing: 'left', label: 'VELVET ARMCHAIR', displayName: 'ARMCHAIR', tagPosition: 'bottom' },
                { type: 'coffee_table', x: margin + w * 0.77, y: margin + h * 0.46, w: 24, h: 20, label: 'COFFEE TABLE', displayName: 'COFFEE TABLE', tagPosition: 'bottom' },
                { type: 'lamp', x: margin + w * 0.715, y: margin + h * 0.67, w: 14, h: 14, label: 'VINTAGE FLOOR LAMP', hideLabel: true, tagPosition: 'left' },
                { type: 'baggage_cart', x: margin + w * 0.745, y: margin + h * 0.64, w: 28, h: 28, label: 'GOLDEN BAGGAGE CART', displayName: 'CART', tagPosition: 'bottom' },
                { type: 'pillar', x: margin + w * 0.83, y: margin + h * 0.66, w: 20, h: 20, label: 'SALON PILLAR', hideLabel: true, tagPosition: 'right' },
                { type: 'plant', x: margin + w * 0.83, y: margin + h * 0.58, w: 16, h: 16, label: 'SALON BONSAI', hideLabel: true, tagPosition: 'right' },

                // === 6. 卫生间 (Restroom) ===
                { type: 'sink', x: margin + w * 0.85, y: margin + h * 0.87, w: 24, h: 16, label: 'WASHBASIN', displayName: 'SINK', tagPosition: 'bottom' },
                { type: 'toilet', x: margin + w * 0.795, y: margin + h * 0.88, w: 16, h: 22, label: 'TOILET', displayName: 'TOILET', tagPosition: 'bottom' },

                // === 6b. 观光电梯 ===
                { type: 'elevator', x: margin + w * 0.67 - 21, y: margin + h * 0.90 - 4, w: 42, h: 36, label: 'ELEVATOR', displayName: 'ELEVATOR', tagPosition: 'bottom' },

                // === 7. 二楼楼梯 ===
                { type: 'stair', x: margin + w - 54, y: margin + 12, w: 42, h: h * 0.45, label: '2ND FLOOR STAIRS', displayName: 'STAIRS' }
            ],
            zones: [
                { name: "GUEST ROOM 1", x: margin + 10, y: margin + 10, w: w * 0.26, h: h * 0.36, labelX: margin + 20, labelY: margin + 25, align: 'left' },
                { name: "GUEST ROOM 2", x: margin + 10, y: margin + h * 0.63, w: w * 0.26, h: h * 0.36, labelX: margin + 20, labelY: margin + h - 25, align: 'left' },
                { name: "GUEST ROOMS", x: margin + 10, y: margin + h * 0.39, w: w * 0.26, h: h * 0.22, labelX: margin + w * 0.13, labelY: margin + h * 0.50, align: 'center' },
                { name: "NORTH GATE", x: margin + w * 0.44, y: margin + 15, w: w * 0.12, h: h * 0.10, labelX: margin + w * 0.50, labelY: margin + 35, align: 'center' },
                { name: "SOUTH GATE", x: margin + w * 0.44, y: height - margin - 50, w: w * 0.12, h: h * 0.10, labelX: margin + w * 0.50, labelY: height - margin - 25, align: 'center' },
                { name: "LUGGAGE STORAGE", x: margin + w * 0.29, y: margin + 15, w: w * 0.14, h: h * 0.20, labelX: margin + w * 0.30, labelY: margin + 25, align: 'left' },
                { name: "FRONT DESK", x: margin + w * 0.59, y: margin + 15, w: w * 0.24, h: h * 0.22, labelX: margin + w * 0.74, labelY: margin + h * 0.08, align: 'center' },
                { name: "STAIRS", x: margin + w - 60, y: margin + 12, w: 48, h: h * 0.45, labelX: margin + w - 36, labelY: margin + 25, align: 'center' },
                { name: "LOUNGE", x: margin + w * 0.36, y: margin + h * 0.42, w: w * 0.24, h: h * 0.22, labelX: margin + w * 0.50, labelY: margin + h * 0.40, align: 'center' },
                { name: "VIP SALON", x: margin + w * 0.70, y: margin + h * 0.32, w: w * 0.17, h: h * 0.42, labelX: margin + w * 0.785, labelY: margin + h * 0.35, align: 'center' },
                { name: "ELEVATOR", x: margin + w * 0.60, y: margin + h * 0.78, w: w * 0.14, h: h * 0.22, labelX: margin + w * 0.67, labelY: margin + h * 0.85, align: 'center' },
                { name: "RESTROOM", x: margin + w * 0.75, y: margin + h * 0.79, w: w * 0.14, h: h * 0.19, labelX: margin + w * 0.82, labelY: margin + h * 0.85, align: 'center' },
                { name: "CORRIDOR", x: margin + w * 0.90, y: margin + h * 0.43, w: w * 0.08, h: h * 0.45, labelX: margin + w * 0.94, labelY: margin + h * 0.60, align: 'center' }
            ],
            waypoints: [
                { x: margin + w * 0.13, y: margin + h * 0.20 },
                { x: margin + w * 0.13, y: margin + h * 0.50 },
                { x: margin + w * 0.13, y: margin + h * 0.80 },
                { x: margin + w * 0.35, y: margin + h * 0.50 },
                { x: margin + w * 0.50, y: margin + h * 0.30 },
                { x: margin + w * 0.50, y: margin + h * 0.50 },
                { x: margin + w * 0.50, y: margin + h * 0.70 },
                { x: margin + w * 0.72, y: margin + h * 0.30 },
                { x: margin + w * 0.92, y: margin + h * 0.50 },
                { x: margin + w * 0.92, y: margin + h * 0.80 }
            ],
            cameras: [
                { 
                    x: margin + w * 0.28, y: margin + h * 0.41, 
                    baseAngle: 0, currentAngle: 0,
                    sweepRange: Math.PI / 3, sweepSpeed: 0.015, sweepTimer: 0 
                },
                { 
                    x: margin + w * 0.78, y: margin + h * 0.78, // 挂载在卫生间外转角，监视整个大厅右半侧与二楼楼梯
                    baseAngle: Math.PI + Math.PI / 4, currentAngle: Math.PI + Math.PI / 4,
                    sweepRange: Math.PI / 3, sweepSpeed: 0.015, sweepTimer: 0 
                }
            ],
            lasers: []
        };
    }
};

window.LEVEL_HOTEL = LEVEL_HOTEL;
