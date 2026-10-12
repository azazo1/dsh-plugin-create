#!/usr/bin/env node
/**
 * 检查一个 DSH client bundle 是否满足宿主的加载契约.
 *
 * 用法:
 *   node check-client-bundle.mjs <bundle 路径> [期望的插件 id]
 *
 * 不传插件 id 时, 从 bundle 所在目录向上找到最近的 package.json 取其 name.
 *
 * 检查三件事:
 *
 * 1. 脚本顶层除注册调用外没有别的语句.
 *    dsh 的 combo 路由把同一个批次里多个插件的 bundle 源码首尾拼接成同一个 classic script,
 *    而 classic script 顶层的 const / let / class 会进入跨脚本共享的全局词法环境. 两个插件
 *    各写一个 `const zh`, 整批脚本就是 `SyntaxError: Identifier 'zh' has already been
 *    declared`, 批内所有插件一个都注册不上, 启动页却只会把失败算到同批的别的插件头上.
 *    所以整个 bundle 必须包在 IIFE (或打包器的 CJS 包装) 里.
 *
 * 2. 产物是普通脚本, 没有顶层 import / export.
 *
 * 3. 注册的 id 与 package name 一致 (传入第二个参数时检查).
 *
 * 退出码: 0 通过, 1 有问题, 2 用法错误.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'

const [bundlePath, givenId] = process.argv.slice(2)
if (bundlePath === undefined) {
  console.error('用法: node check-client-bundle.mjs <bundle 路径> [期望的插件 id]')
  process.exit(2)
}

/** 从 bundle 向上找最近的 package.json, 用它的 name 当期望 id. */
const nearestPackageName = (target) => {
  let directory = dirname(resolve(target))
  for (;;) {
    const manifest = join(directory, 'package.json')
    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8')).name
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}
const expectedId = givenId ?? nearestPackageName(bundlePath)

const source = ts.createSourceFile(bundlePath, readFileSync(bundlePath, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)
const problems = []

/** 顶层允许的形态: "use strict" 字面量, 以及 IIFE / 注册调用这类表达式语句. */
const allowedTopLevel = (statement) =>
  ts.isExpressionStatement(statement)
  && (ts.isStringLiteral(statement.expression)
    || ts.isCallExpression(statement.expression)
    || ts.isParenthesizedExpression(statement.expression))

/** const / let / class 走全局词法环境, 重名直接 SyntaxError. */
const lexicalTopLevel = (statement) =>
  ts.isClassDeclaration(statement)
  || (ts.isVariableStatement(statement)
    && (statement.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0)

/** var / function 走 globalThis, 重名不报错但会互相覆盖. */
const globalObjectTopLevel = (statement) =>
  ts.isFunctionDeclaration(statement)
  || (ts.isVariableStatement(statement)
    && (statement.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) === 0)

for (const statement of source.statements) {
  if (allowedTopLevel(statement)) continue
  const head = statement.getText(source).split('\n')[0].slice(0, 80)
  if (lexicalTopLevel(statement)) {
    problems.push(`顶层声明进入跨插件共享的全局词法环境, 与同批次插件重名即 SyntaxError 且整批插件都不注册: ${head}`)
  } else if (globalObjectTopLevel(statement)) {
    problems.push(`顶层声明挂到 globalThis, 与同批次插件重名会互相覆盖: ${head}`)
  } else {
    problems.push(`顶层出现产物不该有的语句: ${head}`)
  }
}

const registrations = []
const visit = (node) => {
  if (ts.isCallExpression(node) && node.expression.getText(source).endsWith('__ModuleLoader__.load')) {
    const [argument] = node.arguments
    if (argument !== undefined && ts.isObjectLiteralExpression(argument)) {
      const id = argument.properties.find(property =>
        ts.isPropertyAssignment(property) && property.name.getText(source) === 'id')
      if (id !== undefined && ts.isPropertyAssignment(id) && ts.isStringLiteral(id.initializer)) {
        registrations.push(id.initializer.text)
      }
    }
  }
  ts.forEachChild(node, visit)
}
visit(source)

if (registrations.length === 0) problems.push('没有找到 __ModuleLoader__.load({ id, factory }) 注册调用')
for (const id of registrations) {
  if (expectedId !== undefined && id !== expectedId) problems.push(`注册 id "${id}" 与包名 "${expectedId}" 不一致`)
}

if (problems.length === 0) {
  console.log(`OK: ${bundlePath} 顶层只留注册调用, 注册 id ${registrations.join(', ')}`)
  process.exit(0)
}
console.error(`${bundlePath} 不满足 client bundle 契约:`)
for (const problem of problems) console.error(`  - ${problem}`)
process.exit(1)
