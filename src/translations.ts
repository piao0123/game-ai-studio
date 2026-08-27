export type Language = 'zh' | 'en';

export interface TranslationDict {
  // Title & Header
  gameTitle: string;
  gameSubtitle: string;
  
  // Menu Buttons
  startMission: string;
  tacticalManual: string;
  sectorSelect: string;
  languageSelect: string;
  
  // Pause Menu
  tacticalPause: string;
  resumeMission: string;
  restartMission: string;
  returnToMenu: string;

  // Top Bar HUD
  hudGuide: string;
  hudSector: string;
  hudPause: string;
  hudResume: string;
  hudRestart: string;
  hudMenu: string;
  hudLang: string;

  // Status Box
  hpLabel: string;
  armorLabel: string;
  blindEnergyLabel: string;
  blindActiveLabel: string;
  waveLabel: string;
  enemiesLabel: string;
  nextWaveLabel: string;
  killsLabel: string;
  alarmBanner: string;

  // Game Over
  missionFailed: string;
  sectorCleared: string;
  agentFallenDesc: (wave: number, kills: number) => string;
  sectorClearedDesc: (kills: number) => string;
  restartBtn: string;

  // Prologue
  prologue: {
    title: string;
    p1: string[];
    p2: string[];
    p3: string[];
    p4: string[];
    p5: string[];
    p6: string[];
    p7: string[];
    quote: string[];
    skipTip: string;
    enterBtn: string;
  };

  // Level Selection
  levelSelect: {
    title: string;
    confirmBtn: string;
    levels: {
      id: string;
      title: string;
      badge: string;
      desc: string;
    }[];
  };

  // Tutorial (How to Play)
  tutorial: {
    title: string;
    backBtn: string;
    moveAimTitle: string;
    moveAimDesc1: string;
    moveAimDesc2: string;
    weaponsTitle: string;
    weaponsDesc1: string;
    weaponsDesc2: string;
    armorTitle: string;
    armorDesc1: string;
    armorDesc2: string;
    blindTeleportTitle: string;
    blindTeleportDesc1: string;
    blindTeleportDesc2: string;
    blindDamageTitle: string;
    blindDamageDesc: string;
    trapTitle: string;
    trapDesc: string;
    killstreakTitle: string;
    killstreak3Title: string;
    killstreak3Desc: string;
    killstreak5Title: string;
    killstreak5Desc: string;
    killstreak7Title: string;
    killstreak7Desc: string;
    observerTitle: string;
    observerDesc: string;
    coverTitle: string;
    coverGlassDesc: string;
    coverLowWallDesc: string;
  };

  // Weapons
  weapons: {
    rifle: string;
    pistol: string;
    smg: string;
    sniper: string;
    grenade: string;
    machineGun: string;
    uav: string;
  };
}

export const translations: Record<Language, TranslationDict> = {
  zh: {
    gameTitle: '视界滞后',
    gameSubtitle: '',
    startMission: '开始游戏',
    tacticalManual: '操作指南',
    sectorSelect: '关卡选择',
    languageSelect: '语言',
    tacticalPause: '游戏暂停',
    resumeMission: '继续游戏',
    restartMission: '重新开始',
    returnToMenu: '返回主菜单',
    hudGuide: '指南',
    hudSector: '关卡',
    hudPause: '暂停',
    hudResume: '继续',
    hudRestart: '重置',
    hudMenu: '主菜单',
    hudLang: 'EN',
    hpLabel: '生命值',
    armorLabel: '防弹衣',
    blindEnergyLabel: '盲区能量 [SPACE]',
    blindActiveLabel: '盲区开启中 [SPACE]',
    waveLabel: '波次',
    enemiesLabel: '剩余敌人',
    nextWaveLabel: '下一波即将到来...',
    killsLabel: '击杀数',
    alarmBanner: '🚨 警报触发 - 全区域戒备 🚨',
    missionFailed: '任务失败',
    sectorCleared: '关卡完成',
    agentFallenDesc: (wave, kills) => `特工在第 ${wave} 波行动中阵亡。总击杀数: ${kills}`,
    sectorClearedDesc: (kills) => `区域已完全肃清。总击杀数: ${kills}`,
    restartBtn: '[ R ] 重新开始',
    prologue: {
      title: '视界滞后',
      p1: [
        '二战结束后，',
        '美英欧等西方同盟国',
        '于1947年联合签署密约，',
        '成立了同盟国战略情报署（SIA）——',
        '一个超越单一国界、',
        '直属于同盟最高防务委员会的',
        '跨国情报与绝密战术机构。'
      ],
      p2: [
        '21世纪中叶，',
        '自动化控制与光电传感技术迎来飞跃。',
        '面对日益复杂的全球威胁，',
        '同盟国政府在追求绝对安全的叙事中，',
        '自愿将秩序让渡给算法，',
        '并逐步将 SIA 庞大的全球防务网',
        '与基础设施全面外包。'
      ],
      p3: [
        '跨国军工巨头百眼防务集团（Argus Defence Group）',
        '借此崛起。',
        '通过在基础设施、要塞与主权边境铺设',
        '全天候自动化监控天网——“百眼全视者”（Argus Panoptes），',
        '百眼防务完成了对全球物理空间与信息流动的绝对闭环。'
      ],
      p4: [
        '在“百眼全视者”的覆盖下，',
        '任何未经授权的行动均被即时识别并予以物理肃清。',
        '而当一个非主权军工复合体',
        '掌握了全球信息的生死阀门，',
        '则意味着主权国家的防务命脉与国家安全',
        '也随即被彻底架空。',
        '一场围绕“信息控制权”的暗中博弈',
        '在冷战式的静默中展开。'
      ],
      p5: [
        '为打破这种单向透明的技术霸权，',
        '已退居暗处、被逼至绝境的 SIA 启动了绝密应对机制——',
        '研发出能够阻断局域光子与微波传播的“盲区发生器”。'
      ],
      p6: [
        '通过强制制造外界传感器无法观测的“信息断层”，',
        '该技术强行在绝对控制的防线中',
        '开辟出不被坍缩的物理死角。'
      ],
      p7: [
        '作为情报署直属特别行动局（SAD）的高价值隐蔽行动专家，',
        '代号“幽灵”（Specter）的一级作战人员',
        '将携带这台唯一的实验性装置，深入敌对要塞。'
      ],
      quote: [
        '这是一场发生在观测边缘的秩序之争。',
        '一方以绝对透明构建全球统治；',
        '另一方，则利用视界的滞后，',
        '在不可被观测的死角中重塑因果。'
      ],
      skipTip: '[ 可自由滚动阅读 · 按 Enter / Space 键或点击下方按钮开始 ]',
      enterBtn: '进入游戏'
    },
    levelSelect: {
      title: '关卡选择',
      confirmBtn: '进入关卡',
      levels: [
        {
          id: 'level1',
          title: '第 1 关 · 机场航站楼',
          badge: '第 1 关',
          desc: '机场航站楼：包含安检门警报、红外监控摄像、行李传送带与防暴盾牌敌人。'
        },
        {
          id: 'level2',
          title: '第 2 关 · 地铁站台',
          badge: '第 2 关',
          desc: '地下铁站台：长廊型双层站台、进站闸机通道、列车车体与玻璃隔音墙掩体。'
        },
        {
          id: 'level3',
          title: '第 3 关 · 银行金库',
          badge: '第 3 关',
          desc: '中央银行金库：配备高能红外激光探测网、重型钢制墙体与全区战术盲雾。'
        },
        {
          id: 'level4',
          title: '第 4 关 · 豪华游艇',
          badge: '第 4 关',
          desc: '超级游艇：尾部游泳池、沙龙、餐厅、主卧套房、客房以及船首直升机停机坪。'
        },
        {
          id: 'level5',
          title: '第 5 关 · 酒店大堂',
          badge: '第 5 关',
          desc: '五星级酒店大堂：闪灵风格雕花红木墙、行李寄存处、前台、大堂休息区与 VIP 奢华沙龙。'
        }
      ]
    },
    tutorial: {
      title: '操作指南与游戏机制',
      backBtn: '返回',
      moveAimTitle: '移动与瞄准',
      moveAimDesc1: 'W A S D：控制角色全向移动。',
      moveAimDesc2: '鼠标移动：瞄准与视角转向。',
      weaponsTitle: '武器系统',
      weaponsDesc1: '鼠标左键：开火射击。',
      weaponsDesc2: '1 - 5 键：切换主副武器。初始配备步枪，其他武器由击杀敌人掉落拾取。',
      armorTitle: '防弹衣与补给',
      armorDesc1: '防弹衣吸收子弹与爆炸伤害；脱战后可缓慢自我恢复。',
      armorDesc2: '击败敌人掉落补给，拾取可恢复防弹衣与盲区能量。',
      blindTeleportTitle: '盲区与瞬移',
      blindTeleportDesc1: '按 Space 空格键开启/收起盲区。',
      blindTeleportDesc2: '在盲区内部双击鼠标左键可进行瞬移。',
      blindDamageTitle: '伤害延迟结算',
      blindDamageDesc: '盲区构筑双向视觉屏障（外部看不进，内部看不出）。在盲区内造成的伤害将在盲区解除瞬间一并爆发结算。',
      trapTitle: '诱饵陷阱 [5 + 右键]',
      trapDesc: '盲区开启且手持手雷（5 键）时，在盲区地面右键点击可部署诱饵陷阱。',
      killstreakTitle: '连杀奖励',
      killstreak3Title: '3 连杀：[ 6 键 ] 重机枪',
      killstreak3Desc: '高射速重型火力压制。',
      killstreak5Title: '5 连杀：[ 7 键 ] UAV 轰炸',
      killstreak5Desc: '扫描全图敌人并发动定点空袭。',
      killstreak7Title: '7 连杀：[ 8 键 / Space ] 全图盲区',
      killstreak7Desc: '全地图覆盖的绝对盲区隐匿。',
      observerTitle: '观察者敌人',
      observerDesc: '配备重装防弹衣，能看穿盲区，极易被诱饵陷阱吸引。',
      coverTitle: '特殊掩体',
      coverGlassDesc: '防弹玻璃：通透视线，子弹穿透但伤害衰减，拦截手雷投掷。',
      coverLowWallDesc: '矮墙：阻挡视线与直射子弹，支持手雷抛投越过。'
    },
    weapons: {
      rifle: '1: 步枪',
      pistol: '2: 手枪',
      smg: '3: 冲锋枪',
      sniper: '4: 狙击枪',
      grenade: '5: 手雷',
      machineGun: '6: 机枪',
      uav: '7: 空袭'
    }
  },
  en: {
    gameTitle: 'OBSERVATION LAG',
    gameSubtitle: '',
    startMission: 'Start Game',
    tacticalManual: 'Tutorial',
    sectorSelect: 'Level Select',
    languageSelect: 'Language',
    tacticalPause: 'Game Paused',
    resumeMission: 'Resume',
    restartMission: 'Restart',
    returnToMenu: 'Main Menu',
    hudGuide: 'Guide',
    hudSector: 'Level',
    hudPause: 'Pause',
    hudResume: 'Resume',
    hudRestart: 'Reset',
    hudMenu: 'Menu',
    hudLang: '中文',
    hpLabel: 'HP',
    armorLabel: 'Armor',
    blindEnergyLabel: 'Blind Zone [SPACE]',
    blindActiveLabel: 'Blind Zone Active [SPACE]',
    waveLabel: 'Wave',
    enemiesLabel: 'Hostiles',
    nextWaveLabel: 'Next wave incoming...',
    killsLabel: 'Kills',
    alarmBanner: '🚨 ALARM TRIGGERED - HIGH ALERT 🚨',
    missionFailed: 'Mission Failed',
    sectorCleared: 'Level Cleared',
    agentFallenDesc: (wave, kills) => `Operative eliminated on Wave ${wave}. Total Kills: ${kills}`,
    sectorClearedDesc: (kills) => `Area fully secured. Total Kills: ${kills}`,
    restartBtn: '[ R ] Restart',
    prologue: {
      title: 'Observation Lag',
      p1: [
        'In the aftermath of World War II,',
        'Western Allied nations signed a classified treaty in 1947',
        'establishing the Strategic Intelligence Agency (SIA)—',
        'a clandestine multilateral defense agency',
        'operating beyond sovereign boundaries.'
      ],
      p2: [
        'By the mid-21st century,',
        'rapid breakthroughs in automated tracking and electro-optical sensors arrived.',
        'Confronting complex global threats,',
        'governments surrendered defense autonomy to algorithms,',
        'gradually outsourcing SIA’s vast global surveillance infrastructure',
        'to private defense conglomerates.'
      ],
      p3: [
        'Argus Defense Group rose to absolute dominance.',
        'By deploying an omniscient automated sensor network—',
        '“Argus Panoptes”—across sovereign borders and key strongholds,',
        'Argus established complete surveillance over physical',
        'and digital realms worldwide.'
      ],
      p4: [
        'Under Argus Panoptes,',
        'any unauthorized movement is immediately flagged and eliminated.',
        'With private conglomerates controlling the global information choke-point,',
        'sovereign defense lines were hollowed out from within.',
        'A silent war for information hegemony began.'
      ],
      p5: [
        'To break this one-way transparency,',
        'the covert remnants of the SIA initiated their ultimate contingency—',
        'engineering the experimental “Blind Zone Generator”,',
        'a tactical device capable of halting localized photon and microwave transmission.'
      ],
      p6: [
        'By manufacturing an unobservable information disconnect,',
        'the prototype carves out a stable physical blind spot',
        'entirely invisible to automated sensory lines.'
      ],
      p7: [
        'As elite covert operative “Specter” from the Special Activities Division (SAD),',
        'you are deployed deep behind enemy lines',
        'equipped with the sole functioning prototype.'
      ],
      quote: [
        'A silent war fought at the perimeter of perception.',
        'One side enforces order through total transparency;',
        'The other exploits observation lag to reshape reality in the dark.'
      ],
      skipTip: '[ Press any key or click anywhere to continue ]',
      enterBtn: 'Start Game'
    },
    levelSelect: {
      title: 'Level Selection',
      confirmBtn: 'Enter Level',
      levels: [
        {
          id: 'level1',
          title: 'Level 01 · Airport Terminal',
          badge: 'LEVEL 01',
          desc: 'Airport terminal featuring security metal detector gates, CCTV cameras, baggage conveyors, and riot shield units.'
        },
        {
          id: 'level2',
          title: 'Level 02 · Subway Station',
          badge: 'LEVEL 02',
          desc: 'Multi-level metro platform with turnstile corridors, subway carriages, and bullet-resistant glass barriers.'
        },
        {
          id: 'level3',
          title: 'Level 03 · Bank Vault',
          badge: 'LEVEL 03',
          desc: 'High-security bank vault with infrared laser tripwires, blast-proof doors, and tactical fog of war.'
        },
        {
          id: 'level4',
          title: 'Level 04 · Luxury Yacht',
          badge: 'LEVEL 04',
          desc: 'Superyacht layout with stern swimming pool, VIP lounge, dining deck, master stateroom, guest suites, and bow helipad.'
        },
        {
          id: 'level5',
          title: 'Level 05 · Hotel Lobby',
          badge: 'LEVEL 05',
          desc: 'Five-star hotel lobby with mahogany paneling, luggage storage, concierge desk, lounge, and VIP salon.'
        }
      ]
    },
    tutorial: {
      title: 'Tutorial & Game Mechanics',
      backBtn: 'Back',
      moveAimTitle: 'Movement & Aim',
      moveAimDesc1: 'WASD: Omnidirectional character movement.',
      moveAimDesc2: 'Mouse: Aim crosshair and rotate perspective.',
      weaponsTitle: 'Weapons System',
      weaponsDesc1: 'Left Mouse: Discharge equipped firearm.',
      weaponsDesc2: 'Keys 1 - 5: Switch weapons. Starts with Rifle; acquire more from eliminated hostiles.',
      armorTitle: 'Armor & Supplies',
      armorDesc1: 'Armor absorbs bullet and explosive damage; regenerates automatically when out of combat.',
      armorDesc2: 'Defeated hostiles drop tactical supplies that replenish armor and Blind Zone energy.',
      blindTeleportTitle: 'Blind Zone & Teleport',
      blindTeleportDesc1: 'Press SPACE to deploy or retract the Blind Zone.',
      blindTeleportDesc2: 'Double-click Left Mouse inside the Blind Zone to teleport.',
      blindDamageTitle: 'Delayed Damage Resolution',
      blindDamageDesc: 'The Blind Zone creates a bidirectional visual barrier (outside cannot see in, inside cannot see out). Damage dealt inside accumulates and erupts simultaneously when the zone collapses.',
      trapTitle: 'Decoy Trap [Key 5 + Right Click]',
      trapDesc: 'While Blind Zone is active and Grenades (Key 5) are equipped, Right-Click the ground to plant a decoy trap.',
      killstreakTitle: 'Killstreak Rewards',
      killstreak3Title: '3 Kills: [Key 6] Machine Gun',
      killstreak3Desc: 'Heavy suppressive machine gun fire (+30 rounds).',
      killstreak5Title: '5 Kills: [Key 7] UAV Strike',
      killstreak5Desc: 'Scans all hostiles and executes precision targeted airstrikes.',
      killstreak7Title: '7 Kills: [Key 8 / Space] Full Blind Zone',
      killstreak7Desc: 'Map-wide Blind Zone deployment for complete tactical concealment.',
      observerTitle: 'Observer Hostiles',
      observerDesc: 'Heavily armored enemies that can pierce through Blind Zones; highly susceptible to decoy traps.',
      coverTitle: 'Tactical Cover',
      coverGlassDesc: 'Bulletproof Glass: Does not block line of sight; bullets penetrate with damage falloff, but deflects grenades.',
      coverLowWallDesc: 'Low Wall: Blocks line of sight and direct gunfire; grenades can be lobbed over.'
    },
    weapons: {
      rifle: '1: Rifle',
      pistol: '2: Pistol',
      smg: '3: SMG',
      sniper: '4: Sniper',
      grenade: '5: Grenade',
      machineGun: '6: MG',
      uav: '7: UAV'
    }
  }
};

export const LOG_TRANSLATION_MAP: Record<string, string> = {
  "泳池内无法使用枪械": "Cannot fire weapons inside pool",
  "盲区已开启": "Blind Zone activated",
  "能量不足，无法开启盲区！": "Insufficient energy for Blind Zone",
  "全图警报！": "ALARM TRIGGERED!",
  "手榴弹无法扔出泳池外": "Grenades cannot exit pool area",
  "盲区瞬移成功": "Teleport successful",
  "无法在目标附近瞬移": "Cannot teleport too close to target",
  "诱饵陷阱部署成功": "Decoy trap deployed",
  "无法在掩体上部署陷阱": "Cannot place trap on cover",
  "只能在盲区内部署陷阱": "Traps must be placed inside Blind Zone",
  "观察者已被陷阱消灭": "Observer eliminated by decoy trap",
  "拾取医疗包 (+35 生命值)": "Medkit acquired (+35 HP)",
  "拾取补给 (+50 防弹衣 / +40 能量)": "Supplies acquired (+50 Armor / +40 Energy)",
  "💾 已获取绝密数据芯片！区域主电源已重启，照明系统恢复。": "💾 Classified data secured! Main power restored, full lighting enabled.",
  "全图盲区效果已到期": "Blind Zone duration expired"
};
