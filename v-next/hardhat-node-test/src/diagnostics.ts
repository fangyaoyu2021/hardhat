import { TestEventData } from "./types.js";

export interface GlobalDiagnostics {
  tests: number;
  suites: number;
  pass: number;
  fail: number;
  cancelled: number;
  skipped: number;
  todo: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  duration_ms: number;
}

export function processGlobalDiagnostics(
  diagnostics: Array<TestEventData["test:diagnostic"]>,
): GlobalDiagnostics {
  const result: GlobalDiagnostics = {
    tests: 0,
    suites: 0,
    pass: 0,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    duration_ms: 0,
  };

  for (const diagnostic of diagnostics) {
    if (diagnostic.nesting !== 0) {
      continue;
    }

    const [name, numberString] = diagnostic.message.split(" ");
    if (name !== undefined && numberString !== undefined) {
      try {
        const n = parseFloat(numberString);
        if (!(name in result)) {
          console.warn("Invalid global diagnostic name: ", name);
          continue;
        }

        result[name as keyof GlobalDiagnostics] = n;
      } catch {
        console.warn("Invalid global diagnostic message: ", diagnostic.message);
        continue;
      }
    }
  }

  return result;
}
