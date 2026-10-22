# AI Study Frontend

Expo SDK 57 · React Native · TypeScript 모바일 앱입니다. 이메일 인증 코드 로그인과 텍스트·사진 자료 등록·목록·상세·수정·삭제를 제공합니다. AI 기능은 이번 배포 준비 범위에서 제외합니다.

- 프론트 저장소: https://github.com/sgcoat/ai-study-frontend (비공개)
- 백엔드 저장소: https://github.com/sgcoat/ai-study-backend (비공개)
- 현재 API: https://jqhivsrfrkycfjefgoam.supabase.co/functions/v1/ai-study-api/api/v1
- 모바일 빌드 안내: [docs/MOBILE_DEPLOYMENT.md](docs/MOBILE_DEPLOYMENT.md)

## 설치와 실행

Node.js 24 이상, pnpm 12.4.2를 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev:cloud
```

`dev:cloud`는 공개 API의 준비 상태를 확인하고 루트 `.env`에 API 주소를 설정한 뒤 Expo를 엽니다. 휴대폰의 Expo Go로 QR 코드를 스캔합니다. 최초 클라우드 로그인은 이메일 인증을 다시 진행합니다. 백엔드를 이 저장소에서 별도로 실행하거나 설치할 필요가 없습니다.

직접 설정하려면 `.env.example`을 `.env`로 복사합니다. 앱 환경 파일에는 공개 API 주소와 공개 앱 식별자만 넣습니다. SMTP 비밀번호·AI 키·Supabase service role 키는 앱에 넣지 않습니다.

## 폴더

```text
src/api/          HTTP·토큰·공통 오류 처리
src/components/  공통 화면과 입력 컴포넌트
src/navigation/  인증 스택·메인 탭·기능 스택
src/features/    auth, materials, summaries, questions, records
src/types/       공통 데이터 계약
scripts/         모바일 설정 보고서·안전한 소스 내보내기
supabase/scripts/ 공개 API 연결·Expo 실행 도우미
```

이 저장소의 `supabase/`에는 앱 연결용 공개 프로젝트 정보와 실행 도우미만 있습니다. 서버 함수·SQL·SMTP 설정은 백엔드 저장소에서 관리합니다. 기본 앱 식별자 `com.sgcoat.aistudy`는 배포 준비용이며 스토어 등록 전에 소유권과 사용 가능 여부를 확인합니다.

```sh
pnpm mobile:prepare --profile preview --platform ios
pnpm mobile:prepare --profile preview --platform android
```

이 명령은 설정 보고서만 만듭니다. EAS 프로젝트 연결, 네이티브 빌드, 앱 서명, 스토어 업로드는 자동 실행하지 않습니다. 현재 범위는 모바일 앱 배포 준비까지입니다.
