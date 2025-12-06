/**
 * prepare-build.js (final version for your project)
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
        webUrl,
        adjustToken,
        adjustEvents,
        appIconBase64,
        firebaseJsonBase64
    } = config;

    console.log("🚀 prepare-build.js 开始运行");
    console.log(config);

    // =========================================
    // 1. 修改 APP 名称（strings.xml）
    // =========================================
    const stringsXml = `${PROJECT_ROOT}/app/src/main/res/values/strings.xml`;

    replaceInFile(
        stringsXml,
        `<string name="backend_app_name">.*</string>`,
        `<string name="backend_app_name">${appName}</string>`
    );

    replaceInFile(
        stringsXml,
        `<string name="backend_web_url">.*</string>`,
        `<string name="backend_web_url">${webUrl}</string>`
    );

    replaceInFile(
        stringsXml,
        `<string name="backend_adjust_token">.*</string>`,
        `<string name="backend_adjust_token">${adjustToken}</string>`
    );

    console.log("✔ strings.xml 修改完毕");

    // =========================================
    // 2. 替换 MyApp.java 的 Adjust Token
    // =========================================
    const myAppPath = `${PROJECT_ROOT}/app/src/main/java/${packageName.replace(/\./g, "/")}/MyApp.java`;

    replaceInFile(
        myAppPath,
        `String appToken = ".*";`,
        `String appToken = "${adjustToken}";`
    );

    console.log("✔ 已更新 MyApp.java Adjust Token");

    // =========================================
    // 3. 替换 JsInterface.java Adjust Event Tokens
    // =========================================
    const jsInterface = `${PROJECT_ROOT}/app/src/main/java/${packageName.replace(/\./g, "/")}/JsInterface.java`;

    Object.keys(adjustEvents).forEach(eventKey => {
        replaceInFile(
            jsInterface,
            `${eventKey}\\s*=\\s*".*";`,
            `${eventKey} = "${adjustEvents[eventKey]}";`
        );
    });

    console.log("✔ 已更新 JsInterface.java Adjust Event Tokens");

    // =========================================
    // 4. 写入 google-services.json
    // =========================================
    if (firebaseJsonBase64) {
        const firebasePath = `${PROJECT_ROOT}/app/google-services.json`;
        fs.writeFileSync(firebasePath, Buffer.from(firebaseJsonBase64, "base64"));
        console.log("✔ google-services.json 写入完毕");
    }

    // =========================================
    // 5. 替换 APP 图标
    // =========================================
    if (appIconBase64) {
        const iconBuffer = Buffer.from(appIconBase64, "base64");

        const mipmapFolders = [
            "mipmap-hdpi",
            "mipmap-mdpi",
            "mipmap-xhdpi",
            "mipmap-xxhdpi",
            "mipmap-xxxhdpi"
        ];

        mipmapFolders.forEach(folder => {
            const iconPath = `${PROJECT_ROOT}/app/src/main/res/${folder}/ic_launcher.png`;
            if (fs.existsSync(iconPath)) {
                fs.writeFileSync(iconPath, iconBuffer);
            }
        });

        console.log("✔ APP 图标替换完毕");
    }

    console.log("🎉 prepare-build.js 完成全部处理！");
}

main();
