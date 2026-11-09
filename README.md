# dsh-managed-workspaces

让 DSH 的工作区不再必须指向一个已经存在的文件夹：插件在指定根目录下**自建**工作区文件夹，并允许把**多个文件夹**关联到同一个工作区。

## 工作区模型

```
<根目录>/                     ← 可配置，默认 <用户目录>/DSH-Workspaces
  demo/                       ← 工作区主目录，注册进侧边栏，会话 cwd 就是它
    _roots/                   ← 固定目录，存放关联文件夹的链接
      web/                    ← junction → D:\repos\web
      api/                    ← junction → D:\repos\api
```

- 工作区主目录由插件创建，并通过 `ctx.workspaceRegistry` 注册；在侧边栏出现后，直接在该行新建会话即可（会话 cwd = 主目录）。
- 关联文件夹以 `_roots/<别名>` 的形式出现在工作区里（Windows 使用 NTFS junction，无需管理员权限）。它同时保留真实绝对路径。
- 解除关联**只删除链接**，绝不删除被关联的文件夹；从插件移除工作区**只删除注册与插件记录**，绝不删除文件夹或会话。

## 安装

从 GitHub 安装（推荐）：在 DSH 中让代理使用 `plugin_manager` 的 `install_bundle`：

```
plugin_manager({ action: "install_bundle", target: "https://github.com/CoraxEldridge/dsh-managed-workspaces" })
```

也可以先把仓库克隆到本地，再用本地目录安装：

```
plugin_manager({ action: "install_bundle", target: "D:\\path\\to\\dsh-managed-workspaces" })
```

安装后侧边栏底部出现「托管工作区」入口；若结果显示 `restart-required`，重启 DSH 后生效。更新已安装版本：

```
plugin_manager({ action: "install_bundle", target: "https://github.com/CoraxEldridge/dsh-managed-workspaces" })
```

## 接入已有工作区

侧边栏里已经存在的工作区可以「接入」插件，纳入同一套管理（这样就能给它们关联额外文件夹），而且**不移动、不改名、不新建任何文件**：

- 界面：打开「托管工作区」，在「已有工作区（未接入）」里逐个点「接入」，或点「全部接入」。
- 模型：`managed_workspace({ action: "adopt", all: true })`，或 `managed_workspace({ action: "adopt", folder: "D:\\某目录" })`。

接入后的行为差异：

- 接入的工作区**不会**立刻产生 `_roots/`，只有第一次「关联」文件夹时才创建，因此仓库里不会多出空目录。
- 「移出插件」对**接入**的工作区只删除插件记录，保留它在侧边栏的注册（因为那个工作区原本就属于你）；对 **DSH 新建**的工作区则同时移除侧边栏注册。
- 如果接入的工作区目录被外部删除，「修复」不会替你重建，只报告缺失。

## 使用

1. 打开侧边栏底部的「托管工作区」，设置**工作区根目录**并保存。
2. 输入名称点「新建」：创建 `<根目录>/<名称>/` 并注册到侧边栏。
3. 展开某个工作区，填入要关联的文件夹（或用「浏览…」选择），可指定别名，点「关联」。
4. 在侧边栏该工作区行新建会话即可开始工作。

模型也可以通过 `managed_workspace` 工具完成同样的操作：

| action | 说明 |
|---|---|
| `status` | 当前会话属于哪个托管工作区、关联了哪些文件夹 |
| `list` | 列出全部托管工作区，以及尚未接入的已有工作区 |
| `create` | 新建工作区（`name`） |
| `adopt` | 接入已有文件夹（`folder`），或接入全部已有工作区（`all: true`） |
| `attach` | 关联文件夹（`folder`，可选 `alias`、`workspace`） |
| `detach` | 解除关联（`alias`） |
| `register` | 重新注册到侧边栏 |
| `forget` | 移出插件（不删文件；接入的工作区保留侧边栏注册） |

未指定 `workspace` 时，工具使用当前会话所在的工作区。

## 状态文件

`%DSH_HOME%\managed-workspaces\manifest.json`（`DSH_HOME` 未设置时用 `~/.dsh`），记录根目录、工作区与关联关系。写入是原子的（临时文件 + rename）；文件损坏会被改名为 `manifest.json.corrupt-<时间戳>` 并以空状态继续，同时在界面里给出告警。

## 已知限制

- **搜索不会自动穿越链接**：`glob`/`grep` 通过 ripgrep 执行且不带 `--follow`，所以从工作区根搜索一般不会进入 `_roots/<别名>`。请对每个关联文件夹显式指定路径，例如 `grep({ path: "_roots/web" })`。插件会在提示上下文中提醒模型。
- **`workspace-write` 下无法写关联文件夹**：链接目标是工作区根之外的路径，文件沙箱会拒绝写入（Windows 上又无法用 `additionalWritableRoots` 表达，因为会让 pwsh 的 ACL 沙箱直接失败）。需要修改关联文件夹时把会话切到 `danger-full-access`。
- **不支持 UNC 路径**：Windows junction 不能指向网络共享（会明确报错）。
- 工作区文件夹被外部删除时不会静默重建，需在界面点「修复」。
- 若 `_roots/<别名>` 被真实文件或目录占用，插件只报告冲突，绝不覆盖或删除。
- 卸载插件不会动磁盘上的任何工作区文件夹、链接或会话。
- 插件的 HTTP 路由只接受带 `x-dsh-managed-workspaces: 1` 请求头的 POST，且只操作插件自身记录与根目录下的文件夹。

## 开发

```
node --test test/store.test.js test/context.test.js
```
