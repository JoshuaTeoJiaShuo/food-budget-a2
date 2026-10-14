import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC13() {
  return mountChart({
    id: "chart-13",
    url: "charts/c13-nt-basket-costs.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);

      const paired = availableWidth >= Math.max(900, fontSize * 44);
      const labelAllowance = Math.ceil(fontSize * 8 + 56);
      const gap = 28;

      spec.columns = paired ? 2 : 1;
      spec.spacing = gap;

      spec.spec.width = Math.max(
        320,
        Math.floor(
          (availableWidth - labelAllowance - (paired ? gap : 0)) /
          spec.columns
        )
      );

      spec.spec.height = Math.max(
        340,
        Math.round(fontSize * 18)
      );

      Object.assign(spec.facet.header, {
        labelFontSize: fontSize,
        labelLimit: 0,
        labelPadding: 16,
      });

      Object.assign(spec.spec.encoding.y.axis, {
        labelFontSize: fontSize,
        labelLineHeight: Math.ceil(fontSize * 1.2),
        labelLimit: Math.ceil(fontSize * 8),
      });

      const legend = spec.spec.layer[0].encoding.color.legend;

      legend.columns = availableWidth >= 600 ? 2 : 1;
      legend.direction = availableWidth >= 600
        ? "horizontal"
        : "vertical";

      legend.rowPadding = 10;

      return spec;
    },
  });
}