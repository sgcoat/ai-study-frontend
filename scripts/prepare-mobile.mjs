import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
let profileName = 'preview';
let platform = 'ios';
let strict = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--') continue;
  if (args[i] === '--strict') { strict = true; continue; }
  if (args[i] === '--profile' && args[i + 1]) profileName = args[++i];
  else if (args[i] === '--platform' && args[i + 1]) platform = args[++i];
  else throw new Error('Usage: pnpm mobile:prepare [--profile preview|preview-ios-simulator|production] [--platform ios|android] [--strict]');
}
if (!['preview', 'preview-ios-simulator', 'production'].includes(profileName) || !['ios', 'android'].includes(platform) ||
    (profileName === 'preview-ios-simulator' && platform !== 'ios')) throw new Error('지원하는 모바일 빌드 프로필과 플랫폼을 선택하세요.');

const eas = JSON.parse(await readFile(new URL('eas.json', root), 'utf8'));
function resolveProfile(name, seen = new Set()) {
  if (seen.has(name) || !eas.build[name]) throw new Error('잘못된 eas.json 상속 설정입니다.');
  seen.add(name);
  const own = eas.build[name];
  const base = own.extends ? resolveProfile(own.extends, seen) : {};
  return { ...base, ...own, env: { ...base.env, ...own.env }, ios: { ...base.ios, ...own.ios }, android: { ...base.android, ...own.android } };
}
const profile = resolveProfile(profileName);
const allowed = ['EXPO_PUBLIC_API_BASE_URL', 'EXPO_PUBLIC_API_MODE', 'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_APP_ENV', 'APP_IOS_BUNDLE_IDENTIFIER', 'APP_ANDROID_PACKAGE', 'EAS_PROJECT_ID'];
// Inspect only public app settings; never open server/.env or EAS credentials.
let local = {};
try { local = parseEnv(await readFile(new URL('.env', root), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const key of allowed) if (!process.env[key] && local[key]) process.env[key] = local[key];
Object.assign(process.env, profile.env, { EAS_BUILD_PROFILE: profileName, EAS_BUILD_PLATFORM: platform });
const source = JSON.parse(await readFile(new URL('app.json', root), 'utf8')).expo;
const missing = [];
let app = source;
try { app = createRequire(import.meta.url)('../app.config.js')({ config: source }); }
catch (error) { missing.push(...String(error.message).split('\n').slice(1)); }
const projectId = process.env.EAS_PROJECT_ID || app.extra?.eas?.projectId;
if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId ?? '')) missing.push('EAS_PROJECT_ID: eas init으로 프로젝트를 연결하세요.');
const report = {
  generatedAt: new Date().toISOString(),
  status: missing.length ? 'needs_configuration' : 'configuration_prepared',
  profile: profileName, platform, owner: app.owner, slug: app.slug, version: app.version,
  apiMode: process.env.EXPO_PUBLIC_API_MODE, apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  applicationId: platform === 'ios' ? app.ios?.bundleIdentifier : app.android?.package,
  artifact: platform === 'android' ? (profile.android.buildType === 'apk' ? 'APK' : 'AAB') : profile.ios.simulator ? 'iOS Simulator .app' : 'signed IPA',
  environment: profile.environment,
  missing: [...new Set(missing)],
  nativeBuildStarted: false, storeSubmissionStarted: false,
};
await mkdir(new URL('outputs/', root), { recursive: true });
await writeFile(new URL(`outputs/mobile-${profileName}-${platform}.json`, root), `${JSON.stringify(report, null, 2)}\n`);
console.log(`${platform} / ${profileName}: ${report.status}`);
console.log(`API: ${report.apiBaseUrl}`);
console.log(`Application ID: ${report.applicationId}`);
for (const item of report.missing) console.log(`준비 필요: ${item}`);
console.log('설정 보고서를 outputs/에 저장했습니다. 빌드·서명·스토어 제출은 실행하지 않았습니다.');
if (strict && report.missing.length) process.exitCode = 1;
