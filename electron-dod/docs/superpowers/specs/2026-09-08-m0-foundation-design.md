# electron-dod M0 骨架设计文档

日期：2026-09-08  
范围：`electron-dod` 项目的 M0 立项与骨架阶段  
目标：在不进入桌宠业务功能的前提下，完成可持续扩展的工程基础设施，并用一个最小设置页验证 `renderer -> preload -> main -> userData` 的完整链路。

## 1. 背景

当前仓库是标准的 `electron-vite + React + TypeScript` 初始化模板，已经具备：

- `src/main`、`src/preload`、`src/renderer` 三端入口
- `electron.vite.config.ts` 与基础脚本
- `package.json.main = ./out/main/index.js`

当前不足也很明确：

- 主进程逻辑集中在 `src/main/index.ts`
- 预加载层只暴露空的 `window.api`
- 渲染层仍是模板演示页，没有项目级状态与设置入口
- 本地配置、日志、IPC 边界都还没有真正建立

M0 的任务不是“做桌宠”，而是把后面做桌宠所需要的工程骨架搭正。

## 2. M0 目标

M0 完成后，项目需要达到以下状态：

1. 主进程代码从单文件拆出基础模块边界。
2. 预加载层只暴露白名单 API，而不是直接把 Electron 细节泄露给渲染层。
3. 建立配置读写能力，配置文件存放在 `userData/config.json`。
4. 建立最基础的日志能力，能够记录配置读取失败、IPC 失败等问题。
5. 渲染层替换模板首页为“最小设置页”，可以读取、修改并保存配置。

## 3. 本阶段不做

为避免 M0 失控，本阶段明确不实现：

- 托盘
- 透明桌宠窗口
- 拖拽/缩放的桌宠交互
- 台词引擎
- 宠物包/台词包导入
- Live2D
- AI、TTS、记忆

这些能力都在 M1 及后续迭代中实现。

## 4. 方案选择

本次采用“轻量分层”的方案。

### 方案描述

- 保留 `electron-vite` 的标准三端结构，不推翻现有脚手架。
- 在 `main` 中优先拆出 `bootstrap / ipc / services / constants`。
- 在 `shared` 中集中放类型与默认配置，避免三端重复定义。
- 在 `renderer` 中只做一个最小设置页，用来验证配置链路。

### 为什么选这个方案

- 改动量适中，能快速落地。
- 不会为了 M0 提前引入托盘、桌宠窗口等更复杂逻辑。
- 后续无论做桌宠渲染、资源导入，还是设置中心，都可以沿用这套分层继续长。

## 5. 目标结构

计划在现有仓库基础上演进为以下结构：

```txt
src/
├─ main/
│  ├─ index.ts
│  ├─ bootstrap/
│  │  └─ create-main-window.ts
│  ├─ constants/
│  │  └─ app.ts
│  ├─ ipc/
│  │  ├─ config.ts
│  │  └─ register-ipc.ts
│  └─ services/
│     ├─ config-service.ts
│     └─ logger-service.ts
├─ preload/
│  ├─ index.ts
│  └─ index.d.ts
├─ renderer/
│  └─ src/
│     ├─ App.tsx
│     ├─ pages/
│     │  └─ settings/
│     │     └─ SettingsPage.tsx
│     ├─ components/
│     │  └─ settings/
│     └─ hooks/
└─ shared/
   ├─ constants/
   │  └─ config.ts
   └─ types/
      ├─ config.ts
      └─ api.ts
```

说明：

- `main/bootstrap`：只负责应用初始化与窗口创建。
- `main/services`：只负责“能力”，例如配置存储、日志写入。
- `main/ipc`：只负责 IPC 注册与 handler，不做业务存储。
- `shared`：所有跨进程共享的类型和默认配置。
- `renderer/pages/settings`：最小设置页，不提前做复杂 UI 结构。

## 6. 数据模型

M0 只引入一个简单配置模型：

```ts
type AppConfig = {
  theme: 'system' | 'light' | 'dark'
  petScale: number
  bubbleEnabled: boolean
  interactionMode: 'normal' | 'quiet'
}
```

默认值建议：

```ts
{
  theme: 'system',
  petScale: 1,
  bubbleEnabled: true,
  interactionMode: 'normal'
}
```

约束：

- `petScale` 限制在合理范围内，例如 `0.6 ~ 1.8`
- 如果配置文件缺字段，自动补默认值
- 如果配置文件损坏，回退为默认配置并记录日志

## 7. 配置存储设计

### 存储位置

- 路径：`app.getPath('userData')/config.json`

### ConfigService 职责

- 获取配置文件绝对路径
- 读取配置
- 校验配置
- 合并默认值
- 更新部分配置（patch update）
- 恢复默认配置

### 行为定义

#### 首次启动

- 如果 `config.json` 不存在，写入默认配置

#### 正常读取

- 读取 JSON
- 做最小校验与字段修正
- 返回可用配置

#### 读取异常

- 若 JSON 解析失败或结构不可用：
  - 记录日志
  - 用默认配置覆盖原文件
  - 返回默认配置

## 8. 日志设计

M0 不做复杂日志平台，只做本地文件日志。

### LoggerService 职责

- 提供 `info / warn / error`
- 写入 `userData/logs/app.log`
- 在开发环境同时输出到控制台

### 首批日志场景

- 应用启动
- 配置初始化
- 配置读取失败
- 配置更新失败
- IPC handler 异常

### 非目标

- 不做日志滚动
- 不做远程上报
- 不做结构化检索

## 9. IPC 设计

M0 的关键目标之一，是把“空的 `window.api`”变成真正可控的白名单接口。

### 暴露给渲染层的 API

```ts
window.api = {
  app: {
    getVersion(): Promise<string>
  },
  config: {
    get(): Promise<AppConfig>
    update(patch: Partial<AppConfig>): Promise<AppConfig>
    reset(): Promise<AppConfig>
  }
}
```

### 设计原则

- 渲染层不直接访问 `ipcRenderer`
- 只暴露领域 API，不暴露通道名
- `main` 端统一注册 IPC
- 预加载层负责参数进入主进程前的第一层约束

### 通道建议

- `app:getVersion`
- `config:get`
- `config:update`
- `config:reset`

## 10. 最小设置页设计

M0 的 UI 目标只有一个：验证配置链路可用。

### 页面内容

- 应用标题
- 当前版本号
- 主题选择
- 宠物缩放滑块
- 气泡显示开关
- 互动模式选择
- 恢复默认按钮

### 页面行为

- 页面加载时调用 `window.api.config.get()`
- 用户改动后调用 `window.api.config.update()`
- 成功后立刻更新本地 UI 状态
- 恢复默认时调用 `window.api.config.reset()`

### UI 原则

- 不追求复杂视觉
- 优先使用原生表单控件或轻量样式
- 先保证流程清楚、反馈及时

## 11. 错误处理

M0 允许“功能简单”，但不允许“静默失败”。

### 主进程

- `ConfigService` 抛错时记录日志并回退默认配置
- IPC handler 统一 try/catch，避免未处理异常导致进程不稳定

### 渲染层

- 设置页请求失败时显示错误提示
- 避免页面因为配置加载失败直接空白

## 12. 测试与验收

### 手工验收项

1. `pnpm dev` 能正常启动应用
2. 首页不再是脚手架模板，而是最小设置页
3. 首次启动后生成 `userData/config.json`
4. 修改设置后关闭再打开，值仍然保留
5. 删除或破坏 `config.json` 后，应用能恢复默认配置并继续运行
6. 预加载层暴露的 `window.api` 有明确类型

### 最低技术验收

- `pnpm typecheck` 通过
- `pnpm lint` 通过

## 13. 实施顺序

建议按以下顺序实施：

1. 建 `shared` 类型与默认配置
2. 建 `LoggerService`
3. 建 `ConfigService`
4. 建 `main/ipc` 注册与 handler
5. 改 `preload/index.ts` 与 `index.d.ts`
6. 替换渲染层模板首页为设置页
7. 跑通 `typecheck / lint / dev`

## 14. 风险与边界

### 风险

- 如果现在把窗口、托盘、透明、穿透一起加进来，会导致 M0 范围膨胀
- 如果让渲染层直接用 `ipcRenderer`，后续接口会越来越散
- 如果配置模型没有共享类型，三端容易出现字段不一致

### 控制方式

- M0 只保留“配置链路验证”这一条主线
- 所有共享结构放在 `shared`
- 所有系统能力通过 preload 白名单暴露

## 15. 结论

M0 完成后，这个项目虽然还不是桌宠成品，但会具备后续持续迭代所需的最小工程骨架：

- 有清晰的主进程分层
- 有可控的 IPC 边界
- 有可恢复的本地配置
- 有基础日志
- 有能验证整条链路的最小设置页

这能为 M1 的托盘、窗口控制和后续 M2/M3 的桌宠渲染、台词引擎、资源包导入打下稳定基础。

