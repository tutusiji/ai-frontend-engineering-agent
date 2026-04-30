# validation-core

负责统一验证结果模型、校验报告聚合，以及不同验证执行器的共享适配层。

## 当前能力

- 定义验证检查上下文与结果结构
- 聚合多个验证报告为统一 `ValidationReport`
- 提供最小 mock 校验器，便于 workflow runner 先接通规则检查、E2E 和视觉回归链路

## 设计意图

这一层先把“验证怎么表达、怎么汇总、怎么挂到 workflow”定下来。
后续无论接 ESLint、TypeScript、Vitest、Playwright 还是视觉回归，都可以沿用同一套结果协议。

## 后续可扩展方向

- 接入真实 `tsc --noEmit`、ESLint、Vitest 执行器
- 按 target profile 决定哪些检查可执行、哪些需要跳过
- 增加 artifacts 输出，例如测试日志、截图、diff 图和 HTML 报告
- 支持把策略规则检查拆成独立 rule runner
