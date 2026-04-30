# page-generator

负责根据 `ImplementationPlan` 和 `UIContract` 生成最小可执行的生成报告。

## 当前能力

- 将实现计划中的文件清单转成标准化 `GenerationReport`
- 根据目标 profile 推导推荐落点目录
- 输出建议创建/更新的文件与补丁摘要

当前版本只产出生成报告，不直接写目标仓库文件；这样先把主链路的契约打通。
