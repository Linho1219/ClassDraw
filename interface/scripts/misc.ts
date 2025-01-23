{
  const { ipcRenderer, shell } = require("electron");

  window.addEventListener("DOMContentLoaded", () => {
    (<NodeListOf<HTMLSpanElement>>(
      document.querySelectorAll("span.link[href]")
    )).forEach((ele) => {
      ele.onclick = () => {
        ipcRenderer.send("open-url", ele.getAttribute("href"));
      };
    });
    document.getElementById("close")!.onclick = () => {
      ipcRenderer.send("close", document.body.getAttribute("type"));
      document.body.style.opacity = "0";
    };
  });
}
