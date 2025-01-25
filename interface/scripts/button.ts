const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("button")!;
  let active = false;
  let timer: NodeJS.Timeout | false = false;

  const activate = () => {
    if (active) return;
    button.classList.add("active");
    active = true;
  };

  const deactivate = () => {
    if (!active) return;
    button.classList.remove("active");
    active = false;
    if (timer) {
      clearTimeout(timer);
      timer = false;
    }
  };

  let inputHandling = false;
  const handleStart = (event: PointerEvent | TouchEvent) => {
    if (inputHandling) return;
    const isTouch = "touches" in event;
    if (!isTouch && event.pointerType === "touch") return;

    const { screenX: sx, screenY: sy } = isTouch ? event.touches[0] : event;
    let [x, y] = [sx, sy];
    const startTime = event.timeStamp;

    const click = () => {
      if (active) {
        ipcRenderer.send("create-window");
        deactivate();
      } else {
        activate();
        if (timer) clearTimeout(timer);
        timer = setTimeout(deactivate, 2000);
      }
    };

    let moving = false;
    const move = (event: PointerEvent | TouchEvent) => {
      ({ screenX: x, screenY: y } =
        "pointerType" in event ? event : event.touches[0]);
      const [dx, dy] = [x - sx, y - sy];
      if (Math.abs(dy) > 10 && !moving) {
        moving = true;
        document.body.classList.add("drag");
        ipcRenderer.send("movebuttonstart", { sx, sy });
        deactivate();
      }
      ipcRenderer.send("movebutton", { dx, dy });
    };

    const up = (event: PointerEvent | TouchEvent) => {
      document.body.classList.remove("drag");
      if (isTouch) {
        document.removeEventListener("touchmove", move);
        document.removeEventListener("touchend", up);
      } else {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      }
      const [dx, dy] = [x - sx, y - sy];
      const timeDiff = event.timeStamp - startTime;
      if (timeDiff < 200 && Math.abs(dy) < 10) {
        click();
        ipcRenderer.send("movebuttonend", { dx: 0, dy: 0 });
      } else ipcRenderer.send("movebuttonend", { dx, dy });
      inputHandling = false;
    };

    if (isTouch) {
      document.addEventListener("touchmove", move);
      document.addEventListener("touchend", up);
    } else {
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    }
  };

  document.addEventListener("pointerdown", handleStart);
  document.addEventListener("touchstart", handleStart);
});

export = {};
