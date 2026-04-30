# shared-types

负责沉淀各个包共享的基础类型定义。

## 当前内容

- JSON 通用类型
- schema / artifact / target profile 引用类型
- 验证问题与验证报告结构

## 设计意图

把 workflow、skill、plugin、validation 之间共用的协议放到一个最小稳定层，避免后续跨包循环依赖和类型漂移。
