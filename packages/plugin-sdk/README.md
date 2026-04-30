# plugin-sdk

负责定义插件执行上下文、日志接口、artifact 发布接口以及插件协议。

## 当前内容

- `PluginContext`
- `PluginDefinition`
- `PluginResult`
- `PluginArtifactStore`

## 设计意图

让导航决策、代码生成、规则检查、测试执行这类确定性能力都走统一插件协议，便于后续挂接 orchestrator 和 worker。
