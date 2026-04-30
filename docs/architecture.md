# 架构设计

## 部署入口

- 统一访问入口：`https://joox.cc:4399`
- TLS 策略：复用 `joox.cc` 的 SSL 证书
- 建议对外形态：由 Nginx 或等价反向代理承接证书与端口，再转发到 Studio Web、Orchestrator API 与运行时可视化服务
- 推荐路径聚合：`/` -> Studio Web，`/api/` -> API，`/events/` -> SSE，`/ws/` -> WebSocket

## 项目定位

这是一个面向多前端目标的多 Agent 工程平台，用来构建和验证前端需求与实现，不是一个通用聊天型 Agent 应用。

这个平台的核心思路是：
- 用受约束的 Agent 负责分析、规划、生成
- 用确定性的插件负责扫描、检查、生成、执行
- 用验证闸门保证每个阶段产物可审查、可回流、可修复

## 初始目标 profile

- `vue3-admin`
- `react-admin`
- `pc-spa`
- `h5-spa`
- `wechat-miniapp`

一个 target profile 至少定义这些内容：
- 技术框架
- 路由方式
- 组件模型
- 页面模式
- 校验策略
- 测试策略
- 代码生成模板

## 设计原则

1. 平台运行时优先统一为 `Node.js + TypeScript`
2. 规则要尽量落文件，不只放在 prompt 里
3. 必须先产出结构化中间件，再进入代码生成
4. 通用规则与目标端规则分层管理
5. 每个阶段都要有验证，并且失败后可定向回流修复
6. 平台按 profile 驱动生成，而不是把框架假设写死在代码里

## 核心分层

### 1. Studio Web

职责：
- 可视化编辑工作流图
- 配置节点参数
- 选择目标 profile
- 监控执行过程
- 查看中间产物
- 查看 diff 和截图对比
- 处理人工审批闸门

建议技术栈：
- React
- TypeScript
- React Flow
- Monaco Editor
- Ant Design 或其他成熟后台壳子

### 2. Orchestrator API

职责：
- 加载工作流定义
- 调度节点执行
- 管理状态流转
- 管理重试与超时
- 管理审批闸门
- 持久化运行记录
- 按 target profile 注入上下文

建议技术栈：
- NestJS
- PostgreSQL
- Redis
- BullMQ
- SSE 或 WebSocket 做实时状态推送

### 3. Agent Runtime

职责：
- 执行需求分析、页面规划、编码、测试、评审等 skill
- 绑定模型适配器与 skill prompt
- 读取 contracts 和 policies
- 输出结构化结果
- 遵守当前选择的 target profile

补充说明：
- 这里可以接 `Hermes Agent` 或其他 harness runtime
- 编排层最好保持 runtime 无关，不被某个执行器锁死

### 4. Plugin Runtime

职责：
- 针对目标仓库或 sandbox 执行确定性工具
- 扫描项目结构、内部组件、目录约定
- 按目标端规则判断路由、菜单、弹窗、抽屉或页面跳转模式
- 生成骨架文件和规则报告
- 在适用场景下执行 Playwright 和截图比对

### 5. Validation Runtime

职责：
- lint
- typecheck
- 单测
- Playwright 冒烟流程
- 视觉回归
- 策略规则检查
- 按目标 profile 执行差异化验证

## 典型工作流

一个典型流程大致如下：

1. 输入材料归档
2. 需求结构化
3. 目标 profile 选择
4. 页面规划
5. 导航与交互形态决策
6. 实现方案生成
7. 代码生成
8. 规则校验
9. E2E 和视觉验证
10. 定向修复回流

## 为什么必须有 contracts

系统不能让 Agent 从一句模糊的话直接跳到源码实现。中间至少要有几类结构化产物：

- `RequirementSpec`
- `TargetProfileSelection`
- `PagePlan`
- `UIContract`
- `ImplementationPlan`
- `TestPlan`
- `ValidationReport`

这些结构化产物的意义是：
- 可以审核
- 可以持久化
- 可以版本化
- 可以单独修改和回放
- 可以作为下一阶段的硬输入

## 策略分层

建议把规则分成两层：

### 通用规则

例如：
- loading 必须存在
- 危险操作必须确认
- 查询默认 debounce
- 完成前必须过验证

### 目标端规则

例如：
- `vue3-admin` 使用什么路由模式和 UI 库
- `react-admin` 使用什么页面模式和生成方式
- `wechat-miniapp` 是否支持 Playwright、页面跳转怎么设计

## Python 什么时候再引入

第一版不是必须。

只有在这些场景变成真实瓶颈时，再考虑加一个 Python worker：
- 很重的 PDF / OCR 解析
- 更复杂的设计稿视觉理解
- 本地视觉模型处理
- 大规模数据处理或离线分析

## Dify 和 n8n 的位置

### Dify

后面如果需要，可以拿来做：
- 知识助手
- 轻量 prompt 应用
- 面向非研发角色的低代码试验场

### n8n

后面如果需要，可以拿来做：
- 飞书、Jira、Webhook 集成
- 通知和审批触发
- 核心研发流程之外的自动化联动

但它们都不是第一版必须依赖的基础设施。
