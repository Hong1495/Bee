Bee 0.1.4 · 修复启动白屏

修复 0.1.3 自动更新调度器直接调用浏览器计时器时丢失 Window 接收者，触发 Illegal invocation 并导致 React 界面白屏的问题。保留自动检测更新和原 Dock 位置重启的修复。

0.1.3 已白屏的用户请下载本版 DMG，退出 Bee 后替换“应用程序”中的 Bee.app。无需删除音乐库、设置或缓存。

适用于 macOS 12 及更新版本的 Apple Silicon（arm64）。此版本使用完整 ad-hoc 签名和独立升级包签名，尚无 Apple Developer ID 签名或 Apple 公证。
