import type { ElementFingerprint } from '../../shared/types';

// Classes that change dynamically and break fingerprint matching
const UNSTABLE_CLASS = /^(is-|has-|js-|active$|hover$|focus$|selected$|disabled$|\w*\d{4,}\w*)/;

function stableClasses(el: Element): string[] {
  return Array.from(el.classList)
    .filter(c => !UNSTABLE_CLASS.test(c))
    .slice(0, 5);
}

function getXPath(el: Element): string {
  if (el.id) return `//*[@id="${el.id}"]`;

  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node !== document.documentElement) {
    const parent = node.parentElement;
    if (!parent) break;

    const siblings = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
    const suffix = siblings.length > 1 ? `[${siblings.indexOf(node) + 1}]` : '';
    parts.unshift(`${node.tagName.toLowerCase()}${suffix}`);
    node = parent;
  }

  return '/' + parts.join('/');
}

const TEXT_TAGS = new Set(['button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'span', 'p', 'li']);

export function captureFingerprint(el: Element): ElementFingerprint {
  const rect = el.getBoundingClientRect();
  const tag = el.tagName.toLowerCase();
  const htm = el as HTMLElement;
  const inp = el as HTMLInputElement;
  const anc = el as HTMLAnchorElement;

  const raw = (htm.textContent ?? '').trim().replace(/\s+/g, ' ');

  return {
    tag,
    id: el.id || undefined,
    dataTestId: htm.dataset.testid || htm.dataset.cy || undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
    ariaRole: el.getAttribute('role') || undefined,
    name: inp.name || undefined,
    placeholder: inp.placeholder || undefined,
    inputType: tag === 'input' ? inp.type : undefined,
    innerText: TEXT_TAGS.has(tag) && raw ? raw.slice(0, 80) : undefined,
    href: tag === 'a' ? anc.pathname + anc.search : undefined,
    xpath: getXPath(el),
    classes: stableClasses(el),
    rect: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
  };
}
