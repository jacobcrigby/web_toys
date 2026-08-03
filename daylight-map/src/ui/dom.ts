// SPDX-License-Identifier: Apache-2.0

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  el.append(...children);
  return el;
}

/**
 * Create an SVG element with attributes and children.
 *
 * `document.createElement` yields an HTMLUnknownElement for SVG tag names, so
 * anything inside an <svg> has to go through createElementNS.
 */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  el.append(...children);
  return el;
}

/** Query a required element; throws if missing (mount-time invariant). */
export function qs<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Missing element: ${selector}`);
  }
  return el;
}

/** Replace an element's children in one step. */
export function replaceChildren(target: Element, ...children: (Node | string)[]): void {
  target.replaceChildren(...children);
}
