import { afterEach, beforeEach } from 'vite-plus/test';

type ActEnvironmentGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function configureReactActEnvironment(): void {
  (globalThis as ActEnvironmentGlobal).IS_REACT_ACT_ENVIRONMENT = true;
}

configureReactActEnvironment();

if (
  typeof HTMLCanvasElement !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  /jsdom/i.test(navigator.userAgent)
) {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

beforeEach(() => {
  configureReactActEnvironment();
});

afterEach(() => {
  configureReactActEnvironment();
});
