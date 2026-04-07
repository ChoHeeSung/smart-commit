import { describe, it, expect } from "vitest";
import { validateConventionalCommit } from "../src/ai-client.js";

describe("validateConventionalCommit", () => {
  it("should accept valid conventional commits", () => {
    expect(validateConventionalCommit("feat: 새 기능 추가")).toBe(true);
    expect(validateConventionalCommit("fix: 버그 수정")).toBe(true);
    expect(validateConventionalCommit("refactor: 코드 리팩토링")).toBe(true);
    expect(validateConventionalCommit("docs: 문서 업데이트")).toBe(true);
    expect(validateConventionalCommit("test: 테스트 추가")).toBe(true);
    expect(validateConventionalCommit("chore: 의존성 업데이트")).toBe(true);
    expect(validateConventionalCommit("perf: 성능 최적화")).toBe(true);
    expect(validateConventionalCommit("ci: CI 설정 변경")).toBe(true);
    expect(validateConventionalCommit("build: 빌드 설정 수정")).toBe(true);
    expect(validateConventionalCommit("revert: 이전 커밋 되돌림")).toBe(true);
  });

  it("should accept scoped conventional commits", () => {
    expect(validateConventionalCommit("feat(auth): 로그인 구현")).toBe(true);
    expect(validateConventionalCommit("fix(ui): 버튼 스타일 수정")).toBe(true);
    expect(validateConventionalCommit("refactor(api): 엔드포인트 재구성")).toBe(true);
  });

  it("should accept breaking change indicator", () => {
    expect(validateConventionalCommit("feat!: 호환성 깨는 변경")).toBe(true);
    expect(validateConventionalCommit("feat(api)!: API 변경")).toBe(true);
  });

  it("should accept multiline messages (validate first line only)", () => {
    const msg = "feat: 새 기능\n\n- 상세 내용 1\n- 상세 내용 2";
    expect(validateConventionalCommit(msg)).toBe(true);
  });

  it("should reject invalid conventional commits", () => {
    expect(validateConventionalCommit("새 기능 추가")).toBe(false);
    expect(validateConventionalCommit("Added new feature")).toBe(false);
    expect(validateConventionalCommit("FEAT: 대문자")).toBe(false);
    expect(validateConventionalCommit("feat:공백없음")).toBe(false);
    expect(validateConventionalCommit("feature: 잘못된 접두사")).toBe(false);
    expect(validateConventionalCommit("")).toBe(false);
  });
});
