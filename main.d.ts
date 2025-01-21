declare const app: Electron.App, BrowserWindow: typeof Electron.CrossProcessExports.BrowserWindow, Menu: typeof Electron.CrossProcessExports.Menu, Tray: typeof Electron.CrossProcessExports.Tray, escreen: Electron.Screen, ipcMain: Electron.IpcMain;
declare const basicConfig: {
    readonly transparent: true;
    readonly frame: false;
    readonly resizable: false;
    readonly alwaysOnTop: true;
    readonly skipTaskbar: true;
};
declare const cardSize = 260;
declare const generateList: () => number[] | undefined;
declare const list: number[] | undefined;
declare const windows: {
    id: number;
    win: Electron.CrossProcessExports.BrowserWindow;
}[];
declare const createButton: () => void, closeButton: () => void;
declare const createWindow: () => void;
declare const createTray: () => void;
