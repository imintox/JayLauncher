const assert = require('assert');
const s = require('../security');
const ok = (f, v) => assert.strictEqual(f(v), true, 'should allow: ' + v);
const no = (f, v) => assert.strictEqual(f(v), false, 'should block: ' + v);

['steam://rungameid/730', 'com.epicgames.launcher://apps/x?action=launch', 'uplay://launch/1/0', 'battlenet://Pro', 'goggalaxy://openGameView/1'].forEach((u) => ok(s.isSafeLaunchUri, u));
['http://evil.com', 'file:///C:/x.exe', 'javascript:alert(1)', 'steam://a b', 'steam://x\r\nHost: y', 'ms-msdt:/id', '', null, 5].forEach((u) => no(s.isSafeLaunchUri, u));

ok(s.isSafeAumid, 'Microsoft.624F8B84B80_8wekyb3d8bbwe!Game');
['cmd.exe', 'a_b!c; calc', 'x_y!z w', '', null].forEach((a) => no(s.isSafeAumid, a));

['C:\\Games\\A\\a.exe', 'D:\\x\\y.lnk'].forEach((p) => ok(s.isSafeExe, p));
['\\\\server\\share\\a.exe', 'a.exe', 'C:\\a.txt', 'C:\\a.exe\n', 'C:\\a\0.exe', null].forEach((p) => no(s.isSafeExe, p));

ok((p) => s.isInside('C:\\Games\\A', p), 'C:\\Games\\A\\bin\\a.exe');
['C:\\Games\\A\\..\\..\\Windows\\cmd.exe', 'C:\\Windows\\cmd.exe', 'D:\\Games\\A\\a.exe', 'C:\\Games\\A'].forEach((p) => no((x) => s.isInside('C:\\Games\\A', x), p));
console.log('security tests passed');
