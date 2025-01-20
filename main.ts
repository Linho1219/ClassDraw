/// <reference path="node_modules/electron/electron.d.ts" />

const { app, BrowserWindow, Menu, Tray } = require("electron");
// Electron 的 ESM 支持始于 v28.0.0，因此只能 require

const trayMenuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: "打开",
    click: () => {},
  },
  {
    label: "退出",
    click: () => {
      app.quit();
    },
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
  // win.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
