# Plugin Structure

推荐使用 TypeScript 编写插件源码, 并将构建产物与源码分离:

```text
plugin/
├── src/                 # TypeScript 源码
│   ├── index.ts         # Host 入口
│   ├── shared.ts        # Host 和 Client 共享类型与常量
│   └── client/          # Client 源码
├── lib/                 # 构建生成的 JavaScript 和类型声明
├── package.json
├── tsconfig.json
└── cordis.patch.yml
```

- `src/` 只保存手写的 TypeScript 源码.
- `lib/` 只保存构建生成的 JavaScript, source map 和 TypeScript 声明文件.
- `package.json` 的 `main` 和 `exports` 应指向 `lib/` 中的产物.
- 不要在 `src/` 中直接维护发布用的 JavaScript 文件.
- `lib/` 属于发布内容时, 应在构建后检查并纳入 npm package files.
- 不要将 `lib/` 添加到 `.gitignore`, 以便构建产物可以被检查和发布.
