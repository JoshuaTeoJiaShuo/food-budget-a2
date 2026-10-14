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
      const size = stacked
        ? Math.max(280, Math.min(360, availableWidth - 32))
        : 360;

      const house =
        "M-1,-0.15L0,-1L1,-0.15L0.75,-0.15" +
        "L0.75,1L-0.75,1L-0.75,-0.15Z";

      spec.width = size;
      spec.height = size;

      spec.description =
        "Foodbank 2025 food-security estimates. Each house symbol " +
        "represents 1% of Australian households, not one household " +
        "or survey respondent.";

      spec.mark = {
        type: "point",
        shape: house,
        filled: true,
        opacity: 1,
        size: Math.pow((size / 10) * 0.78, 2),
        stroke: "#a997a5",
        strokeWidth: 0.6,
      };

      // Place symbols at the centres of 100 equally spaced cells.
      for (const channel of ["x", "y"]) {
        spec.encoding[channel].scale = {
          type: "band",
          paddingInner: 0,
          paddingOuter: 0,
        };
      }

      Object.assign(spec.encoding.color.legend, {
        title: null,
        orient: stacked ? "bottom" : "right",
        direction: "vertical",
        columns: 1,
        offset: stacked ? 20 : 28,
        rowPadding: Math.round(fontSize * 0.9),
        labelFontSize: fontSize,
        labelLimit: 0,
        symbolType: house,
        symbolSize: 200,
        labelExpr: stacked
          ? "replace(datum.label, ' food ', ' ')"
          : "datum.label",
      });

      return spec;
    },
  });
}