/** One measured reservation shared by floating panels, map fits and controls. */
export function panelLayout(options: {
  desktop: boolean;
  wide: boolean;
  dockOpen: boolean;
  hasInspector: boolean;
  bottomStackHeight: number;
}) {
  const left = options.desktop && options.dockOpen ? 356 : 0;
  const right = options.desktop && options.hasInspector ? 376 : 0;
  const bottom = 16 + Math.max(0, Math.ceil(options.bottomStackHeight));
  return {
    insets: { top: 64, left, right, bottom },
    panelBottom: bottom + 8,
    // At tablet widths two open docks leave almost no usable timeline width.
    // Keep its existing full-width mobile layout until both docks can fit.
    stackLeft: 16 + (options.wide ? left : 0),
    stackRight: 16 + (options.wide ? right : 0)
  };
}
