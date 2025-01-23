/// <reference path="node_modules/electron/electron.d.ts" />

{
  const {
    app,
    BrowserWindow,
    Menu,
    Tray,
    screen: screen,
    ipcMain,
  } = require("electron");
  // Electron 的 ESM 支持始于 v28.0.0，因此只能 require

  const configReg = /\d+(-\d+)?(,\d+(-\d+)?)*(?=\.exe$)/;
  let mute = false;

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
    const match = execPath.match(configReg);
    if (!match) return Array.from({ length: 50 }, (_, i) => i + 1);
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
      win.webContents.on("did-finish-load", () =>
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
          "当前配置：" +
          (process.argv[1]?.match(configReg)?.[0] ?? "默认（1-50）"),
        enabled: false,
      },
      { type: "separator" },
      {
        label: "打开窗口",
        click: () => createWindow(),
      },
      {
        label: "调试面板",
        submenu: [
          {
            label: "抽号窗口",
            click: () =>
              windows.forEach(({ win }) => win.webContents.openDevTools()),
          },
          {
            label: "侧边按钮",
            click: () => buttonUtils.devButton(),
          },
          {
            label: "侧边影子按钮",
            click: () => buttonUtils.devShadowButton(),
          },
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
      {
        label: "退出",
        role: "quit",
      },
    ]);
    const tray = new Tray(__dirname + "/favicon.ico");
    tray.setToolTip("抽号机");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => tray.popUpContextMenu(contextMenu));
  };

  app.whenReady().then(() => {
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
  });

  app.on("window-all-closed", () => {});
}
