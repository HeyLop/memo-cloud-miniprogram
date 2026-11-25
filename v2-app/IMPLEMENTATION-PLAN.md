# v2 实施计划（superpowers 第 3 步产出）

> 依据：`redesign/design/00-头脑风暴-设计规格.md`（11 项决策，D10/D11 已修订）
> 分支：`feature/v2-rebuild` · worktree：`v2-worktree/`
> 代码根目录：`v2-app/`（本文件所在处）
> 日期：2026-11-25

---

## 本版范围（YAGNI：只做这些）

**做**：极速记录（NLP 解析）+ 工作/生活双色分区 + 今日聚焦（App 内提醒）+ 沿用 WorkBuddy 云。
**不做**：订阅消息推送（D11 二期）、实时协作、多端、富文本、自定义分类。

## 基线（第 2 步已确认）

- worktree 干净，分支 `feature/v2-rebuild` 从 `707e043` 分出。
- 无测试框架 → 基线验证 = `node --check` 全部 JS + JSON 严格解析 + WXSS 无中文选择器扫描。
- **TDD 说明**：superpowers 强制红绿 TDD，但本项目无测试框架。本计划采用"**先写验证断言（脚本），再写实现**"的轻量 TDD——每个任务先有一段可失败的自检脚本（见验证列），跑红后再实现。若要严格单测，任务 0 先引入测试框架（可选，见任务 0）。

---

## 阶段一：工程骨架（任务 1-3）

### 任务 1：建 v2 工程骨架
- 文件路径：`v2-app/app.json`、`v2-app/app.js`、`v2-app/app.wxss`、`v2-app/project.config.json`、`v2-app/sitemap.json`
- 要做的：
  - `app.json` 声明 3 个页面：`pages/index/index`、`pages/edit/edit`、`pages/shared/shared`；`window.navigationBarTitleText` = "待办 v2"；保留 `lazyCodeLoading: requiredComponents`。
  - `app.js` 复制 v1 的 `authReady` 逻辑（`handleWorkBuddyMiniProgramCallback`），全局数据加 `appName: '待办 v2'`。
  - `app.wxss` 定义双色主题 CSS 变量（任务 5 细化，此处先建空壳）。
  - `project.config.json` 复制 v1，appid 保持 `touristappid`（本版测试号够用，D11 推送不需）。
  - `sitemap.json` 复制 v1。
- 验证：`for f in app.json project.config.json sitemap.json; do python3 -c "import json;json.load(open('$f'))"; done` 全过；`node --check app.js` 过。

### 任务 2：复用 v1 云服务资产（不重写）
- 文件路径：`v2-app/utils/cloud.js`、`utils/config.js`、`utils/workbuddy-data-access.js`、`utils/workbuddy-cloud-diagnostics.js`
- 要做的：从 `../utils/` 复制这 4 个文件到 `v2-app/utils/`（v1 已验证的 WorkBuddy 云客户端与诊断资产，D10 决定复用）。`cloud.js` 的 publicConfig 保持不变（含 publishableKey / OAuth clientId，随应用发布保留）。
- 验证：`node --check` 4 个 JS 全过；`node -e "require('./utils/cloud.js')"` 在装了 SDK 的 node_modules 下不抛错。

### 任务 3：建数据层骨架（notes v2）
- 文件路径：`v2-app/utils/todo-store.js`（新建）
- 要做的：参考 v1 `notes-store.js`，用 `createTableAccess(cloud, {...})` 封装 `notes` 表，列含 `id, owner_id, title, content, zone, priority, due_at, done, parse_meta, created_at`（字段名对齐设计规格第 4 节）。`mapNote` 输出驼峰字段（zone/dueAt/dueText/done 等）。
  - ⚠️ 数据库字段 `zone/parse_meta` 需先迁移（任务 4）。
- 验证：`node --check todo-store.js` 过；导出 `notes` 对象含 `list/create/update/remove`（对照 v1 的 createTableAccess 能力）。

## 阶段二：数据库迁移（任务 4）

### 任务 4：幂等升级 notes 表 + 建 user_settings 表
- 文件路径：迁移记录写入 `v2-app/docs/db-migration.md`（SQL 存此处，便于追溯）
- 要做的：用工具对应用 `wbapp_0CBamvxrwaqn3mYKCHQrVQ` 执行：
  1. `ALTER TABLE notes ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'work'`
  2. `ALTER TABLE notes ADD COLUMN IF NOT EXISTS parse_meta JSONB`
  3. `CREATE TABLE IF NOT EXISTS user_settings (owner_id TEXT PRIMARY KEY DEFAULT auth.uid(), work_hours JSONB, reminder_lead_time INT)`
  4. `ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY` + GRANT + 四条 owner 隔离策略（照抄 notes 表的）
- 验证：执行后用 db_describe_table 确认列存在；RLS 列表确认 user_settings 四条策略在；用显式 `owner_id='selftest'` 写入读回一条后删除（v1 已验证的 RLS 自检法）。

## 阶段三：页面实现（任务 5-9）

### 任务 5：双色主题 CSS 变量 + 首页骨架
- 文件路径：`v2-app/app.wxss`、`v2-app/pages/index/index.wxss`
- 要做的：
  - `app.wxss` 定义两套主题变量：`page` 默认工作蓝（--brand:#1769E0; --bg:#F5F8FF），`.zone-life` 覆盖为生活暖（--brand:#D9730D; --bg:#FFF8F0）。所有颜色引用变量，不写死。
  - `index.wxss` 建结构样式：分区切换 tab、今日聚焦卡、待办列表项、底部输入栏。
  - ⚠️ 所有 class 名 ASCII（踩过的坑：中文类名导致编译失败）。
- 验证：扫描 `grep -P '[\x{4e00}-\x{9fff}]'` 选择器部分应为空；编译无报错。

### 任务 6：首页登录门禁 + 分区切换
- 文件路径：`v2-app/pages/index/index.js`、`index.wxml`
- 要做的：
  - JS 复用 v1 的三态登录（checking/signed-in/signed-out）+ `getSession()` 恢复 + `loadNotes()`。data 加 `zone: 'work'`。
  - `onZoneSwitch(e)` 切 `zone` 并重新过滤列表；WXML 根 view 动态加 `zone-life` 类实现整体变色。
  - 保留 v1 的"微信登录主 + WorkBuddy 备用"两个入口（D2 单人，登录沿用 v1）。
- 验证：`node --check index.js` 过；mock 数据下 `zone` 切换能过滤列表（自检脚本断言）。

### 任务 7：今日聚焦区（App 内提醒，D11 本版形态）
- 文件路径：`v2-app/pages/index/index.js`、`index.wxml`（同任务 6 文件，增量改）
- 要做的：
  - `isTodayOrOverdue(note)` 照搬 v1 逻辑（dueAt 在今天或已逾期且未完成）。
  - 首页顶部渲染 `todayNotes`，按 priority + dueAt 排序，显示"今天 N 件待办"。
  - 完成勾选 `onToggleDone` 复用 v1，勾选后从聚焦区消失。
- 验证：造一条今天到期的待办，断言它进 todayNotes；标记完成后断言消失。

### 任务 8：NLP 智能解析（D7，核心）
- 文件路径：`v2-app/utils/parse-todo.js`（新建，前端草稿解析）；数据库侧解析走 WorkBuddy 云 LLM（见下）
- 要做的：
  - 输入一句话，抽取 `{title, dueAt, zone, needsManual}`。
  - **方案**：优先调 WorkBuddy 云 LLM 模块解析（凭证在云端，不下发前端）；前端 `parse-todo.js` 封装调用 + 本地兜底正则（识别"今天/明天/周X + 上午/下午/晚上 + 时刻"）。
  - 解析失败/低置信 → `needsManual: true`，前端弹时间选择器补选，原文保留为 title。
  - 解析结果先显示"草稿卡"，用户确认后才入库。
- 验证：输入"明天下午3点交报告"断言 dueAt=明天15:00、zone=work、title 去掉时间词；输入无法解析文本断言 needsManual=true 且不丢字。

### 任务 9：编辑页（含分区/优先级/时间 + 草稿确认）
- 文件路径：`v2-app/pages/edit/edit.js/.wxml/.wxss/.json`
- 要做的：
  - 新建/编辑复用 v1 编辑页结构，加 `zone` 选择（工作/生活）。
  - 从首页草稿卡跳入时，带 `?draft=<encoded>` 预填解析结果，用户确认后保存。
  - 删掉 v1 的订阅授权调用（D11 推送二期，本版不请求）。
  - 截止时间字段照 v1（date+time picker，ISO `+08:00`）。
- 验证：`node --check edit.js` 过；4 个文件齐全；草稿参数能预填（自检断言）。

## 阶段四：收尾（任务 10）

### 任务 10：全量校验 + 文档更新
- 文件路径：`v2-app/docs/verification.md`（新建，记录验证结果）
- 要做的：跑完整校验脚本并把结果写入 verification.md：
  1. 所有 JS `node --check` 全过
  2. 所有 JSON 严格解析全过
  3. WXSS 选择器无中文
  4. 页面四件套齐全
  5. 按 Agentic Git 规范提交（四项 trailer）
- 验证：verification.md 记录 5 项全 PASS；git commit 含 trailer。

---

## 任务依赖顺序

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
（任务 4 数据库迁移可与 5-9 前端并行，但任务 3 数据层依赖它的字段）
```

## 可选：任务 0 引入测试框架（严格 TDD 才需要）

当前无测试框架，计划用"自检脚本模拟红绿"。若要严格 TDD：
- 加 `jest` + `@jest/globals`，给 `parse-todo.js`、`isTodayOrOverdue` 写单测。
- 这会多一步，但让 superpowers 的 RED-GREEN-REFACTOR 能真正执行。
- **建议**：本版先按轻量 TDD 走，若任务 8（NLP）出错率高再补测试框架。

---

**计划写完，请确认后再进入子代理驱动开发（第 4 步）。** 计划变更请改本文件，不要悄悄改实现。
