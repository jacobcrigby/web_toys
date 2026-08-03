// SPDX-License-Identifier: Apache-2.0

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Call `listener` whenever the colour scheme changes. */
export function onThemeChange(listener: (dark: boolean) => void): void {
  window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
    listener(event.matches);
  });
}
