// 负责切换与管理场景关卡
class LevelManager {
    constructor() {
        this.levels = [];
        this.currentIndex = 0;
    }

    getLevels() {
        if (!this.levels || this.levels.length === 0) {
            this.levels = [
                (typeof LEVEL_AIRPORT !== 'undefined' ? LEVEL_AIRPORT : window.LEVEL_AIRPORT),
                (typeof LEVEL_SUBWAY !== 'undefined' ? LEVEL_SUBWAY : window.LEVEL_SUBWAY),
                (typeof LEVEL_BANK !== 'undefined' ? LEVEL_BANK : window.LEVEL_BANK),
                (typeof LEVEL_TEST !== 'undefined' ? LEVEL_TEST : window.LEVEL_TEST)
            ].filter(Boolean);
        }
        return this.levels;
    }

    getCurrentLevel() {
        const levels = this.getLevels();
        return levels[this.currentIndex] || levels[0];
    }

    loadCurrentLevel() {
        const level = this.getCurrentLevel();
        if (!level) return;

        const w = (typeof width !== 'undefined' && width) ? width : (window.width || window.innerWidth || 1200);
        const h = (typeof height !== 'undefined' && height) ? height : (window.height || window.innerHeight || 800);

        const layout = level.getMapLayout(w, h);

        const obs = layout.obstacles || [];
        const sec = layout.securityGates || [];
        const prp = layout.props || [];
        const zns = layout.zones || [];
        const way = layout.waypoints || [];
        const cam = layout.cameras || [];
        const lsr = layout.lasers || [];

        if (typeof setMapData === 'function') {
            setMapData(obs, sec, prp, zns, way, cam, lsr);
        } else if (typeof window.setMapData === 'function') {
            window.setMapData(obs, sec, prp, zns, way, cam, lsr);
        }

        const p = (typeof player !== 'undefined' ? player : window.player);
        if (p && level.playerStart) {
            p.x = level.playerStart.x;
            p.y = level.playerStart.y;

            if (level.id === 'level3_bank') {
                p.viewDistance = 250;
                if (typeof initBankRevealGrid === 'function') {
                    initBankRevealGrid();
                } else if (typeof window.initBankRevealGrid === 'function') {
                    window.initBankRevealGrid();
                }
            } else {
                p.viewDistance = 500;
            }
        }

        if (typeof addLog === 'function') {
            addLog(`LOADED: ${level.name}`);
        } else if (typeof window.addLog === 'function') {
            window.addLog(`LOADED: ${level.name}`);
        }
    }

    nextLevel() {
        const levels = this.getLevels();
        if (this.currentIndex + 1 < levels.length) {
            this.currentIndex++;
            this.loadCurrentLevel();
            return true;
        }
        return false; // 已无更多关卡
    }
}

const levelManager = new LevelManager();
window.levelManager = levelManager;

