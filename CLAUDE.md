# CLAUDE.md

## 图片理解规则

如果当前使用的是 **xiaomi（小米）系列模型**（如 `mimo-v2.5-pro`），**不能**用 `mimo-v2.5-pro` 模型直接理解/读取图片，否则会报错。

正确做法：使用 `haiku` 模型对应的 `mimo-v2.5` 模型来理解图片。可以通过子 agent 调用 `haiku` 模型来读取图片内容。

```bash
# 正确：用 haiku 模型读图
Agent(model="haiku", prompt="读取这张图片...")

# 错误：不要用 mimo-v2.5-pro 直接读图，会报错
```

## Git 提交规则

这是一个开源项目，**所有 Git 提交都必须先与用户确认**，未经确认不得自行 commit 或 push。
