/// <reference path="./electron.d.ts" />
const { contextBridge, ipcRenderer } = require("electron");

const $ = (selector: string) =>
  document.getElementById(selector) ?? document.querySelector(selector);

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

Promise.all([ipcParamsPromise, contentLoadPromise]).then(([list]) => {
  console.log(list);
  (<HTMLButtonElement>$("drawBtn")).disabled = false;
  
});
