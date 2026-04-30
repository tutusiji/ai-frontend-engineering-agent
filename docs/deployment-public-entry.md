# 外网访问入口部署方案

## 目标

将项目统一对外暴露为：`https://joox.cc:4399`

要求：
- 通过公网可访问
- 复用 `joox.cc` 现有 SSL 证书
- Studio Web 与 Orchestrator API 通过同一入口聚合
- Worker Runtime 保持内网运行，不直接暴露

## 推荐拓扑

```text
Internet
   |
https://joox.cc:4399
   |
Nginx / SSL termination
   |-- /        -> Studio Web        -> 127.0.0.1:4400
   |-- /api/    -> Orchestrator API  -> 127.0.0.1:4401
   |-- /events/ -> SSE               -> 127.0.0.1:4401/events/
   |-- /ws/     -> WebSocket         -> 127.0.0.1:4401/ws/

Worker Runtime / Queue / DB / Redis 仅内网可见
```

## 证书与端口

- 证书文件：`/etc/nginx/ssl/joox.cc.pem`
- 私钥文件：`/etc/nginx/ssl/joox.cc.key`
- 对外监听端口：`4399`
- 域名：`joox.cc`

## Nginx 配置文件

仓库内配置草案：`deploy/nginx/joox-4399.conf`

## 建议的本地服务端口

- Studio Web：`127.0.0.1:4400`
- Orchestrator API：`127.0.0.1:4401`
- Worker Runtime：内网服务，不直接暴露

## 上线检查清单

- [ ] 服务器安全组 / 防火墙已放行 TCP `4399`
- [ ] `joox.cc` DNS 已指向目标服务器公网 IP
- [ ] `/etc/nginx/ssl/joox.cc.pem` 与 `/etc/nginx/ssl/joox.cc.key` 可读
- [ ] `nginx -t` 校验通过
- [ ] `systemctl reload nginx` 或等价命令完成热加载
- [ ] `https://joox.cc:4399` 首页可访问
- [ ] `https://joox.cc:4399/api/health` 可返回 API 健康状态
- [ ] SSE / WebSocket 链接可正常建立

## 为什么采用同域名 + 端口聚合

- 用户入口更简单，减少跨域与多域配置
- Studio、API、事件流可以共用同一证书与反向代理层
- 便于后续增加登录、审计、限流、基础认证等网关能力

## 当前状态说明

当前仓库已补齐：
- 部署入口文档
- `joox.cc:4399` 的 Nginx 配置草案
- 架构总览文档与可视化页面

但尚未直接修改服务器运行中的 Nginx。若要真正上线，还需要把该配置应用到目标机器并重载服务。
