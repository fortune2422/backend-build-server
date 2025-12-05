const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.join(__dirname, "..", "builds");

function saveBuild(id, data) {
    const file = path.join(BUILD_DIR, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadBuild(id) {
    const file = path.join(BUILD_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file));
}

function listBuilds() {
    return fs.readdirSync(BUILD_DIR).map(f => f.replace(".json", ""));
}

module.exports = { saveBuild, loadBuild, listBuilds };
