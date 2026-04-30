# playwright-runner

负责基于 target profile 与目标仓库现状，判断 Playwright 冒烟验证是否可执行，并输出统一验证结果。

## 当前能力

- 根据 target profile 判断是否支持 Playwright
- 扫描目标仓库中的 Playwright 配置、依赖与测试目录
- 输出 `runnerStatus`、配置线索和建议，不直接执行外部测试命令
- 当前阶段属于诊断型校验：`unsupported`、`not-configured`、`incomplete` 不阻断主 workflow

当前版本先解决“该不该跑、能不能跑、缺什么”三个问题，后续再接入真实执行与 artifact 产出。
