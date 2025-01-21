/// <reference path="./electron.d.ts" />
{
  const { ipcRenderer } = require("electron");

  const $ = (selector: string) =>
    <HTMLElement>(
      (document.getElementById(selector) ?? document.querySelector(selector))
    );
  const sleep = async (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms));

  const ipcParamsPromise = new Promise<{ list: number[]; id: number }>(
    (resolve) =>
      ipcRenderer.on("startup-params", (_event, args) => {
        resolve(args);
      })
  );
  const contentLoadPromise = new Promise<void>((resolve) =>
    window.addEventListener("DOMContentLoaded", () => {
      resolve();
    })
  );

  const getRand = (() => {
    let lastRand = -1;
    return (list: number[]) => {
      let num: number;
      do {
        num = Math.floor(Math.random() * list.length);
      } while (num === lastRand);
      lastRand = num;
      return num;
    };
  })();

  const autioInit = () => {
    const music = new Audio("assets/music.wav");
    const bell = new Audio("assets/bell.wav");
    const audioContext = new window.AudioContext();
    audioContext
      .createMediaElementSource(music)
      .connect(audioContext.destination);
    audioContext
      .createMediaElementSource(bell)
      .connect(audioContext.destination);
    return { music, bell };
  };

  Promise.all([ipcParamsPromise, contentLoadPromise]).then(([{ list, id }]) => {
    console.log(list);
    console.log(id);

    const numbers = $("num");
    const ripple = $("ripple");
    const button = <HTMLButtonElement>$("drawBtn");

    const { music, bell } = autioInit();

    numbers.innerHTML =
      "<span>--</span>" + list.map((item) => `<span>${item}</span>`).join("");

    button.onmousedown = async (event) => {
      const result = getRand(list) + 1;
      numbers.style.top = -result * 130 + "px";
      music.play();
      button.disabled = true;
      console.log(event.x, event.y);
      ripple.style.top = event.y - button.offsetTop - 10 + "px";
      ripple.style.left = event.x - button.offsetLeft - 10 + "px";
      await sleep(1500);
      music.pause();
      music.currentTime = 0;
      bell.play();
      button.disabled = false;
    };
    $("close").onclick = async () => {
      ipcRenderer.send("close", id);
      document.body.style.opacity = "0";
    };
  });
}
