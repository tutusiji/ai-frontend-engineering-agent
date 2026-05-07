# Phase 3b → 3 → 4 实施计划

## 当前状态总结

### 已完成 (REAL)
- 8 个包 (shared-types, contract-schema, plugin-sdk, skill-sdk, policy-engine, validation-core, workflow-core, agent-runtime)
- 6 个插件 (project-scanner, navigation-decider, page-generator, rule-checkers 真实, playwright/visual-regression 仅诊断)
- 8 个 LLM Skills (requirement-analysis, target-profile-selection, page-planning, frontend-coding-core, interactive-requirement, design-generation, code-generation, ui-library-selection)
- Studio API (Express, 4401) + Studio Web (React+Vite, 4400) 已部署

### 需要修复的关键问题
1. **工作流执行是假的** — POST /api/workflows/:id/run 用 setTimeout 模拟，未调用 WorkflowExecutor
2. **所有数据是内存存储** — sessions/runs 重启丢失
3. **验证器是 mock** — validation-core 的 mock-validators 总返回空 issues
4. **执行器仅串行** — 无 DAG 调度和并行执行
5. **Playwright/Visual Regression 仅诊断** — 不执行真实测试
6. **代码面板无语法高亮** — UX 缺陷

---

## Phase 3b: 数据持久化 + 真实工作流执行 + 审批闸门

### 3b.1 文件持久化层
- [ ] 创建 `packages/persistence/` 包
  - `store.ts` — JSON 文件存储引擎 (读写 .json 文件，带文件锁)
  - `sessions.ts` — 会话 CRUD (sessions.json)
  - `runs.ts` — 运行历史 CRUD (runs.json)
  - `artifacts.ts` — 产物存储 (artifacts/ 目录，按 runId 组织)
- [ ] 数据目录: `~/.ai-studio/data/` (sessions.json, runs.json, artifacts/)
- [ ] 在 server.ts 中替换内存 Map 为持久化存储

### 3b.2 真实工作流执行
- [ ] 修改 server.ts POST /api/workflows/:id/run 调用真实 WorkflowExecutor
- [ ] 执行过程通过 SSE 流式推送进度到前端
- [ ] 执行结果持久化到 runs.json
- [ ] 产物 (生成的代码/设计稿) 保存到 artifacts/

### 3b.3 审批闸门
- [ ] 在 workflow 类型中实现 ApprovalGate (已定义但未使用)
- [ ] 在 executor 中添加审批检查点
- [ ] API: POST /api/runs/:id/approve — 审批通过
- [ ] API: POST /api/runs/:id/reject — 审批拒绝
- [ ] 前端: 审批弹窗 + 审批历史

### 3b.4 产物持久化
- [ ] 每次运行的生成产物保存到 artifacts/{runId}/
- [ ] 产物元数据 (文件列表、类型、大小) 保存到 runs 记录
- [ ] API: GET /api/runs/:id/artifacts — 产物列表
- [ ] API: GET /api/runs/:id/artifacts/:file — 产物内容

---

## Phase 3: Studio UI 完善

### 3.1 工作流可视化
- [ ] WorkflowPanel 添加 DAG 图形视图 (用 Ant Design 的 Tree 或自定义 SVG)
- [ ] 节点状态: pending/running/completed/failed/waiting-approval
- [ ] 实时更新执行进度

### 3.2 Artifact 查看器
- [ ] ArtifactPanel 组件: 文件树 + 内容预览
- [ ] 支持 HTML (iframe), 代码 (语法高亮), JSON (格式化), 图片 (预览)
- [ ] 集成到运行详情页

### 3.3 Profile 选择器
- [ ] 在会话创建时选择 target profile
- [ ] 在侧边栏显示当前 profile
- [ ] API: GET /api/profiles 已有，需要前端集成

### 3.4 代码语法高亮
- [ ] 集成 Prism.js 或 highlight.js
- [ ] CodePanel 组件升级

### 3.5 错误边界
- [ ] 添加 React ErrorBoundary
- [ ] 组件级错误隔离

### 3.6 UI 细节优化
- [ ] WorkflowPanel 轮询添加超时/最大重试
- [ ] ChatPanel 消息时间戳
- [ ] 响应式布局优化

---

## Phase 4: 回流修复 + 视觉基线 + 多 Profile

### 4.1 修复回流 Loop
- [ ] 在 workflow executor 中添加 retry 机制
- [ ] 当验证节点失败时，自动回退到生成节点
- [ ] 最大重试次数限制
- [ ] 回流日志记录

### 4.2 升级 Playwright Runner
- [ ] 真实执行 Playwright 测试
- [ ] 解析测试结果 (pass/fail/skip)
- [ ] 截图保存到 artifacts
- [ ] HTML 报告生成

### 4.3 升级 Visual Regression Runner
- [ ] 真实视觉对比 (pixelmatch 或 resemble.js)
- [ ] 基线截图管理 (baseline/ 目录)
- [ ] Diff 截图生成
- [ ] 阈值配置

### 4.4 多 Profile 扩展
- [ ] 添加 React profile (react + antd)
- [ ] 添加 H5 profile (vue3 + vant)
- [ ] Profile 切换时 UI 组件映射自动调整
- [ ] 代码生成支持多框架

---

## 实施顺序
1. Phase 3b.1 (持久化层) — 基础设施
2. Phase 3b.2 (真实工作流) — 核心功能
3. Phase 3b.3 (审批闸门) — 业务流程
4. Phase 3b.4 (产物存储) — 数据完整性
5. Phase 3.1-3.6 (UI 完善) — 用户体验
6. Phase 4.1-4.4 (高级功能) — 扩展能力
