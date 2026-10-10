import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC7() {
  return mountChart({
    id: "chart-7",
    url: "charts/c7-income-spending.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      const axisAllowance = Math.ceil(fontSize * 6 + 32);

      // Preserve readable bars and labels on narrow screens.
      spec.width = Math.max(
        620,
        Math.min(920, availableWidth - axisAllowance)
      );

      spec.height = Math.max(
        380,
        Math.round(fontSize * 22)
      );

      applyTextSize(spec, fontSize);

      return spec;
    },
  });
}