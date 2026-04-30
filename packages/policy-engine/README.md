# policy-engine

负责从 `policies/` 和 `policies/targets/` 目录读取通用策略与目标 profile。

## 当前能力

- 读取通用策略文件
- 读取 target profile
- 列出可用 target profile

## 设计意图

这一层把平台通用规则和目标端差异规则统一收口，后面扩展 React、H5、小程序时不需要改 workflow 核心。
