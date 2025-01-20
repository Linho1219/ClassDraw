/// <reference path="node_modules/electron/electron.d.ts" />

const { app, BrowserWindow, Menu, Tray } = require("electron");
// Electron 的 ESM 支持始于 v28.0.0，因此只能 require

const trayMenuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: "ClassDraw",
    enabled: false,
  },
  { type: "separator" },
  {
    label: "退出",
    click: () => app.quit(),
  },
];

const createTray = () => {
  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
  const tray = new Tray(__dirname + "/favicon.ico");
  tray.setToolTip("抽号机");
  tray.setContextMenu(contextMenu);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 310,
    height: 310,
    icon: __dirname + "/favicon.ico",
    transparent: true,
    frame: false,
    resizable:false,
    alwaysOnTop: true,
    webPreferences: {
      preload: __dirname + "/interface/scripts/preload.js",
    },
  });
  win.loadFile("interface/index.html");

  win.webContents.openDevTools();

  return win;
};

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

app.whenReady().then(() => {
  const list = generateList();
  createTray();
  const win = createWindow();
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("startup-params", list);
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
