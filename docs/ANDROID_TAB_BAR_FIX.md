# Android 하단 탭·아이콘 수정

## 원인과 변경

- `MainTabs.tsx`에 `tabBarIcon`이 없어 React Navigation의 대체 아이콘이 표시됐습니다. 자료·학습 기록·내 정보에 직접 그린 SVG 아이콘을 지정했습니다. 아이콘은 시스템 글꼴이나 아이콘 폰트 로딩에 의존하지 않습니다.
- 기본 탭 높이에 위쪽 여백만 추가하던 구성을 변경했습니다. 탭 내용 높이는 기본 64dp이며, 기기 글자 배율에 따라 라벨 영역을 늘립니다.
- 전체 탭 높이에 `max(실제 하단 안전 영역, 12dp)`를 더하고 같은 값을 아래 여백으로 적용합니다. 시스템 제스처 영역·3버튼 내비게이션 영역을 탭 내용 공간과 구분하고 안전 영역을 중복해서 더하지 않습니다.
- 라벨은 아이콘 아래에 배치하며, 한글 라벨의 줄 높이 18dp와 Android 폰트 여백 설정을 명시했습니다.
- 키보드를 열면 탭을 숨기고, 앱 시작 시 `initialWindowMetrics`로 초기 안전 영역을 제공합니다.
- 학습 기록의 안내 카드도 특수 문자 대신 같은 SVG 아이콘을 사용합니다.

## 변경 파일

- `App.tsx`
- `src/navigation/MainTabs.tsx`
- `src/navigation/MainTabIcon.tsx`
- `src/navigation/MainTabScreens.tsx`
- `package.json`, `pnpm-lock.yaml`

추가 패키지는 `react-native-svg@15.15.4` 하나입니다. 현재 설치된 Expo SDK 57의 `bundledNativeModules.json`에 지정된 버전에 맞췄습니다. 기존 Expo·React Native 버전은 변경하지 않았습니다.

## 적용

최신 소스를 받은 프로젝트 폴더에서:

```sh
pnpm install --frozen-lockfile
pnpm dev:cloud
```

Expo Go에서 앱을 다시 엽니다. 이미 설치한 APK를 사용하는 경우 새 네이티브 의존성이 추가되었으므로 APK를 다시 빌드하고 설치해야 합니다. `expo export`로 만든 JavaScript 번들은 설치 가능한 APK가 아닙니다.

추가 패키지만 직접 설치할 때의 명령은 다음과 같습니다. 저장소에 최신 잠금 파일이 있으므로 일반적으로는 위 설치 명령을 사용합니다.

```sh
pnpm add react-native-svg@15.15.4
```

## 확인 범위

TypeScript 컴파일과 Android용 JavaScript/Hermes 번들 생성을 수행했습니다. 자동 테스트는 추가하거나 실행하지 않았습니다. Android 실기기·에뮬레이터에서 제스처/3버튼 내비게이션, 시스템 글자 확대, 탭 전환과 키보드 열기·닫기의 실제 화면 확인은 남아 있습니다. iOS 네이티브 실행도 이번 수정에서 수행하지 않았습니다.

## 참고

- [React Navigation 탭 설정](https://reactnavigation.org/docs/bottom-tab-navigator/)
- [안전 영역 처리](https://reactnavigation.org/docs/handling-safe-area/)
- [Expo SVG](https://docs.expo.dev/versions/latest/sdk/svg/)
