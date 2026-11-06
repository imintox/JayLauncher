const { execFile } = require('child_process');

// Read one registry value on Windows. Returns the value string or null.
function regQuery(key, name) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);
    execFile('reg', ['query', key, '/v', name], { windowsHide: true }, (err, out) => {
      if (err) return resolve(null);
      const m = out.match(new RegExp('^\\s*' + name + '\\s+REG_\\w+\\s+(.*)$', 'mi'));
      resolve(m ? m[1].trim() : null);
    });
  });
}

// List the full paths of a registry key's subkeys.
function regSubkeys(key) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('reg', ['query', key], { windowsHide: true }, (err, out) => {
      if (err) return resolve([]);
      const prefix = key.toLowerCase() + '\\';
      resolve(out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.toLowerCase().startsWith(prefix)));
    });
  });
}

module.exports = { regQuery, regSubkeys };
