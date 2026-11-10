# Bee

为 macOS 打造的黑胶音乐界面，使用 **React + TypeScript + Tauri 2**。
通过本机“音乐”（Music）App 浏览资料库、播放歌曲，用封面、封脊和唱机呈现音乐。

目前处于早期开发阶段。支持本机 Music 中的本地音乐，以及已加入资料库的 Apple Music 订阅歌曲；Spotify 和 Apple Music 完整在线目录尚未接入。

## 功能

- 艺术家、专辑、播放列表导航与资料库搜索、排序。
- 封面网格、横向透视封脊，以及专辑曲目页。
- 黑胶唱机、封套、随播放进度移动的唱臂和悬浮播放控制。
- 按点播来源切换上一首／下一首，显示来源曲目列表。
- 本地封面缓存、可见区域按需读取、重复请求合并。
- macOS 窗口行为、可调整宽度的侧栏、浅色／深色／跟随系统界面。
- 原生 Icon Composer 图标资源：默认白底，暗色与透明外观由支持这些样式的 macOS 管理。
- 圆 b（B♭）悬停提示音、方 B（B♮）封脊换格提示音，可在设置关闭。

## 开发

需要 macOS、Node.js 22+、Rust stable 和 Xcode Command Line Tools。Music 集成与原生窗口功能需要在 macOS 应用内运行。

```sh
npm ci
npm run tauri -- dev
```

只预览网页界面：`npm run dev`。浏览器中无法连接本机 Music。

首次使用，在 **设置 → 音乐来源** 中连接 Apple Music，并允许 Bee 控制“音乐”App。
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

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

检查包含 TypeScript／Vite 构建、Music API 模拟测试、封面请求队列和提示音逻辑测试。
模拟测试不替代真实 Music 授权、播放及 macOS 外观验证。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `src/` | React 页面、封脊交互、唱臂与图片加载 |
| `src-tauri/src/` | Rust 命令、窗口和本地封面缓存 |
| `src-tauri/music/bridge.js` | Music 的 Apple Events / JXA 接口 |
| `src-tauri/icons/` | 当前图标源与构建资源 |
| `public/sounds/` | 原创提示音素材 |
| `scripts/` | 资源生成及回归检查 |

## 数据与当前限制

- 资料库和封面来自用户本机 Music；仓库不包含歌曲、专辑封面或个人资料库数据。
- 封面缓存位于系统应用缓存目录（`studio.bee.vinyl/artwork-v2`），有效期为 30 天。2048 像素以内的 JPEG／PNG 保留源文件；更大的图片使用高质量缩放缓存。
- 曲目列表和切歌按播放来源顺序工作；无法完整复现 Music 私有“待播放”队列、手动插队及随机／循环行为。
- 界面依赖 Music 回报播放状态，读取速度取决于资料库规模和 Music 响应。
- 图标主体使用 AI 辅助生成，并通过 Icon Composer 制作系统外观资源。历史设计稿和第三方参考截图不包含在仓库中。

## 参与贡献

欢迎通过 Issue 反馈问题或提交 Pull Request。反馈请注明 macOS 版本、复现步骤及期望行为；分享日志或截图前请去除个人资料。提交修改前运行上面的验证命令。

## 许可

[MIT](LICENSE)。Apple Music、macOS 及其他第三方名称和商标属于各自所有者；Bee 为独立项目。
