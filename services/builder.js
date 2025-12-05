const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { replaceResValues } = require('./gradleEditor');
const { updateStrings } = require('./stringsEditor');
const { replaceIcon } = require('./iconReplacer');
const { v4: uuidv4 } = require('uuid');

const TEMPLATE = path.join(__dirname, '..', 'template', 'MyWebviewApp_Fixed3');
const TEMP_DIR = path.join(__dirname, '..', 'temp', 'jobs');
const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'output');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// in-memory job store
const jobs = {};

/**
 * startBuild(cfg) -> returns jobId
 */
async function startBuild(cfg) {
  const jobId = Date.now().toString() + '-' + uuidv4();
  jobs[jobId] = { status: 'queued', startedAt: Date.now(), cfg };

  // run build asynchronously (fire and forget)
  runJob(jobId, cfg).catch(err => {
    jobs[jobId].status = 'error';
    jobs[jobId].error = (err && err.toString()) || 'unknown';
  });

  return jobId;
}

function getJobStatus(jobId) {
  return jobs[jobId];
}

async function runJob(jobId, cfg) {
  jobs[jobId].status = 'running';
  const jobDir = path.join(TEMP_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // copy template -> jobDir
  await copyDir(TEMPLATE, jobDir);

  try {
    // 1) update strings.xml
    const stringsPath = path.join(jobDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
    await updateStrings(stringsPath, {
      appName: cfg.appName,
      webUrl: cfg.webUrl,
      adjustToken: cfg.adjustToken,
      eventToken: cfg.eventToken
    });

    // 2) update app/build.gradle resValue and applicationId
    const appGradlePath = path.join(jobDir, 'app', 'build.gradle');
    await replaceResValues(appGradlePath, {
      appName: cfg.appName,
      webUrl: cfg.webUrl,
      adjustToken: cfg.adjustToken,
      eventToken: cfg.eventToken,
      packageName: cfg.packageName
    });

    // 3) copy firebase json if provided
    if (cfg.firebasePath) {
      const src = path.join(__dirname, '..', cfg.firebasePath);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(jobDir, 'app', 'google-services.json'));
      } else {
        console.warn('firebase file not found:', src);
      }
    }

    // 4) replace icon if provided
    if (cfg.iconPath) {
      const iconSrc = path.join(__dirname, '..', cfg.iconPath);
      if (fs.existsSync(iconSrc)) {
        await replaceIcon(jobDir, iconSrc);
      } else {
        console.warn('icon file not found:', iconSrc);
      }
    }

    // 5) run build script (note: ideally run within docker container)
    jobs[jobId].status = 'building';
    await execPromise(`bash ${path.join(__dirname, '..', 'scripts', 'build.sh')} ${jobDir}`, { cwd: jobDir, timeout: 1000 * 60 * 20 });

    // 6) sign apk
    const unsignedPath = path.join(jobDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
    if (!fs.existsSync(unsignedPath)) throw new Error('unsigned apk not found: ' + unsignedPath);

    const outName = `${(cfg.packageName || 'app')}-${jobId}.apk`;
    const outPath = path.join(OUTPUT_DIR, outName);

    // Keystore handling: require env variables or mounted path
    const KEYSTORE_PATH = process.env.KEYSTORE_PATH || '/keystore/keystore.jks';
    const KEYSTORE_PASS = process.env.KEYSTORE_PASS || process.env.KS_PASS || '';
    const KEY_ALIAS = process.env.KEY_ALIAS || 'myalias';

    if (!fs.existsSync(KEYSTORE_PATH)) {
      throw new Error(`keystore not found at ${KEYSTORE_PATH}. Please mount your keystore and set KEYSTORE_PATH env var.`);
    }

    jobs[jobId].status = 'signing';
    await execPromise(`bash ${path.join(__dirname, '..', 'scripts', 'sign-apk.sh')} "${unsignedPath}" "${KEYSTORE_PATH}" "${KEYSTORE_PASS}" "${KEY_ALIAS}" "${outPath}"`, { timeout: 1000*60*5 });

    jobs[jobId].status = 'done';
    jobs[jobId].apk = `/downloads/${outName}`;
    jobs[jobId].finishedAt = Date.now();
  } catch (e) {
    console.error('job error', e);
    jobs[jobId].status = 'error';
    jobs[jobId].error = (e && e.toString()) || 'unknown';
  } finally {
    // optional: clean up jobDir after a while; keep for debugging for now
    // fs.rmSync(jobDir, { recursive: true, force: true });
  }
}

// utility: exec -> promise
function execPromise(command, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = exec(command, { maxBuffer: 1024 * 1024 * 20, ...opts }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || stdout || err.message));
      }
      resolve({ stdout, stderr });
    });
    p.stdout && p.stdout.pipe(process.stdout);
    p.stderr && p.stderr.pipe(process.stderr);
  });
}

// utility: copy directory recursively
async function copyDir(src, dest) {
  return new Promise((resolve, reject) => {
    const ncp = require('ncp').ncp;
    ncp.limit = 16;
    ncp(src, dest, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { startBuild, getJobStatus };
