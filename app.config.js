/** Public build configuration only. Server credentials must never be read here. */
module.exports = ({ config }) => {
  const production = process.env.EXPO_PUBLIC_APP_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production';
  const preview = process.env.EXPO_PUBLIC_APP_ENV === 'preview';
  const iosId = process.env.APP_IOS_BUNDLE_IDENTIFIER || config.ios?.bundleIdentifier;
  const androidId = process.env.APP_ANDROID_PACKAGE || config.android?.package;
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const isHttpsUrl = (value) => {
    try {
      const url = new URL(value || '');
      return url.protocol === 'https:' && !url.username && !url.password &&
        url.hostname.includes('.') && !/^\d+\./.test(url.hostname) && !url.hostname.includes(':') &&
        !/\.(?:local|localhost|test|invalid)$/.test(url.hostname) &&
        !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) &&
        !/(?:^|\.)example\.(?:com|net|org)$/.test(url.hostname);
    } catch { return false; }
  };
  if (production || preview) {
    const missing = [];
    if (process.env.EXPO_PUBLIC_API_MODE !== 'http') missing.push('EXPO_PUBLIC_API_MODE=http');
    if (!isHttpsUrl(process.env.EXPO_PUBLIC_API_BASE_URL)) missing.push('EXPO_PUBLIC_API_BASE_URL: 실제 HTTPS API 주소');
    if (production && !isHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)) missing.push('EXPO_PUBLIC_PRIVACY_POLICY_URL: 게시된 HTTPS 개인정보 처리방침 주소');
    if (!iosId || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(iosId)) missing.push('APP_IOS_BUNDLE_IDENTIFIER');
    if (!androidId || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(androidId)) missing.push('APP_ANDROID_PACKAGE');
    if (production && (!projectId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId))) missing.push('EAS_PROJECT_ID');
    if (missing.length) throw new Error(`앱 빌드 설정이 필요합니다:\n${missing.join('\n')}`);
  }
  return {
    ...config,
    ios: { ...config.ios, ...(iosId ? { bundleIdentifier: iosId } : {}) },
    android: { ...config.android, ...(androidId ? { package: androidId } : {}) },
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
};
