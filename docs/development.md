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

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

检查包含 TypeScript／Vite 构建、Music API 模拟测试、真实 Hook 队列／音乐库隔离测试、LRC 时间轴边界、本地 WAV 扫描与解码、缓存预算、封面请求队列和提示音逻辑测试。
模拟测试不替代真实 Music 授权、播放及 macOS 外观验证。

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

