# skill-sdk

负责定义受约束推理类 skill 的上下文、prompt 结构和输出协议。

## 当前内容

- `SkillContext`
- `SkillDefinition`
- `SkillPrompt`
- `SkillResult`

## 设计意图

把“结构化推理”与“确定性执行”分层：skill 负责分析、规划、生成结构化结果；plugin 负责透明可审计的执行动作。
