# backend-build-server

功能：
- 上传 firebase json (/api/upload/firebase)
- 上传 icon (/api/upload/icon)
- 发起构建 /api/build
- 查询构建状态 /api/status/:jobId
- 下载生成的 apk 在 /downloads/<apk>

部署：
1. 准备模板：把你的 `MyWebviewApp_Fixed3` 放到 `template/MyWebviewApp_Fixed3`
2. 准备 keystore：把 keystore 放到宿主机并在 docker-compose.yml 挂载到 /keystore
3. 修改 environment 里的 KEYSTORE_PASS 与 KEY_ALIAS 或使用 secret 管理
4. 构建与启动：
   docker build -t backend-build-server:1.0 .
   docker run -p 3000:3000 -v $(pwd)/template:/app/template -v $(pwd)/uploads:/app/uploads -v $(pwd)/temp:/app/temp -v /path/to/keystore:/keystore -e KEYSTORE_PATH=/keystore/keystore.jks -e KEYSTORE_PASS=pass -e KEY_ALIAS=myalias backend-build-server:1.0

示例构建流程：
1. 上传 firebase.json:
   curl -F "firebase=@/path/to/google-services.json" http://localhost:3000/api/upload/firebase
   -> 返回 { path: "uploads/firebase/..." }

2. 上传 icon:
   curl -F "icon=@/path/to/icon.png" http://localhost:3000/api/upload/icon
   -> 返回 { path: "uploads/icons/..." }

3. 发起构建:
   POST http://localhost:3000/api/build
   body:
   {
     "appName":"My App",
     "webUrl":"https://example.com",
     "packageName":"com.example.app",
     "adjustToken":"abcd",
     "eventToken":"evt",
     "firebasePath":"uploads/firebase/xxxx.json",
     "iconPath":"uploads/icons/yyyy.png"
   }

4. 查询:
   GET http://localhost:3000/api/status/<jobId>

5. 下载:
   http://localhost:3000/downloads/<apk-file>
