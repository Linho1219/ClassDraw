/// <reference path="node_modules/electron/electron.d.ts" />
/// <reference path="types.d.ts" />

// Electron 的 ESM 支持始于 v28.0.0，因此只能用 CJS

const { app, screen, ipcMain, dialog, shell } = require("electron");
const { BrowserWindow, Menu, Tray } = require("electron");

const Store = new (require("electron-store") as StoreConstructor)();

const sizes: WindowCfg = {
  cardSize: 240,
  margin: 10,
  aboutSize: [560, 400],
  guideSize: [650, 660],
  buttonSize: [43, 86],
  defaultButtonPos: 0.6,
} as const;

const configs = (() => {
  const cfgDefault = "1-50";
  const configReg = /\d+(-\d+)?(,\d+(-\d+)?)*(?=\.exe$|$)/;

  const path = (<string | undefined>process.argv[1])
    ?.replace(/，/g, ",")
    .replace(/~/g, "-");
  const match = path?.match(configReg)?.[0];
  const caption = match ?? cfgDefault + " (默认)";
  const final = match ? match : cfgDefault;

  const ranges: (number | [number, number])[] = final.split(",").map((raw) => {
    const [start, end] = raw.split("-").map(Number);
    return end ? [start, end] : start;
  });
  const rawlist = ranges.flatMap((range) => {
    if (typeof range === "number") return range;
    let [start, end] = range;
    if (start > end) [end, start] = [start, end];
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });
  const list = Array.from(new Set(rawlist.sort((a, b) => a - b)));

  const dev = path?.includes("DEV") || path === ".";

  return { caption, final, dev, list };
})();

const states = {
  /** 窗口中心点与屏幕顶部的距离 */
  wy: 0,
  mute: false,
  dockLeft: false,
};

const basicWindowCfg: Electron.BrowserWindowConstructorOptions = {
  transparent: true,
  frame: false,
  resizable: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  minimizable: false,
  icon: __dirname + "/favicon.ico",
} as const;

const Screen = ((): ScreenUtil => {
  function init(this: ScreenUtil) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    this.width = width;
    this.height = height;
  }
  return {
    init,
    width: 0,
    height: 0,
  };
})();

const Button = (() => {
  const [width, height] = sizes.buttonSize;
  let wx = 0;
  let button: Electron.CrossProcessExports.BrowserWindow | null = null;
  let shadowButton: Electron.CrossProcessExports.BrowserWindow | null = null;
  let insertedCSSKey: string | undefined = undefined;
  const buttonInvertCSS = () =>
    `html { transform: ${states.dockLeft ? "rotateY(180deg)" : "none"}; }`;
  const shadowCSS =
    "#button { opacity: 1 !important; transition: none !important }" +
    "body { animation: fade 0.3s !important }";

  const getButtonConfig = (
    shadow?: true
  ): Electron.BrowserWindowConstructorOptions => ({
    ...basicWindowCfg,
    webPreferences: {
      preload: shadow ? undefined : __dirname + "/interface/scripts/button.js",
      backgroundThrottling: false,
    },
    show: false,
    width,
    height,
  });

  function create() {
    if (button) return;

    wx = Screen.width - width;
    states.wy = Math.round(Screen.height * sizes.defaultButtonPos);

    const wyBound = [
      sizes.cardSize / 2,
      Screen.height - sizes.cardSize / 2,
    ] as [number, number];

    const x = () => (states.dockLeft ? 0 : Screen.width - width);

    button = new BrowserWindow(getButtonConfig());
    button.setBounds({ x: x(), y: states.wy - height / 2, width, height });

    button.show();
    button.setAlwaysOnTop(true, "screen-saver");
    button.loadFile("interface/button.html");

    ipcMain.on("create-window", Window.create);

    const restrain = (value: number, [min, max]: [number, number]) =>
      Math.min(Math.max(value, min), max);

    ipcMain.on("movebuttonstart", () => {
      shadowButton = new BrowserWindow({
        ...getButtonConfig(true),
        show: true,
      });
      const y = states.wy - height / 2;
      shadowButton.setBounds({ x: x(), y, width, height });
      shadowButton.loadFile("interface/button.html");
      shadowButton.webContents.insertCSS(shadowCSS);
      shadowButton.webContents.insertCSS(buttonInvertCSS());
    });
    ipcMain.on("movebutton", (_, { dy }) => {
      let nwy = restrain(states.wy + Math.round(dy), wyBound);
      const y = nwy - height / 2;
      if (shadowButton) shadowButton.setBounds({ x: x(), y, width, height });
    });
    ipcMain.on("movebuttonend", (_, { dy }) => {
      states.wy = restrain(states.wy + Math.round(dy), wyBound);
      const y = states.wy - height / 2;
      if (button) button.setBounds({ x: x(), y, width, height });
      if (shadowButton) {
        shadowButton.close();
        shadowButton = null;
      }
    });
  }

  function openDevTools() {
    button?.webContents.openDevTools();
    shadowButton?.webContents.openDevTools();
  }

  async function setDock(isLeft: boolean) {
    states.dockLeft = isLeft;
    if (isLeft && !insertedCSSKey)
      insertedCSSKey = await button?.webContents.insertCSS(buttonInvertCSS());
    else if (!isLeft && insertedCSSKey) {
      button?.webContents.removeInsertedCSS(insertedCSSKey);
      insertedCSSKey = undefined;
    }
    button?.setBounds({
      x: states.dockLeft ? 0 : wx,
      y: states.wy - height / 2,
      width,
      height,
    });
  }

  return { create, openDevTools, setDock };
})();

const Window = (() => {
  const { cardSize, margin } = sizes;
  const [width, height] = [cardSize + 2 * margin, cardSize + 2 * margin];
  const winArr: {
    id: number;
    win: Electron.CrossProcessExports.BrowserWindow;
  }[] = [];
  let aboutWin: Electron.CrossProcessExports.BrowserWindow | null = null;
  let guideWin: Electron.CrossProcessExports.BrowserWindow | null = null;

  const getId = (() => {
    let id = 0;
    return () => id++;
  })();

  function create() {
    const id = getId();
    const x = () =>
        states.dockLeft ? -margin : Screen.width - cardSize - margin,
      y = states.wy - cardSize / 2 - margin;
    const win = new BrowserWindow({
      ...basicWindowCfg,
      ...{ x: x(), y, width, height },
      webPreferences: {
        preload: __dirname + "/interface/scripts/rand.js",
      },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.loadFile("interface/rand.html");

    if (states.dockLeft)
      win.webContents.insertCSS(
        "#body { animation-name: fadeFromLeft !important; }"
      );
    win.webContents.once("did-finish-load", () =>
      win.webContents.send("startup-params", {
        list: configs.list,
        id,
        mute: states.mute,
      })
    );
    win.once("minimize", () => win.close());
    winArr.push({ id, win });
  }

  function createMisc(type: "about" | "guide") {
    const [width, height] =
      type === "about" ? sizes.aboutSize : sizes.guideSize;
    if (type === "about" && aboutWin) return aboutWin.focus();
    if (type === "guide" && guideWin) return guideWin.focus();
    const win = new BrowserWindow({
      ...basicWindowCfg,
      width: width + sizes.margin * 2,
      height: height + sizes.margin * 2,
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
  }

  function listen() {
    ipcMain.on("close", (_, id) => close(id));
    ipcMain.on("open-url", (_, url) => shell.openExternal(url));
    ipcMain.handle("get-app-version", () => app.getVersion());
  }

  function close(id: number | "about" | "guide") {
    if (id === "about") return setTimeout(() => aboutWin?.close(), 150);
    if (id === "guide") return setTimeout(() => guideWin?.close(), 150);

    const index = winArr.findIndex((win) => win.id === id);
    if (index === -1) console.warn("Window not found: " + id);
    const { win } = winArr[index];
    winArr.splice(index, 1);
    setTimeout(() => win.close(), 150);
  }

  function openDevTools() {
    winArr.forEach(({ win }) => win.webContents.openDevTools());
  }

  function openMiscDevTools() {
    aboutWin?.webContents.openDevTools();
    guideWin?.webContents.openDevTools();
  }

  function setMute(muteflag: boolean) {
    states.mute = muteflag;
    winArr.forEach(({ win }) => win.webContents.send("mute", muteflag));
  }

  return {
    create,
    createMisc,
    listen,
    close,
    openDevTools,
    openMiscDevTools,
    setMute,
  };
})();

const quitTimer = (() => {
  let quitTimerId: NodeJS.Timeout | null = null;
  let remainingTime: number | null = null;

  function set(minutes: number, callback?: (remainingTime: number) => void) {
    if (quitTimerId) clearInterval(quitTimerId);
    remainingTime = minutes;
    callback?.(remainingTime);
    quitTimerId = setInterval(() => {
      if (remainingTime !== null) {
        remainingTime--;
        if (remainingTime <= 0) app.quit();
        callback?.(remainingTime);
      }
    }, 60 * 1000);
  }

  function stop() {
    if (quitTimerId) {
      clearInterval(quitTimerId);
      quitTimerId = null;
    }
    remainingTime = null;
  }

  const get = () => remainingTime;

  return { set, stop, get };
})();

const TrayIcon = (() => {
  let tray: Electron.CrossProcessExports.Tray;

  const timerMenuItems = [
    configs.dev
      ? { label: "1 分钟", minutes: 1 }
      : { label: "30 分钟", minutes: 30 },
    { label: "50 分钟", minutes: 50 },
    { label: "1 小时", minutes: 60 },
    { label: "1.5 小时", minutes: 90 },
    { label: "2 小时", minutes: 120 },
  ];
  const contextMenu = Menu.buildFromTemplate([
    { label: "ClassDraw v" + app.getVersion(), enabled: false },
    { label: "配置: " + configs.caption, enabled: false },
    { label: "指南…", click: () => Window.createMisc("guide") },
    { label: "关于…", click: () => Window.createMisc("about") },
    {
      visible: configs.dev,
      label: "调试面板",
      submenu: [
        { label: "抽号窗口", click: Window.openDevTools },
        { label: "关于/指南窗口", click: Window.openMiscDevTools },
        { label: "侧边按钮", click: Button.openDevTools },
      ],
    },
    { type: "separator" },
    {
      label: "贴靠位置",
      submenu: [
        { label: "右侧", click: () => Button.setDock(false), type: "radio" },
        { label: "左侧", click: () => Button.setDock(true), type: "radio" },
      ],
    },
    {
      label: "定时关闭",
      submenu: [
        {
          label: "无",
          click: () => {
            quitTimer.stop();
            updateTooltip(0);
          },
          type: "radio",
        },
        ...timerMenuItems.map(({ label, minutes }) => ({
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

  function setQuitTimer(minutes: number) {
    quitTimer.set(minutes, updateTooltip);
  }

  function updateTooltip(remainingTime: number) {
    function timeCaption() {
      if (!remainingTime) return "";
      const t = remainingTime - 1;
      if (t === 0) return "不到 1 分钟";
      if (t < 60) return `${t} 分钟`;
      if (t % 60 === 0) return `${t / 60} 小时`;
      return `${Math.floor(t / 60)} 小时 ${t % 60} 分钟`;
    }
    if (remainingTime)
      tray.setToolTip(`ClassDraw 抽号机\n${timeCaption()}后自动退出`);
    else tray.setToolTip("ClassDraw 抽号机");
  }

  function create() {
    tray = new Tray(__dirname + "/favicon.ico");
    tray.setToolTip("ClassDraw 抽号机");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => tray.popUpContextMenu());
  }

  return { create };
})();

const SingleLock = (() => {
  async function attempt() {
    if (app.requestSingleInstanceLock()) return true;

    const conflictDialog = await dialog.showMessageBox({
      type: "info",
      title: "实例冲突",
      message:
        "已有一个 ClassDraw 抽号机在运行。\n\n" +
        `正运行的配置：${Store.get("config")}\n` +
        `新启动的配置：${configs.caption}\n\n` +
        "如需使用新的配置，请关闭上一个正在运行的抽号机。",
      buttons: ["取消启动，继续使用原数据", "关闭上一个，加载新数据"],
    });
    if (conflictDialog.response === 0) return false;

    sendClose();
    const retrieRes = await retry();
    if (retrieRes) return true;

    const retryFailDialog = await dialog.showMessageBox({
      type: "warning",
      title: "实例冲突",
      message: "上一个进程未正常退出。\n建议在任务管理器结束任务以免产生问题。",
      buttons: ["退出", "继续 (不推荐)"],
    });

    if (retryFailDialog.response === 1) return true;
    return false;
  }

  function retry(maxAttempt: number = 10): Promise<boolean> {
    return new Promise((resolve) => {
      let cnt = 0;
      const getLockInterval = setInterval(() => {
        cnt++;
        if (app.requestSingleInstanceLock()) {
          clearInterval(getLockInterval);
          resolve(true);
        } else if (cnt >= maxAttempt) {
          clearInterval(getLockInterval);
          resolve(false);
        }
      }, 500);
    });
  }

  function sendClose() {
    app.requestSingleInstanceLock({ cmd: "close" });
  }

  function listenClose() {
    app.on("second-instance", (_e, _argv, _dir, additionalData: any) => {
      if (additionalData?.cmd === "close") app.quit();
    });
  }

  return { attempt, listenClose };
})();

app.whenReady().then(async () => {
  if (typeof process.argv[1] !== "string") {
    const option = dialog.showMessageBoxSync({
      type: "error",
      title: "参数缺失",
      message:
        "启动参数缺失，未获取到自解压包启动路径。\n" +
        "请确认是否从正确的发行版本启动。",
      buttons: ["退出", "以默认配置启动"],
    });
    if (!option) app.quit();
  }

  if (!(await SingleLock.attempt())) app.quit();

  Store.set("config", configs.caption);

  Screen.init();
  TrayIcon.create();
  Button.create();
  Window.listen();
  SingleLock.listenClose();
});

app.on("window-all-closed", () => {});

export = {};
