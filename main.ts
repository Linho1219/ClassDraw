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

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: __dirname + "/assets/favicon.ico",
    webPreferences: {
      preload: __dirname + "/interface/scripts/preload.js",
    },
  });
  win.loadFile("interface/index.html");

  const args = process.argv.slice(1)
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('startup-params', args)
  })

  win.webContents.openDevTools();
};

app.whenReady().then(() => {
  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
  const tray = new Tray(__dirname + "/assets/favicon.ico");
  tray.setToolTip("抽号机");
  tray.setContextMenu(contextMenu);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
