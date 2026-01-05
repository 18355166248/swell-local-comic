# Git 提交规范

## Commit Message 格式
使用中文编写 commit message，格式如下：

```
<type>: <subject>

<body>
```

## Type 类型
- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 重构代码
- `style`: 代码格式调整（不影响功能）
- `docs`: 文档更新
- `chore`: 构建/工具链相关

## 示例
```
feat: 添加图片查看器组件
fix: 修复图片加载失败的问题
refactor: 重构图片加载逻辑，提取 useImageLoader Hook
```

