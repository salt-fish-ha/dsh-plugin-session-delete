# dsh-plugin-session-delete

[English](README.md) | 中文

**在 DSH 侧栏彻底删除一个对话。**

DSH 本身没有删除会话的能力：`@deepseek-ai/dsh-session-persistence` 的文档明确写着
*"No deletion or retention API — pruning stored sessions is out-of-band backend maintenance"*
（没有删除或保留 API——清理已存储会话属于带外后端维护），会话的 Remote 接口里也没有 `delete`。
本插件就是这套"带外维护"，并把它接到侧栏的常规操作上。

## 它新增了什么

- 每条侧栏对话行的**悬停条上多一个垃圾桶图标按钮**，排在系统自带的归档（100）和置顶（200）之后。
- 该行 **`…` 菜单里多一项「删除对话」**，不用悬停也能触达。
- 一个**确认对话框**（挂在 `shell.overlay`），会显示对话标题——因为这个操作不可恢复。

两个入口都注册在 `@deepseek-ai/dsh-client-ui-workspace` 声明的 seat 上：
`sidebar.workspaces.session.row.action` 与 `sidebar.workspaces.session.menu.item`。

## 「删除」会清掉什么

| 产物 | 清除方式 |
|---|---|
| 会话日志目录（`<DSH home>/sessions/<项目>/<sessionId>/`，含全部已存世代与 `session.lock`） | `fs.rm`——DSH 没有对应 API |
| 投影缓存记录 | `ctx.sessionProjectionCache.requireTable().delete(id)` |
| 工作区成员登记 | `Workspace#detachSession(id)` |
| 归档 / 置顶登记 | `registry.unarchiveSession(id)`、`registry.unpinSession(id)` |
| 已连接的客户端 | `ctx.emit('api-session/removed', id)` |

顺序是刻意安排的：先解析日志路径，再做工作区记账，最后才删日志——因为 `sessionKnown`
是从 `sessionPersistence.list()` 重建的，日志一删它就不认识这个会话了。

## 安全设计

- **先停止运行中的工作，而不是一概拒绝。** 一个"打开着的"对话即使空闲也会驻留在会话存储里，
  所以若把所有驻留会话都拒掉，恰好会挡住用户正看着的那一行。插件改用 DSH 自己的
  `workspace/session-activity` 探针判断是否真有工作在跑；有则调用 `stopSessionActivity`，
  然后逐出内存实例（`sessions` / `agents`），确保没有任何东西会把即将删除的日志重新写回来。
- **拒绝非法 id**——含路径分隔符、控制字符、`.` 或 `..` 的值，一律在触碰文件系统之前就被拒绝。
- **删除前必须确认**，对话框里显示对话标题，失败时把 Host 的原始错误显示出来。
- 一套行为自测覆盖以上全部：空闲对话、忙碌对话、无关的旁观对话、非法 id，以及缺少可选服务的精简组合。

## 安装与更新

把包放到 `<profile>/node_modules/dsh-plugin-session-delete/`，并在 profile 的 manifest 里登记：

```json
{
  "dependencies": { "dsh-plugin-session-delete": "file:../../plugins/dsh-plugin-session-delete" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-plugin-session-delete"] } }
}
```

**安装或更新后必须完全重启应用。** DSH 的热重载确实会实时应用 bundle 列表变化——它会在几秒内
重新读取包 manifest 并应用 `cordis.patch.yml`——但它**不会替换 JavaScript 模块代际**：
*"Package replacements require restarting the process to load a fresh JavaScript module generation."*
（替换已安装的包需要重启进程才能加载新的模块代际。）所以请从托盘图标**完全退出** DSH 再重新打开，
关窗口不算退出。已在 DSH 0.2.0-rc.2 上实测：登记 bundle 后，运行中的 Host 读取了本包的
`package.json` 与 `cordis.patch.yml`，但**始终没有重新读取 `lib/index.js`**。

只改 `lib/client.js` 时可以不用重启——`dsh-client-hmr` 会轮询被服务的产物并热替换，
但前提是该插件的行已经被加载。

## 在真实安装上验证过

环境：Windows + DSH 0.2.0-rc.2，插件安装在 `desktop` profile 中。

**加载链路。** 完全重启后，Host 在进程启动约两秒内依次：导入 `lib/index.js`、注册 Typert
反射（`lib/typert.host.js` + `lib/remote.js`）、应用 `cordis.patch.yml`、并把 `lib/client.js`
纳入浏览器图。该信号的对照组：一个只在 `dependencies` 里、**不在** `dsh.profile.bundles`
里的包，启动时完全没有被读取。

**界面。** 悬停条渲染出垃圾桶按钮，`…` 菜单渲染出删除项；确认对话框显示对话标题，
确认按钮为危险色。

**一次真实删除。** 删除一个对话时，三组产物被一并清除：

- 它的 `<DSH home>/sessions/<项目>/<sessionId>/` 日志目录；
- 它的 `<DSH home>/storages/session_projcache/sessions/<sessionId>.json` 缓存记录；
- 它在 `workspace.json` 的 `sessionIds` 里的登记，且 `archivedSessionIds` 与
  `pinnedSessionIds` 保持干净。

事后存储中 **13 份会话日志 ↔ 13 份投影缓存一一对应**，两个方向都没有孤儿，全库没有残留的
`session.lock`，该工作区以及另外两个无关工作区里的其他对话**全部未被触碰**。另外请注意，
DSH 并不写日志文件（`%APPDATA%\DeepSeek Harness`、`%LOCALAPPDATA%\DeepSeek Harness` 与
`<DSH home>/logs` 都不存在），所以上述状态是直接读取存储得出的。

## 在另一台机器上安装

本插件**没有任何运行时依赖，也没有构建步骤**，可以直接搬过去用。安装前请完全退出 DSH，
安装后重启它。

**用包文件。** 把 `dsh-plugin-session-delete-<版本>.tgz` 拷到目标机器，然后在 DSH 里打开
**插件**页面，选择**添加插件**，填入该 tarball 的**绝对路径**。DSH 会在 profile 内执行
`pnpm add <路径>`，把包追加进 `dsh.profile.bundles`，然后重载。该 tarball 使用 npm 的
`package/` 布局。

**用目录。** 把包目录拷到 `<profile>/node_modules/dsh-plugin-session-delete/`，并按上面的
写法加进 profile manifest。做组合时不需要改 lockfile。

两种方式下 bundle 列表都会实时生效，但**新的 Host 模块代际只在全新进程里加载**，
所以请重启 DSH。

从这份源码重新打包：

```sh
mkdir -p /tmp/stage/package
cp package.json cordis.patch.yml README.md README.zh.md LICENSE /tmp/stage/package/
cp -r lib locale /tmp/stage/package/
tar -czf dsh-plugin-session-delete-0.1.0.tgz -C /tmp/stage package
```

## 未覆盖的范围

- **附件。** `<DSH home>/attachments/v1/objects/…` 是内容寻址且**跨会话共享**的；删掉对象可能
  会破坏其他对话。
- **spill 文件。** `<spill root>/session-<hash>/…` 没有按会话清理的 API，只有启动时按年龄的
  一次性清扫。
- **跨进程。** 在**第二个**正在运行的 DSH 背后删除，会让那个进程的内存存储变脏，直到它重启。

## 目录结构

```text
package.json        dsh.bundle.patch + dsh.client
cordis.patch.yml    插入插件行
lib/index.js        Host 插件：SessionDeleteService，真正执行删除
lib/remote.js       严格线协议描述符（手工编写，不依赖任何 schema 库）
lib/typert.host.js  ./typert 导出所需的 TYPERT 反射
lib/client.js       手写的前端 bundle：行按钮、菜单项、确认对话框
locale/{en,zh}.json 插件标题与描述
```

没有构建步骤，也没有第三方运行时依赖：Host 侧只 import `node:*`，前端侧只需要浏览器模块表里的
`react` 与 `@deepseek-ai/dsh-client-ui-primitives`。

## 许可证

MIT。
