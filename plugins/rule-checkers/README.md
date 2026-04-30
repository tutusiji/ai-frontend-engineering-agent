# rule-checkers

负责基于 `project-scanner` 的扫描结果执行共享前端规则检查。

## 当前能力

- `loading-rule-checker`
- `debounce-rule-checker`
- `delete-confirm-rule-checker`

当前实现以静态文本证据和文件分布为基础，先给出可解释的第一版结果，后续再逐步升级到 AST 和组件语义分析。
