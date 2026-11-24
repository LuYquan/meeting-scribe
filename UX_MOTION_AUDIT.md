# Meeting Scribe — UX 与动效审查简报（2026-11-24）

## 产品

Meeting Scribe：把会议文字记录粘贴进来，AI 输出摘要、待办（负责人/截止日期/优先级）、决策；可起草跟进邮件、可跨多场会议综合主题。React 19 + Vite + TypeScript，全部 AI 调用走 Firebase AI Logic（本机 Gemini Nano / 云端 Gemini 混合推理）。数据只存本机 localStorage。线上地址 https://meeting-scribe-2.web.app 。

主流程：粘贴文本 →（可选）选路由 → 点「Analyze meeting」→ 右侧出结果 → 可勾待办、复制/下载 Markdown、起草邮件；历史列表可打开/删除/勾选多场做跨会综合。

总原则：**复杂留给系统，不留给用户；用户体验至高无上。**

---

## 一、UX 审查：8 条原则

### 1. 系统能判断的，不留给用户
- **F1 路由三选一是多余的。** 现状：主流程里一个「Where should inference run?」分段控件（Auto / Prefer on-device / Prefer cloud）+ 一段讲 9216 token 上下文的技术说明。事实：Auto 已能正确判断（≤6000 字符先试本机，否则走云端），SDK 本机不可用时自动回退云端；用户不知道自己的文本多少 token，也做不出比系统更好的决定。「Prefer on-device」选了长文本也一样回退云端。**改：删掉主流程里的选择，永远 Auto；把算好的路由当成事实展示（一行小字，如「短文本 · 先试本机，失败自动走云端」）。** 手动覆盖如需保留，收到「高级」折叠里。
- **F2 待办的完成状态丢了。** 现状：结果里勾「完成」只存在组件 state，切到另一场会议再回来就没了。**改：按会议 id 持久化到 localStorage。**
- **F3 邮件草稿的编辑丢了。** 现状：草稿正文可改，但改完切走会议就丢；分析新文本时也会立刻清空旧草稿。**改：草稿按会议 id 持久化；新分析成功前不清空旧内容。**
- **F4 综合要用户自己数。** 现状：必须手动勾 ≥2 场，按钮在不足 2 场时禁用。**改：加「全选」；只有 2 场时默认全选；0 场时不出现综合按钮。**

### 2. 此刻没用的，就不出现
- **F5 路由说明段落常驻。** 随 F1 一起删。
- **F6 设备不可用横幅常驻。** 现状：大多数机器上 Nano 都不可用，横幅一直挂着。**改：可关闭（×），关闭后不再出现。**
- **F7 历史里的毫秒数是噪音。** 现状：每条历史显示「1234 ms」。用户不关心毫秒。**改：历史只显示日期与待办数；耗时只在结果页以秒显示（1.2 s）。**
- **F8 页脚两段技术说明。** 第一段（Firebase AI Logic、App Check）是给评委/开发者的，普通用户不需要。**改：缩成一行，或移到「关于」折叠。**

### 3. 能替人做的，就直接做
- **F9 点示例应直接出结果。** 现状：点示例只填文本，还要再点 Analyze。用户点示例的意思就是「让我看看它能干什么」。**改：点示例 = 填入并直接分析。**
- **F10 主操作缺快捷键。** 现状：只能点按钮。**改：Cmd/Ctrl+Enter 分析；按钮上标注快捷键。**
- **F11 分析完用户看不到结果（手机）。** 现状：移动端单列，结果在输入框下方，分析完停留在原地。**改：分析成功后平滑滚动到结果顶部；综合完成后滚动到综合面板。**
- **F12 没有重起草。** 现状：邮件草稿生成后，起草按钮消失；草稿不好只能手动改，没有重新生成。**改：草稿旁加「重新起草」。**

### 4. 同一件事，处处一样
- **F13 两个删除，两种待遇。** 现状：「Clear」是次按钮、紧贴主按钮；历史里的「Delete」是幽灵按钮；两者都是一点即删、无确认、无撤销。**改：统一成「删除类操作」模式：先弱化位置与样式，再用同一种可撤销方式处理（见 F15）。**
- **F14 日期格式不统一。** 历史用 `toLocaleDateString()`，结果用 `toLocaleString()`。**改：统一格式。**

### 5. 按下去有回应，再按能收回
- **F15 删除与清空不可撤销。** 现状：删会议、清空文本都是一点即永久丢失，无任何反馈。**改：统一用 Toast + 撤销：删除/清空后 Toast 显示「已删除，撤销」，5 秒内可恢复；Toast 带关闭按钮。** 不用阻塞式确认弹窗。
- **F16 分析进行时反馈太弱。** 现状：只有一行小字「Analyzing…」+ 百分比；云端分析可能长达数十秒到数分钟，界面看起来像卡住了；且分析时文本框仍可编辑（改了也不影响本次分析，会让人困惑）。**改：进度条（阶段文字 + 不确定进度条 + 已用时间）；分析时禁用文本框、示例按钮与路由。**
- **F17 邮件起草的进度出现在错误的位置。** 现状：三类任务共用一个 progress 状态，渲染在左列输入卡里；起草邮件时进度条出现在左列，而邮件在右列。**改：进度跟随触发它的操作：分析进度在输入卡，邮件进度在邮件区，综合进度在历史区。**

### 6. 不打断人手上的事
- **F18 分析开始就清空旧成果。** 现状：点 Analyze 立即 `setEmail(null)`、`setSynthesis(null)`——用户正在读的邮件草稿瞬间消失。**改：只在新分析成功后才替换；失败时旧结果原地保留。**
- **F19 打开另一场会议丢草稿。** 同 F3，持久化解决。
- 其余：Toast 不挡操作、无弹窗，现状已达标。

### 7. 常用的好做，会丢东西的难误碰
- **F20 Clear 紧贴主按钮。** 现状：Clear 与 Analyze 同行、同等视觉分量，一滑就可能误删长文本。**改：Clear 降级为文字按钮，移到文本框右上角/元信息行；加撤销（F15）。**
- **F21 文本框没有自动保存。** 现状：写到一半刷新页面，文本全丢。**改：输入防抖保存到 localStorage，刷新后恢复并提示「已恢复草稿」，可一键丢弃。**
- **F22 删除一键永久。** 同 F15，撤销解决。

### 8. 界面自己说明自己
- **F23 顶部状态是术语。** 现状：「Firebase: Connected」「On-device model: Unavailable on this device」。用户不知道 Firebase 是什么。**改：用人话：「云端已连接」「本机模型不可用 · 将使用云端」。**
- **F24 报错是原始 SDK 文本。** 现状：`Analysis failed: ...` 直接透传 SDK 错误（如 403 PERMISSION_DENIED）。用户无法据此行动。**改：把已知错误翻译成人话 + 下一步：云端 403 →「云端暂时不可用（免费额度未开通），请稍后重试或检查 Firebase 控制台」；超时 →「云端响应超时，请重试」；未知错误给通用文案 + 重试。**
- **F25 禁用按钮不解释原因。** 现状：Firebase 未配置时 Analyze 禁用，原因只在横幅里。**改：禁用按钮旁/下给一句话原因。**

---

## 二、动效审查：按「状态变化」找

现状：**全站零动效。** 所有变化都是瞬间跳变：按钮 hover、选中态、卡片出现/消失、Toast 出现/消失、勾选、错误出现、面板切换。没有时长、没有曲线、没有深色模式、没有 `prefers-reduced-motion` 处理。

### 状态变化清单（都要有交代）
出现/消失：结果卡片、综合面板、错误条、进度条、Toast、横幅、空状态 ↔ 结果态。
移动：分析成功后滚动到结果；Toast 从底部进入。
变大小：文本框随内容伸缩（resize 句柄已有）。
换内容：路由原因文字随输入变化；按钮文案 Analyzing… ↔ Analyze meeting；综合按钮计数变化。
换图标：徽章（本机/云端）切换；勾选框打勾。
数值跳动：字符数/Token 数随输入变；进度百分比。
按下/悬停：所有按钮、分段控件、历史行、待办行。
加载：分析/起草/综合三段加载。
完成：结果出现、Toast「已复制」。
出错：错误条出现。

### 动效语言（拟定，待顾问确认）
- 一套时长：微交互 120ms（hover/按下），标准 200ms（淡入、小位移），强调 320ms（面板进入、Toast），上限 480ms。
- 一套曲线：进入用 Apple 式 ease-out `cubic-bezier(0.32, 0.72, 0, 1)`；退出更快更轻；同一类变化用同一条曲线。
- 动效只解释变化：结果卡片淡入 + 上移 6px（从输入来）；Toast 从底部升起（从操作来）；删除行淡出 + 高度收起（东西去哪了）；进度条是不确定进度（正在发生）。
- 克制：反复操作（勾待办、切换路由）要更快（120–160ms）；不做装饰性动效。
- 跟手、可打断：滚动用平滑滚动且可被用户打断；动画进行中再次操作要自然接上（不用锁死状态）。
- 性能：只动 transform 与 opacity；长列表不重排；实测桌面与手机满帧。
- 不引入新问题：不抖、不闪、不溢出；尊重 `prefers-reduced-motion`（全部动效关闭，改为瞬间变化）；深浅色都要成立（补一套深色变量）。

### 待确认的问题
- Q1：F1 删路由选择是否太激进？评委想看「混合推理」的可控性，是否把手动覆盖留给「高级」折叠就够了？
- Q2：删除/清空用 Toast+撤销，是否比二次确认更符合「不打断」？有没有漏掉的不可逆操作？
- Q3：文案：上面 F23/F24 的改法是否够人话？有没有更好的说法？
- Q4：动效时长/曲线方案是否合理？有没有漏掉的状态变化？
- Q5：深色模式是否值得这次做，还是只保证浅色 + 跟随系统？
- Q6：我漏掉了哪些违反 8 条原则的地方？

---

## 三、Gemini 会诊结论（2026-11-24 18:07，会话 gemini.google.com/app/25d22f8c8146a283）

### 采纳
- **Q1 路由**：「默认静默 Auto + Change 折叠」混合方案。常态只显示一行低权重事实状态（短文本 ⚡ Running locally · Change；长文本 ☁️ Long transcript · Routing to Cloud · Change；本机不可用时连 Change 都不出现）。展开后是紧凑单行选择器 Auto (Recommended) / Force On-device / Force Cloud，删掉 9216 token 说明；强选本机且超限时提示 `Transcript too long for local model (max ~6,000 chars).`
- **Q2 Toast**：8 秒（原 5 秒太短）+ 悬停/聚焦暂停计时；最多堆叠 2 条。新增的破坏性操作：① Redraft 覆盖已编辑草稿 → Toast「Draft regenerated」+ Restore previous；② 点示例覆盖用户已写文本 → 只有输入框为空或内容本身就是示例时才直接分析，否则只填入、不自动分析，并给 Undo Toast 恢复原文；③ 同一场会议补粘贴再分析 → 前缀重合（补粘/删减）时就地更新同一条记录，保留已勾待办。
- **Q3 文案**：状态合并为一个积极就绪态：`⚡ Ready · On-device & Cloud` / `☁️ Cloud AI Ready`（tooltip 解释本机不可用）；离线：`Offline · Cloud AI unavailable`。报错绝不提 Firebase 控制台：403 → `Cloud AI is temporarily unavailable — the free usage quota may have been reached. Try again later, or try a shorter transcript to run on-device.`；超时 → 原因 + 卡片内 [Retry]；禁用按钮原因写在按钮正下方。
- **Q4 动效**：时长/曲线方案通过（Linear/Raycast 级）。修正：删除行收起不用 height 动画（触发重排），用 CSS Grid `grid-template-rows: 1fr → 0fr` 过渡。补 5 个状态变化：① 待办勾选删除线扫过 + 透明度降至 0.55（注：多行文本的扫线用 text-decoration 替代，见实施说明）；② 复制按钮就地变形 Copy → ✓ Copied，1.5s 后恢复；③ 历史选中态背景色平滑过渡；④ 综合计数数字变化 + 禁用→可用色彩过渡 200ms；⑤ 路由状态跨 6000 字符阈值时胶囊轻微脉冲/淡入切换。
- **Q5 深色模式**：值得做，纯自动跟随系统（`prefers-color-scheme`），不做手动切换开关。
- **Q6 补充**：① 综合入口只在 ≥2 场会议时出现；加「Synthesize last 3 meetings」一键入口。② 空结果区现状已达标（空状态是轻量引导卡，不是空结果框架），空维度只保留一行极简提示（Decisions 为空时连标题都隐藏）。③ 标题已由 AI 自动生成（Gemini 前提有误）， inline 重命名这次不做。④ 综合结果持久化到 localStorage。⑤ 邮件加「Open in Mail App」（mailto 预填主题正文）。⑥ 每块 AI 内容右上角统一位置 Copy 按钮，待办复制为 Markdown 任务列表。⑦ 长耗时操作加 Cancel（前端 run token 取消 UI，SDK 调用本身不可中断，完成后丢弃结果并注释说明）。⑧ 监听 `storage` 事件做多标签页同步。⑨ 键盘：Cmd/Ctrl+Enter 分析、Esc 关 Toast、首次访问自动聚焦文本框；历史方向键切换这次不做。⑩ 历史底部加 `Stored locally in your browser · Export JSON`（导出 JSON 备份）。⑪ 示例按钮用场景名（Try: Sprint planning / Client kickoff / Incident review）。

### 不采纳 / 调整
- 删除线扫过动画：多行文本下伪元素扫线位置不对，改用 text-decoration + 透明度/颜色过渡 200ms + 复选框缩放弹跳。
- 示例覆盖用户文本时：不自动分析（避免与撤销取消分析竞态），只填入 + Undo Toast；用户再按 Analyze。
- 标题 inline 重命名：标题已由 AI 生成，重命名低频，这次不做。
- 历史方向键切换：列表短、鼠标/触摸优先，这次不做。

---

## 四、亲手实测记录（2026-11-24 18:15–18:30）

### 测试方式
- 桌面 QA：浏览器任务跑预览通道 `https://meeting-scribe-2--qa-ux-20261124-mey4cqme.web.app/?demo=1`（云端浏览器打不开 localhost，改走 Firebase preview channel；`?demo=1` 自动注入 2 场演示会议 + 1 条综合，见 `src/data/demo.ts` + `maybeSeedDemoData`）。桌面窗口实测 1919×998。
- 手机/深色：浏览器任务无法调窗口尺寸与模拟，改用本机 CDP（Chrome 139 + Node 24 WebSocket 驱动）：390×844 移动端、1280×1000 桌面深色，实测 `scrollWidth === innerWidth` 且零溢出元素；深色变量实测生效（body `rgb(16,18,20)`、card `rgb(26,29,33)`）。

### 桌面 11 项：全部通过（第 9 项按设计通过）
1. 历史 2 场带复选框，综合按钮禁用 + 提示，页脚 `Stored locally in your browser · Export JSON`。
2. 打开会议：各分区、Copy as Markdown、Download .md、邮件区齐全；延迟显示 `1.2 s`（秒制）；有 Decisions，无空维度。
3. 勾待办 → 变暗 + 删除线 + `1/4 done`；刷新后仍勾选（持久化通过）。
4. Copy 点按 → 绿色 `✓ Copied`，约 3s 恢复。
5. 删除会议 → 行消失 + Toast `Meeting deleted.` + Undo；Undo 后恢复，综合恢复 `Across 2 meetings`。
6. Clear → 空 + Undo，Undo 后 133 字符恢复。
7. 有文本时点示例 → 只填入不自动分析 + Undo Toast；Undo 后原文恢复。
8. 空框点示例 → 自动分析，进度条 + 已用秒 + Cancel，文本框禁用；失败为人话报错 + Retry，无 SDK 原文/403 代码。
9. 路由行 `Cloud · Runs in the cloud`，无 Change——按设计：本机模型不可用时 Change 不出现。
10. 状态 `Cloud AI Ready`；横幅带 ×，关闭后刷新不再出现。
11. 1919px 无横向溢出/重叠/裁切；控制台无法打开（工具限制），页面无可见错误。

### 手机 390px / 深色：通过
- 移动端单列，全部换行，无溢出；深色全站可读，无白闪。注意：无头 Chrome `--screenshot` 直出 390px 会假性裁切（布局视口未按窗口走），须以 CDP `Emulation.setDeviceMetricsOverride` 为准。

### QA 发现的 6 个问题（已全部修复，见下节）
- F26 综合标题单复数：删 1 场后 `Across 1 meetings`；且综合证据文字仍列出已删会议（综合过期）。
- F27 示例按钮悬停说明与实际路由不符（写死 `Routes on-device`，本机不可用时实际走云端）。
- F28 403 报错建议误导：文本仅 2,209 字符且本机不可用时仍建议「换更短文本走本机」。
- F29 Participants / Key points 两区无 Copy 按钮（简报要求每块 AI 内容统一 Copy）。
- F30 历史标题被截断成 `Sprint Planning …`，悬停看不到全名。
- F31 点示例会清空当前查看的会议结果。

## 五、QA 修复（2026-11-24 18:26–18:35，构建干净，lint 0 警告）

- **F26**：删会议时，若该会议属于已存综合，综合一并退役（Undo 时连同会议一起恢复）；标题单复数修正（`Across 1 meeting` / `Across 2 meetings`）。另补：`?demo=1` 的综合只随演示会议一起注入（原子种子），避免综合引用已不存在的会议。
- **F27**：示例 tooltip 改为按当前设备与样本长度动态计算（本机不可用 → `Runs in the cloud on this device`；超长 → 云端；否则本机优先）；输入框上方提示文案与路由行 hover 文案同样按本机是否可用切换，不再写死「本机优先」。
- **F28**：`humanizeError` 加上下文参数 `{ onDeviceAvailable, transcriptChars }`：只有本机可用且文本超 6000 字符时才建议换短文本；本机不可用时改说「无备用路由」。三个调用点（分析/邮件/综合）均传上下文。
- **F29**：Participants、Key points 两区加 Copy 按钮（新增 `keyPointsToMarkdown`、`participantsToText`），结果区 Copy 按钮共 5 个。
- **F30**：历史标题按钮加 `title={全名}`，悬停可见全名。
- **F31**：`loadSample` 不再清空当前查看的会议；点示例后结果区仍显示原会议，直到新分析完成才替换。

### 修复验证
- CDP 实测（dev server，清空 localStorage 后重进 `?demo=1`）：2 场 + `Across 2 meetings`；删第 2 场 → 1 场、综合消失、Toast `Meeting deleted.`；点该 Toast 的 Undo → 2 场 + `Across 2 meetings`（两标题齐全）；Copy 按钮 5 个；tooltip/提示/路由 hover 文案均为云端口径；点示例后结果仍显示原会议。
- 403 报错文案：本机无头 Chrome 发不出云端请求（代理拦截，报 offline 分支），无法本地验证；已派浏览器任务在预览通道上实测 exact 文案（任务 browser-task:88e5aac7-75a0-59e6-b999-5ea11ecb42a3，待回执）。
- 修复后已重新部署同一预览通道（version 3f91bfa52d47776a），lint 0 警告，构建成功。

### 复核结论（2026-11-24 18:31–18:32，任务 e120c508）
- 上一轮复核（88e5aac7）测到的是**旧构建**（浏览器缓存了 18:19 的 HTML；草稿被恢复即为证据），两项均按旧代码表现，不作数。
- 带 `&v=3` 缓存破坏参数 + Ctrl+Shift+R 硬刷新后重测，两项全部通过：
  - 报错文案逐字为：`Cloud AI is temporarily unavailable. / The free usage quota may have been reached. Try again later. On-device inference isn't available in this browser, so there's no fallback route right now.`（无 shorter transcript 建议；刷新前后两次一致）。
  - 删第 2 场 → 综合区完全消失（不是 `Across 1 meeting`）；Undo → 会议与 `Across 2 meetings` 综合完整恢复。
- 6 项 QA 修复至此全部验证通过。桌面截图（结果区 5 个 Copy 按钮、云端口径提示）存 `qa-screenshots/gpt-desktop-light.png`；另有 mobile light/dark、desktop dark 四张截图供 GPT 审查用。

---

## 六、GPT 审查（2026-11-24 18:32–18:36，ChatGPT luyanqua 号，对话 6b05680e）

- 审查材料：4 张截图（桌面浅色结果区、手机 390 浅色/深色、桌面深色历史+综合）+ 预览链接。GPT 未能打开 live URL（阅读器无内容），结论只基于截图；动效与无障碍为“须实测”项，未断言。
- 总分 7.5/10：桌面布局 8、视觉层级 7.5、文案 5.5、交互一致性 7*、手机 6.5、深色 8、无障碍/动效待验证。定调：别再打磨颜色阴影动效，先修“所说 = 所做”的真实性、演示数据完整性、手机信息密度。

### 采纳并修复（2026-11-24 18:36–18:50，lint 0 警告，构建干净，CDP 实测通过）
- **B1 执行徽章与隐私承诺失实**：演示会议 1 的 fixture 写死 `source: on_device` + “transcript never left your device”，与本机不可用横幅矛盾。修：演示两场会议均改为 `in_cloud` + 云端 routeNote；徽章只反映实际执行引擎（真实分析本就如此，错只在 fixture）。
- **B2 演示转录与结果脱节**：117 字符的摘要转录旁是 4 人、分值、决策、待办的完整结果，像编造。修：演示转录改为两条完整 sample 转录（2,215 字符），结果逐项有据可查。
- **B3 手机与桌面路由解释矛盾**：GPT 看的手机截图是 F27 修复前的旧构建；当前构建手机提示已是云端口径（CDP 复核确认），不再另修。
- **S1 手机纵向空间**：横幅文案缩短为一句（156px → 87px）；≤600px 隐藏品牌副标题；输入框 ≤900px 时高 200px（注意：该媒体查询须放在基础 textarea 规则之后，同特异度后者胜，否则 min-height 240px 仍会顶住）。
- **S2 结果层级**：结果区顺序改为 Summary → Action items → Decisions → Key points → Participants。Copy all 已有（Copy as Markdown），不再加。
- **S3 历史选择反馈**：选中行高亮（`is-selected`：surface-muted 背景 + 左侧 accent 竖线）；勾选后出现 “N meeting(s) selected” 状态行。综合按钮仍保持“可见但禁用 + 提示”（Gemini 会诊定案：藏起来不如讲清楚，不改）。
- **S4 删除样式**：Delete / Clear 默认仍低调（撤销兜底），hover/focus 变红（`btn-danger-ghost` / `link-btn.danger`），Delete 加 title “you can undo”。Toast + 撤销本身早已实现，GPT 只从截图看不到。
- **S5 空态能力描述**：空态三条改为运行时感知：本机不可用时首条改为 “Cloud · Gemini — available now”，第二条讲 Nano 是“浏览器支持时才可用”；去掉 “instant” 一词。
- **S6 深色对比度（实测，非目测）**：CDP 逐项算比值，全部 ≥4.5:1。修掉两个真问题：① placeholder 浏览器默认灰 #757575 只有 3.67:1，改为 `::placeholder { color: var(--text-muted); opacity: 1 }`（6.68:1）；② **深色块里写死颜色的覆盖规则被基础规则顶掉**：`@media (prefers-color-scheme: dark)` 写在文件前部，`.priority-high/.priority-medium/.pill-ok/.badge-*/.btn-sample:hover/.banner code` 的硬编码深色值被后部同特异度基础规则覆盖，导致深色下优先级芯片实际是浅色底（浅红字 #b42318 + 浅粉底 #fdecea）。修：全部改走变量（新增 `--accent-border/--cloud-border/--amber/--amber-soft/--banner-code-bg`），删除深色块里的死规则。修后 priority-high 深色 6.61:1、medium 8.3:1。
- **S7 演示日期星期错误**：2026 年日历核对（`date -d`）：Nov 28 是周六不是周五、Nov 26 周四、Nov 25 周三、Nov 21 周六、Nov 19 周四、Nov 24 周二、Nov 14 周六、Dec 1 周二、Dec 3 周四、Dec 5 周六。三条 sample 转录里的星期全部按 2026 年日历改对（构建产物中确认 “Saturday, November 28” ×4 等）。
- **无障碍**：焦点环与 Toast `role="status"` 早已有；补待办计数 `aria-live="polite"`；Copy 按钮最小高 36px（原 ~30px）。Cmd/Ctrl+Enter 早已跨平台；优先级已有文字标签（不只靠颜色）；减少动态/可打断/诚实进度条早已有。
- 重新部署预览通道（version f45d0d92f95d7138）；最终 smoke test 在跑（任务 939e7bde），等回执再合并上线。

### 不采纳 / 已覆盖
- 综合按钮“仅 ≥2 选中时才出现”：与 Gemini 会诊的“可见但禁用 + 提示”冲突，保留后者。
- Copy 按钮重复：F29 刚按简报补齐 5 个，每块 AI 内容统一 Copy 是既定决策，保留。
- 动效三条（减少动态、可打断、诚实进度）：均已实现，GPT 未实测故只作提醒。

---

## 七、冒烟测试发现的两个真问题（2026-11-24 18:41–18:55）

### F32 演示 fixture 没有版本，旧数据赖着不走
- 现象：冒烟测试用的浏览器 profile 早先已种过旧演示（on-device 徽章、117 字符转录、已勾待办），`maybeSeedDemoData` 只在历史为空时才种，于是新 fixture 永远盖不掉旧数据；复核测到的全是旧代码的表现。不是缓存问题，是种子逻辑问题。
- 修：`DEMO_VERSION = "v2"`（demo.ts）；`?demo=1` 打开时若存的版本低于代码版本，只替换 `demo-*` 会议与演示综合，并清掉这些会议的待办/邮件草稿；真实会议与真实综合绝不动。版本存在 localStorage `meeting-scribe:demo-version:v1`。
- 验证（CDP，先手工种旧数据再加载）：版本写为 v2、会议 1 转录 2215 字符、徽章 `Cloud · Gemini 2.4 s`、待办回到 `0/4 done`。草稿仍恢复旧的 117 字符——那是自动保存的草稿，本来就该留着；点开会议后输入框被会议转录填满（2215 字符）。

### F33 撤销删除不恢复勾选状态
- 现象：两场都勾选时删掉第 2 场再撤销，会议与综合都回来了，但第 2 场的勾选没回来，显示 “1 meeting selected”，综合按钮回到禁用态——综合声称的两场与实际选中不一致。
- 根因：删除时 `doomed` 快照没存 `wasSelected`，撤销只恢复了会议/待办/邮件/综合。另注意：删到只剩 1 场时 `canSynthesize` 变 false，勾选框与选中状态行会从 DOM 消失，测 “删后选中” 须看撤销后，不能看删后（删后无框可测是设计，不是 bug）。
- 修：`doomed` 加 `wasSelected: selected.has(id)`，撤销提交路径里若曾勾选则重新加回 `selected`。
- 验证（CDP）：勾选两场 → 删第 2 场 → 撤销 → 两场均勾选、`2 meetings selected`。**教训：本轮验证用的 dev server 曾提供过期 App.tsx**（curl 只含 `wasSelected` 捕获、不含恢复分支；Vite HMR 漏掉了相邻两次编辑中的后一次，日志停在 18:43）。重启 dev server（注意 `npm run dev -- --port 5173 --host 127.0.0.1`，`--` 不可省；另 `pkill -f vite` 会杀掉自己的 shell，勿用）后重新验证通过。生产构建（dist）一直是对的——`grep wasSelected` 得 2 处。

### 合并前状态
- 构建干净（lint 0 警告）、dist 已包含 F32/F33；预览通道 version f45d0d92f95d7138 是 F32/F33 之前的构建，合并时重新部署生产即覆盖。
