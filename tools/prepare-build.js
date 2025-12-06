/**
 * prepare-build.js
 * 自动根据 buildConfig.json 修改 Android 工程
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = "./MyWebviewApp_Fixed3/MyWebviewApp_Fixed3";
const CONFIG_PATH = "./config/buildConfig.json";

// 工具：替换文件内容
function replaceInFile(file, search, replace) {
    let data = fs.readFileSync(file, "utf8");
    const newData = data.replace(new RegExp(search, "g"), replace);
    fs.writeFileSync(file, newData);
}

// 工具：确保目录存在
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function main() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.log("❌ buildConfig.json 未找到");
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH));

    const {
        appName,
        packageName,
        h5Url,
        appIconBase64,
        firebaseJsonBase64,
        adjustToken,
        adjustEvents
    } = config;

    console.log("🚀 开始处理 Android 构建配置…");
    console.log("📄 读取 buildConfig.json 成功");
    console.log(config);

    // ===============================
    // 1. 修改 APP 名称（strings.xml）
    // ===============================
    const stringsXml = `${PROJECT_ROOT}/app/src/main/res/values/strings.xml`;

    replaceInFile(
        stringsXml,
        `<string name="app_name">.*</string>`,
        `<string name="app_name">${appName}</string>`
    );

    console.log("✔ 已更新 app 名称");

    // ===============================
    // 2. 修改包名（移动文件夹 + Gradle）
    // ===============================
    if (packageName) {
        console.log("📦 开始修改包名…");

        const oldPackagePath = `${PROJECT_ROOT}/app/src/main/java/com/go606/br33`;
        const newPackagePath = `${PROJECT_ROOT}/app/src/main/java/${packageName.replace(/\./g, "/")}`;

        ensureDir(newPackagePath);

        // 移动 Java 文件
        fs.readdirSync(oldPackagePath).forEach(file => {
            fs.renameSync(
                path.join(oldPackagePath, file),
                path.join(newPackagePath, file)
            );
        });

        console.log(`✔ 已移动 Java 文件至新包路径：${newPackagePath}`);

        const buildGradle = `${PROJECT_ROOT}/app/build.gradle`;
        replaceInFile(buildGradle, `applicationId ".*"`, `applicationId "${packageName}"`);

        console.log("✔ 已更新 applicationId");
    }

    // ===============================
    // 3. H5 链接注入（MainActivity.java）
    // ===============================
    const mainActivity = `${PROJECT_ROOT}/app/src/main/java/${packageName.replace(/\./g, "/")}/MainActivity.java`;
    replaceInFile(
        mainActivity,
        `String BASE_URL = ".*";`,
        `String BASE_URL = "${h5Url}";`
    );

    console.log("✔ 已注入 H5 URL");

    // ===============================
    // 4. 写入 Adjust Token（MyApp.java）
    // ===============================
    const myAppFile = `${PROJECT_ROOT}/app/src/main/java/${packageName.replace(/\./g, "/")}/MyApp.java`;

    replaceInFile(
        myAppFile,
        `String ADJUST_TOKEN = ".*";`,
        `String ADJUST_TOKEN = "${adjustToken}";`
    );

    console.log("✔ 已注入 Adjust 主 Token");

    // ===============================
    // 5. 写入 Adjust 事件 Token（JsInterface.java）
    // ===============================
    const jsInterface = `${PROJECT_ROOT}/app/src/main/java/${packageName.replace(/\./g, "/")}/JsInterface.java`;

    Object.keys(adjustEvents).forEach(eventKey => {
        replaceInFile(
            jsInterface,
            `${eventKey} = ".*";`,
            `${eventKey} = "${adjustEvents[eventKey]}";`
        );
    });

    console.log("✔ 已写入 Adjust 事件 Tokens");

    // ===============================
    // 6. 写入 google-services.json
    // ===============================
    if (firebaseJsonBase64) {
        const firebasePath = `${PROJECT_ROOT}/app/google-services.json`;
        fs.writeFileSync(firebasePath, Buffer.from(firebaseJsonBase64, "base64"));
        console.log("✔ google-services.json 已写入");
    }

    // ===============================
    // 7. 替换 App 图标（覆盖所有 mipmap）
    // ===============================
    if (appIconBase64) {
        console.log("🎨 开始替换 APP 图标…");

        const iconBuffer = Buffer.from(appIconBase64, "base64");

        const mipmapFolders = [
            "mipmap-hdpi",
            "mipmap-mdpi",
            "mipmap-xhdpi",
            "mipmap-xxhdpi",
            "mipmap-xxxhdpi"
        ];

        mipmapFolders.forEach(folder => {
            const dest = `${PROJECT_ROOT}/app/src/main/res/${folder}/ic_launcher.png`;
            if (fs.existsSync(dest)) {
                fs.writeFileSync(dest, iconBuffer);
            }
        });

        console.log("✔ 图标替换完成");
    }

    console.log("🎉 Android 工程预处理完成！");
}

main();
