import { TwaManifest, TwaGenerator, ConsoleLog, BufferedLog, JdkHelper, KeyTool } from '@bubblewrap/core';
import { join } from 'path';
import { writeFile, readFile, mkdir } from 'fs/promises';
import crypto from 'crypto';

const targetDirectory = '/home/somers/gibrr-android';
const manifestUrl = 'https://gibrr.somershome.uk/manifest.webmanifest';

await mkdir(targetDirectory, { recursive: true });

const twaManifest = await TwaManifest.fromWebManifest(manifestUrl);

// Second host for the API/federation domain isn't needed here — TWA just
// wraps the web app; the web app itself talks to the API over HTTPS.
twaManifest.appVersionCode = 1;
twaManifest.appVersionName = '1.0.0';
twaManifest.signingKey.path = join(targetDirectory, 'android.keystore');
twaManifest.signingKey.alias = 'android';

const err = twaManifest.validate();
if (err) {
  console.error('Invalid TWA manifest:', err);
  process.exit(1);
}

await twaManifest.saveToFile(join(targetDirectory, 'twa-manifest.json'));

const log = new BufferedLog(new ConsoleLog('Generating TWA'));
const twaGenerator = new TwaGenerator();
await twaGenerator.createTwaProject(targetDirectory, twaManifest, log);
log.flush();

// manifest-checksum.txt (used by `bubblewrap update` to detect drift)
const manifestFile = join(targetDirectory, 'twa-manifest.json');
const manifestContents = await readFile(manifestFile);
const sum = crypto.createHash('sha1').update(manifestContents).digest('hex');
await writeFile(join(targetDirectory, 'manifest-checksum.txt'), sum);

// Signing key
const config = { jdkPath: '/usr/lib/jvm/java-17-openjdk-amd64', androidSdkPath: '/home/somers/android-sdk' };
const jdkHelper = new JdkHelper(process, config);
const keytool = new KeyTool(jdkHelper);
await keytool.createSigningKey({
  fullName: 'Gibrr',
  organizationalUnit: 'Gibrr',
  organization: 'Gibrr',
  country: 'US',
  password: 'gibrr-android',
  keypassword: 'gibrr-android',
  alias: twaManifest.signingKey.alias,
  path: twaManifest.signingKey.path,
});

console.log('DONE');
console.log(JSON.stringify({
  packageId: twaManifest.packageId,
  host: twaManifest.host,
  name: twaManifest.name,
}, null, 2));
