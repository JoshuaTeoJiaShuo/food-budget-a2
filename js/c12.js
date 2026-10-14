import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC12() {
  return mountChart({
    id: "chart-12",
    url: "charts/c12-parental-food-security.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      // Reserve space for household labels and chart padding.
      const labelAllowance = Math.ceil(fontSize * 13 + 64);

      spec.width = Math.max(
        360,
        Math.min(760, availableWidth - labelAllowance)
      );

      spec.height = Math.max(
        300,
        Math.round(fontSize * 16)
      );

      applyTextSize(spec, fontSize);

      const comparison = spec.layer.find(
        (layer) =>
          layer.encoding?.y?.field === "display_label"
      );

      if (comparison) {
        const axis = comparison.encoding.y.axis;

        axis.labelLimit = Math.ceil(fontSize * 12);
        axis.labelLineHeight = Math.ceil(fontSize * 1.3);

        const labels = comparison.layer.find(
          (layer) => layer.mark?.type === "text"
        );

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