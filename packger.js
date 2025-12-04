const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config');

function updateAppName(appName) {
    const manifestPath = config.paths.manifest;
    let content = fs.readFileSync(manifestPath, 'utf8');

    content = content.replace(/android:label="[^"]*"/,
        `android:label="${appName}"`);

    fs.writeFileSync(manifestPath, content);
}

function updatePackageName(packageName) {
    const manifest = config.paths.manifest;
    let content = fs.readFileSync(manifest, 'utf8');

    content = content.replace(/package="[^"]*"/,
        `package="${packageName}"`);

    fs.writeFileSync(manifest, content);
}

function updateAdjust(appToken, events) {
    const mainActivity = findMainActivity();
    let code = fs.readFileSync(mainActivity, 'utf8');

    code = code.replace(/new AdjustConfig\(.*?\);/s,
        `new AdjustConfig(this, "${appToken}", AdjustConfig.ENVIRONMENT_PRODUCTION);`
    );

    let eventCode = "";
    for (const key in events) {
        eventCode += `
            AdjustEvent event_${key} = new AdjustEvent("${events[key]}");
            Adjust.trackEvent(event_${key});
        `;
    }

    code = code.replace(
        /\/\/\[ADJUST_EVENTS_BEGIN\][\s\S]*?\/\/\[ADJUST_EVENTS_END\]/,
        `//[ADJUST_EVENTS_BEGIN]
         ${eventCode}
         //[ADJUST_EVENTS_END]`
    );

    fs.writeFileSync(mainActivity, code);
}

function findMainActivity() {
    const javaDir = config.paths.mainActivity;
    let file = '';

    function search(dir) {
        const list = fs.readdirSync(dir);
        for (const item of list) {
            const p = path.join(dir, item);
            if (fs.statSync(p).isDirectory()) {
                search(p);
            } else if (item === "MainActivity.java") {
                file = p;
            }
        }
    }

    search(javaDir);
    return file;
}

function buildAPK(callback) {
    exec(`cd ${config.androidProjectPath} && ./gradlew assembleRelease`, 
    (err, stdout, stderr) => {
        console.log(stdout);
        if (err) {
            console.log(stderr);
            callback(false);
            return;
        }

        const apkPath = `${config.androidProjectPath}/app/build/outputs/apk/release/app-release.apk`;
        const outputPath = `./builds/app-${Date.now()}.apk`;

        fs.copyFileSync(apkPath, outputPath);
        callback(outputPath);
    });
}

module.exports = {
    updateAppName,
    updatePackageName,
    updateAdjust,
    buildAPK
};
