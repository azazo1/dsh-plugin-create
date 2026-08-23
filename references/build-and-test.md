# Build And Test

推荐使用 TypeScript 编写源码, 先进行类型检查, 再将源码编译为 JavaScript 并输出到 `lib/`.

```text
src/  -- TypeScript build -->  lib/
```

基本流程:

1. 使用项目统一的包管理器安装依赖.
2. 执行 TypeScript 类型检查, 确认源码和声明没有类型错误.
3. 执行构建脚本, 生成 `lib/` 下的 JavaScript, source map 和类型声明.
4. 按项目需要运行针对 Host, Client 或配置逻辑的测试.
5. 检查 `package.json` 的入口和 `files` 配置是否指向 `lib/`.

构建产物不应手工修改. 发布前应在干净环境重新生成 `lib/`, 并确认包内不包含未构建的临时文件.
