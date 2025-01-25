type StoreConstructor = new () => {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
};

type WindowCfg = {
  /** 抽号窗口边长（不含边距） */
  cardSize: number;
  /** 窗口边距 */
  margin: number;
  /** “关于”窗口大小 */
  aboutSize: [number, number];
  /** “指南”窗口大小 */
  guideSize: [number, number];
  /** 侧边按钮大小 */
  buttonSize: [number, number];
  /** 侧边按钮默认相对位置，0 为顶部，1 为底部 */
  defaultButtonPos: number;
};

type ScreenUtil = {
  init: (this: ScreenUtil) => void;
  width: number;
  height: number;
};
