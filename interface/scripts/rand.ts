const { ipcRenderer } = require("electron");

function $(selector: string) {
  const e =
    document.getElementById(selector) ?? document.querySelector(selector);
  if (!e) throw new ReferenceError(`Element not found: ${selector}`);
  return e;
}
const sleep = async (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const ipcParamsPromise = new Promise<{
  list: number[];
  id: number;
  mute: boolean;
}>((resolve) =>
  ipcRenderer.on("startup-params", (_event, args) => resolve(args))
);
const contentLoadPromise = new Promise<void>((resolve) =>
  window.addEventListener("DOMContentLoaded", () => resolve())
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

const autioInit = (mute: boolean) => {
  const names = ["music", "bell"] as const;
  const audioContext = new window.AudioContext();
  const audios = names.reduce((acc, name) => {
    const audio = new Audio(`assets/${name}.mp3`);
    audioContext
      .createMediaElementSource(audio)
      .connect(audioContext.destination);
    audio.muted = mute;
    acc[name] = audio;
    return acc;
  }, {} as Record<(typeof names)[number], HTMLAudioElement>);
  return audios;
};

Promise.all([ipcParamsPromise, contentLoadPromise]).then(
  ([{ list, id, mute }]) => {
    console.log(list);
    console.log(id);

    const numbers = $("num");
    const ripple = $("ripple");
    const button = <HTMLButtonElement>$("drawBtn");

    const { music, bell } = autioInit(mute);

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
      bell.play();
      button.disabled = false;
    };
    $("close").onclick = () => {
      ipcRenderer.send("close", id);
      document.body.style.opacity = "0";
    };
    ipcRenderer.on("mute", (_event, mute) => {
      music.muted = bell.muted = mute;
    });
  }
);

export = {};
