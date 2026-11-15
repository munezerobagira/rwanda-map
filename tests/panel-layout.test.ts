import assert from 'node:assert/strict';
import { test } from 'node:test';
import { panelLayout } from '../src/lib/panelLayout';

test('panels and map controls share actual timeline size for every dock and comparison state', () => {
  for (const desktop of [false, true])
    for (const wide of [false, true])
      for (const dockOpen of [false, true])
        for (const hasInspector of [false, true])
          for (const bottomStackHeight of [52, 187.3, 321.7]) {
            const layout = panelLayout({ desktop, wide, dockOpen, hasInspector, bottomStackHeight });
            assert.equal(layout.insets.bottom, Math.ceil(bottomStackHeight) + 16);
            assert.equal(layout.panelBottom, layout.insets.bottom + 8);
            assert.equal(layout.insets.left, desktop && dockOpen ? 356 : 0);
            assert.equal(layout.insets.right, desktop && hasInspector ? 376 : 0);
            assert.equal(layout.stackLeft, 16 + (wide ? layout.insets.left : 0));
            assert.equal(layout.stackRight, 16 + (wide ? layout.insets.right : 0));
          }
});

test('tablet timeline retains usable width when both docks are open', () => {
  for (const viewportWidth of [768, 820, 1024, 1199]) {
    const layout = panelLayout({ desktop: true, wide: false, dockOpen: true, hasInspector: true, bottomStackHeight: 280 });
    assert.equal(viewportWidth - layout.stackLeft - layout.stackRight, viewportWidth - 32);
  }
  const wide = panelLayout({ desktop: true, wide: true, dockOpen: true, hasInspector: true, bottomStackHeight: 280 });
  assert.ok(1200 - wide.stackLeft - wide.stackRight >= 400);
});
