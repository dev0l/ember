@echo off
echo === Downloading Eclipse Temurin JDK 17 (no admin needed) ===

set JDK_DIR=C:\Users\marcu\.jdk\temurin-17
set JDK_ZIP=C:\Users\marcu\.jdk\temurin17.zip

if exist "%JDK_DIR%\bin\java.exe" (
    echo JDK 17 already exists at %JDK_DIR%
    "%JDK_DIR%\bin\java.exe" -version
    goto :end
)

mkdir C:\Users\marcu\.jdk 2>nul

echo Downloading from Adoptium API...
curl -L -o "%JDK_ZIP%" "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"

if not exist "%JDK_ZIP%" (
    echo ERROR: Download failed.
    goto :end
)

echo Extracting...
powershell -Command "Expand-Archive -Path '%JDK_ZIP%' -DestinationPath 'C:\Users\marcu\.jdk' -Force"

echo Finding extracted directory...
for /d %%i in (C:\Users\marcu\.jdk\jdk-17*) do (
    echo Found: %%i
    if not "%%i"=="%JDK_DIR%" (
        ren "%%i" temurin-17
    )
)

if exist "%JDK_DIR%\bin\java.exe" (
    echo SUCCESS: JDK 17 installed at %JDK_DIR%
    "%JDK_DIR%\bin\java.exe" -version
) else (
    echo ERROR: java.exe not found after extraction
    dir /b C:\Users\marcu\.jdk
)

del "%JDK_ZIP%" 2>nul

:end
