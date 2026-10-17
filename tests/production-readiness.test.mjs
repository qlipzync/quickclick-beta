import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const firebase = readJson('firebase.json');
const applet = readJson('firebase-applet-config.json');
const configTs = readFileSync('src/config/quickclick-config.ts', 'utf8');
const authMiddleware = readFileSync('server/middleware/authMiddleware.ts', 'utf8');
const firestoreRules = readFileSync('firestore.rules', 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');

test('package manifest and lockfile are synchronized', () => {
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.deepEqual(Object.keys(lock.packages[''].dependencies || {}).sort(), Object.keys(pkg.dependencies || {}).sort());
  assert.deepEqual(Object.keys(lock.packages[''].devDependencies || {}).sort(), Object.keys(pkg.devDependencies || {}).sort());
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    assert.equal(lock.packages[''].dependencies[name], version, 'dependency mismatch: ' + name);
    assert.ok(lock.packages['node_modules/' + name], 'lockfile entry missing: ' + name);
  }
  for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
    assert.equal(lock.packages[''].devDependencies[name], version, 'devDependency mismatch: ' + name);
    assert.ok(lock.packages['node_modules/' + name], 'lockfile entry missing: ' + name);
  }
});

test('Firebase deployment and application configs agree on the Firestore database ID', () => {
  const databaseId = firebase.firestore.database;
  assert.equal(databaseId, applet.firestoreDatabaseId);
  assert.ok(configTs.includes('databaseId: "' + databaseId + '"'));
  assert.ok(configTs.includes('id: "' + databaseId + '"'));
  assert.ok(authMiddleware.includes("process.env.FIRESTORE_DB || '" + databaseId + "'"));
  assert.ok(!configTs.includes('qlipzync-prod'));
  assert.ok(!authMiddleware.includes('qlipzync-prod'));
});

test('Firestore rules retain default deny and block client privilege escalation', () => {
  assert.match(firestoreRules, /match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/);
  assert.match(firestoreRules, /function protectedUserFields\(\)/);
  assert.match(firestoreRules, /function safeUserCreate\(\)/);
  assert.match(firestoreRules, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(protectedUserFields\(\)\)/);
});

test('production container entrypoint exists in the build contract', () => {
  assert.match(pkg.scripts.build, /esbuild server\.ts .*--outfile=dist\/server.js/);
  assert.equal(pkg.scripts.start, 'node dist/server.js');
  assert.match(dockerfile, /test -f dist\/server.js/);
  assert.match(dockerfile, /CMD \["node", "dist\/server.js"\]/);
  assert.match(dockerfile, /npm ci --legacy-peer-deps/);
  assert.match(dockerfile, /npm ci --omit=dev --legacy-peer-deps/);
});

test('only one active Cloud Run deployment workflow remains', () => {
  assert.equal(existsSync('.github/workflows/google-cloudrun-docker.yml'), false);
  const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.match(deployWorkflow, /FIRESTORE_DB/);
  assert.match(deployWorkflow, /npm run test:rules/);
  assert.match(deployWorkflow, /--set-env-vars "NODE_ENV=production,GCP_PROJECT=/);
});

test('client sync uses verified Firebase UID and never submits server-controlled fields', () => {
  const source = readFileSync('src/lib/firebase.ts', 'utf8');
  assert.match(source, /const firebaseUid = auth\.currentUser\?\.uid/);
  assert.match(source, /serverControlledFields = new Set/);
  assert.match(source, /doc\(db\.prod, 'users', firebaseUid\)/);
  assert.ok(!source.includes("doc(db.prod, 'users', user.id)"));
});

test('server routes and middleware do not retain the legacy Firestore database fallback', () => {
  const sourcePaths = [
    'server.ts',
    'server/index.ts',
    'server/middleware/authMiddleware.ts',
    'server/middleware/unifiedAuth.middleware.ts',
    'server/routes/apiKey.routes.ts',
    'server/routes/apiKeys.routes.ts',
    'server/routes/authOAuth.ts',
    'server/routes/clips.ts',
    'server/routes/extraClips.ts',
    'server/routes/platform.routes.ts',
    'server/routes/stripe.ts',
    'server/routes/subscription.routes.ts',
    'server/routes/topupRoute.ts',
    'server/routes/twitch.ts',
  ];
  for (const path of sourcePaths) {
    assert.ok(!readFileSync(path, 'utf8').includes('qlipzync-prod'), path + ' still contains the legacy Firestore database ID');
  }
});
