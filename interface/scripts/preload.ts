/// <reference path="./electron.d.ts" />
const { ipcRenderer } = require("electron");

const $ = (selector: string) =>
  document.getElementById(selector) ?? document.querySelector(selector);
const sleep = async (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const ipcParamsPromise = new Promise<{ list: number[]; id: number }>(
  (resolve) => {
    ipcRenderer.on("startup-params", (_event, args) => {
      resolve(args);
    });
  }
);
const contentLoadPromise = new Promise<void>((resolve) => {
  window.addEventListener("DOMContentLoaded", () => {
    resolve();
  });
});

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

Promise.all([ipcParamsPromise, contentLoadPromise]).then(([{ list, id }]) => {
  console.log(list);
  console.log(id);

  const numbers = $("num");
  const button = <HTMLButtonElement>$("drawBtn");
  const music = <HTMLAudioElement>$("music");
  const bell = <HTMLAudioElement>$("bell");

  button.disabled = false;
  numbers.innerHTML =
    "<span>--</span>" + list.map((item) => `<span>${item}</span>`).join("");

  button.onclick = async () => {
    const result = getRand(list);
    numbers.style.top = -result * 130 + "px";
    music.play();
    button.disabled = true;
    await sleep(1500);
    music.pause();
    music.currentTime = 0;
    bell.play();
    button.disabled = false;
  };
  $("close").onclick = async () => {
    $('body').style.opacity = '0';
    await sleep(150);
    ipcRenderer.send("close", id);
  };
});
