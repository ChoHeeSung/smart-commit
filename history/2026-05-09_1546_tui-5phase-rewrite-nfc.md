# 2026-05-09 15:46 — TUI 5-phase 전면 재작성 + NFC 한국어 정렬 해결

## 지시 요약

> "TUI 시스템전체를 갈아 엎고싶어. 지금 구성된것을 참조하지말고 새로운 UI/UX를 개발할거야."
> 1. 검색된 레포 리스트 표시
> 2. 커밋/push 할 레포 선택 가능
> 3. 커밋 메시지 직관적 표시
> 4. 사용자 최소 개입 (현재는 commit/push 매번 물어봐서 자동화 의미 없음)
> 5. 한국어 표기 줄/열 정렬 (라이브러리 검증)
> 6. 실제 ~/work에서 실행해 출력 검증

## 작업 내용

### 1. 화면 흐름 재설계

기존 modal-overlay 기반 multi-pane UI(좌 RepoPane / 우 ActivityPane+LogPane / 모달 5종)를 통째로 제거하고 단일 phase 라우터로 교체.

`scan → select → preview → execute → done`

| Phase | 역할 | 입력 |
|---|---|---|
| scan | 진행률 단일 라인 | (없음) |
| select | 레포 체크리스트 (기본 dirty 전체 체크) | ↑↓ Space `a` Enter q |
| preview | AI 메시지 일괄 생성 → 카드 리스트 | ↑↓ / Enter / ESC |
| execute | `[i/N] repo ✓commit ✓push` 진행 로그 | ESC(=현재 op 끝나고 중단) |
| done | 성공/실패 요약 | 키 입력 시 종료 |

### 2. Prompt 자동화 (사용자 개입 최소화)

제거된 modal/prompt 5종:
- `promptGroupAction` (그룹별 commit/skip)
- `promptPushAction` (레포별 push/local)
- `confirmWarned` (위험 파일 포함 확인)
- `confirmLfsInit` / `selectLfsExtensions` / `confirmLfsInstall` (LFS 인터랙션)
- `promptOfflineTemplate` (오프라인 템플릿 선택)

LFS는 `config.safety.lfsAutoTrack/lfsAutoInstall` 설정 기반 무프롬프트로 변경. 큰 파일이 있으면 그 레포만 skip + done 요약에 표시.

### 3. 한국어 정렬 — 핵심 발견 & 해결

**증상**: ~/work 의 한글 폴더 (`P_경기남부`, `P_평택동부` 등)가 섞이면 좌·우 panel 사이 `│` 보더가 행마다 들쭉날쭉.

**원인**:
- macOS HFS+ filesystem이 한글 파일명을 NFD(분해형)로 반환
- 예: "견" = ᄀ(U+1100) + ᅧ(U+1167) + ᆫ(U+11AB) — 3 codepoint
- `string-width` 라이브러리는 NFD jamo를 별개 codepoint로 합산해 한 글자 당 3~4 cols로 잘못 측정
  - Choseong(자음 초성) = 2 cols
  - Jungseong(모음 중성) = 1 col (combining 처리 안 됨)
  - Jongseong(자음 종성) = 1 col
  - 합계 = 한 글자 당 3~4 cols (실제 터미널 렌더링은 2 cols)
- 결과: pad 계산이 실제보다 1~2 cols 더 크게 잡혀 트레일링 spaces 부족 → Box 폭 어긋남

**해결**: 모든 측정/패딩 직전 `s.normalize('NFC')` 적용.
- "견" NFD(3 codepoint) → NFC(1 codepoint U+ACAC) → string-width = 2 정확

### 4. width.ts 강화

```ts
export function nfc(s: string): string {
  return s.normalize("NFC");
}

export function inkWidth(s: string): number {
  return stringWidth(nfc(s), { ambiguousIsNarrow: true });
}

export function inkPad(s: string, width: number): string {
  const norm = nfc(s);
  const gap = width - stringWidth(norm, { ambiguousIsNarrow: true });
  return gap > 0 ? norm + " ".repeat(gap) : norm;
}
```

추가:
- `alignTable(rows, totalWidth, specs)` — 컬럼별 min/max/weight 자동 분배
- `inkTruncate` — Ink layout과 폭 합의되는 절단
- `containsHangul`, `cwCenter` 보조 유틸

### 5. 검증

`tests/cjk-alignment.test.ts` 8 케이스:
- Hangul 폭 측정 (locale 무관 2 cols)
- `cellPad` 정확한 폭 패딩
- ASCII '..' 사용 (ambiguous '…' 회피)
- Hangul 경계 절단
- alignTable 모든 행 동일 폭
- 자연 폭 초과 시 자동 축소

실제 ~/work 검증 (cmux pane 직접 제어):
```
P_제이영동/03. 재구축              cp=94, hangul=7, display=101 ✓
P_창원부산/00.cbits_doc_ftms_new  cp=97, hangul=4, display=101 ✓
P_평택동부/02. 구축                cp=95, hangul=6, display=101 ✓
scripts/smart-commit (ASCII)       cp=101, hangul=0, display=101 ✓
```

모든 행이 정확히 터미널 디스플레이 컬럼 101에 일치 → `│` 한 일자 정렬.

## 결과

**삭제**: src/ui/{components,layout,modals}/* 17 파일

**신규**:
- src/ui/screens/{Scan,Select,Preview,Execute,Done}Screen.tsx
- tests/cjk-alignment.test.ts

**수정 (핵심)**:
- src/ui/App.tsx: phase 라우터로 단순화
- src/ui/store.ts: 5 phase state machine 재설계 (282 lines)
- src/ui/index.tsx: UI interface를 runSelect/runPreview/runExecute/runDone + 헤드리스 분기로 축소
- src/ui/width.ts: NFC 정규화 + alignTable + inkWidth (200 lines)
- src/index.ts: prompt 호출 제거, AI 메시지 일괄 생성 후 Enter 한 번으로 commit+push (522→327 lines)
- src/i18n.ts: 사용 안 하는 24개 prompt 키 제거
- src/conflict-resolver.ts: confirmWarned 의존 제거
- src/mcp-server.ts: noopUI를 새 UI 타입에 맞춰 갱신

**Net diff**: 41 files, +855 / -2157 (= -1302 lines, 거의 절반 감축)

## 핵심 코드 스니펫

PreviewListRow — 멀티 `<Text>` 분해 + 정확한 width 패딩으로 좌·우 panel 경계 보존:

```tsx
function PreviewListRow({ preview, focused, width }) {
  const cursorMark = focused ? "▶ " : "  ";
  const iconCell = `${statusIcon(preview.status)} `;
  const headW = inkWidth(cursorMark) + inkWidth(iconCell);
  const nameTrunc = inkTruncate(shortRepoPath(preview.repo.path), Math.max(4, width - headW));
  const used = headW + inkWidth(nameTrunc);
  const trailing = " ".repeat(Math.max(0, width - used));
  return (
    <Text>
      <Text bold color={focused ? "cyan" : undefined}>{cursorMark}</Text>
      <Text bold color={statusColor(preview.status) ?? "gray"}>{iconCell}</Text>
      <Text color={focused ? "cyan" : statusColor(preview.status)} bold={focused}>{nameTrunc}</Text>
      <Text>{trailing}</Text>
    </Text>
  );
}
```

## 현실 비유

NFC vs NFD 정렬 문제는 **레고 블록 vs 조립 완성품 측정** 과 같다.

- NFD = "낱개 블록 더미" (자음 + 모음 + 받침 분리 보관)
- NFC = "조립된 한 글자" (合 = 1개 단위)

`string-width` 자(尺)는 박스 안 블록 개수를 세는데, 자음 블록은 "큰 블록(2칸)", 모음·받침은 "작은 블록(1칸)"이라고 각각 잰다.
- 낱개 보관(NFD) "ᄀ + ᅧ + ᆫ" → 자가 2+1+1 = **4칸** 으로 측정
- 조립품(NFC) "견" → 자가 **2칸** 으로 측정 (실제 터미널이 그리는 폭과 일치)

해결책은 자로 재기 직전에 **블록을 조립부터 시키기** (`s.normalize('NFC')`). 측정도구(string-width)와 렌더링(터미널)이 같은 기준으로 동작하니 정렬이 맞아떨어진다.
