/* 自动测试 backend-build-server 功能 */

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const BASE = "http://localhost:3000"; // 后端地址
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* 上传文件方法 */
async function upload(path, file) {
    const form = new FormData();
    form.append("file", fs.createReadStream(file));

    const res = await axios.post(`${BASE}/api/upload/${path}`, form, {
        headers: form.getHeaders(),
    });

    return res.data.filePath;
}

/* 查询构建状态 */
async function waitStatus(jobId) {
    while (true) {
        const res = await axios.get(`${BASE}/api/status/${jobId}`);
        console.log(`Job ${jobId}: ${res.data.status}`);

        if (res.data.status === "completed" || res.data.status === "error") {
            return res.data;
        }
        await delay(1500);
    }
}

/* 构建 APK */
async function build(params) {
    const res = await axios.post(`${BASE}/api/build`, params);
    return res.data.jobId;
}

/* 测试 1: 基础构建 */
async function testBasicBuild() {
    console.log("\n=== TEST 1: 基础 build（不上传 icon/firebase） ===");

    const jobId = await build({
        appName: "TestBasicApp",
        packageName: "com.test.basic",
        webUrl: "https://example.com",
        adjustToken: "TOKEN123",
        eventToken: "EVENT123"
    });

    const result = await waitStatus(jobId);
    console.log("构建结果:", result);
}

/* 测试 2: 带 icon + firebase JSON + 自定义包名 */
async function testFullBuild() {
    console.log("\n=== TEST 2: 完整 build：icon + firebase + packageName ===");

    const iconPath = await upload("icon", "./test/icon.png");
    const firebasePath = await upload("firebase", "./test/firebase.json");

    const jobId = await build({
        appName: "FullFeatureApp",
        packageName: "com.full.test",
        webUrl: "https://google.com",
        adjustToken: "FULLTOKEN",
        eventToken: "FULLEVENT",
        iconPath,
        firebasePath
    });

    const result = await waitStatus(jobId);
    console.log("构建结果:", result);
}

/* 测试 3: 并发测试 */
async function testConcurrency() {
    console.log("\n=== TEST 3: 并发 build（3 个同时执行） ===");

    const jobs = await Promise.all([
        build({ appName: "A1", packageName: "com.test.A1", webUrl: "https://a.com" }),
        build({ appName: "A2", packageName: "com.test.A2", webUrl: "https://b.com" }),
        build({ appName: "A3", packageName: "com.test.A3", webUrl: "https://c.com" }),
    ]);

    console.log("并发 Job IDs:", jobs);

    for (const jobId of jobs) {
        const res = await waitStatus(jobId);
        console.log("结果:", res);
    }
}

/* 测试 4: 错误测试 (错误 firebase.json) */
async function testErrorCase() {
    console.log("\n=== TEST 4: 错误测试（上传错误 firebase.json） ===");

    const firebasePath = await upload("firebase", "./test/firebase_wrong.json");

    const jobId = await build({
        appName: "ErrorApp",
        packageName: "com.error.test",
        webUrl: "https://error.com",
        firebasePath: firebasePath
    });

    const result = await waitStatus(jobId);

    console.log("预期构建失败:", result);
}

/* 测试 5: 压力测试：连续构建 5 次 */
async function testStress() {
    console.log("\n=== TEST 5: 连续 5 次构建 ===");

    for (let i = 0; i < 5; i++) {
        console.log(`\n--- 构建 ${i + 1}/5 ---`);

        const jobId = await build({
            appName: `Stress${i}`,
            packageName: `com.stress.${i}`,
            webUrl: `https://stress-${i}.com`
        });

        const result = await waitStatus(jobId);

        console.log("结果:", result);
    }
}

/* 主流程 */
(async function () {
    console.log("\n========== 自动测试开始 ==========");

    await testBasicBuild();
    await testFullBuild();
    await testConcurrency();
    await testErrorCase();
    await testStress();

    console.log("\n========== 全部测试完成 ==========\n");
})();
