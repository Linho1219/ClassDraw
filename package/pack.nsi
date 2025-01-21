!define OUTPUT_FILE "ClassDraw 1-50.exe"
; NSIS Script only supports GBK encoding
; For compatibility reasons, avoid using non-ASCII characters

OutFile "..\out\${OUTPUT_FILE}"
Icon "..\favicon.ico"

RequestExecutionLevel user
SetCompressor /SOLID zlib
SilentInstall silent

Section
  SetSilent silent
  StrCpy $0 "$EXEPATH"
  ; Path to the SFX will be stored in $0 and later be passed to the executable

  CreateDirectory $TEMP\ClassDraw

  SetOutPath $TEMP\ClassDraw
  File /r "..\out\ClassDraw-win32-x64\*.*"

  Exec '"$TEMP\ClassDraw\ClassDraw.exe" "$0"'

  Quit
SectionEnd
