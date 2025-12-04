const express = require('express');
const multer = require('multer');
const packger = require('./packger');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Android Build Server is running!");
});

app.post("/config/update", (req, res) => {
    const { appName, packageName, adjustToken, adjustEvents } = req.body;

    if (appName) packger.updateAppName(appName);
    if (packageName) packger.updatePackageName(packageName);
    if (adjustToken) packger.updateAdjust(adjustToken, adjustEvents || {});

    res.send({ success: true });
});

app.post("/upload/icon", upload.single("file"), (req, res) => {
    const fs = require('fs');
    const config = require('./config');

    fs.copyFileSync(req.file.path, config.paths.appIcon);
    res.send({ success: true });
});

app.post("/upload/google", upload.single("file"), (req, res) => {
    const fs = require('fs');
    const config = require('./config');

    fs.copyFileSync(req.file.path, config.paths.googleJson);
    res.send({ success: true });
});

app.post("/build", async (req, res) => {
    packger.buildAPK((result) => {
        if (!result) return res.send({ success: false });
        res.send({
            success: true,
            apk: result
        });
    });
});

app.listen(3000, () => console.log("Build server running on port 3000"));
