// 负责切换与管理场景关卡
class LevelManager {
    constructor() {
        this.levels = [];
        this.currentIndex = 0;
    }

    // 官方正式发布关卡：第1关（机场）、第2关（地铁）、第3关（银行）、第4关（游艇）、第5关（酒店）
    getLevels() {
        if (!this.levels || this.levels.length === 0) {
            this.levels = [
                (typeof LEVEL_AIRPORT !== 'undefined' ? LEVEL_AIRPORT : window.LEVEL_AIRPORT),
                (typeof LEVEL_SUBWAY !== 'undefined' ? LEVEL_SUBWAY : window.LEVEL_SUBWAY),
                (typeof LEVEL_BANK !== 'undefined' ? LEVEL_BANK : window.LEVEL_BANK),
                (typeof LEVEL_YACHT !== 'undefined' ? LEVEL_YACHT : window.LEVEL_YACHT),
                (typeof LEVEL_HOTEL !== 'undefined' ? LEVEL_HOTEL : window.LEVEL_HOTEL)
            ].filter(Boolean);
        }
        return this.levels;
    }

    // 测试关卡（Level 0 远东装甲列车）已安全隐藏，仅供开发测试调用
    loadTestLevel() {
        const testLvl = (typeof LEVEL_TEST !== 'undefined' ? LEVEL_TEST : window.LEVEL_TEST);
        if (!testLvl) return;
        this.levels = [testLvl, ...this.getLevels()];
        this.currentIndex = 0;
        this.loadCurrentLevel();
        if (typeof addLog === 'function') {
            addLog(`[开发调试] 测试关卡已载入: ${testLvl.name}`);
        }
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
            addLog(`已加载地图: ${level.name}`);
        } else if (typeof window.addLog === 'function') {
            window.addLog(`已加载地图: ${level.name}`);
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

