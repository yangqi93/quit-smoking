# 说戒就戒

> 戒烟，说戒就戒。一个帮你认真戒烟的小程序。

微信小程序 + Gin 后端

## 项目结构

```
quit-smoking/
├── miniprogram/          # 微信原生小程序
│   ├── pages/
│   │   ├── index/        # 首页（计时器+仪表盘）
│   │   ├── breathe/      # 烟瘾急救（4-7-8呼吸法）
│   │   ├── health/       # 健康恢复时间线
│   │   └── profile/      # 个人设置
│   ├── components/       # 公共组件
│   ├── utils/
│   │   ├── calculator.js # 计算工具函数
│   │   └── storage.js    # 本地存储封装
│   ├── images/           # 图标资源
│   ├── app.js / app.json / app.wxss
│   ├── project.config.json
│   └── sitemap.json
└── server/               # Gin 后端 API
    ├── main.go           # 入口
    ├── config/           # 配置管理
    ├── models/           # 数据模型 + SQLite
    ├── handlers/         # API 处理器
    ├── middleware/        # 中间件（鉴权/CORS）
    ├── routes/           # 路由定义
    └── go.mod
```

## 功能

- **戒烟计时器**：实时显示已戒烟时长
- **省钱计算器**：根据吸烟参数计算已省金额
- **健康恢复时间线**：基于 WHO 数据，15个里程碑
- **每日打卡**：记录心情和状态
- **烟瘾急救**：4-7-8 呼吸法引导
- **复吸重置**：温柔重置，不评判

## 开发

### 前端（小程序）

用微信开发者工具打开 `miniprogram/` 目录

### 后端（Gin）

```bash
cd server
go mod tidy
go run main.go
```

API 启动后访问 `http://localhost:8080/ping` 检查健康状态

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录/注册 |
| GET | /api/user/profile | 获取用户资料 |
| POST | /api/quit-record | 创建戒烟记录 |
| GET | /api/quit-record/active | 获取活跃戒烟记录 |
| GET | /api/dashboard | 仪表盘数据 |
| GET | /api/health/timeline | 健康恢复时间线 |
| POST | /api/check-in | 打卡 |
| GET | /api/check-in/history | 打卡历史 |
| POST | /api/craving | 记录烟瘾 |

## 技术栈

- 前端：微信原生小程序
- 后端：Go + Gin + SQLite
- 数据：原型阶段优先本地存储，后端 API 可选接入
