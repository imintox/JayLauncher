const assert = require('assert');
const xbox = require('../scanners/xbox');
const manifests = {
  Halo: '<Package><Applications><Application Id="App" /></Applications></Package>',
  HaloDlc: '<Package><Dependencies/></Package>',
};
const pk = (n, extra = {}) => ({ Name: n, PackageFamilyName: n + '_x', InstallLocation: 'C:\\XboxGames\\' + n + '\\Content', ...extra });
xbox.scan({
  listPackages: async () => [pk('Halo'), pk('HaloDlc'), pk('Lang', { IsResourcePackage: true })],
  readFile: async (p) => {
    const m = /appxmanifest/.test(p) && p.match(/XboxGames[\\/]+([^\\/]+)/);
    if (m && manifests[m[1]]) return manifests[m[1]];
    throw new Error('missing');
  },
}).then((g) => {
  assert.deepStrictEqual(g.map((x) => x.title), ['Halo']);
  console.log('xbox tests passed');
});
