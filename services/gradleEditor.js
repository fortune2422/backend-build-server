const fs = require('fs');

function replaceResValues(appGradlePath, config) {
  let text = fs.readFileSync(appGradlePath, 'utf8');

  // applicationId
  if (config.packageName) {
    text = text.replace(/applicationId\s+"[^"]+"/, `applicationId "${config.packageName}"`);
  }

  // helper to set resValue lines
  const setRes = (key, val) => {
    if (!val) return;
    const re = new RegExp(`resValue\\s+"string",\\s*"${key}".*`);
    const line = `        resValue "string", "${key}", "${escapeGradleString(val)}"`;
    if (re.test(text)) {
      text = text.replace(re, line);
    } else {
      // insert before the closing brace of defaultConfig
      text = text.replace(/(defaultConfig\s*{)([\s\S]*?)(\n\s*})/, (m, p1, inner, p3) => {
        return `${p1}${inner}\n${line}\n${p3}`;
      });
    }
  };

  setRes('backend_app_name', config.appName);
  setRes('backend_web_url', config.webUrl);
  setRes('backend_adjust_token', config.adjustToken);
  setRes('backend_event_token', config.eventToken);

  fs.writeFileSync(appGradlePath, text, 'utf8');
}

function escapeGradleString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

module.exports = { replaceResValues };
