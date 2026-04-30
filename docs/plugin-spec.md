# Plugin 规范

Plugin 负责确定性执行能力。

## 什么时候应该用 Plugin

适合放到 Plugin 的事情：
- 仓库扫描
- 文件生成或改写
- 路由、弹窗、抽屉、页面跳转等导航形态判断
- 各类验证执行器
- 截图生成和 diff 对比
- 稳定、可重复的规则检查

## 推荐的 Plugin 分类

- `scanner`
- `planner`
- `generator`
- `checker`
- `validator`
- `reporter`

## 第一批建议优先实现的 Plugin

- `project-scanner`
- `navigation-decider`
- `page-generator`
- `loading-rule-checker`
- `debounce-rule-checker`
- `delete-confirm-rule-checker`
- `playwright-runner`
- `visual-regression-runner`

## Side Effect 声明

每个 Plugin 都应该声明副作用级别：
- `none`
- `repo-write`
- `external-call`

这样便于后面做：
- 审批控制
- 审计留痕
- 权限边界管理
