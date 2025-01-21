/// <reference path="node_modules/electron/electron.d.ts" />

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  screen: escreen,
  ipcMain,
} = require("electron");
// Electron 的 ESM 支持始于 v28.0.0，因此只能 require

const basicConfig = {
  transparent: true,
  frame: false,
  resizable: false,
  alwaysOnTop: true,
  skipTaskbar: true,
} as const;

const cardSize = 260;

const generateList = () => {
  // const execPath = process.argv[1][0];
  const execPath = "aha 1-5";
  const reg = /\d+(-\d+)?(,\d+(-\d+)?)*$/;
  const match = execPath.match(reg);
  if (!match) return;
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

const { createButton, closeButton } = (() => {
  let button: Electron.CrossProcessExports.BrowserWindow | null = null;
  return {
    createButton() {
      if (button) return;
      const width = 43,
        height = 86;
      const win = new BrowserWindow({
        ...basicConfig,
        width,
        height,
        focusable: false,
        icon: __dirname + "/favicon.ico",
        webPreferences: {
          preload: __dirname + "/interface/scripts/button.js",
        },
        show: false,
      });
      const { width: screenWidth, height: screenHeight } =
        escreen.getPrimaryDisplay().workAreaSize;
      const x = screenWidth - width;
      const y = Math.floor((screenHeight - height) / 2);
      win.setBounds({ x, y, width, height });
      win.show();
      win.setAlwaysOnTop(true, "screen-saver");
      win.loadFile("interface/button.html");
      button = win;
    },
    closeButton() {
      if (button) button.close();
      button = null;
    },
  };
})();

const createWindow = (() => {
  let curid = 0;
  return () => {
    const id = curid++;
    const { width: screenWidth, height: screenHeight } =
      escreen.getPrimaryDisplay().workAreaSize;
    const x = screenWidth - cardSize + 10,
      y = (screenHeight - cardSize) / 2;
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
      win.webContents.send("startup-params", { list, id })
    );
    win.on("moved", () => createButton());
    setTimeout(() => closeButton(), 400);
    windows.push({ id, win });
  };
})();

const createTray = () => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "ClassDraw",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "打开窗口",
      click: () => createWindow(),
    },
    {
      label: "启用调试",
      click: () => windows.forEach((win) => win.win.webContents.openDevTools()),
    },
    {
      label: "退出",
      click: () => app.quit(),
    },
  ]);
  const tray = new Tray(__dirname + "/favicon.ico");
  tray.setToolTip("抽号机");
  tray.setContextMenu(contextMenu);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));
};

app.whenReady().then(() => {
  createTray();
  createButton();
  ipcMain.on("close", (_, id) => {
    const index = windows.findIndex((win) => win.id === id);
    if (index === -1) console.warn("Window not found: " + id);
    const { win } = windows[index];
    windows.splice(index, 1);
    setTimeout(() => {
      win.close();
      createButton();
    }, 150);
  });
  ipcMain.on("create-window", () => createWindow());
});

app.on("window-all-closed", () => {});
