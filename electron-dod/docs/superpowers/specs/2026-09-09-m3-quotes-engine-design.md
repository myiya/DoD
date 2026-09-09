# M3 MVP：台词引擎与台词包导入（离线可玩核心）- 设计说明

日期：2026-09-09  
范围：`electron-dod`（Electron + electron-vite + React + TS）  
目标：实现“离线可玩”的核心：点击/摸摸/缩放等事件触发可爱台词；支持导入台词包（zip），并在设置页进行管理。

## 背景与现状

- 已完成：
  - M1：透明置顶桌宠窗口 + 托盘 + 气泡（bubble）+ 拖拽/缩放/穿透锁定
  - M2：Sprite 渲染与交互事件标准化（含 `dragStart/drag/dragEnd`）+ bodyPart（粗粒度）
  - M2-4：WebAudio 轻量音效（默认关闭）
- 当前缺失：
  - 缺少“台词决策引擎”（QuoteEngine）
  - 缺少“可导入、可管理、可持久化”的台词包体系

## 设计原则

1. **离线可玩**：不依赖网络、不依赖大模型，也能玩得起来。
2. **安全优先**：导入 zip 必须防路径逃逸、大小限制、格式校验明确。
3. **最小 UI**：采用 A「极简列表」结构；先把导入与启用跑通。
4. **单选启用**：同一时间只启用一个用户台词包，降低复杂度。
5. **禁用回退内置包**：禁用不等于“哑巴”，而是回退到内置默认包（builtin）。

## 成功标准（验收）

1. 点击桌宠（`tap`）能稳定触发一句台词，并在气泡中显示。
2. 同一事件类型有多条台词可轮换：连续触发不会一直重复同一句。
3. 台词不会刷屏：有全局节流与单句冷却。
4. 设置页支持：
   - 点击导入 zip
   - 把 zip 拖到导入区域触发导入
   - 列表展示包：启用/禁用/删除/重载
5. 导入的包重启后仍生效；删除包会清理本地文件。
6. 非法 zip 或格式错误会被拒绝，并能给出清晰错误原因；不会写出 `userData` 目录外。

## 非目标（MVP 不做）

- 多包同时启用（叠加抽取）
- UI 预览包内容（按事件展示台词列表）
- 远程下载/在线商店
- 复杂事件条件（时间段、工作状态、应用前台、窗口焦点等）
- 宠物包体系（I1）、Live2D（I2）、AI（I3）等

## 用户体验（UI/交互）

### 设置页（入口 1）

新增设置区块：**台词包**

- 导入区域（Dropzone）：
  - 文案：`拖拽 .zip 到这里导入` + `或点击「导入台词包」`
  - 支持把 zip 拖到区域触发导入（见“入口 3”）
- 操作按钮：
  - `导入台词包`（打开文件选择）
  - `重载`（重新扫描/加载本地台词包索引与 builtin）
- 列表：
  - 展示 builtin（内置默认包）+ 用户导入包
  - 每条：`name`、`version`、状态（启用/未启用）
  - 操作：
    - `设为启用`
    - `禁用`（仅对用户包：将 active 设为 null 并回退 builtin）
    - `删除`（仅对用户包；若删除的是当前启用包，则自动回退 builtin）

### 拖拽导入（入口 3）

- 将 `.zip` 拖入设置页 Dropzone：
  - 立即开始导入（由主进程处理）
  - 导入中显示 loading / notice
  - 成功：刷新列表并提示“导入成功”
  - 失败：提示错误原因（例如“缺少 manifest.json”/“zip 过大”/“ID 不合法”）

### 冲突处理（packId 已存在）

当导入包的 `packId` 已存在时：

- 弹窗询问：`覆盖 / 取消`
- 覆盖：删除旧目录并写入新内容，更新时间戳与 version（以 manifest 为准）
- 取消：不做任何变更

## 数据与存储

### 目录约定

用户台词包安装目录（建议）：

- `userData/packs/quotes/<packId>/`
  - `manifest.json`
  - `quotes.jsonl`

内置默认包（builtin）：

- 随应用静态资源提供（renderer 内置或 main 内置均可）
- 不参与导入/删除
- 作为 active 为空时的回退包

### 配置字段（ConfigService）

在 `AppConfig` 增加字段（MVP）：

- `activeQuotePackId: string | null`
  - `null` 表示启用 builtin

同时维护“已安装包索引”（MVP 两种可选实现）：

**方案 A（推荐）：主进程扫描目录生成索引，不写入 config**

- 每次启动 / 重载时，扫描 `userData/packs/quotes/*/manifest.json` 生成 `installedQuotePacks`
- 优点：避免 config 和磁盘不一致
- 缺点：每次扫描需要 IO（但 pack 数量不会大）

**方案 B：写入 config（installedQuotePacks）**

- `installedQuotePacks: Array<{id; name; version; installedAt}>`
- 优点：UI 读取更快
- 缺点：需要额外保持与目录一致

MVP 建议优先 **方案 A**，把“真相”放在磁盘目录；UI 通过 IPC 获取索引。

## 台词包格式（Pack Schema）

### 文件结构（zip 解压后的逻辑结构）

- `manifest.json`（必需）
- `quotes.jsonl`（必需）

### manifest.json（MVP）

```json
{
  "schemaVersion": 1,
  "id": "cat-daily",
  "name": "猫猫日常",
  "version": "1",
  "description": "偏撒娇、轻松"
}
```

约束：

- `schemaVersion` 仅支持 `1`
- `id`：只允许 `[a-z0-9-_]`，长度建议 `3..40`

### quotes.jsonl（MVP）

一行一个 JSON，例如：

```jsonl
{"event":"tap","text":"嘿嘿～","weight":2}
{"event":"pet","text":"呼噜呼噜…","cooldownMs":3000}
{"event":"tap","text":"你叫我吗？","bodyPart":"face"}
```

字段：

- `event: InteractionEventType`
- `text: string`（建议限制长度，如 <= 60）
- 可选：
  - `weight?: number`（默认 1，范围建议 `0.1..10`）
  - `cooldownMs?: number`（默认 0）
  - `bodyPart?: BodyPart`

## QuoteEngine（台词引擎）

### 输入/输出

- 输入：
  - `InteractionEvent`（来自 `PetStage`）
  - 当前配置：`interactionMode`、`bubbleEnabled`、`activeQuotePackId`
  - 已加载的台词库（来自 builtin + active pack）
- 输出：
  - `text: string | null`

### MVP 选词规则

1. `interactionMode === 'quiet'`：返回 `null`（不说话）
2. 若 `bubbleEnabled === false`：可仍“选词但不显示”，但 MVP 建议直接返回 `null`（避免无意义计算）
3. 全局节流（防刷屏）：
   - 为 QuoteEngine 设置 `minIntervalMs`（建议 350~600ms）
   - 若上次出词距离太近，返回 `null`
4. 候选集过滤：
   - `quote.event === event.type`
   - 若 quote 指定 `bodyPart`，必须与 event.bodyPart 匹配
   - 若 quote 在冷却期内（按 text 或 quoteId 作为 key），排除
5. 加权随机抽取：
   - 使用 `weight`（默认 1）
6. 避免连续重复：
   - 若抽到与 `lastText` 相同且还有其它候选，重新抽一次（最多 N 次）
7. 更新状态：
   - 记录 `lastSpeakAt`
   - 记录 `cooldownUntil[text]`

### 事件覆盖

MVP 支持事件至少包含：

- `tap`
- `pet`
- `dragStart`
- `dragEnd`
- `scale`
- `idle`
- `enter`
- `exit`

`drag` 本身高频，不建议出词（会刷屏），MVP 默认不对 `drag` 出词（可在包里允许但引擎默认强节流或直接忽略）。

## 导入与安全校验（Zip Importer）

### 为什么放在主进程

- 写入 `userData` 目录、限制路径、处理覆盖删除等属于敏感文件操作
- 主进程更适合做 IO + 安全校验；渲染层负责交互即可

### 校验清单（MVP 必做）

1. 文件大小限制：例如 `<= 30MB`
2. zip 解包时：拒绝任何包含以下情况的 entry：
   - `..`、绝对路径（`/` 开头）、盘符路径（如 `C:\`）
   - entry 太多（例如 > 2000）
3. 必须存在 `manifest.json` 与 `quotes.jsonl`
4. manifest 校验：
   - `schemaVersion === 1`
   - `id` 合法（字符集 + 长度）
5. quotes.jsonl 校验：
   - 行数上限（例如 2000）
   - 单行长度上限（例如 2KB）
   - 每行 JSON 可解析，且 `event/text` 必填
6. 覆盖策略：
   - 若 `<packId>` 已存在：弹窗询问 `覆盖/取消`
   - 覆盖时先删除旧目录，再写入新目录

### 用户提示（错误消息）

MVP 建议返回明确错误码 + message，例如：

- `ZIP_TOO_LARGE`
- `ZIP_INVALID`
- `ZIP_PATH_TRAVERSAL`
- `MANIFEST_MISSING`
- `MANIFEST_INVALID`
- `QUOTES_MISSING`
- `QUOTES_INVALID_LINE`
- `PACK_ID_CONFLICT_CANCELLED`

## IPC/API 设计（草案）

> 说明：具体通道命名需遵循现有 IPC 白名单风格（`xxx:action`）。

### quotePack

- `quotePack:list` → `{ packs: QuotePackInfo[], activeId: string | null }`
  - packs 包含 builtin（id 固定为 `builtin`）
- `quotePack:import`（参数为文件路径或文件 bytes 的引用）
  - 返回导入后的 pack info
- `quotePack:setActive`（packId | null）
  - null 表示回退 builtin
- `quotePack:delete`（packId）
- `quotePack:reload`

### config（已存在）

- 若采用“activeQuotePackId 存 config”：
  - `config:update({ activeQuotePackId })`

## 渲染层集成点

### SettingsPage

- 新增「台词包」区块 UI（按钮 + dropzone + 列表）
- 拖拽导入：
  - `onDrop` 拿到文件，调用 `window.api.quotePack.import(...)`
- 状态：
  - 导入中/成功/失败提示
  - 列表刷新：导入成功后 `quotePack:list`

### PetWindowPage（气泡触发）

- `PetStage` 事件 → 交给 QuoteEngine → 若产出 text 则显示 bubble
- 注意：`drag` 高频默认不出词（或强节流）

## 测试与验证（MVP）

### 手工验收

1. 无导入任何包时：
   - 桌宠 tap/pet/scale/idle 仍能出现 builtin 台词
2. 导入一个合法 zip：
   - 列表出现新包
   - 设为启用后，触发事件能从新包出词
3. 禁用：
   - 回退 builtin（仍有台词）
4. 删除当前启用包：
   - 自动回退 builtin
5. 导入恶意 zip：
   - 包含 `../` 的 entry 被拒绝，且 userData 目录外无任何写入
6. 重启应用：
   - 启用状态（activeQuotePackId）保持；若 active 指向的包被删除，则自动回退 builtin

### 自动化（可选）

- QuoteEngine 单元测试：
  - 加权随机基本正确（可用固定 seed/伪随机）
  - 冷却与节流生效
  - bodyPart 过滤生效

## 里程碑映射

- M3-1：QuoteEngine（权重/冷却/过滤 + 防刷屏）
- M3-2：台词包格式（manifest + quotes.jsonl）
- M3-3：导入台词包（zip → 校验 → 落盘 → 启用）
- M3-4：导入校验与安全策略（白名单/路径逃逸/大小限制）
- M3-5：台词包管理 UI（启用/禁用/删除/重载）+ 拖拽导入
