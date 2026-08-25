# Figthread

Figthread는 claim에서 semantic figure IR을 거쳐 deterministic한 HTML/SVG figure로 이어지는 authoring system입니다.

현재 저장소는 설계 baseline과 첫 번째 실행 가능한 기반만 포함합니다.

- `docs/sepc/figthread_design_canvas.html` — v1.0 설계·결정 캔버스
- `schemas/figure-spec.schema.json` — `FigureSpec 0.1` 구조 계약
- `src/validator.js` — structural + core semantic gate의 최소 구현
- `examples/minimal.figure.json` — 통과하는 최소 FigureSpec
- `skills/figthread/` — Claude Code/Codex에 설치할 수 있는 스킬 본체와 참조 리소스

## Skill 설치

이 저장소는 `skills/<skill-name>/SKILL.md` 규약을 따르므로 GitHub에 push한 뒤
Claude Code 또는 Codex에 다음처럼 설치할 수 있습니다.

```bash
npx skills add ictseoyoungmin/figthread --agent claude-code
npx skills add ictseoyoungmin/figthread --agent codex
```

스킬 이름을 명시해야 하는 CLI 버전에서는 다음 형식을 사용합니다.

```bash
npx skills add ictseoyoungmin/figthread --skill figthread --agent codex
```

Claude Code marketplace와 Codex plugin metadata도 함께 제공합니다.

- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- `.codex-plugin/plugin.json`
- `skills/figthread/agents/openai.yaml`

실제 스킬은 `SKILL.md`와 `references/`, `templates/`, `assets/`만으로
self-contained하게 동작하고, root의 `src/`·`examples/`·`test/`는 개발/검증용입니다.

## 시작하기

Node.js 20 이상에서 외부 의존성 없이 실행할 수 있습니다.

```bash
npm test
npm run validate -- examples/minimal.figure.json
```

validator는 JSON report를 stdout으로 출력합니다. promotion 가능한 문서는 `status: "pass"`와 빈 `issues`를 반환하며, 오류가 있는 문서는 non-zero exit code를 반환합니다.

## 현재 범위

이번 scaffold는 설계 문서의 IR gate에 집중합니다.

- stable ID uniqueness와 typed reference integrity
- claim witness / semantic node reachability
- parent cycle 및 root reachability
- state domain의 `initial`·`summary` 값
- `static_snapshot_id`와 snapshot reference
- semantic IR 내부의 resolved geometry 차단
- `extensions` namespaced container 규칙

layout engine, MotionSpec compiler, renderer/exporter는 다음 vertical slice에서 추가합니다. 유효한 `FigureSpec`만 downstream 단계의 authoritative input이 될 수 있도록 이 경계를 먼저 고정했습니다.
