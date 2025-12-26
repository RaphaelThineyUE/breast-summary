import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import type { } from '@testing-library/jest-dom/vitest';

expect.extend(matchers);

declare global {
  interface PromiseConstructor {
    withResolvers?<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

if (!Promise.withResolvers) {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });

    return { promise, resolve, reject };
  };
}

const suppressedWarnings = [
  'Cannot access the `require` function',
  'Cannot polyfill `DOMMatrix`',
  'Cannot polyfill `ImageData`',
  'Cannot polyfill `Path2D`',
  'Unable to load font data'
];

const shouldSuppressConsoleOutput = (args: unknown[]) => {
  const message = args.map(String).join(' ');
  if (suppressedWarnings.some((warning) => message.includes(warning))) {
    return true;
  }
  return false;
};

const originalWarn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args) => {
  if (shouldSuppressConsoleOutput(args)) {
    return;
  }
  originalWarn(...args);
});

const originalLog = console.log.bind(console);
vi.spyOn(console, 'log').mockImplementation((...args) => {
  if (shouldSuppressConsoleOutput(args)) {
    return;
  }
  originalLog(...args);
});
