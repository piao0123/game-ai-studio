# 项目开发与故障复盘笔记 (Development & Technical Notes)

本文档用于记录地图开发、渲染引擎适配及关卡设计过程中遇到的技术问题、根源分析与最佳解决方案，供日后维护及类似问题排查参考。

---

## 📌 记录 001：关卡物品 Label 标签精简与外观绘制冲突问题

### 1. 现象描述
在尝试对地图（如 `Level 0 - 测试关卡酒店大堂`）上的物品悬浮标签（Label）进行精简和防遮挡优化时，出现了以下矛盾现象：
- **第一次尝试**：直接修改物品/墙体对象的 `label` 属性（如将 `'VIP KING BED'` 缩短为 `'KING BED'`），结果地图上大量的物品外观发生了变样，失去了专属细节纹理，回退（Fallback）成了默认的普通方块/方桌。
- **第二次尝试**：将 `label` 全部原封不动还原回长字符串，物品的精细外观恢复了，但屏幕上再次充斥大量杂乱、相互遮挡重叠的文字标识（例如墙体的 `'SALON NORTH WALL'`、地毯与立柱文字等）。

---

### 2. 问题根源分析 (Root Cause Analysis)

通过深入分析渲染引擎 `src/js/engine.js` 的实现代码，发现引擎内部存在 **“双重绑定”** 机制：

1. **`label` 的双重职责**：
   - **职责 A（材质/图形识别码）**：`src/js/engine.js` 中的 `drawProps()` 和 `drawObstacle()` 强依赖 `p.label.toUpperCase().includes('...')` 来判断物品具体样式（例如识别到 `LUGGAGE RACK` 绘制行李搁架与包袋、识别到 `VIP KING BED` 绘制豪华大床与床头柜、识别到 `TELEVISION` 绘制电视桌机顶盒）。若修改或删减 `label` 字符串，引擎无法识别对应特征码，就会降级渲染成通用方块。
   - **职责 B（默认 HUD 显示文本）**：在没有配置 `displayName` 时，引擎默认提取 `p.label` 作为屏幕上浮动的 UI 文字标签。

2. **冲突本质**：直接修改 `label` 破坏了**职责 A**（导致物品图形损坏）；完全不修改 `label` 则破坏了**职责 B**（导致 HUD 界面文字冗余杂乱）。

---

### 3. 最终解决方案 (Final Architectural Solution)

利用渲染引擎 `drawPropTagLabel()` 和 `drawObstacle()` 中原生支持的解耦机制（`displayName`、`hideLabel`、`tagPosition`），实现 **图形绘制** 与 **UI 悬浮文本** 的彻底解耦：

#### 规范原则：
1. **`label` 字符串 100% 保持不动**：
   - 绝不为了界面好看而修改 `label`。保持原始的专用特征串（如 `VIP KING BED`、`GOLDEN BAGGAGE CART`、`GUEST ROOM WALL`），确保引擎 100% 正确触发高精图形绘制。
2. **使用 `displayName` 重新定义短别名**：
   - 需要在 UI 上显示更简短名称时，添加 `displayName` 属性（如 `displayName: 'KING BED'`、`displayName: 'CART'`）。引擎优先使用 `displayName` 进行文本测量与绘制。
3. **使用 `hideLabel: true` 隐藏无用/冗余文字**：
   - 针对墙体障碍物（如 `GUEST ROOM WALL`）、地毯背景（`rug`）、连排植株（`plant`）、密集办公椅（`office_chair`）、大理石立柱（`pillar`）等物体，显式添加 `hideLabel: true`，彻底消除界面文字噪音。
4. **使用 `tagPosition` 错开密集区标签方向**：
   - 在物品紧密摆放区（如 VIP 沙龙、客房内），指定 `tagPosition: 'left' | 'right' | 'top' | 'bottom'`，避免相邻物品的标签在同一个上方位置重叠。

---

### 4. 代码配置示例

```javascript
// ✅ 正确示范：图形与UI文本解耦
{ 
    type: 'bed', 
    x: 100, y: 150, w: 72, h: 46, 
    label: 'VIP KING BED',       // 1. 保留原始特征码 -> 触发引擎豪华大床绘制
    displayName: 'KING BED',     // 2. 界面仅显示精简别名
    tagPosition: 'bottom'        // 3. 错开悬浮位置
},
{ 
    type: 'rug', 
    x: 100, y: 150, w: 68, h: 46, 
    label: 'PERSIAN RUG',        // 保留波斯地毯特征码
    hideLabel: true              // 隐藏地毯上的文字标签
},
{ 
    x: 200, y: 300, w: 12, h: 100, 
    type: 'solid', 
    label: 'GUEST ROOM WALL',    // 保留墙体特征码
    hideLabel: true              // 隐藏墙面上的文字标签
}
```

---

*（后续若遇到其他模块或引擎逻辑的疑难问题，请按此格式继续追加记录）*

---

## 📌 记录 002：Level 0 酒店大堂道具定位优化与高精特色物件绘制

### 1. 修改内容与原因
1. **越界行李架清除与行李区重构**：
   - 原 `level0_test.js` 中存在坐标 `y: 16` 的行李架（外墙边界为 `margin: 40`），导致该物件直接越界渲染到了地图北侧墙体之外。将越界道具彻底移除，并重构行李寄存区的道具坐标，配置精细的行李架与摆放层次。
2. **行李车 (`baggage_cart`) 造型升级**：
   - 原行李车绘制较为简陋（两个分色方块）。重新设计为经典**奢华酒店金鸟笼行李推车（Bellman Birdcage Trolley）**：拥有 4 角橡胶轮与黄轴、深红天鹅绒铺底台面、金色全围护栏、精细皮质行李箱堆叠、以及顶部的金鸟笼弧形支架与金环。
3. **前台区域专有设施替换（钥匙房卡柜 `key_rack`）**：
   - 移除了前台接待区原本显得突兀的衣柜 (`wardrobe`)，替换为符合高级酒店前台定位的**礼宾部房卡/钥匙鸽子窝柜 (`key_rack`)**：深色红木背板、金边顶标、密集排列的房卡格、以及挂有红穗钥匙的黄铜钥匙扣细节。
4. **VIP 沙龙展示柜 (`display_cabinet`)**：
   - 将 VIP 沙龙内的衣柜 (`wardrobe`) 替换为**VIP 奢华玻璃展示柜 (`display_cabinet`)**：包括顶部暖色 LED 射灯柔光、水晶玻璃隔板、反光玻璃门板、以及内部展示的金奖杯、水晶酒壶与欧式瓷瓶。
5. **渲染拦截 Bug 修复与分支优先级提升**：
   - 之前 `drawProps` 中靠前的 `lbl.includes('BAGGAGE')` 和 `lbl.includes('CABINET')` 通用判定拦截了 `p.type === 'baggage_cart'` 与 `p.type === 'display_cabinet'`，导致定制绘制逻辑未被执行。已将所有 `p.type` 显式判定移至 `drawProps()` 的最顶部，确保新高精物件外形正常渲染。
6. **前台礼宾钥匙柜 (`key_rack`) 样式确立**：
   - 确认并保持前台右侧的 **礼宾房卡/钥匙柜 (`KEY RACK`)** 配置与精致外观（红木边框、黄铜 "KEYS" 铜牌顶标、密集房卡格子与挂有红穗钥匙的黄铜扣）。

---

