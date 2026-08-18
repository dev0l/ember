@echo off
set JAVA_HOME=C:\Users\marcu\.jdk\temurin-17
set ANDROID_HOME=C:\Users\marcu\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%;%ANDROID_HOME%\platform-tools

echo === Stopping all Gradle daemons ===
cd android
call gradlew.bat --stop 2>nul
cd ..
echo.

echo === Cleaning build caches ===
if exist "android\.gradle" rmdir /s /q "android\.gradle"
if exist "android\build" rmdir /s /q "android\build"
if exist "android\app\build" rmdir /s /q "android\app\build"
echo Cleaned.
echo.

echo === Running Expo Android build ===
npx expo run:android --no-install
