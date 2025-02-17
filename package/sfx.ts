import fs from "node:fs";
import os from "node:os";
import iconv from "iconv-lite";
import jschardet from "jschardet";
import { execSync } from "node:child_process";

const nsiPath = "./package/pack.nsi";
const nsiTempPath = "./package/pack.temp.nsi";

const packageJSON = JSON.parse(fs.readFileSync("./package.json", "utf8"));

const nsiBuffer = fs.readFileSync(nsiPath);
const nsiEncoding = jschardet.detect(nsiBuffer).encoding;
const nsiContent = iconv.decode(nsiBuffer, nsiEncoding);

const updatedNsiContent = nsiContent.replace(
  /!define VERSION .+(?=\r?\n)/,
  `!define VERSION "${packageJSON.version}"`
);

fs.writeFileSync(
  nsiTempPath,
  os.platform() === "win32"
    ? iconv.encode(updatedNsiContent, "gbk")
    : updatedNsiContent
);
console.log("Running makensis to build SFX...");
execSync(`makensis ${nsiTempPath}`);
console.log("SFX built successfully.");
fs.unlinkSync(nsiTempPath);
