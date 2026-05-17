import type { ElementFingerprint } from '../../shared/types';

interface Candidate {
  el: Element;
  score: number;
}

function proximityScore(el: Element, stored: ElementFingerprint['rect']): number {
  const r = el.getBoundingClientRect();
  const dx = r.left + window.scrollX - stored.x;
  const dy = r.top + window.scrollY - stored.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, 100 - dist / 5);
}

function best(candidates: Candidate[], fp: ElementFingerprint): Element {
  const scored = candidates.map(({ el, score }) => ({
    el,
    total: score + proximityScore(el, fp.rect),
  }));
  scored.sort((a, b) => b.total - a.total);
  return scored[0].el;
}

export function resolveElement(fp: ElementFingerprint): Element | null {
  const candidates: Candidate[] = [];

  // Strategy 1 — id (exact, highest confidence)
  if (fp.id) {
    const el = document.getElementById(fp.id);
    if (el && el.tagName.toLowerCase() === fp.tag) return el;
  }

  // Strategy 2 — data-testid / data-cy
  if (fp.dataTestId) {
    const sel = `[data-testid="${CSS.escape(fp.dataTestId)}"], [data-cy="${CSS.escape(fp.dataTestId)}"]`;
    const els = document.querySelectorAll(sel);
    if (els.length === 1) return els[0];
    els.forEach(el => candidates.push({ el, score: 90 }));
  }

  // Strategy 3 — aria-label + tag
  if (fp.ariaLabel) {
    const els = document.querySelectorAll(`${fp.tag}[aria-label="${CSS.escape(fp.ariaLabel)}"]`);
    if (els.length === 1) return els[0];
    els.forEach(el => candidates.push({ el, score: 80 }));
  }

  // Strategy 4 — name attribute (inputs, selects)
  if (fp.name) {
    const els = document.querySelectorAll(`${fp.tag}[name="${CSS.escape(fp.name)}"]`);
    if (els.length === 1) return els[0];
    els.forEach(el => candidates.push({ el, score: 75 }));
  }

  // Strategy 5 — placeholder (inputs)
  if (fp.placeholder) {
    const els = document.querySelectorAll(`${fp.tag}[placeholder="${CSS.escape(fp.placeholder)}"]`);
    if (els.length === 1) return els[0];
    els.forEach(el => candidates.push({ el, score: 70 }));
  }

  // Strategy 6 — text content (buttons, links, headings)
  if (fp.innerText) {
    document.querySelectorAll(fp.tag).forEach(el => {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (text === fp.innerText) candidates.push({ el, score: 65 });
    });
  }

  // Strategy 7 — href for anchors
  if (fp.href) {
    document.querySelectorAll(`a`).forEach(el => {
      if (el.pathname + el.search === fp.href) candidates.push({ el, score: 68 });
    });
  }

  // Strategy 8 — XPath (fragile but always available as last resort)
  if (fp.xpath) {
    try {
      const result = document.evaluate(
        fp.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      );
      if (result.singleNodeValue) {
        candidates.push({ el: result.singleNodeValue as Element, score: 40 });
      }
    } catch {
      // XPath may be invalid on re-rendered pages — silently skip
    }
  }

  if (candidates.length === 0) return null;
  return best(candidates, fp);
}
