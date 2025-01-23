/// <reference path="node_modules/electron/electron.d.ts" />
/// <reference path="node_modules/electron-store/index.d.ts" />

{
  const {
    app,
    BrowserWindow,
    Menu,
    Tray,
    screen: screen,
    ipcMain,
    dialog,
  } = require("electron");
  // Electron 的 ESM 支持始于 v28.0.0，因此只能 require

  const Store = require("electron-store");
  const store = <
    {
      get: (key: string) => string | undefined;
      set: (key: string, value: string) => void;
    }
  >new Store();

  const configReg = /\d+(-\d+)?(,\d+(-\d+)?)*(?=\.exe$)/;
  let mute = false;
  let devFlag = false;

  const basicConfig: Electron.BrowserWindowConstructorOptions = {
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
  } as const;

  const cardSize = 260;

  const generateList = () => {
    const execPath = process.argv[1];
    console.log("execPath: " + execPath);
    const match = execPath.match(configReg);
    devFlag = execPath.includes("DEV") || execPath === ".";
    if (!match) {
      store.set("config", "1-50 (默认)");
      return Array.from({ length: 50 }, (_, i) => i + 1);
    } else store.set("config", match[0]);
    const ranges: (number | [number, number])[] = match[0]
      .split(",")
      .map((raw) => {
        const [start, end] = raw.split("-").map(Number);
        return end ? [start, end] : start;
      });
    const list = ranges.flatMap((range) => {
      if (Array.isArray(range)) {
        let [start, end] = range;
        if (start > end) [end, start] = [start, end];
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      } else return range;
    });
    return Array.from(new Set(list.sort((a, b) => a - b)));
  };

  const list = generateList();
  const windows: {
    id: number;
    win: Electron.CrossProcessExports.BrowserWindow;
  }[] = [];

  let wy: number = 0;

  const buttonUtils = (() => {
    const [width, height] = [43, 86];
    let wx: number;
    let button: Electron.CrossProcessExports.BrowserWindow | null = null;
    let shadowButtonObj: Electron.CrossProcessExports.BrowserWindow | null =
      null;
    let first = true;
    const getButtonConfig = (shadow?: boolean) => ({
      ...basicConfig,
      icon: __dirname + "/favicon.ico",
      webPreferences: {
        preload: shadow
          ? undefined
          : __dirname + "/interface/scripts/button.js",
        backgroundThrottling: false,
      },
      show: false,
      thickFrame: false,
      width,
      height,
    });
    return {
      createButton() {
        if (first) {
          const { width: screenWidth, height: screenHeight } =
            screen.getPrimaryDisplay().workAreaSize;
          wx = screenWidth - width;
          wy = Math.floor(screenHeight / 2);
          const shadowButton = new BrowserWindow(getButtonConfig(true));
          shadowButtonObj = shadowButton;
          shadowButton.loadFile("interface/shadowButton.html");
          ipcMain.on("movebuttonstart", () => {
            shadowButton.showInactive();
          });
          ipcMain.on("movebutton", (_, { dy }) => {
            dy = Math.round(dy);
            shadowButton.setBounds({
              x: wx,
              y: wy + dy - height / 2,
              width,
              height,
            });
          });
          ipcMain.on("movebuttonend", (_, { dy }) => {
            dy = Math.round(dy);
            wy += dy;
            if (button)
              button.setBounds({ x: wx, y: wy - height / 2, width, height });
            shadowButton.hide();
          });
          first = false;
        }
        if (button) return;
        const win = new BrowserWindow(getButtonConfig());
        win.setBounds({ x: wx, y: wy - height / 2, width, height });
        win.show();
        win.setAlwaysOnTop(true, "screen-saver");
        win.loadFile("interface/button.html");
        button = win;
      },
      closeButton: () => (button && button.close(), (button = null)),
      devButton: () => button && button.webContents.openDevTools(),
      devShadowButton: () =>
        shadowButtonObj && shadowButtonObj.webContents.openDevTools(),
    };
  })();

  const createWindow = (() => {
    let curid = 0;
    return () => {
      const id = curid++;
      const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
      const x = screenWidth - cardSize + 10,
        y = wy - cardSize / 2;
      const win = new BrowserWindow({
        ...basicConfig,
        width: cardSize,
        height: cardSize,
        x,
        y,
        icon: __dirname + "/favicon.ico",
        webPreferences: {
          preload: __dirname + "/interface/scripts/rand.js",
        },
      });
      win.setAlwaysOnTop(true, "screen-saver");
      win.loadFile("interface/rand.html");
      win.webContents.once("did-finish-load", () =>
        win.webContents.send("startup-params", { list, id, mute })
      );
      windows.push({ id, win });
    };
  })();

  const createTray = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "ClassDraw",
        enabled: false,
      },
      {
        label:
          "配置: " + (process.argv[1]?.match(configReg)?.[0] ?? "1-50 (默认)"),
        enabled: false,
      },
      {
        visible: devFlag,
        label: "调试面板",
        submenu: [
          {
            label: "抽号窗口",
            click: () =>
              windows.forEach(({ win }) => win.webContents.openDevTools()),
          },
          {
            label: "侧边按钮",
            click: buttonUtils.devButton,
          },
          {
            label: "侧边影子按钮",
            click: buttonUtils.devShadowButton,
          },
        ],
      },
      { type: "separator" },
      {
        label: "打开窗口",
        click: () => createWindow(),
      },
      {
        label: "定时关闭",
        submenu: [
          { label: "无", click: () => stopQuitTimer(), type: "radio" },
          ...[
            devFlag
              ? { label: "1 分钟", minutes: 1 }
              : { label: "30 分钟", minutes: 30 },
            { label: "50 分钟", minutes: 50 },
            { label: "1 小时", minutes: 60 },
            { label: "1.5 小时", minutes: 60 },
            { label: "2 小时", minutes: 60 },
          ].map(({ label, minutes }) => ({
            label,
            click: () => setQuitTimer(minutes),
            type: "radio" as const,
          })),
        ],
      },
      {
        label: "静音",
        type: "checkbox",
        click: ({ checked }) => {
          mute = checked;
          windows.forEach(({ win }) => win.webContents.send("mute", checked));
        },
      },
      { type: "separator" },
      {
        label: "退出",
        role: "quit",
      },
    ]);
    const tray = new Tray(__dirname + "/favicon.ico");
    tray.setToolTip("抽号机");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => tray.popUpContextMenu());

    let quitTimerId: NodeJS.Timeout | null = null;
    let remainingTime: number | null = null;

    function setQuitTimer(minutes: number) {
      if (quitTimerId) clearInterval(quitTimerId);
      remainingTime = minutes * 60;
      quitTimerId = setInterval(() => {
        if (remainingTime !== null) {
          remainingTime--;
          if (remainingTime <= 0) app.quit();
          else
            tray.setToolTip(
              "抽号机\n定时关闭：" +
                `${Math.floor(remainingTime / 60)}:${remainingTime % 60}`
            );
        }
      }, 1000);
    }
    function stopQuitTimer() {
      if (quitTimerId) {
        clearInterval(quitTimerId);
        quitTimerId = null;
      }
      remainingTime = null;
      tray.setToolTip("抽号机");
      tray.setContextMenu(contextMenu);
    }
  };

  app.whenReady().then(() => {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      const option = dialog.showMessageBoxSync({
        type: "info",
        title: "实例冲突",
        message:
          "已有一个抽号机在运行。\n\n" +
          `正运行的配置：${store.get("config")}\n` +
          `新启动的配置：${
            process.argv[1]?.match(configReg)?.[0] ?? "1-50 (默认)"
          }\n\n` +
          "如需使用新的配置，请关闭上一个正在运行的抽号机。",
        buttons: ["关闭上一个，加载新数据", "取消启动，继续使用原数据"],
      });
      if (option) app.quit();
      else {
        app.requestSingleInstanceLock({ cmd: "close" });
        let newlock = false;
        let cnt = 0;
        const getlock = setInterval(() => {
          newlock = app.requestSingleInstanceLock();
          cnt++;
          if (newlock) {
            clearInterval(getlock);
            console.log("Got new lock");
          }
          if (cnt > 10) {
            clearInterval(getlock);
            const option = dialog.showMessageBoxSync({
              type: "warning",
              title: "实例冲突",
              message:
                "上一个进程未正常退出。\n建议在任务管理器结束任务以免产生问题。",
              buttons: ["退出", "强制启动新实例"],
            });
            if (!option) app.quit();
          }
        }, 500);
      }
    }
    createTray();
    buttonUtils.createButton();
    ipcMain.on("close", (_, id) => {
      const index = windows.findIndex((win) => win.id === id);
      if (index === -1) console.warn("Window not found: " + id);
      const { win } = windows[index];
      windows.splice(index, 1);
      setTimeout(() => {
        win.close();
        buttonUtils.createButton();
      }, 150);
    });
    ipcMain.on("create-window", createWindow);
    app.on("second-instance", (_e, _argv, _dir, additionalData) => {
      if (
        additionalData &&
        typeof additionalData === "object" &&
        "cmd" in additionalData
      )
        if (additionalData.cmd === "close") app.quit();
    });
  });

  app.on("window-all-closed", () => {});
}
