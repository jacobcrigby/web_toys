// SPDX-License-Identifier: Apache-2.0
type Attrs = Record<string, string | boolean | undefined>;

export function h(
  tag: string,
  attrs: Attrs = {},
  ...children: (HTMLElement | string | null | undefined)[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function qs<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

export function clearEl(el: HTMLElement): void {
  while (el.firstChild) el.firstChild.remove();
}
