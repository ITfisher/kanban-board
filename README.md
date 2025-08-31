# 项目管理看板 (Kanban Board)

一个现代化的项目管理看板系统，基于 Next.js 15 构建，提供直观的任务管理、服务监控和团队协作功能。

## ✨ 核心功能

### 🎯 项目看板
- **五阶段工作流**: 待规划 → 待开发 → 开发中 → 待审核 → 已完成
- **拖拽式操作**: 直观的任务状态流转
- **实时筛选**: 支持按服务、优先级、负责人筛选任务
- **批量操作**: 多选任务批量删除、状态更新
- **键盘快捷键**: 提升操作效率
  - `Ctrl+K`: 快速搜索任务
  - `Ctrl+Shift+A`: 全选任务
  - `Ctrl+Shift+D`: 批量删除
  - `Esc`: 清除选择/筛选

### 🔧 服务管理
- **服务配置**: 管理项目中的所有微服务
- **状态监控**: 实时显示服务状态（健康/警告/错误/维护）
- **技术栈标记**: 清晰展示每个服务的技术架构
- **Git分支管理**: 支持测试分支和主分支配置
- **任务关联**: 统计每个服务的任务数量

### 📋 需求管理
- **详细视图**: 完整的需求信息展示
- **筛选功能**: 按优先级和状态筛选需求
- **Git集成**: 关联代码分支信息
- **标签系统**: 灵活的任务分类

### ⚙️ 其他功能
- **数据持久化**: 基于 localStorage 的本地数据存储
- **响应式设计**: 完美适配各种设备尺寸
- **暗色主题**: 支持明暗主题切换
- **中文界面**: 完整的中文用户界面

## 🛠️ 技术栈

### 前端框架
- **Next.js 15** - React 全栈框架
- **React 19** - 用户界面构建
- **TypeScript** - 类型安全的 JavaScript

### 样式设计
- **Tailwind CSS v4** - 原子化CSS框架
- **shadcn/ui** - 基于 Radix UI 的组件库
- **Lucide React** - 现代化图标库
- **OKLCH颜色空间** - 先进的颜色管理

### 开发工具
- **pnpm** - 快速、节约磁盘空间的包管理器
- **ESLint** - 代码质量检查
- **PostCSS** - CSS处理工具

## 🚀 快速开始

### 环境要求
- Node.js 18.0 或更高版本
- pnpm 8.0 或更高版本

### 安装依赖
```bash
pnpm install
```

### 启动开发服务器
```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用

### 构建生产版本
```bash
pnpm build
pnpm start
```

### 代码检查
```bash
pnpm lint
```

## 📁 项目结构

```
kanban-board/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx           # 主看板页面
│   ├── services/          # 服务管理
│   ├── requirements/      # 需求管理
│   ├── branches/          # Git分支管理
│   ├── settings/          # 系统设置
│   └── layout.tsx         # 根布局
├── components/            # React 组件
│   ├── ui/               # shadcn/ui 基础组件
│   ├── main-layout.tsx   # 主布局组件
│   ├── sidebar.tsx       # 侧边栏导航
│   ├── task-card.tsx     # 任务卡片
│   └── ...               # 其他业务组件
├── hooks/                # 自定义 React Hooks
│   └── use-local-storage.ts
├── lib/                  # 工具函数
│   └── utils.ts
├── styles/               # 样式文件
│   └── globals.css
├── public/               # 静态资源
└── package.json
```

## 🎨 设计系统

### 颜色方案
- **主色调**: 青色 (Cyan) - 专业可靠
- **强调色**: 绿色 (Green) - 积极进展
- **OKLCH颜色空间**: 更好的颜色一致性和对比度

### 组件规范
- 基于 **shadcn/ui** 的设计系统
- **Radix UI** 无障碍组件基础
- **New York** 风格变体
- 统一的圆角、间距、字体规范

## 💾 数据管理

### 本地存储
应用使用 localStorage 进行数据持久化，主要存储：
- `kanban-tasks`: 任务数据
- `kanban-services`: 服务配置
- `kanban-selected-service`: 当前选择的服务

### 数据结构
```typescript
interface Task {
  id: string
  title: string
  description: string
  status: "backlog" | "todo" | "in-progress" | "review" | "done"
  priority: "low" | "medium" | "high"
  assignee?: { name: string; avatar?: string }
  gitBranch?: string
  service: string
  labels: string[]
}

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  techStack: string[]
  dependencies: string[]
  testBranch: string
  masterBranch: string
}
```

## 🔧 自定义配置

### Tailwind CSS
```javascript
// next.config.mjs
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}
```

### TypeScript
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## 📱 响应式设计

- **移动端优先**: 从小屏幕开始设计
- **断点**: sm(640px), md(768px), lg(1024px), xl(1280px)
- **灵活网格**: 看板列数自动适配屏幕尺寸
- **触摸友好**: 移动设备操作优化

## 🚀 部署指南

### Vercel (推荐)
1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 自动部署完成

### 其他平台
- **Netlify**: 支持静态导出
- **Docker**: 可容器化部署
- **静态托管**: 支持 `next export`

### 环境变量
```bash
# .env.local
NEXT_PUBLIC_APP_NAME="项目管理看板"
NEXT_PUBLIC_VERSION="1.0.0"
```

## 🤝 贡献指南

### 开发规范
1. 使用 TypeScript 进行类型安全开发
2. 遵循 ESLint 代码规范
3. 组件命名使用 PascalCase
4. 函数命名使用 camelCase
5. 提交信息使用中文描述

### 提交规范
```bash
git commit -m "feat: 添加任务批量操作功能"
git commit -m "fix: 修复拖拽排序问题"
git commit -m "docs: 更新README文档"
```

## 📄 许可证

[MIT License](LICENSE)

## 🆘 支持

如果你在使用过程中遇到问题：
1. 查看项目 Issues
2. 提交新的 Issue
3. 参与项目讨论

---

**让项目管理更简单，让团队协作更高效！** 🎉