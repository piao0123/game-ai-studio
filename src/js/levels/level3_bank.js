// 银行与金库关卡地图数据与配置 (关卡 3：中央银行金库 - 像素蓝图重构版)
const LEVEL_BANK = {
    id: "level3_bank",
    name: "中央银行金库",
    playerStart: { x: 100, y: 340 }, // Far away from top-left camera and safe from any props
    
    getMapLayout: (width, height) => {
        // High-fidelity layout matching the realistic blueprint floor plan.
        // We avoid the top (y < 80) and bottom (y > height - 110) zones to prevent UI/log panel overlaps.
        const margin_left = 24;
        const margin_right = 24;
        const margin_top = 80;
        const margin_bottom = 110; // Extra padding to avoid log-panel overlaps in the bottom-left corner

        const w = width - margin_left - margin_right;
        const h = height - margin_top - margin_bottom;

        const x_left = margin_left;
        const x_right = width - margin_right;
        const y_top = margin_top;
        const y_bottom = height - margin_bottom;

        // Proportional dividers to make Zone A > Zone B > Zone C
        // Zone A (Public Lobby & Rooms): w * 0.38
        // Zone B (Staff Operations, Pantry, Restrooms, Staff Corridor): w * 0.34 (from 0.38 to 0.72)
        // Zone C (Reinforced Secure Vault): w * 0.28
        const x_sep1 = x_left + w * 0.38;            // Separator between Lobby and Staff Area
        const x_sep1_rooms = x_left + w * 0.10;      // Left wall of Account Opening Room
        const x_sep1_manager = x_left + w * 0.24;    // Left wall of Manager's Office
        const x_sep2 = x_left + w * 0.72;            // Outer Vault Wall boundary
        const x_sep_restroom = x_left + w * 0.58;    // Left wall of Breakroom & Restrooms
        
        // Vault inner left wall offset (hallway width of 75px for comfortable player navigation)
        const x_vault_left = x_sep2 + 75;

        // Portal sizes for comfortable character navigation
        const door_h = 75;

        return {
            obstacles: [
                // ==========================================
                // 1. Bank Heavy Outer Structural Walls
                // ==========================================
                { x: x_left, y: y_top, w: w, h: 14, type: 'solid', isOuterBorder: true },
                { x: x_left, y: y_bottom - 14, w: w, h: 14, type: 'solid', isOuterBorder: true },
                { x: x_left, y: y_top, w: 14, h: h, type: 'solid', isOuterBorder: true },
                { x: x_right - 14, y: y_top, w: 14, h: h, type: 'solid', isOuterBorder: true },

                // ==========================================
                // 2. Account Opening Room (开户室)
                // ==========================================
                // Left wall
                { x: x_sep1_rooms, y: y_top + 14, w: 12, h: h * 0.30 - 14, type: 'solid', label: 'ROOM WALL' },
                // Bottom wall with a door gap on the left side
                { x: x_sep1_rooms + 12 + door_h, y: y_top + h * 0.30, w: (x_sep1_manager - (x_sep1_rooms + 12 + door_h)), h: 12, type: 'low_wall', label: 'OFFICE PARTITION' },

                // ==========================================
                // 3. Branch Manager's Office (行长办公室)
                // ==========================================
                // Left divider wall (shared with Account Opening Room)
                { x: x_sep1_manager, y: y_top + 14, w: 12, h: h * 0.30 - 14, type: 'solid' },
                // Bottom wall with a door gap on the right (ends at x_sep1)
                { x: x_sep1_manager + 12, y: y_top + h * 0.30, w: (x_sep1 - x_sep1_manager - 12) - door_h, h: 12, type: 'low_wall', label: 'MANAGER PARTITION' },

                // ==========================================
                // 4. Teller Service Counters (柜台服务区)
                // ==========================================
                // Vertical counter separating Lobby and Behind-Counter space.
                // Leaves a gap at BOTH top and bottom for smooth, circular navigation.
                // Shifted left to x_left + w * 0.25 (to completely avoid blocking Secure Portal A)
                { x: x_left + w * 0.25, y: y_top + h * 0.38, w: 12, h: (y_bottom - 80) - (y_top + h * 0.38), type: 'glass', label: 'TELLER GLASS' },

                // ==========================================
                // 5. Lobby & Offices Separator (x_sep1)
                // ==========================================
                // Separates the public/counter area from the staff-only zones.
                // Features two secure doors: Door A (middle-top) and Door B (bottom).
                // Upper partition wall
                { x: x_sep1, y: y_top + 14, w: 12, h: h * 0.34 - 14, type: 'solid', label: '' },
                // Middle partition wall between Door A and Door B
                { x: x_sep1, y: y_top + h * 0.34 + door_h, w: 12, h: (h * 0.68) - (h * 0.34 + door_h), type: 'solid' },
                // Lower partition wall below Door B
                { x: x_sep1, y: y_top + h * 0.68 + door_h, w: 12, h: (y_bottom - 14) - (y_top + h * 0.68 + door_h), type: 'solid' },

                // ==========================================
                // 6. Breakroom (茶水间) & Restrooms (洗手间)
                // ==========================================
                // Vertical wall separating Breakroom/Restrooms from Staff Operations Area
                { x: x_sep_restroom, y: y_top + 14, w: 12, h: h * 0.54 - 14, type: 'solid', label: 'ROOM WALL' },
                // Breakroom bottom wall (shortened to create a wide entrance into the Pantry)
                { x: x_sep1 + 12, y: y_top + h * 0.28, w: 55, h: 12, type: 'low_wall', label: 'PANTRY PARTITION' },
                // Restroom 1 (Upper) bottom wall (has door gap on the left)
                { x: x_sep_restroom + 12 + door_h, y: y_top + h * 0.27, w: (x_sep2 - (x_sep_restroom + 12 + door_h)), h: 12, type: 'solid', label: 'RESTROOM PARTITION' },
                // Restroom 2 (Lower) bottom wall (has door gap on the left)
                { x: x_sep_restroom + 12 + door_h, y: y_top + h * 0.54, w: (x_sep2 - (x_sep_restroom + 12 + door_h)), h: 12, type: 'solid', label: 'RESTROOM PARTITION' },

                // ==========================================
                // 7. Staff Operations & Corridor Separator
                // ==========================================
                // Horizontal divider separating middle Staff Operations Area from bottom Staff Corridor.
                // Features a secure door gap on the right.
                { x: x_sep1 + 12, y: y_top + h * 0.64, w: (x_sep2 - x_sep1 - 12) - door_h, h: 12, type: 'low_wall', label: 'STAFF DIVIDER' },

                // ==========================================
                // 8. Outer Vault Wall (金库外墙)
                // ==========================================
                // High-security boundary separating Staff areas from the Vault entrance vestibule.
                // Features the Outer Vault Entrance Door.
                { x: x_sep2, y: y_top + 14, w: 16, h: h * 0.68 - 14, type: 'solid', label: 'ARMORED VAULT BARRIER' },
                { x: x_sep2, y: y_top + h * 0.68 + door_h, w: 16, h: (y_bottom - 14) - (y_top + h * 0.68 + door_h), type: 'solid' },

                // ==========================================
                // 9. Inner Vault Chamber (金库核心室)
                // ==========================================
                // Heavy double-walled reinforced steel chamber.
                // Left Wall of the Vault chamber (contains the giant circular Vault Door).
                // Aligned to x_vault_left (75px corridor) so player can walk freely without collision.
                { x: x_vault_left, y: y_top + h * 0.12, w: 16, h: h * 0.26, type: 'solid', label: '' },
                { x: x_vault_left, y: y_top + h * 0.38 + door_h, w: 16, h: (y_bottom - h * 0.12 - 16) - (y_top + h * 0.38 + door_h), type: 'solid' },
                // Top Wall of Vault chamber
                { x: x_vault_left, y: y_top + h * 0.12, w: (x_right - x_vault_left - 14), h: 16, type: 'solid' },
                // Bottom Wall of Vault chamber
                { x: x_vault_left, y: y_bottom - h * 0.12 - 16, w: (x_right - x_vault_left - 14), h: 16, type: 'solid' }
            ],

            // Secure Portal Access Controls (Aligned perfectly with door frames)
            securityGates: [
                // Portal B: Lobby -> Staff Corridor
                { x: x_sep1, y: y_top + h * 0.68, w: 12, h: door_h, label: 'SECURE PORTAL B' },
                // Vault Entrance: Staff Corridor -> Vault Vestibule
                { x: x_sep2, y: y_top + h * 0.68, w: 16, h: door_h, label: 'VAULT SECURITY GATE' },
                // Heavy Vault Door: Vestibule -> Vault Room Inner
                { x: x_vault_left - 2, y: y_top + h * 0.38, w: 20, h: door_h, label: 'HEAVY VAULT DOOR' }
            ],

            // Blueprint Furniture Sets & Room Props
            props: [
                // --- Lobby Area Props ---
                // Reception (接待处) - Elegant L-shaped front desk shifted left
                { type: 'desk', x: x_left + w * 0.04, y: y_top + h * 0.15, w: 45, h: 22, label: 'RECEPTION' },
                { type: 'desk', x: x_left + w * 0.04 + 45, y: y_top + 14, w: 22, h: h * 0.15 + 2, label: '' },
                
                // Waiting Area (休息区) - Shifted higher along the left wall to completely avoid bottom-left log-panel overlaps
                { type: 'sofa', x: x_left + 20, y: y_top + h * 0.48, w: 16, h: 40, label: '' },
                { type: 'sofa', x: x_left + 20, y: y_top + h * 0.58, w: 16, h: 40, label: '' },
                { type: 'desk', x: x_left + 45, y: y_top + h * 0.53, w: 20, h: 20, label: 'COFFEE TABLE' },

                // --- Account Opening Room (开户室) ---
                { type: 'desk', x: x_sep1_rooms + 15, y: y_top + h * 0.10, w: 35, h: 22, label: 'OPENING DESK' },

                // --- Manager's Office (行长办公室) ---
                { type: 'desk', x: x_sep1_manager + 20, y: y_top + h * 0.10, w: 35, h: 22, label: '' },

                // --- Teller behind-counter desks (positioned in the private teller workspace) ---
                // Shifted horizontally to sit comfortably behind teller glass at 0.25 * w
                { type: 'desk', x: x_left + w * 0.25 + 18, y: y_top + h * 0.42, w: 20, h: 20, label: 'TELLER UNIT 1' },
                { type: 'desk', x: x_left + w * 0.25 + 18, y: y_top + h * 0.54, w: 20, h: 20, label: 'TELLER UNIT 2' },
                { type: 'desk', x: x_left + w * 0.25 + 18, y: y_top + h * 0.66, w: 20, h: 20, label: 'TELLER UNIT 3' },
                { type: 'desk', x: x_left + w * 0.25 + 18, y: y_top + h * 0.78, w: 20, h: 20, label: 'TELLER UNIT 4' },

                // --- Breakroom (茶水间) ---
                { type: 'desk', x: x_sep1 + 18, y: y_top + 18, w: 28, h: 20, label: 'PANTRY SHELF' },

                // --- Staff Operations Area (员工区域) ---
                // Sized and positioned flush to the walls to keep a wide, clear vertical path for the player.
                { type: 'desk', x: x_sep1 + 25, y: y_top + h * 0.35, w: 32, h: 22, label: 'STAFF DESK 1' },
                { type: 'desk', x: x_sep1 + 25, y: y_top + h * 0.50, w: 32, h: 22, label: 'STAFF DESK 2' },
                { type: 'desk', x: x_sep_restroom - 55, y: y_top + h * 0.35, w: 32, h: 22, label: 'STAFF DESK 3' },
                { type: 'desk', x: x_sep_restroom - 55, y: y_top + h * 0.50, w: 32, h: 22, label: 'STAFF DESK 4' },

                // --- Staff Corridor (员工通道) ---
                // Large, beautiful long table centered in the bottom room.
                { type: 'desk', x: x_sep1 + (x_sep2 - x_sep1)/2 - 55, y: (y_top + h * 0.64 + y_bottom)/2 - 15, w: 110, h: 30, label: 'CONFERENCE TABLE' },

                // --- Vault Chamber Inner Room ---
                // Safety Deposit Boxes (保险箱) lining the top and left walls of the vault
                { type: 'deposit_boxes', x: x_vault_left + 40, y: y_top + h * 0.16, w: 100, h: 18, label: '' },
                // Sized and positioned higher up so it ends before the heavy vault door (y_top + h * 0.38) begins, avoiding door blockage.
                { type: 'deposit_boxes', x: x_vault_left + 18, y: y_top + h * 0.12 + 20, w: 18, h: 60, label: '' },
                // Cash Storage racks (现金储存架) at the bottom (type: 'cash_rack' for spectacular custom rendering)
                { type: 'cash_rack', x: x_vault_left + 60, y: y_bottom - h * 0.12 - 45, w: 100, h: 22, label: 'CASH RACKS' }
            ],

            // Strategic Security Zones matching blueprint
            zones: [
                { name: "ZONE A", x: x_left + 18, y: y_top + 18, w: w * 0.36, h: h - 36, labelX: x_left + 28, labelY: y_top + 105, align: 'left' },
                { name: "ZONE B", x: x_sep1 + 18, y: y_top + 18, w: (x_sep2 - x_sep1) - 36, h: h - 36, labelX: x_sep1 + 28, labelY: y_top + 105, align: 'left' },
                { name: "ZONE C", x: x_sep2 + 18, y: y_top + 18, w: (x_right - x_sep2) - 36, h: h - 36, labelX: x_sep2 + 28, labelY: y_top + 105, align: 'left' }
            ],

            // Navigable AI Patrol Routing Waypoints (through corridors and openings)
            waypoints: [
                { x: x_left + w * 0.14, y: y_top + h * 0.45 },   // Lobby Center
                { x: x_left + w * 0.14, y: y_bottom - 60 },      // Lobby Bottom
                { x: x_sep1_rooms + 25, y: y_top + h * 0.18 },   // Opening Room Inside
                { x: x_sep1_manager + 25, y: y_top + h * 0.18 }, // Manager Room Inside
                { x: x_sep1 + 45, y: y_top + h * 0.45 },         // Staff Area Center
                { x: x_sep1 + 45, y: y_bottom - 50 },            // Staff Corridor Center
                { x: x_sep2 + 35, y: y_bottom - 50 },            // Vault Vestibule Entry
                { x: x_vault_left + 60, y: y_top + h * 0.45 }    // Vault Room Inner Center
            ],

            // Balanced high-tech cameras matching strategic tactical spots
            cameras: [
                // 1. Lobby Surveillance: Avoids top-left UI overlap, scanning reception/entrance from wall middle
                { 
                    x: x_left + 22, y: y_top + 150, 
                    baseAngle: -Math.PI / 6, currentAngle: -Math.PI / 6,
                    sweepTimer: 0, sweepSpeed: 0.015, sweepRange: Math.PI / 6, 
                    detecting: false, cooldownTimer: 0 
                },
                // 2. Zone B CCTV: Placed above Zone B text, sweeps left to cover pantry and manager's office, but never right (restrooms)
                { 
                    x: x_sep1 + (x_sep2 - x_sep1) / 2, y: y_top + 22, 
                    baseAngle: Math.PI * 0.9, currentAngle: Math.PI * 0.9,
                    sweepTimer: 0, sweepSpeed: 0.015, sweepRange: Math.PI / 6, 
                    detecting: false, cooldownTimer: 0 
                }
            ],

            // High-energy laser infrared defense barriers (balanced for playability)
            lasers: [
                // Laser 1: Horizontal fixed laser between heavy vault door upper post and top obstacle
                {
                    x1: x_vault_left, y1: y_top + h * 0.34,
                    x2: x_vault_left + 160, y2: y_top + h * 0.34,
                    active: true,
                    pulseType: 'static'
                },
                // Laser 2: Horizontal moving laser between heavy vault door lower post and cash rack
                {
                    x1: x_vault_left, y1: y_top + h * 0.38 + door_h + 10,
                    x2: x_vault_left + 100, y2: y_top + h * 0.38 + door_h + 10,
                    active: true,
                    pulseType: 'moving_y',
                    minY: y_top + h * 0.38 + door_h + 10,
                    maxY: y_bottom - h * 0.12 - 55,
                    speed: 1.2,
                    dir: 1,
                    y: y_top + h * 0.38 + door_h + 10
                },
                // Laser 3: Vertical moving laser between rightmost wall and cash rack
                {
                    x1: x_vault_left + 110, y1: y_top + h * 0.12 + 16,
                    x2: x_vault_left + 110, y2: y_bottom - h * 0.12 - 16,
                    active: true,
                    pulseType: 'moving_x',
                    minX: x_vault_left + 110,
                    maxX: x_right - 25,
                    speed: 1.5,
                    dir: 1,
                    x: x_vault_left + 110
                }
            ]
        };
    }
};

window.LEVEL_BANK = LEVEL_BANK;
