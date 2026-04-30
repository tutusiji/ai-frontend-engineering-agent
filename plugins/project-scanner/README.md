# project-scanner

负责扫描目标前端仓库，提取框架线索、目录结构、候选页面文件和交互模式证据。

## 当前能力

- 递归扫描源码文件并过滤 `node_modules`、`.git`、产物目录
- 识别 package.json 中的框架、路由和 UI 库依赖
- 汇总页面、组件、hooks、测试文件数量
- 抽取 loading、debounce、删除确认等规则检查需要的文本证据
