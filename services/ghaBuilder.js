// services/ghaBuilder.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER || 'fortune2422';
const REPO_NAME = process.env.REPO_NAME || 'backend-build-server';
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || 'build.yml'; // the filename in .github/workflows
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

  // Build the dispatch payload from cfg
  const inputs = {
    appName: cfg.appName || cfg.appName || 'DEFAULT_APP_NAME',
    packageName: cfg.packageName || 'com.example.app',
    webUrl: cfg.webUrl || 'https://default.com',
    adjustToken: cfg.adjustToken || 'DEFAULT_ADJUST_TOKEN',
    eventToken: cfg.eventToken || 'DEFAULT_EVENT_TOKEN'
  };

  // If uploads (firebase/icon) exist we expect they've been placed in repo or accessible to Actions
  // (Alternative: you can implement an artifact upload flow — out of scope for minimal implement)
  jobs[jobId].status = 'triggering';

  try {
    // Trigger the workflow_dispatch
    const dispatchUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    await axios.post(dispatchUrl, {
      ref: 'main',
      inputs
    }, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
      }
    });

    jobs[jobId].status = 'dispatched';
    jobs[jobId].dispatchedAt = Date.now();

    // Now poll recent workflow runs to find the run for this dispatch
    jobs[jobId].status = 'running';
    const runId = await findNewestRunId(inputs);
    jobs[jobId].runId = runId;

    // Poll run status until completed
    const run = await waitForRunCompletion(runId);
    jobs[jobId].runInfo = run;

    if (run.conclusion !== 'success') {
      jobs[jobId].status = 'error';
      jobs[jobId].error = `workflow finished with conclusion: ${run.conclusion}`;
      return jobId;
    }

    // Get artifacts for run
    const artifactUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/artifacts`;
    const artRes = await axios.get(artifactUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });

    if (artRes.data && artRes.data.artifacts && artRes.data.artifacts.length > 0) {
      // Pick first artifact (workflow uploads apk artifact)
      const artifact = artRes.data.artifacts[0];

      // Download artifact archive (zip)
      const downloadUrl = artifact.archive_download_url;
      const zipRes = await axios.get(downloadUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
        responseType: 'arraybuffer'
      });

      const outZip = path.join(OUTPUT_DIR, `${jobId}-artifact.zip`);
      fs.writeFileSync(outZip, Buffer.from(zipRes.data));

      // Optionally unzip and find apk — keep zip for now
      jobs[jobId].status = 'done';
      jobs[jobId].artifactZip = `/downloads/${path.basename(outZip)}`; // you'll need express static serving set to uploads/output -> /downloads
      jobs[jobId].finishedAt = Date.now();
    } else {
      jobs[jobId].status = 'done';
      jobs[jobId].message = 'no artifact found';
    }
  } catch (err) {
    jobs[jobId].status = 'error';
    jobs[jobId].error = err.message || JSON.stringify(err);
  }

  return jobId;
}

/** Try to find the newest run for the workflow (best-effort) */
async function findNewestRunId(inputs) {
  const runsUrl = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs`;
  // We'll poll until a run appears (timeout ~120s)
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const res = await axios.get(runsUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    const runs = res.data.workflow_runs || [];
    if (runs.length > 0) {
      // Return the most recent one (conservative)
      return runs[0].id;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('workflow run not found after dispatch');
}

/** Poll run until conclusion */
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
