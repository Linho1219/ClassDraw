/// <reference path="./electron.d.ts" />
{
  const { ipcRenderer } = require("electron");

  window.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("button")!;
    let active = false;
    let timer: NodeJS.Timeout | false = false;

    const activate = () => {
      button.classList.add("active");
      active = true;
    };

    const deactivate = () => {
      button.classList.remove("active");
      active = false;
      if (timer) {
        clearTimeout(timer);
        timer = false;
      }
    };

    button.onclick = () => {
      if (active) {
        ipcRenderer.send("create-window");
        deactivate();
      } else {
        activate();
        if (timer) clearTimeout(timer);
        timer = setTimeout(deactivate, 2000);
      }
    };
  });
}
