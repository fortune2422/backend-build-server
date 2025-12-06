// services/ghaBuilder.js (improved)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');

const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER || 'fortune2422';
const REPO_NAME = process.env.REPO_NAME || 'backend-build-server';
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || 'build.yml'; // filename in .github/workflows
const API_BASE = process.env.GITHUB_API_BASE || 'https://api.github.com';

// in-memory job store (simple)
const jobs = {};

/**
 * triggerBuild(cfg) -> jobId
 * cfg: { appName, packageName, webUrl, adjustToken, eventToken, firebasePath, iconPath }
 */
async function triggerBuild(cfg) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set in env');

  const jobId = Date.now().toString();
  jobs[jobId] = { status: 'queued', createdAt: Date.now(), cfg };

  const inputs = {
    appName: cfg.appName || 'DEFAULT_APP_NAME',
    packageName: cfg.packageName || 'com.example.app',
    webUrl: cfg.webUrl || 'https://default.com',
    adjustToken: cfg.adjustToken || 'DEFAULT_ADJUST_TOKEN',
    eventToken: cfg.eventToken || 'DEFAULT_EVENT_TOKEN',
    firebasePath: cfg.firebasePath || '', // should be full public URL (use /uploads endpoint)
    iconPath: cfg.iconPath || ''
  };

  jobs[jobId].status = 'triggering';
  const dispatchUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  try {
    // Trigger workflow_dispatch
    await axios.post(dispatchUrl, { ref: 'main', inputs }, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
      }
    });

    jobs[jobId].status = 'dispatched';
    jobs[jobId].dispatchedAt = Date.now();

    // Find the matching run (best-effort) created after dispatch
    jobs[jobId].status = 'running';
    const runId = await findMatchingRunId(jobs[jobId].dispatchedAt);
    jobs[jobId].runId = runId;

    const run = await waitForRunCompletion(runId);
    jobs[jobId].runInfo = run;

    if (run.conclusion !== 'success') {
      jobs[jobId].status = 'error';
      jobs[jobId].error = `workflow finished with conclusion: ${run.conclusion}`;
      return jobId;
    }

    // Fetch artifacts
    const artifactUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/artifacts`;
    const artRes = await axios.get(artifactUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });

    if (!artRes.data || !artRes.data.artifacts || artRes.data.artifacts.length === 0) {
      jobs[jobId].status = 'done';
      jobs[jobId].message = 'no artifact found';
      jobs[jobId].finishedAt = Date.now();
      return jobId;
    }

    // pick first artifact and download
    const artifact = artRes.data.artifacts[0];
    const downloadUrl = artifact.archive_download_url;

    const zipRes = await axios.get(downloadUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      responseType: 'arraybuffer'
    });

    const outZip = path.join(OUTPUT_DIR, `${jobId}-artifact.zip`);
    fs.writeFileSync(outZip, Buffer.from(zipRes.data));

    // unzip and find apk
    const unzipDir = path.join(OUTPUT_DIR, `${jobId}-unzip`);
    if (!fs.existsSync(unzipDir)) fs.mkdirSync(unzipDir, { recursive: true });

    await new Promise((resolve, reject) => {
      const stream = unzipper.Open.buffer(Buffer.from(zipRes.data));
      stream.then(d => {
        Promise.all(d.files.map(file => {
          const target = path.join(unzipDir, file.path);
          if (file.type === 'Directory') {
            if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
            return Promise.resolve();
          } else {
            return file.stream().pipe(fs.createWriteStream(target));
          }
        })).then(resolve).catch(reject);
      }).catch(reject);
    });

    // search for .apk in unzipDir
    const apkFiles = [];
    function walk(dir) {
      const items = fs.readdirSync(dir);
      for (const it of items) {
        const p = path.join(dir, it);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (p.endsWith('.apk')) apkFiles.push(p);
      }
    }
    walk(unzipDir);

    if (apkFiles.length === 0) {
      // keep artifact zip but mark no apk found
      jobs[jobId].status = 'done';
      jobs[jobId].artifactZip = `/downloads/${path.basename(outZip)}`;
      jobs[jobId].message = 'artifact downloaded but no apk found inside artifact';
      jobs[jobId].finishedAt = Date.now();
      return jobId;
    }

    // copy first apk to output root for easy download
    const chosen = apkFiles[0];
    const outApkName = `${jobId}-${path.basename(chosen)}`;
    const outApkPath = path.join(OUTPUT_DIR, outApkName);
    fs.copyFileSync(chosen, outApkPath);

    jobs[jobId].status = 'done';
    jobs[jobId].apk = `/downloads/${outApkName}`;
    jobs[jobId].artifactZip = `/downloads/${path.basename(outZip)}`;
    jobs[jobId].finishedAt = Date.now();
  } catch (err) {
    jobs[jobId].status = 'error';
    jobs[jobId].error = (err && err.message) ? err.message : String(err);
    jobs[jobId].finishedAt = Date.now();
  }

  return jobId;
}

/** find a run created after dispatchedAt (wait a while) */
async function findMatchingRunId(dispatchedAt) {
  const runsUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs`;
  const start = Date.now();
  while (Date.now() - start < 120000) { // wait up to 120s
    const res = await axios.get(runsUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    const runs = res.data.workflow_runs || [];
    if (runs.length > 0) {
      // pick first run whose created_at >= dispatchedAt - 30s tolerance
      for (const r of runs) {
        const created = new Date(r.created_at).getTime();
        if (created >= (dispatchedAt - 30000)) return r.id;
      }
      // otherwise return latest
      return runs[0].id;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('workflow run not found after dispatch');
}

/** Poll run until completion */
async function waitForRunCompletion(runId) {
  const runUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`;
  const start = Date.now();
  while (true) {
    const res = await axios.get(runUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    const run = res.data;
    if (run.status === 'completed') return run;
    if (Date.now() - start > 1000 * 60 * 20) throw new Error('timeout waiting for workflow run completion');
    await new Promise(r => setTimeout(r, 5000));
  }
}

function getJobStatus(jobId) {
  return jobs[jobId];
}

module.exports = { triggerBuild, getJobStatus };
