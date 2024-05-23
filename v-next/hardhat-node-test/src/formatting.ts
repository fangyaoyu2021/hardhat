import { inspect } from "node:util";

import chalk from "chalk";
import { diff } from "jest-diff";

import { TestEventData } from "./types.js";
import { GlobalDiagnostics } from "./diagnostics.js";

export function indent(str: string, spaces: number): string {
  const padding = " ".repeat(spaces);
  return str.replace(/^/gm, padding);
}

// TODO: We could improve the errors in two ways:
//    1. Clean up the node internal fames from the stack trace
//    2. Shore relative instead of absolute paths
//  Both of them require more manual string manipulation, so we are not doing it
//  right now.
export function formatError(error: Error): string {
  if ("code" in error && error.code === "ERR_TEST_FAILURE") {
    if (error.cause instanceof Error) {
      error = error.cause;
    }

    if ("failureType" in error && error.failureType === "cancelledByParent") {
      return (
        chalk.red("Test cancelled by parent error") +
        "\n" +
        chalk.gray(
          "    This test was cancelled due to an error in its parent suite/it or test/it, or in one of its before/beforeEach",
        )
      );
    }
  }

  const defaultFormat = inspect(error);
  const indexOfMessage = defaultFormat.indexOf(error.message);

  let title: string;
  let stack: string;
  if (indexOfMessage !== -1) {
    title = defaultFormat.substring(0, indexOfMessage + error.message.length);
    stack = defaultFormat
      .substring(indexOfMessage + error.message.length)
      .replace(/^(\r?\n)*/, "");
  } else {
    title = error.message;
    stack = error.stack ?? "";
  }

  title = chalk.red(title);
  stack = chalk.gray(stack);

  const diffResult = getErrorDiff(error);

  if (diffResult === undefined) {
    return `${title}
${stack}`;
  }

  return `${title}
${diffResult}

${stack}`;
}

export function formatGlobalDiagnostics(
  diagnostics: GlobalDiagnostics,
): string {
  let result =
    chalk.green(`${diagnostics.pass} passing`) +
    chalk.gray(` (${Math.floor(diagnostics.duration_ms)}ms)`);

  if (diagnostics.fail > 0) {
    result += chalk.red(`
${diagnostics.fail} failing`);
  }

  if (diagnostics.skipped > 0) {
    result += chalk.cyan(`
${diagnostics.skipped} skipped`);
  }

  if (diagnostics.todo > 0) {
    result += chalk.blue(`
${diagnostics.todo} todo`);
  }

  if (diagnostics.cancelled > 0) {
    result += chalk.gray(`
${diagnostics.cancelled} cancelled`);
  }

  return result;
}

export function* printParentStack(
  parentStack: Array<TestEventData["test:start"]>,
  prefix = "",
  suffix = "",
) {
  const prefixLength = prefix.length;

  for (const [i, parentTest] of parentStack.entries()) {
    if (i !== 0) {
      yield "\n";
    }
    yield "".padEnd((parentTest.nesting + 1) * 2 + (i ? prefixLength : 0));
    if (i === 0 && prefix) {
      yield prefix;
    }

    yield parentTest.name;
  }
  yield suffix + "\n";
}

function isDiffableError(
  error: Error,
): error is Error & { actual: any; expected: any } {
  return (
    "expected" in error && "actual" in error && error.expected !== undefined
  );
}

function getErrorDiff(error: Error): string | undefined {
  if (!isDiffableError(error)) {
    return undefined;
  }

  if ("showDiff" in error && error.showDiff === false) {
    return undefined;
  }

  return diff(error.expected, error.actual) ?? undefined;
}
