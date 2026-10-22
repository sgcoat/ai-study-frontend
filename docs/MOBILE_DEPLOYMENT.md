# 모바일 앱 배포 준비

2026-10-22 사용자 선택: 서버 정보 미정, 웹 배포 제외, 모바일 앱 배포 준비까지 진행. 유료 계정·결제·스토어 제출은 실행하지 않습니다. 실제 AI 연결은 제외합니다.

## 준비한 설정

| 항목 | 값 |
| --- | --- |
| Expo 계정 | `sugarcoat1021` (CLI 로그인에서 확인) |
| Expo slug | `ai-study-app` |
| 앱 버전 | `1.0.0` |
| iOS bundle identifier | `com.sgcoat.aistudy` |
| Android package | `com.sgcoat.aistudy` |
| API 모드 | `http` |
| API | `https://jqhivsrfrkycfjefgoam.supabase.co/functions/v1/ai-study-api/api/v1` |

앱 식별자는 현재 프로젝트용 기본값입니다. 최초 스토어 등록 전에 사용 가능 여부를 확인하고, 바꾸려면 `app.json` 또는 `APP_IOS_BUNDLE_IDENTIFIER`·`APP_ANDROID_PACKAGE`를 변경합니다. 등록된 앱 식별자는 이후 함부로 바꾸지 않습니다.

`eas.json`에 공개 API 주소를 명시해 실제 `.env`를 업로드하지 않아도 클라우드 빌드가 같은 백엔드를 사용합니다. preview와 production은 base 프로필을 상속합니다. SMTP·DB·AI 키는 EAS 앱 환경에 등록하지 않습니다.

| 프로필 | 결과 | 용도 |
| --- | --- | --- |
| `preview` + Android | APK | Android 기기에 직접 설치 |
| `preview` + iOS | 서명된 IPA | 등록한 실제 iPhone에 Ad Hoc 배포, Apple 개발자 계정 필요 |
| `preview-ios-simulator` + iOS | Simulator용 `.app` | Mac의 iOS Simulator용, 실제 iPhone 설치 불가 |
| `production` | Android AAB / iOS IPA | 스토어 제출용, 별도 계정·정책·서명 필요 |

preview는 HTTPS 실제 API와 HTTP 모드를 요구합니다. production은 추가로 게시한 개인정보 처리방침 URL과 EAS 프로젝트 UUID를 요구합니다. 기본값만 채우고 스토어 준비가 완료됐다고 판단하지 않습니다.

## 지금 사용할 수 있는 명령

```sh
pnpm install --frozen-lockfile
pnpm dev:cloud
pnpm mobile:prepare --profile preview --platform ios
pnpm mobile:prepare --profile preview --platform android
pnpm mobile:prepare --profile preview-ios-simulator --platform ios
```

설정 보고서는 `outputs/mobile-<프로필>-<플랫폼>.json`에 저장됩니다. 빌드 실행 전 누락 설정을 오류로 처리하려면 `--strict`를 추가합니다. 이 명령은 빌드·서명·스토어 업로드·메일 발송을 하지 않습니다. 개인정보 처리방침 초안 게시나 법률 검토는 이번 범위에 포함하지 않았습니다.

## 이후 실제 빌드를 할 때

1. Expo 계정으로 로그인한 상태에서 EAS 프로젝트를 생성하거나 기존 프로젝트에 연결합니다.

```sh
pnpm dlx eas-cli login
pnpm dlx eas-cli init
```

생성된 `extra.eas.projectId`가 `app.json`에 저장됐는지 확인합니다. 이 값은 공개 프로젝트 UUID입니다. 이미 만든 프로젝트가 있다면 새 프로젝트를 중복 생성하지 않고 해당 ID로 연결합니다.

2. 필요한 플랫폼·프로필로 누락 설정을 확인합니다.

```sh
pnpm mobile:prepare --profile preview --platform android --strict
```

3. 실제 빌드 시점에 EAS 무료 잔여량과 계정 조건을 확인한 뒤 필요한 빌드만 실행합니다. 아래 명령은 현재 작업에서 실행하지 않습니다.

```sh
# Android 기기 설치용
pnpm dlx eas-cli build --platform android --profile preview

# Mac의 iOS Simulator용
pnpm dlx eas-cli build --platform ios --profile preview-ios-simulator
```

실제 iPhone의 Expo Go 개발 실행은 기존 방식으로 가능합니다. Simulator 산출물은 iPhone용 IPA가 아니며, Expo Go 실행은 앱 배포 완료를 뜻하지 않습니다.

production 빌드에는 실제 공개 개인정보 처리방침을 게시하고 EAS production 환경의 `EXPO_PUBLIC_PRIVACY_POLICY_URL`에 URL을 넣습니다. production의 EAS 환경 값은 로컬 `.env`와 별도로 준비합니다. 등록 운영자·연락처·데이터 보관 정책이 정해지기 전에는 임의 정책을 게시하지 않습니다.

## 배포 전 확인이 남은 부분

- 배포된 API를 사용하는 iPhone의 이메일 로그인, 재실행 로그인 복원, 사진 포함 자료 생성·조회·수정·삭제.
- EAS 프로젝트 연결과 플랫폼별 네이티브 컴파일·서명.
- iPhone 앱 아이콘·스토어 스크린샷·개인정보 처리방침·심사 정보.
- 클라우드 API의 기존 로컬 자료·사진 이전 여부 결정.

## 수정 위치

| 변경 사항 | 파일 |
| --- | --- |
| 빌드 API·APK/AAB·Simulator 설정 | `eas.json` |
| 앱 이름·식별자·버전·소유자 | `app.json`, `app.config.js` |
| production 설정 필수값 | `app.config.js` |
| 로컬 API 연결 | `.env`, `supabase/projects.json`, `supabase/scripts/connect-app.mjs` |
| 누락 설정 보고서 | `scripts/prepare-mobile.mjs` |

## 공식 문서

- [Expo 빌드 프로필](https://docs.expo.dev/build/eas-json/)
- [Expo 내부 배포](https://docs.expo.dev/build/internal-distribution/)
- [EAS 환경 변수](https://docs.expo.dev/eas/environment-variables/usage/)
- [EAS 프로젝트 연결](https://docs.expo.dev/eas/cli/)
