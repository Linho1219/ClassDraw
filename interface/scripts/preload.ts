/// <reference path="./electron.d.ts" />
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  getStartupParams: () => ipcRenderer.invoke("get-startup-params"),
});

const ipcParamsPromise = new Promise<string[]>((resolve) => {
  ipcRenderer.on("startup-params", (_event, args) => {
    resolve(args);
  });
});

const contentLoadPromise = new Promise<void>((resolve) => {
  window.addEventListener("DOMContentLoaded", () => {
    resolve();
  });
});

Promise.all([ipcParamsPromise, contentLoadPromise]).then(([args]) => {
  const replaceText = (selector: string, text: string = "") => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }

  document.getElementById("args").innerText = JSON.stringify(args);
});
