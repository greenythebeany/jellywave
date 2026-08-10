@echo off
REM One-shot Android release build. Works from cmd.exe or PowerShell.
REM Sets JAVA_HOME (JDK 21 -- some Capacitor libs target Java 21 bytecode,
REM which an older JDK 17 compiler physically can't produce) and TEMP/TMP
REM (the non-ASCII username in the default Windows temp path breaks the
REM JDK's loopback selector pipe on this machine) for this process only --
REM no permanent system changes.

set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "TEMP=C:\jtmp"
set "TMP=C:\jtmp"
if not exist "%TEMP%" mkdir "%TEMP%"

call "%~dp0gradlew.bat" assembleRelease
