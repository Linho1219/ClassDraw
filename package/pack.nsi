; NSIS 不支持 UTF-8，故该文件使用 GBK。如果你看到乱码，请检查你的编辑器设置。
; This script is encoded in GBK, as NSIS do not support UTF-8 encoding.
; If you see garbled text, check your editor settings.

!define VERSION "1.0"
!define OUTPUT_FILE "ClassDraw 1-50.exe"

OutFile "..\out\${OUTPUT_FILE}"
Icon "..\favicon.ico"

RequestExecutionLevel user
SetCompressor /SOLID zlib
SilentInstall silent

VIProductVersion "${VERSION}.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "ClassDraw 抽号机"
VIAddVersionKey /LANG=2052 "CompanyName" "Linho"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Copyright (c) 2025 Linho. MIT License."
VIAddVersionKey /LANG=2052 "FileDescription" "课堂抽号小工具"
VIAddVersionKey /LANG=2052 "OriginalFilename" "ClassDraw.exe"
VIAddVersionKey /LANG=2052 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=2052 "FileVersion" "${VERSION}"

Section
  SetSilent silent
  StrCpy $0 "$EXEPATH"
  CreateDirectory $TEMP\ClassDraw
  SetOutPath $TEMP\ClassDraw
  File /r "..\out\ClassDraw-win32-x64\*.*"
  Exec '"$TEMP\ClassDraw\ClassDraw.exe" "$0"'
  Quit
SectionEnd
