const fs = require('fs');
const xml2js = require('xml2js');

async function updateStrings(stringsPath, config) {
  const xml = fs.readFileSync(stringsPath, 'utf8');
  const parser = new xml2js.Parser();
  const builder = new xml2js.Builder({ headless: true, renderOpts: { pretty: true }});
  const obj = await parser.parseStringPromise(xml);

  if (!obj.resources) obj.resources = {};
  if (!obj.resources.string) obj.resources.string = [];

  const strs = obj.resources.string;

  const put = (name, value) => {
    if (value === undefined || value === null) return;
    const idx = strs.findIndex(s => s.$ && s.$.name === name);
    if (idx >= 0) strs[idx]._ = value;
    else strs.push({ $: { name }, _: value });
  };

  put('backend_app_name', config.appName);
  put('backend_web_url', config.webUrl);
  put('backend_adjust_token', config.adjustToken);
  put('backend_event_token', config.eventToken);

  obj.resources.string = strs;
  const out = builder.buildObject(obj);
  fs.writeFileSync(stringsPath, out, 'utf8');
}

module.exports = { updateStrings };
