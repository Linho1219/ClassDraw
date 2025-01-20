import fs from "fs";
import path from "path";

const localeDir = "./out/ClassDraw-win32-x64/locales";

fs.readdir(localeDir, (err, files) => {
  if (err) {
    console.error("Error reading locales directory: ", err);
    return;
  }
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
});
