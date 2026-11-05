# Claude Code Codex Mods

Claude Code의 메인 대화에서 Codex에 로그인한 ChatGPT 계정의 GPT 모델을 사용하는 실행 도우미입니다.

실제 모델 연결과 Claude Mods 구현은 [greenpolo/cc-multi-cli-plugin](https://github.com/greenpolo/cc-multi-cli-plugin)을 사용합니다. 이 저장소는 해당 프로젝트를 고정 버전으로 설치하고, 실행할 때마다 Codex의 모델 목록을 조회하는 래퍼와 로컬 호환성 패치를 제공합니다. Anthropic 또는 OpenAI의 공식 제품이 아닙니다.

## 준비 사항

- Linux 또는 WSL의 Bash 환경. macOS와 Windows 네이티브에서는 이 래퍼를 검증하지 않았습니다.
- Claude Code와 Claude Mods를 사용할 수 있는 환경
- Codex CLI와 사용할 모델에 접근 가능한 ChatGPT 계정
- Git, npm, Python 3

Claude Code와 Codex CLI는 미리 설치되어 있어야 합니다. Claude Code 자체의 로그인·이용 조건은 별도로 충족해야 합니다.

## 설치

```bash
git clone https://github.com/kangmomin/claude-code-codex-mods.git
cd claude-code-codex-mods
codex login
./run setup
```

설치 스크립트는 저장소 내부에 Node `24.12.0`과 고정 버전의 upstream을 내려받고, 로컬 패치를 적용한 뒤 `multi-openai` 플러그인을 사용자 범위에 설치합니다. upstream의 `multi-core` 의존성도 함께 설치됩니다. 기존 `claude` 실행 파일과 셸 설정 파일은 변경하지 않습니다.

`~/.local/bin/claude-multi`가 비어 있으면 이 저장소의 실행 스크립트로 연결합니다. 이미 다른 실행 파일이 있으면 덮어쓰지 않습니다. `~/.local/bin`이 `PATH`에 없거나 기존 명령이 있다면 `./run claude`를 사용하세요.

## 실행

```bash
# 저장소 안에서
./run claude

# 다른 작업 디렉터리에서 실행: 해당 디렉터리가 작업 공간으로 유지됩니다.
claude-multi

# 계정에서 현재 사용할 수 있는 모델 목록 조회
./run models
```

Claude Code 안에서 `/model`로 `multi/openai/` 접두사가 붙은 모델을 선택할 수 있습니다. 시작할 때 지정하려면 `./run models`에서 확인한 모델 ID를 사용하세요.

```bash
./run claude --model "multi/openai/<모델 ID>"
```

기본값은 Codex가 기본 모델로 반환하는 모델입니다. 모델 이름을 고정된 목록으로 관리하지 않으며, 목록 조회에 실패하면 실행을 중단합니다. 계정·플랜·클라이언트 버전에 따라 제공되는 모델은 달라질 수 있습니다.

## 구성과 출처

- `run`, `claude-multi`: 현재 작업 디렉터리와 CLI 인수를 유지하는 실행 도우미
- `install-mods`: Node와 upstream 설치 및 플러그인 등록
- `mods.mjs`: Codex `app-server`의 `model/list` 조회와 모델 레지스트리 연결
- `patches/legacy-codex-auth.patch`: `auth_mode`가 없는 구형 Codex 구독 인증 형식 호환. API 키 인증은 계속 거절합니다.
- `patches/terminal-resize.patch`: 분리된 Claude 자식 프로세스에 터미널 크기 변경 신호 전달
- `tests/mods_catalog.test.mjs`: 모델 검색·페이지네이션·실패 처리·요청 허용 목록 테스트

upstream은 커밋 `3dcb057c10b16d3ed911e8ce509e91398712c906`에 고정되어 있습니다. 모델 레지스트리 연결은 이 버전의 내부 구현에 의존하므로 upstream을 임의로 교체하지 마세요. 패치는 이 저장소에서 제공하는 수정이며 upstream 원본에 포함된 기능으로 표시하지 않습니다.

이 저장소 자체는 단독 설치형 Claude 플러그인이나 marketplace가 아닙니다. `./run setup`이 upstream marketplace에서 실제 플러그인을 설치합니다. 기존 LiteLLM 프록시 실험 코드는 포함하지 않습니다.

## 인증과 데이터

- 사용자 인증 파일·API 키·개인 설정·대화 기록은 배포하지 않습니다.
- `mods.mjs`의 모델 목록 조회는 인증 파일을 직접 읽지 않고 Codex CLI를 사용합니다. 실제 모델 요청의 인증은 upstream 플러그인이 Codex 로그인 정보를 이용해 처리합니다.
- 선택한 GPT 모델의 대화와 도구 컨텍스트는 upstream 게이트웨이를 거쳐 OpenAI로 전달됩니다. 비밀정보나 회사 자료를 입력하기 전에 계정과 제공자의 데이터 처리 정책을 확인하세요.
- 모델 사용량과 제한은 해당 계정 및 제공자의 조건을 따릅니다. 이 도구가 무료 이용이나 구독 제한 우회를 보장하지 않습니다.
- `.state/`, `.tools/`, `vendor/`, `.venv/`는 로컬 생성물이며 Git에서 제외됩니다. 마지막 모델 목록은 `.state/codex-models.json`에 저장되지만 조회 실패 시 대체 목록으로 사용하지 않습니다.

## 검증

설치 후 실행합니다. 아래 테스트는 모델 추론을 요청하지 않습니다.

```bash
bash -n run install-mods claude-multi
.tools/node_modules/.bin/node --check mods.mjs
.tools/node_modules/.bin/node --test tests/mods_catalog.test.mjs
.tools/node_modules/.bin/node --test \
  vendor/cc-multi-cli-plugin/test/unit/native-openai-auth.test.ts \
  vendor/cc-multi-cli-plugin/test/unit/native-launcher-exit.test.ts
```

## 제거

Claude Code의 플러그인 관리자에서 `multi-openai`를 제거합니다. 다른 Multi 플러그인에서 사용하지 않는 경우에만 `multi-core`도 제거하세요. 이 저장소를 가리키는 `~/.local/bin/claude-multi` 심볼릭 링크는 별도로 제거할 수 있습니다. Codex 로그인과 기존 `claude` 명령은 유지됩니다.

## 라이선스

Apache-2.0. `LICENSE`와 upstream의 출처를 보존한 `NOTICE`를 참고하세요. Claude Code, Codex 및 각 외부 서비스의 이용 조건은 별도로 적용됩니다.
