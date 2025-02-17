import packager from "@electron/packager";
import fs from "node:fs";
import path from "node:path";

const localeDir = "./out/ClassDraw-win32-x64/locales";

const cacheDir = "./cache";

const packageJSON = JSON.parse(fs.readFileSync("./package.json", "utf8"));

const cacheFileName = `electron-v${(<string>(
  packageJSON.devDependencies.electron
)).replace(/^\^/, "")}-win32-x64.zip`;
const cacheExists = fs.existsSync(path.join(cacheDir, cacheFileName));

packager({
  dir: "./",
  out: "./out",
  icon: "./favicon.ico",
  platform: "win32",
  arch: "x64",
  electronZipDir: cacheExists ? cacheDir : undefined,

  name: "ClassDraw",
  appCopyright: "Copyright (c) 2025 Linho. MIT License.",
  win32metadata: {
    CompanyName: "Linho",
    ProductName: "ClassDraw 抽号机",
    FileDescription: "ClassDraw 抽号机",
    OriginalFilename: "ClassDraw.exe",
  },

  overwrite: true,
  asar: true,
  ignore: [
    /\.ts$/,
    /\.map$/,
    /tsconfig\.json$/,
    /\.gitignore$/,
    /\/package$/,
    /\/cache$/,
    /\/misc$/,
    /\.vscode$/,
  ],
}).then((appPaths) => {
  const files = fs.readdirSync(localeDir);
  files.forEach((file) => {
    const filePath = path.join(localeDir, file);
    const extname = path.extname(file);
    if (extname === ".pak") {
      const locale = path.basename(file, extname);
      if (!(locale.startsWith("en") || locale.startsWith("zh")))
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Error deleting file ${file}:`, err);
        });
    }
  });
  console.log(`Electron app bundle created at: ${appPaths.join("\n  ")}`);
});
