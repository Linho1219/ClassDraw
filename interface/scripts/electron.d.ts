declare global {
  interface Window {
    electron: {
      getStartupParams: () => string[];
    };
  }
}

export {};
