# navigation-decider

负责根据目标 profile、页面规划和项目扫描结果，决定页面采用路由页、抽屉、弹窗还是 tab 页等交互形态，并输出 `UIContract`。

## 当前能力

- 基于 `page-planning` 结果推断页面布局
- 结合 target profile 支持能力选择 route-page / drawer / modal / tab-page / miniapp-page
- 输出页面 sections 与交互规则，作为后续实现方案与代码生成输入
