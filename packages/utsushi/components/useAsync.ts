import { useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; value: T };

export const useAsync = <T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> => {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    load().then(
      (value) => alive && setState({ status: "ready", value }),
      (error) => alive && setState({ status: "error", error }),
    );
    return () => {
      alive = false;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: 呼び出し側が渡す deps で読み直す
  }, deps);
  return state;
};
