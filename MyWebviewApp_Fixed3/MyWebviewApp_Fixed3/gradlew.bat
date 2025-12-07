@echo off
set DEFAULT_JVM_OPTS=
set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.
set CLASSPATH=%DIRNAME%gradle\wrapper\gradle-wrapper.jar

set JAVA_EXE=java.exe
if defined JAVA_HOME (
  set JAVA_EXE=%JAVA_HOME%\bin\java.exe
)

"%JAVA_EXE%" %DEFAULT_JVM_OPTS% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
