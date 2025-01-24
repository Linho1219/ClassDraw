import packager from "@electron/packager";
import fs from "fs";
import path from "path";
import iconv from "iconv-lite";

const localeDir = "./out/ClassDraw-win32-x64/locales";
const nsiPath = "./package/pack.nsi";

const packageJSON = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const nsiContent = iconv.decode(fs.readFileSync(nsiPath), "GBK");
const updatedNsiContent = nsiContent.replace(
  /!define VERSION .+(?=\r?\n)/,
  `!define VERSION "${packageJSON.version}"`
);
fs.writeFileSync(nsiPath, iconv.encode(updatedNsiContent, "GBK"));

console.log(`Updated NSIS script with version ${packageJSON.version}.`);

packager({
  dir: "./",
  out: "./out",
  icon: "./favicon.ico",
  platform: "win32",
  arch: "x64",

  name: "ClassDraw",
  appCopyright: "Copyright (c) 2025 Linho. MIT License.",
  win32metadata: {
    CompanyName: "Linho",
    FileDescription: "课堂抽号小工具",
    OriginalFilename: "ClassDraw.exe",
    ProductName: "ClassDraw 抽号机",
  },

  overwrite: true,
  asar: true,
  ignore: [
    /\.ts$/,
    /\.map$/,
    /tsconfig\.json$/,
    /\.gitignore$/,
    /\/package$/,
    /\.vscode$/,
  ],
}).then((appPaths) => {
  const files = fs.readdirSync(localeDir);
  files.forEach((file) => {
    const filePath = path.join(localeDir, file);
    const extname = path.extname(file);
    if (extname === ".pak") {
      const locale = path.basename(file, extname);
      if (!(locale.startsWith("en") || locale.startsWith("zh"))) {
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Error deleting file ${file}:`, err);
        });
      }
    }
  });
	console.log(`Electron app bundle created at: ${appPaths.join("\n  ")}`);
});
