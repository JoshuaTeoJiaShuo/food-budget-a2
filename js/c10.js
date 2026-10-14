import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC10() {
  return mountChart({
    id: "chart-10",
    url: "charts/c10-food-security-waffle.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);

      const stacked = availableWidth < 900;

      // Keep the waffle square at every screen size.
      const size = stacked
        ? Math.max(280, Math.min(360, availableWidth - 32))
        : 360;

      spec.width = size;
      spec.height = size;

      Object.assign(spec.encoding.color.legend, {
        orient: stacked ? "bottom" : "right",
        direction: "vertical",
        columns: 1,
        offset: stacked ? 20 : 28,
        rowPadding: Math.round(fontSize * 0.9),
        labelFontSize: fontSize,
        titleFontSize: fontSize,
        labelLimit: 0,
        titleLimit: 0,

        // Shorter labels fit beneath the waffle on narrow screens.
        // Full source labels remain available in tooltips.
        labelExpr: stacked
          ? "replace(datum.label, ' food ', ' ')"
          : "datum.label",
      });

      return spec;
    },
  });
}