{
  const { ipcRenderer } = require("electron");

  const $ = (selector: string) =>
    <HTMLElement>(
      (document.getElementById(selector) ?? document.querySelector(selector))
    );

  window.addEventListener("DOMContentLoaded", async () => {
    (<NodeListOf<HTMLSpanElement>>(
      document.querySelectorAll("span.link[href]")
    )).forEach((ele) => {
      ele.onclick = () => {
        ipcRenderer.send("open-url", ele.getAttribute("href"));
      };
    });
    $("close").onclick = () => {
      ipcRenderer.send("close", document.body.getAttribute("type"));
      document.body.style.opacity = "0";
    };
    if (document.body.getAttribute("type") === "about") {
      const version = await ipcRenderer.invoke("get-app-version");
      $("version").innerText = version;
      $("app-version").innerText = version;
      $("electron-version").innerText = process.versions.electron;
      $("chromium-version").innerText = process.versions.chrome;
      $("node-version").innerText = process.versions.node;
    }
  });
}
