/// <reference path="node_modules/electron/electron.d.ts" />

{
  const { app, screen, ipcMain, dialog, shell } = require("electron");
  const { BrowserWindow, Menu, Tray } = require("electron");
  // Electron 的 ESM 支持始于 v28.0.0，因此只能用 CJS

  const Store = require("electron-store");
  const store = new Store() as {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
  };

  const configReg = /\d+(-\d+)?(,\s?\d+(-\d+)?)*(?=\.exe$)/;

  const windowCfg = {
    cardSize: 240,
    margin: 10,
    aboutSize: [560, 400],
    guideSize: [650, 675],
    buttonSize: [43, 86],
    defaultButtonPos: 0.6,
  };

  const execPath = process.argv[1].replace(/，/g, ",").replace(/~/g, "-");
  const devFlag = execPath.includes("DEV") || execPath === ".";
  const cfgMatch = execPath.match(configReg)?.[0];
  const cfgDefault = "1-50";
  const cfgCaption = cfgMatch ?? cfgDefault + " (默认)";

  const list = (() => {
    const ranges: (number | [number, number])[] = (cfgMatch ?? cfgDefault)
      .split(",")
      .map((raw) => {
        const [start, end] = raw.split("-").map(Number);
        return end ? [start, end] : start;
      });
    const list = ranges.flatMap((range) => {
      if (typeof range === "number") return range;
      let [start, end] = range;
      if (start > end) [end, start] = [start, end];
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    });
    return Array.from(new Set(list.sort((a, b) => a - b)));
  })();

  let wy = 0;

  const basicWindowConfig: Electron.BrowserWindowConstructorOptions = {
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    icon: __dirname + "/favicon.ico",
  } as const;

  function getScreenSize() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { screenWidth: width, screenHeight: height };
  }

  const restrain = (value: number, [min, max]: [number, number]) =>
    Math.min(Math.max(value, min), max);

  const Button = (() => {
    const [width, height] = windowCfg.buttonSize;
    let x = 0;
    let button: Electron.CrossProcessExports.BrowserWindow;
    let shadowButton: Electron.CrossProcessExports.BrowserWindow | null = null;
    let firstFlag = true;

    const getButtonConfig = (shadow?: true) => ({
      ...basicWindowConfig,
      webPreferences: {
        preload: shadow
          ? undefined
          : __dirname + "/interface/scripts/button.js",
        backgroundThrottling: false,
      },
      show: false,
      width,
      height,
    });

    return {
      create() {
        if (!firstFlag) return;
        firstFlag = false;

        const { screenWidth, screenHeight } = getScreenSize();
        x = screenWidth - width;
        wy = Math.round(screenHeight * windowCfg.defaultButtonPos);
        const wyBound = [
          windowCfg.cardSize / 2,
          screenHeight - windowCfg.cardSize / 2,
        ] as [number, number];

        button = new BrowserWindow(getButtonConfig());
        button.setBounds({ x, y: wy - height / 2, width, height });

        button.show();
        button.setAlwaysOnTop(true, "screen-saver");
        button.loadFile("interface/button.html");

        ipcMain.on("movebuttonstart", () => {
          shadowButton = new BrowserWindow({
            ...getButtonConfig(true),
            show: true,
          });
          shadowButton.loadFile("interface/shadowButton.html");
          const y = wy - height / 2;
          shadowButton.setBounds({ x, y, width, height });
        });
        ipcMain.on("movebutton", (_, { dy }) => {
          let nwy = restrain(wy + Math.round(dy), wyBound);
          const y = nwy - height / 2;
          if (shadowButton) shadowButton.setBounds({ x, y, width, height });
        });
        ipcMain.on("movebuttonend", (_, { dy }) => {
          wy = restrain(wy + Math.round(dy), wyBound);
          const y = wy - height / 2;
          if (button) button.setBounds({ x, y, width, height });
          if (shadowButton) {
            shadowButton.close();
            shadowButton = null;
          }
        });
      },
      openDevTools() {
        if (button) button.webContents.openDevTools();
      },
      openShadowDevTools() {
        if (shadowButton) shadowButton.webContents.openDevTools();
      },
    };
  })();

  let mute = false;

  const Window = (() => {
    const { cardSize, margin } = windowCfg;
    const [width, height] = [cardSize + 2 * margin, cardSize + 2 * margin];
    const winArr: {
      id: number;
      win: Electron.CrossProcessExports.BrowserWindow;
    }[] = [];
    let aboutWin: Electron.CrossProcessExports.BrowserWindow | null = null;
    let guideWin: Electron.CrossProcessExports.BrowserWindow | null = null;
    let curid = 0;

    return {
      create() {
        const id = curid++;
        const { screenWidth } = getScreenSize();
        const x = screenWidth - cardSize - margin,
          y = wy - cardSize / 2 - margin;
        const win = new BrowserWindow({
          ...basicWindowConfig,
          ...{ x, y, width, height },
          webPreferences: {
            preload: __dirname + "/interface/scripts/rand.js",
          },
        });
        win.setAlwaysOnTop(true, "screen-saver");
        win.loadFile("interface/rand.html");
        win.webContents.once("did-finish-load", () =>
          win.webContents.send("startup-params", { list, id, mute })
        );
        win.once("minimize", () => win.close());
        winArr.push({ id, win });
      },
      close(id: number | "about" | "guide") {
        if (id === "about") return setTimeout(() => aboutWin?.close(), 150);
        if (id === "guide") return setTimeout(() => guideWin?.close(), 150);

        const index = winArr.findIndex((win) => win.id === id);
        if (index === -1) console.warn("Window not found: " + id);
        const { win } = winArr[index];
        winArr.splice(index, 1);
        setTimeout(() => win.close(), 150);
      },
      openDevTools() {
        winArr.forEach(({ win }) => win.webContents.openDevTools());
      },
      openMiscDevTools() {
        aboutWin?.webContents.openDevTools();
        guideWin?.webContents.openDevTools();
      },
      setMute(muteflag: boolean) {
        mute = muteflag;
        winArr.forEach(({ win }) => win.webContents.send("mute", muteflag));
      },
      createMisc(type: "about" | "guide") {
        const [width, height] =
          type === "about" ? windowCfg.aboutSize : windowCfg.guideSize;
        if (type === "about" && aboutWin) return aboutWin.focus();
        if (type === "guide" && guideWin) return guideWin.focus();
        const win = new BrowserWindow({
          ...basicWindowConfig,
          width: width + windowCfg.margin * 2,
          height: height + windowCfg.margin * 2,
          skipTaskbar: false,
          alwaysOnTop: false,
          minimizable: true,
          webPreferences: { preload: __dirname + "/interface/scripts/misc.js" },
        });
        win.loadFile(`interface/${type}.html`);
        if (type === "about") {
          aboutWin = win;
          win.on("closed", () => (aboutWin = null));
        } else {
          guideWin = win;
          win.on("closed", () => (guideWin = null));
        }
      },
    };
  })();

  const createTray = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: "ClassDraw v" + app.getVersion(), enabled: false },
      {
        label: "配置: " + cfgCaption,
        enabled: false,
      },
      {
        label: "指南…",
        click: () => Window.createMisc("guide"),
      },
      {
        label: "关于…",
        click: () => Window.createMisc("about"),
      },
      {
        visible: devFlag,
        label: "调试面板",
        submenu: [
          { label: "抽号窗口", click: Window.openDevTools },
          { label: "关于/指南窗口", click: Window.openMiscDevTools },
          { label: "侧边按钮", click: Button.openDevTools },
          { label: "侧边影子按钮", click: Button.openShadowDevTools },
        ],
      },
      { type: "separator" },
      { label: "打开窗口", click: Window.create },
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
            { label: "1.5 小时", minutes: 90 },
            { label: "2 小时", minutes: 120 },
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
        click: ({ checked }) => Window.setMute(checked),
      },
      { type: "separator" },
      { label: "退出", role: "quit" },
    ]);
    const tray = new Tray(__dirname + "/favicon.ico");
    tray.setToolTip("ClassDraw 抽号机");
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
              "ClassDraw 抽号机\n定时关闭：" +
                (remainingTime > 3600
                  ? Math.floor(remainingTime / 3600) + ":"
                  : "") +
                Math.floor((remainingTime % 3600) / 60) +
                ":" +
                (remainingTime % 60)
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
      tray.setToolTip("ClassDraw 抽号机");
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
          "已有一个 ClassDraw 抽号机在运行。\n\n" +
          `正运行的配置：${store.get("config")}\n` +
          `新启动的配置：${cfgCaption}\n\n` +
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
    store.set("config", cfgCaption);
    createTray();
    Button.create();

    ipcMain.on("close", (_, id) => Window.close(id));
    ipcMain.on("create-window", Window.create);
    ipcMain.on("open-url", (_, url) => shell.openExternal(url));
    ipcMain.handle("get-app-version", () => app.getVersion());

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
