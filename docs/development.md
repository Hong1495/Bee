# 开发 Bee

[返回项目介绍](../README.md)

## 开发

需要 macOS、Node.js 22+、Rust stable 和 Xcode Command Line Tools。Music 集成与原生窗口功能需要在 macOS 应用内运行。

```sh
npm ci
npm run tauri -- dev
```

只预览网页界面：`npm run dev`。浏览器中无法连接本机 Music。

首次使用，在 **设置 → 音乐库** 中连接 Apple Music，并允许 Bee 控制“音乐”App。
本地文件夹模式使用系统目录选择器，可添加多个目录。切换音乐库会停止播放并清空队列，保留配置与缓存。

授权由系统的“隐私与安全性 → 自动化”管理，不需要提供 Apple ID 密码或开发者令牌。

## 构建

```sh
npm run tauri -- build
```

产物：`src-tauri/target/release/bundle/macos/Bee.app`。
本仓库尚未配置 Developer ID 分发签名和公证；本机构建不等于已签名发行包。

修改图标后，用包含 Icon Composer 的 Xcode 重新生成资源：

```sh
sh scripts/build-macos-icon.sh
```

当前图标源位于 `src-tauri/icons/Bee.icon`。编译后的 `Assets.car`、ICNS 和默认 PNG 随源码提供；普通构建无需重新制作图标。原色、暗色及透明导出预览生成于忽略的 `src-tauri/icons/compiled/` 目录。系统外观是否显示取决于 macOS 版本和系统设置。

提示音为原创合成 PCM 素材，生成脚本：`python3 scripts/build-ui-sounds.py`。

## 验证

原生侧栏使用 AppKit 的 `Sidebar` 材质，WebView 只叠加明暗底色，不再额外进行
`backdrop-filter` 模糊。避免将整窗 Liquid Glass 与网页模糊叠加，产生不同的
最小化合成路径。材质随系统窗口激活状态变化；不拦截或替换系统 Dock 动画。
调整窗口材质后，应在明暗模式下分别检查最小化／恢复、失焦、侧栏收起和拖动宽度，
以及系统“减少透明度”设置。静态截图和构建通过不能证明动画过渡正常。

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

检查包含 TypeScript／Vite 构建、Music API 模拟测试、真实 Hook 队列／音乐库隔离测试、LRC 时间轴边界、本地 WAV 扫描与解码、缓存预算、封面请求队列和提示音逻辑测试。
模拟测试不替代真实 Music 授权、播放及 macOS 外观验证。

后台播放：当前队列推进依赖 `useMusic` 的状态轮询，因此主窗口配置了
`backgroundThrottling: "disabled"`，避免 WebKit 在窗口隐藏／最小化后挂起轮询。
这个系统选项仅在 macOS 14+ 生效；macOS 12–13 的后台连续切歌仍需单独验证，
不能将新系统的结果视为旧系统保证。后台的唱片动画、歌词刷新仍按可见性暂停。

`check-library.mjs` 覆盖隐藏状态下本地／Music 队列自动推进、保存状态以及主动暂停后不自动恢复。
它不模拟 WebKit 的系统挂起。原生回归需分别在本地文件和 Music 模式中播放多首队列，
切换其他 App、最小化、关闭窗口隐藏各持续至少 6 分钟，确认同一曲目的音频连续、
跨曲目自动切换，以及返回前台后状态一致；另外确认手动暂停在后台不会恢复。

`node scripts/check-performance.mjs` 另外验证封脊定位与原算法结果一致、切换歌手复用搜索分组、长队列重复保存不产生额外写入，并输出一万张专辑的计算耗时对比。它是算法微基准，不代表 App 帧率或端到端加载速度。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `src/` | React 页面、封脊交互、唱臂与图片加载 |
| `src-tauri/src/` | Rust 命令、窗口和本地封面缓存 |
| `src-tauri/music/bridge.js` | Music 的 Apple Events / JXA 接口 |
| `src-tauri/icons/` | 当前图标源与构建资源 |
| `public/sounds/` | 原创提示音素材 |
| `scripts/` | 资源生成及回归检查 |

