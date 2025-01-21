/// <reference path="node_modules/electron/electron.d.ts" />

const { app, BrowserWindow, Menu, Tray, ipcMain } = require("electron");
// Electron 的 ESM 支持始于 v28.0.0，因此只能 require

const basicConfig = {
  transparent: true,
  frame: false,
  resizable: false,
  alwaysOnTop: true,
  skipTaskbar: true,
} as const;

const cardSize = 310;

const generateList = () => {
  // const execPath = process.argv[1][0];
  const execPath = "aha 1-9,11-20";
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

const createWindow = (() => {
  let curid = 0;
  return () => {
    const id = curid++;
    const win = new BrowserWindow({
      ...basicConfig,
      width: cardSize,
      height: cardSize,
      icon: __dirname + "/favicon.ico",
      webPreferences: {
        preload: __dirname + "/interface/scripts/preload.js",
      },
    });
    win.loadFile("interface/index.html");
    win.webContents.on("did-finish-load", () =>
      win.webContents.send("startup-params", { list, id })
    );
    windows.push({ id, win });
    // win.webContents.openDevTools();
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
  createWindow();
  ipcMain.on("close", (_, id) => {
    const index = windows.findIndex((win) => win.id === id);
    if (index === -1) console.warn("Window not found: " + id);
    windows[index].win.close();
    windows.splice(index, 1);
  });
});

app.on("window-all-closed", () => {});
