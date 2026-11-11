Bee 0.1.1 · macOS 安装包签名修复

修复 0.1.0 安装包未完整签署 App 资源，导致 macOS 提示“已损坏”的问题。构建流程现在对整个 App 进行 ad-hoc 签名，并强制通过 codesign 完整性检查后才生成发布资产。

适用于 Apple Silicon（arm64），需要 macOS 12 或更新版本。将 Bee.app 拖入“应用程序”并替换旧版。

此版本仍未使用 Apple Developer ID 签名或 Apple 公证。macOS 仍可能阻止来自互联网的应用；请按系统提示决定是否允许打开。升级包签名仅用于 Bee 自动更新校验，不代替 Apple 公证。
