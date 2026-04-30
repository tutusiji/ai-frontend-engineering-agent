# contract-schema

负责从 `contracts/` 目录读取结构化 schema。

## 当前能力

- 通过 schema 名称读取 `*.schema.json`
- 列出当前可用 schema

## 设计意图

这一层让 workflow、skill、plugin 都不用自己拼接文件路径，后面也方便切换成数据库或远程注册表。
