import chalk from "chalk";

import {
  INFO_SYMBOL,
  SLOW_TEST_THRESHOLD,
  SUCCESS_SYMBOL,
} from "./constants.js";
import { processGlobalDiagnostics } from "./diagnostics.js";
import {
  formatError,
  formatGlobalDiagnostics,
  indent,
  printParentStack,
} from "./formatting.js";
import { TestEventData, TestEventSource, TestReporterResult } from "./types.js";

export default async function* customReporter(
  source: TestEventSource,
): TestReporterResult {
  const diagnostics: Array<TestEventData["test:diagnostic"]> = [];

  const failures: Array<{
    data: TestEventData["test:fail"];
    parentStack: Array<TestEventData["test:start"]>;
  }> = [];

  const stack: Array<TestEventData["test:start"]> = [];
  let lastPrintedIndex: number | undefined;

  for await (const event of source) {
    switch (event.type) {
      case "test:diagnostic": {
        console.log(event.type);
        diagnostics.push(event.data);
        break;
      }
      case "test:start": {
        console.log(event.type, event.data.name);
        stack.push(event.data);
        break;
      }
      case "test:pass":
      case "test:fail": {
        console.log(event.type, event.data.name);
        if (event.data.details.type === "suite") {
          stack.pop();
          if (lastPrintedIndex !== undefined) {
            lastPrintedIndex = Math.max(lastPrintedIndex - 1, 0);
          }

          if (event.data.nesting === 0) {
            lastPrintedIndex = undefined;
            yield "\n";
          } else {
            if (lastPrintedIndex !== undefined) {
              lastPrintedIndex = lastPrintedIndex - 1;

              if (lastPrintedIndex < 0) {
                lastPrintedIndex = undefined;
              }
            }
          }

          continue;
        }

        if (lastPrintedIndex !== stack.length - 2) {
          yield* printParentStack(
            stack.slice(
              lastPrintedIndex !== undefined ? lastPrintedIndex + 1 : 0,
              -1,
            ),
          );
          lastPrintedIndex = stack.length - 2;
        }

        yield "".padEnd((event.data.nesting + 1) * 2);

        if (event.type === "test:pass") {
          if (event.data.skip === true || typeof event.data.skip === "string") {
            // TODO: show skip reason
            yield chalk.cyan(`- ${event.data.name}`);
          } else if (
            event.data.todo === true ||
            typeof event.data.todo === "string"
          ) {
            // TODO: show todo reason
            yield chalk.blue(`+ ${event.data.name}`);
          } else {
            const successMsg = `${SUCCESS_SYMBOL} ${event.data.name}`;
            yield chalk.gray(successMsg);
          }
        } else {
          failures.push({
            data: event.data,
            parentStack: [...stack],
          });

          const failureIndexHumanized = failures.length;
          const failMsg = `${failureIndexHumanized}) ${event.data.name}`;

          yield chalk.red(failMsg);
        }

        if (event.data.details.duration_ms > SLOW_TEST_THRESHOLD) {
          const durationMsg = chalk.italic(
            `(${Math.floor(event.data.details.duration_ms)}ms)`,
          );

          yield " ";
          yield chalk.red(durationMsg);
        }

        yield "\n";

        stack.pop();

        // Top-level tests are separated by an empty line
        if (event.data.nesting === 0) {
          yield "\n";
        }

        break;
      }
      case "test:stderr": {
        yield event.data.message;
        break;
      }
      case "test:stdout": {
        yield event.data.message;
        break;
      }
      case "test:plan": {
        // Do nothing
        break;
      }
      case "test:enqueue": {
        // Do nothing
        break;
      }
      case "test:dequeue": {
        console.log(event.type, event.data.name);
        // Do nothing
        break;
      }
      case "test:watch:drained": {
        // Do nothing
        break;
      }
      case "test:complete": {
        // Do nothing
        break;
      }
      case "test:coverage": {
        yield chalk.red("\nTest coverage not supported by this reporter\n");
        break;
      }
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      default: {
        const _isNever: never = event;
        void _isNever;

        const type = (event as any).type;
        console.warn(`Unsuported node:test event type ${type}:`, event);
        break;
      }
    }
  }

  const diagnosticMessages = diagnostics
    .filter(({ nesting }) => nesting !== 0) // We should only ignore the recognized ones
    .map(({ message }) => `${INFO_SYMBOL} ${message}`)
    .join("\n");

  yield "\n";
  yield formatGlobalDiagnostics(processGlobalDiagnostics(diagnostics));

  if (diagnosticMessages.length > 0) {
    yield "\n";
    yield chalk.gray(diagnosticMessages);
  }

  yield "\n\n";

  for (const [i, { data, parentStack: parent }] of failures.entries()) {
    yield* printParentStack(parent, `${i + 1}) `, ":");
    yield "\n";
    yield indent(formatError(data.details.error), 3);
    yield "\n\n";
  }
}
