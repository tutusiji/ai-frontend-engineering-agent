# Skill 规范

Skill 负责受约束的推理和结构化输出。

## 什么时候应该用 Skill

适合放到 Skill 的事情：
- 需求分析
- 目标 profile 选择
- 页面规划
- 实现方案规划
- 测试用例生成
- 代码评审分类
- 修复任务规划

## Skill 设计规则

- 尽量给每个 skill 绑定输入 schema
- 尽量给每个 skill 绑定输出 schema
- 构建 prompt 前先加载通用策略和目标端策略
- 尽量把输出规整成严格 JSON 对象
- 编码类 skill 不能跳过 contracts 直接生成最终代码

## 第一批建议优先实现的 Skill

- `requirement-analysis`
- `target-profile-selection`
- `page-planning`
- `frontend-coding-core`
- `test-case-generation`
- `code-review-rubric`
