import { useEffect, useState } from "react";

/**
 * stdout의 columns/rows를 반응형으로 반환. SIGWINCH(resize) 이벤트 구독.
 *
 * 대체 후보로 `ink-use-stdout-dimensions`가 있으나, CJS 번들이라 Node 22+
 * (ESM 그래프 + top-level await) 환경에서 `require(ink)`가 `ERR_REQUIRE_ASYNC_MODULE`
 * 로 실패해 사용 불가. 훅 본체가 10줄 내외이므로 직접 구현이 가장 안정적.
 */
export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState(() => ({
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 40,
  }));

  useEffect(() => {
    const onResize = () => {
      setSize({
        columns: process.stdout.columns ?? 80,
        rows: process.stdout.rows ?? 40,
      });
    };
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  return size;
}
