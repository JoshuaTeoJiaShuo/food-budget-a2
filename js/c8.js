import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC8() {
  return mountChart({
    id: "chart-8",
    url: "charts/c8-food-budget-share.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      const axisAllowance = Math.ceil(fontSize * 6 + 32);

      spec.width = Math.max(
        620,
        Math.min(920, availableWidth - axisAllowance)
      );

      spec.height = Math.max(
        320,
        Math.round(fontSize * 18)
      );

      applyTextSize(spec, fontSize);

      return spec;
    },
  });
}