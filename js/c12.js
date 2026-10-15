// C12 | Parental-status comparison: estimates connected to the national benchmark.
import { mountChart, applyTextSize } from "./chart-utils.js";

export function initialiseC12() {
  return mountChart({
    id: "chart-12",
    url: "charts/c12-parental-food-security.vl.json",

    // CHART | Prepare the data encodings and responsive layout
    prepare(spec, { availableWidth, fontSize }) {
      // Reserve space for household labels and chart padding.
      const labelAllowance = Math.ceil(fontSize * 11 + 48);

      spec.width = Math.max(200, Math.min(760, availableWidth - labelAllowance));

      spec.height = Math.max(200, Math.round(fontSize * 14));

      applyTextSize(spec, fontSize);
      spec.padding.top = 12;

      const comparison = spec.layer.find((layer) => layer.encoding?.y?.field === "display_label");

      if (comparison) {
        const axis = comparison.encoding.y.axis;

        axis.labelLimit = Math.ceil(fontSize * 11);
        axis.labelLineHeight = Math.ceil(fontSize * 1.3);

        const labels = comparison.layer.find((layer) => layer.mark?.type === "text");

        if (labels) {
          labels.mark.align = "center";
          labels.mark.baseline = "bottom";
          labels.mark.dx = 0;
          labels.mark.dy = -Math.ceil(fontSize * 0.7);
        }
      }

      return spec;
    },
  });
}
