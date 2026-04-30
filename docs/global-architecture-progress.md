# 全局架构与研发进度总览

## 部署入口

- 访问地址：`https://joox.cc:4399`
- 证书策略：复用 `joox.cc` 的 SSL 证书
- 对外形态：单域名 + 指定端口，承载 Studio Web、API 反向代理与运行态可视化入口

## 当前研发进度

- Phase 1：已完成
- Phase 2：核心骨架已完成，正在把诊断型验证器升级为真实执行器
- Phase 3：未开始，聚焦可视化、artifacts、运行历史、审批闸门
- Phase 4：未开始，聚焦修复回流、视觉基线、多 profile 扩展

## 全局架构流程图

```mermaid
flowchart LR
    A[输入材料\n聊天 / PRD / 设计说明] --> B[Workflow Orchestrator\nNode.js + TypeScript]
    B --> C1[Agent Runtime\n需求分析 / 页面规划 / 实现方案]
    B --> C2[Plugin Runtime\n扫描 / 导航决策 / 生成 / 校验]
    B --> C3[Validation Runtime\n规则 / E2E / 视觉回归]

    C1 --> D1[RequirementSpec]
    C1 --> D2[TargetProfileSelection]
    C1 --> D3[PagePlan]
    C2 --> D4[UIContract]
    C1 --> D5[ImplementationPlan]
    C2 --> D6[GenerationReport]
    C3 --> D7[ValidationReport]

    D1 --> E[Artifacts & Runtime State]
    D2 --> E
    D3 --> E
    D4 --> E
    D5 --> E
    D6 --> E
    D7 --> E

    E --> F[Studio Web\n流程图 / 产物查看 / 审批]
    F --> G[对外部署\nhttps://joox.cc:4399\nSSL: joox.cc]
```

## 研发进度映射

### 已完成

- 工作流加载、校验、最小 runner
- schema / policy / target profile 注册表
- `project-scanner`
- `navigation-decider`
- `page-generator`
- `validation-core`
- 规则检查器：loading / debounce / 删除确认
- 诊断型 `playwright-runner`
- 诊断型 `visual-regression-runner`

### 进行中

- 将诊断型验证器升级为真实执行器
- 让 artifacts 从“报告对象”升级为“文件系统产物 + 可视化查看”

### 待开始

- Studio 运行详情页
- 人工审批闸门
- 视觉基线管理
- 多 profile 深化适配
