# ClassDraw 抽号机

> [!warning]
>
> 由于需要兼容 Windows 7，本项目使用 Electron 22.3.27。
>
> 采用旧版本工具链是痛苦的，故本项目大概率不会持续维护。如有需要请自行 fork。

## 介绍

简单易用的课堂抽号小工具，基于 Electron 开发。

发布形式为单文件 `.exe` 封包，可直接从 U 盘双击运行。启动后会在屏幕右边缘显示一个按钮，双击即可唤出抽号窗口。

特点：

- 单文件 `.exe` 封包，可直接从 U 盘双击运行
- 使用文件名配置号数范围，对带有硬盘还原的校园设备更友好
- 在屏幕上常驻一个按钮用于唤出抽号窗口，方便快捷
- 良好的触屏适配
- 保留对 Windows 7/8/8.1 的兼容性
- 提供定时关闭功能，可实现下课自动退出

## 使用指南

![](https://raw.githubusercontent.com/Linho1219/ClassDraw/refs/heads/main/interface/assets/guide.svg)

## 开发指南

### 概述

由于要保留对 Windows 7 的兼容性，Electron 版本锁在 22.3.27。因此：

- 安装依赖时会跳一些 `npm warn deprecated`，忽略即可。安全性没有问题。
- 必须使用 CJS 方式引入包（Electron 的 ESM 支持始于 28.0.0）

Electron 这几年没有什么很大的变化，所以现在的文档基本适用。

前端部分在 `interface` 目录下。因为动态内容不多，没有用框架，就是原生，由 tsc 编译 TypeScript。都是预加载方式载入的。

二进制构建的代码在 `package/build.ts` 中，用的是 Electron Packager。构建完成会把 `locales` 目录下没用的 `.pak` 语言文件删掉，并更新 `.nsi` 脚本中的版本号信息。

单文件封包利用 NSIS 脚本完成，在 `package/pack.nsi` 中。本质上就是将 Electron 应用压缩成一个自解压包，解压到临时目录后启动并带上自解压包的路径作为参数。Electron 应用得到参数后处理得到号数范围。

`misc` 目录下是一些开发过程中用到的资源的源文件，打包时不会放进发行版。

### 快速开始

环境要求：

- Windows 7 或以上
- Node 16 或以上
- [NSIS 3](https://nsis.sourceforge.io/Download)（并添加到 PATH）

安装依赖：

```bash
npm i
```

启动调试：

```bash
npm start
```

构建二进制文件但不进行单文件封包：

```bash
npm run build
```

构建二进制文件并进行单文件封包：

```bash
npm run pack
```

仅进行单文件封包：

```bash
npm run sfx
```

> [!note]
>
> 也可使用 Linux。例如通过 `sudo apt-get install nsis` 安装 NSIS。但请注意！Linux 下的 NSIS 使用 UTF-8 编码（区别于 Windows 下只接受 GBK），因此需要手动将 `package/pack.nsi` 的重新编码为 UTF-8 并保存。启动、调试、打包命令与 Windows 下一致。

### 常见问题

#### 找不到 `makensis`

如果遇到这样的错误：

```
makensis : 无法将“makensis”项识别为 cmdlet、函数、脚本文件或可运行程序的名称。请检查名称的拼写，如果包括路径，请确保路径正确，然后再试一次。
```

说明你没把 `makensis.exe` 所在目录添加到 PATH。默认情况下其位置为 `C:\Program Files (x86)\NSIS\Bin`。

#### 构建过程速度慢 / 网络问题 / 需要离线构建

安装依赖时正常，但是在执行 `build` 时出现 `TIMEOUT`、`INVALID_URL` 等网络问题，并且身处提瓦特大陆。

由于打包过程需要 Electron 二进制文件，如果缓存失效就要重新下载。此问题可以通过合适地配置网络解决。但是既然锁版本了，每次重新下载也没有必要。一般构建过程（不包含单文件封包）只需几秒到十几秒，超出这个时间基本就是卡在网络上了。

`build.ts` 中定义了 Electron 二进制包的缓存位置。只需在项目根目录下创建 `cache` 文件夹，然后将下载好的 `electron-v22.3.27-win32-x64.zip` 放进去，即可识别到并使用该包来构建。

可以从 [其 Github 仓库的 Release](https://github.com/electron/electron/releases/tag/v22.3.27) 中下载。这里提供一下哈希以免下错：

```
MD5    FAE28FAA48B38BB717725F4B88C6C953
SHA-1  967A5CF7E53598B4E741C1F83F6F72389B37A290
```

#### 文件锁定

如果遇到这样的错误：

```
[Error: EBUSY: resource busy or locked, unlink '...' ]
```

即文件被占用。可以使用 PowerToys 的 File Locksmith 或其他类似工具处理。

### 缓存权限错误

```
[Error: EPERM: operation not permitted, rmdir 'C:\Users\***\AppData\Local\Temp\electron-packager\tmp-G2VRQu\resources\app'] {
  errno: -4048,
  code: 'EPERM',
  syscall: 'rmdir',
  path: 'C:\\Users\\***\\AppData\\Local\\Temp\\electron-packager\\tmp-***\\resources\\app'
}
```

Electron + Electron Packager 的远古 bug，在特定的 Windows 版本上出现。以管理员权限甚至 SYSTEM 权限执行都无法解决。

解决方案：暂未找到。如有解决方法请提交 issue 或 PR。

曲线救国：用 Linux。

### 调试

> [!warning]
>
> 这个版本的 Electron 毕竟不是最新的，有一些 Bug。其中包括：F12 面板设成为中文时会随机报错。因此不要将 F12 面板设成中文。

通过 `npm start` 启动时托盘菜单里会有“调试面板”菜单，从中可以启动各个窗口的 F12 开发人员工具。

如果需要调试已经封包好的，在文件名中加入 `DEV` 三个大写字母即可在显示调试面板菜单。

> [!tip]
>
> 侧边按钮比较小，直接打开 F12 面板的话什么都点不到。可以打开“指南”窗口及其 F12 面板，然后选择 Dock side 为独立窗口，再打开侧边按钮的 F12 面板。

## 碎碎念

这个抽号机一开始是初中应班主任要求写的，大家都很喜欢，以至于成为了班级文化的一部分，还推广到其他班去了。毕业的时候我还自动掏钱给班上每个同学送了一个写着各自名字和座号的抽号机亚克力钥匙扣。

抽号机还带到了高中，高一班主任特别喜欢。但是由于本人懒得做设置界面，抽号机的通用性就差了很多，想改号数范围就得重新制作程序包，后来嫌麻烦就没维护了。

上了大学，对大学美好生活的幻想破灭了。也不知道是谁一天天在说上了大学就轻松了之类的鬼话。我都不知道每天上课是去干嘛，恨不得直接一次性交完学费拿了学位证就走人。在学校没上课就窝在宿舍写代码。

整天回忆美好的中学时光，就想起来重构一下之前的项目。结果发现原来的代码找不到了（摊手），只有前端部分还在（还好之前毕业的时候做了个网页版留作纪念），遂从头重写了一遍。

都说 Electron 是电子垃圾，确实是。但人家方便是真的方便，两下半就能做个很好看的界面。要怪就怪巨硬做不出好用的 WebView 吧（WebView2 没普及，而且做得也是依托，还有一堆权限问题）。
