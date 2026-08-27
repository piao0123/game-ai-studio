// 战术精纯版音效与背景音乐管理器 (DSP)
// 保留并精调：开枪（主/客）、爆炸、盲区夜视仪、战术警报
// 新增：极低沉、带心跳鼓点、绝不盖过枪声/警报的全新战术背景音乐 (BGM 纯 procedural 合成)

class SoundManager {
    constructor() {
        this.enabled = true;
        this.bgmVolume = 0.35; // 稍微调大默认背景音乐音量，从0.2调到0.35
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.userPaused = false;
        
        // 战术背景音乐状态 (Procedural BGM)
        this.bgmPlaying = false;
        this.bgmStep = 0;
        this.nextStepTime = 0;
        this.bgmIntervalId = null;
        this.activeBgmNodes = [];

        // 持续低频背景氛围 (BGM Drone)
        this.bgmDroneOsc = null;
        this.bgmDroneGain = null;
        this.bgmDroneFilter = null;

        // Web Audio 上下文和节点
        this.ctx = null;

        // 盲区夜视仪节点
        this.nvgOsc = null;
        this.nvgGain = null;

        // 战术警报音节点
        this.alarmOsc = null;
        this.alarmLfo = null;
        this.alarmLfoGain = null;
        this.alarmFilter = null;
        this.alarmGain = null;

        // BGM 轨道描述 (防界面报错存根)
        this.bgmTracks = [
            {
                id: 'tactical_heartbeat',
                name: 'Tactical Heartbeat // 战术心跳鼓点 (低频脉冲)',
                style: '深沉低频脉冲 / 极低混响鼓点 / 默认背景音乐',
                url: ''
            }
        ];
    }

    // 初始化 AudioContext
    initCtx() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // =======================================================
    // 1. 背景音乐：战术心跳鼓点 Procedural Bass & Beat Generator
    // =======================================================
    playBGM() {
        this.userPaused = false;
        if (!this.bgmPlaying) {
            this.startProceduralBGM();
        }
    }

    stopCurrentBGM() {
        this.stopProceduralBGM();
    }

    pauseBGM() {
        this.userPaused = true;
        this.stopProceduralBGM();
    }

    switchTrack() {}

    setBGMVolume(vol) {
        this.bgmVolume = Math.max(0, Math.min(1, vol));
        if (this.ctx && this.bgmDroneGain) {
            const now = this.ctx.currentTime;
            try {
                this.bgmDroneGain.gain.cancelScheduledValues(now);
                this.bgmDroneGain.gain.setValueAtTime(this.bgmDroneGain.gain.value, now);
                this.bgmDroneGain.gain.linearRampToValueAtTime(this.bgmVolume * 0.22, now + 0.1);
            } catch (e) {}
        }
    }

    // 启动完全由物理合成的低频战术背景音乐
    startProceduralBGM() {
        if (this.bgmPlaying) return;
        this.initCtx();
        if (!this.ctx) return;
        
        this.bgmPlaying = true;
        this.bgmStep = 0;
        this.nextStepTime = this.ctx.currentTime;
        this.activeBgmNodes = [];

        // 启动持续、温暖的电影级战术底噪氛围音 (Low Bass Pressure Drone)，彻底消除音乐在小节间的音量起伏、忽大忽小
        try {
            const now = this.ctx.currentTime;
            this.bgmDroneOsc = this.ctx.createOscillator();
            this.bgmDroneFilter = this.ctx.createBiquadFilter();
            this.bgmDroneGain = this.ctx.createGain();

            this.bgmDroneOsc.type = 'triangle'; // 温暖柔和的三角波
            this.bgmDroneOsc.frequency.setValueAtTime(36.71, now); // D1 低频幽深音

            this.bgmDroneFilter.type = 'lowpass';
            this.bgmDroneFilter.frequency.setValueAtTime(60, now); // 严苛低通，消除一切高频，只留下柔润的战术胸腔气压震动

            this.bgmDroneGain.gain.setValueAtTime(0, now);
            this.bgmDroneGain.gain.linearRampToValueAtTime(this.bgmVolume * 0.22, now + 1.2); // 优雅缓入

            this.bgmDroneOsc.connect(this.bgmDroneFilter);
            this.bgmDroneFilter.connect(this.bgmDroneGain);
            this.bgmDroneGain.connect(this.ctx.destination);

            this.bgmDroneOsc.start(now);
        } catch (e) {
            console.warn('Tactical Drone failed to start:', e);
        }
        
        const lookahead = 0.1; // 100ms 预调度
        const scheduleInterval = 45; // 45ms 扫描一次
        
        this.bgmIntervalId = setInterval(() => {
            if (!this.bgmPlaying || !this.ctx) return;
            
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            
            const now = this.ctx.currentTime;
            if (this.nextStepTime < now - 0.5) {
                this.nextStepTime = now;
            }
            while (this.nextStepTime < now + lookahead) {
                this.scheduleBGMStep(this.bgmStep, this.nextStepTime);
                this.advanceBGMStep();
            }
        }, scheduleInterval);
    }

    advanceBGMStep() {
        this.bgmStep = (this.bgmStep + 1) % 16;
        // 每步 150ms 相当于 100 BPM 拍子
        this.nextStepTime += 0.15; 
    }

    scheduleBGMStep(step, time) {
        if (!this.ctx) return;
        
        // 自动清理已经播放结束的节点引用
        this.activeBgmNodes = this.activeBgmNodes.filter(node => {
            if (node._stopTime && time > node._stopTime + 0.2) {
                try { node.disconnect(); } catch (e) {}
                return false;
            }
            return true;
        });

        // A. 战术超深沉底鼓 (Kick): 强震、纯低音、在 0, 4, 8, 12 步上播放
        if (step % 4 === 0) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(85, time);
            osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
            
            // 稍稍提高，使心跳律动更稳实
            gain.gain.setValueAtTime(this.bgmVolume * 0.28, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
            
            osc.start(time);
            osc.stop(time + 0.15);
            
            osc._stopTime = time + 0.15;
            this.activeBgmNodes.push(osc);
        }
        
        // B. 极软高频沙锤 (Shaker/Hi-Hat): 在 2, 6, 10, 14 步上作为弱拍点缀
        if ((step - 2) % 4 === 0) {
            const bufferSize = this.ctx.sampleRate * 0.03;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 7500; // 超高音
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(this.bgmVolume * 0.04, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            
            noise.start(time);
            noise.stop(time + 0.035);
            
            noise._stopTime = time + 0.035;
            this.activeBgmNodes.push(noise);
        }
        
        // C. 深沉密闭的切分贝斯 (Bassline): D1/C1 低频交替，在 0, 3, 6, 8, 11, 14 步
        const bassSteps = [0, 3, 6, 8, 11, 14];
        if (bassSteps.includes(step)) {
            let pitch = 36.71; // D1
            if (step >= 8) {
                pitch = 32.70; // C1 (更加幽深下潜)
            }
            
            const bassOsc = this.ctx.createOscillator();
            const bassFilter = this.ctx.createBiquadFilter();
            const bassGain = this.ctx.createGain();
            
            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(this.ctx.destination);
            
            bassOsc.type = 'triangle'; // 饱满、无过多锯齿杂音
            bassOsc.frequency.setValueAtTime(pitch, time);
            
            bassFilter.type = 'lowpass';
            bassFilter.frequency.setValueAtTime(85, time); // 极致低频，隔绝刺耳杂音
            
            bassGain.gain.setValueAtTime(0, time);
            bassGain.gain.linearRampToValueAtTime(this.bgmVolume * 0.22, time + 0.04);
            bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
            
            bassOsc.start(time);
            bassOsc.stop(time + 0.24);
            
            bassOsc._stopTime = time + 0.24;
            this.activeBgmNodes.push(bassOsc);
        }
    }

    stopProceduralBGM() {
        this.bgmPlaying = false;
        if (this.bgmIntervalId) {
            clearInterval(this.bgmIntervalId);
            this.bgmIntervalId = null;
        }
        if (this.activeBgmNodes) {
            this.activeBgmNodes.forEach(node => {
                try { node.stop(); node.disconnect(); } catch (e) {}
            });
            this.activeBgmNodes = [];
        }
        if (this.bgmDroneOsc) {
            try {
                const drone = this.bgmDroneOsc;
                const droneGain = this.bgmDroneGain;
                if (this.ctx) {
                    const now = this.ctx.currentTime;
                    droneGain.gain.cancelScheduledValues(now);
                    droneGain.gain.setValueAtTime(droneGain.gain.value, now);
                    droneGain.gain.linearRampToValueAtTime(0, now + 0.4); // 400ms优雅淡出
                    setTimeout(() => {
                        try {
                            drone.stop();
                            drone.disconnect();
                            droneGain.disconnect();
                        } catch (e) {}
                    }, 500);
                } else {
                    drone.stop();
                    drone.disconnect();
                }
            } catch (e) {}
            this.bgmDroneOsc = null;
            this.bgmDroneGain = null;
            this.bgmDroneFilter = null;
        }
    }

    // =======================================================
    // 2. 核心音效：开枪音效 (加强音量与冲击力，强化声音平衡)
    // =======================================================
    playShoot(weaponType) {
        if (!this.enabled) return;
        this.initCtx();
        
        // 使用 Mixkit 真枪采样音轨，将音量系数拉高至 1.6 倍，使其更有爆发力
        const sampleUrl = 'https://assets.mixkit.co/active_storage/sfx/2153/2153-preview.mp3';
        try {
            const audio = new Audio(sampleUrl);
            audio.volume = Math.min(1.0, Math.max(0, this.bgmVolume * 1.6));
            audio.play().catch(() => {
                this.playSynthesizedGunshot();
            });
        } catch (e) {
            this.playSynthesizedGunshot();
        }
    }

    // 敌人开枪：同样略微增强，体现远距离穿透感
    playEnemyShoot() {
        if (!this.enabled) return;
        this.initCtx();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // 弹药击发的火药白噪音
        const bufferSize = this.ctx.sampleRate * 0.18;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1050, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        noiseFilter.Q.setValueAtTime(3.0, now);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(this.bgmVolume * 1.25, now); // 增强音量
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        // 枪体低频共鸣
        const thumpOsc = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        thumpOsc.type = 'triangle';
        thumpOsc.frequency.setValueAtTime(200, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(30, now + 0.05);
        
        thumpGain.gain.setValueAtTime(this.bgmVolume * 1.4, now); // 增强音量
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        
        thumpOsc.connect(thumpGain);
        thumpGain.connect(this.ctx.destination);
        
        noise.start(now);
        thumpOsc.start(now);
        
        noise.stop(now + 0.2);
        thumpOsc.stop(now + 0.1);
    }

    // DSP 写实玩家开枪：增强突刺与火药冲击力
    playSynthesizedGunshot() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // A. 爆鸣白噪音
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.12);
        noiseFilter.Q.setValueAtTime(3.5, now);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(this.bgmVolume * 2.4, now); // 明显增强
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        // B. 低频膛内重击
        const thumpOsc = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        thumpOsc.type = 'triangle';
        thumpOsc.frequency.setValueAtTime(240, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.07);
        
        thumpGain.gain.setValueAtTime(this.bgmVolume * 2.8, now); // 明显增强
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        
        thumpOsc.connect(thumpGain);
        thumpGain.connect(this.ctx.destination);
        
        // C. 机械拉栓摩擦
        const mechanicalOsc = this.ctx.createOscillator();
        const mechanicalGain = this.ctx.createGain();
        mechanicalOsc.type = 'sawtooth';
        mechanicalOsc.frequency.setValueAtTime(3500, now + 0.06);
        
        mechanicalGain.gain.setValueAtTime(0, now);
        mechanicalGain.gain.setValueAtTime(this.bgmVolume * 0.28, now + 0.06); // 明显增强
        mechanicalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        
        mechanicalOsc.connect(mechanicalGain);
        mechanicalGain.connect(this.ctx.destination);
        
        noise.start(now);
        thumpOsc.start(now);
        mechanicalOsc.start(now + 0.06);
        
        noise.stop(now + 0.28);
        thumpOsc.stop(now + 0.13);
        mechanicalOsc.stop(now + 0.13);
    }

    // =======================================================
    // 3. 核心音效：爆炸音效 (音量明显调小，融入完美低噪平衡)
    // =======================================================
    playExplosion() {
        if (!this.enabled) return;
        this.initCtx();
        this.playSynthesizedExplosion();
    }

    playSynthesizedExplosion() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // 【第 1 阶段】：击针弹片瞬间 (调小音量)
        const crackBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
        const crackData = crackBuffer.getChannelData(0);
        for(let i = 0; i < crackBuffer.length; i++) {
            crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 150);
        }
        const crackSource = this.ctx.createBufferSource();
        crackSource.buffer = crackBuffer;
        const crackFilter = this.ctx.createBiquadFilter();
        crackFilter.type = 'highpass';
        crackFilter.frequency.value = 1800;
        const crackGain = this.ctx.createGain();
        crackGain.gain.setValueAtTime(this.bgmVolume * 1.6, now); // 原 4.2 -> 现 1.6 (大幅度调小)

        crackSource.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(this.ctx.destination);
        crackSource.start(now);

        // 【第 2 阶段】：重度膨胀热气流 (超重低音 - 调小)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(260, now);
        subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.18);
        
        subGain.gain.setValueAtTime(this.bgmVolume * 1.9, now); // 原 5.0 -> 现 1.9 (大幅度调小)
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        
        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.72);

        // 【第 3 阶段】：废墟物理残响 (调小)
        const bodyBufferSize = this.ctx.sampleRate * 2.0;
        const bodyBuffer = this.ctx.createBuffer(1, bodyBufferSize, this.ctx.sampleRate);
        const bodyData = bodyBuffer.getChannelData(0);
        for (let i = 0; i < bodyBufferSize; i++) {
            bodyData[i] = Math.random() * 2 - 1;
        }
        const bodySource = this.ctx.createBufferSource();
        bodySource.buffer = bodyBuffer;
        
        const bodyFilter = this.ctx.createBiquadFilter();
        bodyFilter.type = 'lowpass';
        bodyFilter.frequency.setValueAtTime(1400, now);
        bodyFilter.frequency.exponentialRampToValueAtTime(32, now + 1.2);
        
        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(this.bgmVolume * 1.1, now); // 原 2.6 -> 现 1.1 (大幅度调小)
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        
        bodySource.connect(bodyFilter);
        bodyFilter.connect(bodyGain);
        gainNode => gainNode.connect(this.ctx.destination);
        bodyGain.connect(this.ctx.destination);
        bodySource.start(now);
        bodySource.stop(now + 1.82);

        // 【第 4 阶段】：细碎弹片和混凝土碎屑落下 (调小)
        const debrisTimes = [0.14, 0.22, 0.31, 0.44];
        debrisTimes.forEach((delay) => {
            const debrisTime = now + delay;
            const debrisBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
            const dData = debrisBuffer.getChannelData(0);
            
            for(let i=0; i<debrisBuffer.length; i++) {
                dData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 140);
            }
            
            const dSource = this.ctx.createBufferSource();
            dSource.buffer = debrisBuffer;
            
            const dFilter = this.ctx.createBiquadFilter();
            dFilter.type = 'highpass';
            dFilter.frequency.value = 3200 + (Math.random() * 1500);
            
            const dGain = this.ctx.createGain();
            dGain.gain.setValueAtTime(this.bgmVolume * 0.22, debrisTime); // 原 0.65 -> 现 0.22
            dGain.gain.exponentialRampToValueAtTime(0.001, debrisTime + 0.045);
            
            dSource.connect(dFilter);
            dFilter.connect(dGain);
            dGain.connect(this.ctx.destination);
            dSource.start(debrisTime);
        });
    }

    // =======================================================
    // 4. 核心音效：盲区/夜视仪电容充能 (增强质感与音量)
    // =======================================================
    playBlindZone() {
        if (!this.enabled) return;
        this.initCtx();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // A. 继电器清脆回弹 Click (增强音量)
        const clickBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.02, this.ctx.sampleRate);
        const clickData = clickBuffer.getChannelData(0);
        for (let i = 0; i < clickBuffer.length; i++) {
            clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 110);
        }
        
        const clickSource1 = this.ctx.createBufferSource();
        clickSource1.buffer = clickBuffer;
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(this.bgmVolume * 0.85, now); // 原 0.45 -> 0.85
        clickSource1.connect(clickGain);
        clickGain.connect(this.ctx.destination);
        clickSource1.start(now);

        const clickSource2 = this.ctx.createBufferSource();
        clickSource2.buffer = clickBuffer;
        clickSource2.connect(clickGain);
        clickSource2.start(now + 0.04);

        // B. 真空管电容充能高频振荡 Whine - 仅在开启瞬间有蜂鸣（0.4秒），之后自动停止
        try {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1100, now);
            osc.frequency.exponentialRampToValueAtTime(8900, now + 0.38);

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(this.bgmVolume * 0.48, now + 0.14); // 原 0.25 -> 0.48
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.4); // 400ms后自动停止蜂鸣，不再持续嗡嗡作响
        } catch (e) {}
    }

    stopBlindZone() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;

        // 关闭瞬间放电蜂鸣（向下扫频，质感极佳）
        try {
            const offOsc = this.ctx.createOscillator();
            const offGain = this.ctx.createGain();

            offOsc.type = 'sine';
            offOsc.frequency.setValueAtTime(4500, now);
            offOsc.frequency.exponentialRampToValueAtTime(250, now + 0.26);

            offGain.gain.setValueAtTime(this.bgmVolume * 0.35, now);
            offGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

            offOsc.connect(offGain);
            offGain.connect(this.ctx.destination);

            offOsc.start(now);
            offOsc.stop(now + 0.26);

            // 物理 Click (增强)
            const clickBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.015, this.ctx.sampleRate);
            const clickData = clickBuffer.getChannelData(0);
            for (let i = 0; i < clickBuffer.length; i++) {
                clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 85);
            }
            const clickSource = this.ctx.createBufferSource();
            clickSource.buffer = clickBuffer;
            const clickGain = this.ctx.createGain();
            clickGain.gain.setValueAtTime(this.bgmVolume * 0.65, now + 0.2); // 原 0.35 -> 0.65
            clickSource.connect(clickGain);
            clickGain.connect(this.ctx.destination);
            clickSource.start(now + 0.2);
        } catch (e) {}

        this.nvgOsc = null;
        this.nvgGain = null;
    }

    // =======================================================
    // 5. 战术警报音 (双频扫频尖锐警报，纯物理合成，不吵且音量控制得当)
    // =======================================================
    playAlarm() {
        if (!this.enabled) return;
        this.initCtx();
        if (!this.ctx) return;
        
        // 确保只有一个警报音实例运行，防多重叠加刺耳
        if (this.alarmOsc) return;
        
        const now = this.ctx.currentTime;
        
        this.alarmOsc = this.ctx.createOscillator();
        this.alarmGain = this.ctx.createGain();
        this.alarmFilter = this.ctx.createBiquadFilter();
        
        // 使用 LFO 调制警报频率，使其在高频段快速周期扫动，具备逼真紧迫的特征 (尖锐但不吵)
        this.alarmLfo = this.ctx.createOscillator();
        this.alarmLfoGain = this.ctx.createGain();
        
        this.alarmLfo.type = 'sine';
        this.alarmLfo.frequency.setValueAtTime(1.8, now); // 每秒 1.8 次警报收缩
        this.alarmLfoGain.gain.setValueAtTime(125, now); // 扫频振幅范围 +/- 125 Hz
        
        this.alarmOsc.type = 'sine';
        this.alarmOsc.frequency.setValueAtTime(925, now); // 基础频率：925Hz (高辨识度，不低沉，稍带尖锐感)
        
        // 低通滤波器，隔绝极高频段（>1300Hz）的数码刮擦声，保留纯净的模拟气笛质感，绝不刺耳
        this.alarmFilter.type = 'lowpass';
        this.alarmFilter.frequency.setValueAtTime(1300, now);
        
        // 严格控制警报音量比例，完美融于战术环境
        this.alarmGain.gain.setValueAtTime(0, now);
        this.alarmGain.gain.linearRampToValueAtTime(this.bgmVolume * 0.12, now + 0.15); // 渐入，防止突兀爆音
        
        this.alarmLfo.connect(this.alarmLfoGain);
        this.alarmLfoGain.connect(this.alarmOsc.frequency);
        
        this.alarmOsc.connect(this.alarmFilter);
        this.alarmFilter.connect(this.alarmGain);
        this.alarmGain.connect(this.ctx.destination);
        
        this.alarmLfo.start(now);
        this.alarmOsc.start(now);
    }
    
    stopAlarm() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // 瞬间淡出并彻底关闭振荡器
        if (this.alarmOsc) {
            try {
                this.alarmGain.gain.cancelScheduledValues(now);
                this.alarmGain.gain.setValueAtTime(this.alarmGain.gain.value, now);
                this.alarmGain.gain.linearRampToValueAtTime(0, now + 0.08); // 80ms 极微淡出
                
                const osc = this.alarmOsc;
                const lfo = this.alarmLfo;
                const gainNode = this.alarmGain;
                const filterNode = this.alarmFilter;
                
                setTimeout(() => {
                    try {
                        osc.stop();
                        lfo.stop();
                        osc.disconnect();
                        lfo.disconnect();
                        gainNode.disconnect();
                        filterNode.disconnect();
                    } catch (e) {}
                }, 100);
            } catch (e) {}
            
            this.alarmOsc = null;
            this.alarmLfo = null;
            this.alarmGain = null;
            this.alarmFilter = null;
        }
    }

    // =======================================================
    // 6. 游戏状态变化生命周期
    // =======================================================
    updateGameState(isGameOver, isPaused) {
        const shouldPlay = !isGameOver && !isPaused && this.enabled && !this.userPaused;
        if (shouldPlay) {
            if (!this.bgmPlaying) {
                this.startProceduralBGM();
            }
        } else {
            if (this.bgmPlaying) {
                this.stopProceduralBGM();
            }
            this.stopAlarm();
        }
    }

    // 空方法兼容存根，保证不发生外部调用未定义崩溃
    startAmbient() {}
    stopAmbient() {}
    playAirportChime() {}
    playStationAtmosphere() {}
    playBankAtmosphere() {}
    playHit() {}
    playReload() {}
    playFootstep() {}
    playAlert() {}
    playPickup() {}
    playTrap() {}
}

const soundManager = new SoundManager();
if (typeof window !== 'undefined') {
    window.soundManager = soundManager;
}
