@echo off
REM ASCII only on purpose: cmd.exe parses .cmd files in the OEM codepage,
REM so Chinese text here would render as garbage on most Windows machines.
REM The Chinese instructions live in README.md instead.

set REPO=FanFantom9452/YouTube-Short-Limiter

echo.
echo   YouTube Shorts break reminder - installer
echo.
echo   [1/3] Opening the Tampermonkey store page.
echo         Click "Add to Chrome". Already installed? Just close the tab.
start "" "https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo"
echo.
echo   Press any key once Tampermonkey is installed...
pause >nul

echo.
echo   [2/3] REQUIRED - Chrome will block the install without this.
echo         Type chrome://extensions in the address bar, then:
echo           a. Turn on "Developer mode"        (top right)
echo           b. Tampermonkey - Details - turn on "Allow user scripts"
echo           c. Site access: set to "On all sites"
echo.
echo   Press any key once all three are done...
pause >nul

echo.
echo   [3/3] Opening the script. Click "Install" on the Tampermonkey page.
start "" "https://raw.githubusercontent.com/%REPO%/main/shorts-limiter.user.js"

echo.
echo   Done. Open any youtube.com/shorts/ video to start.
echo.
pause
