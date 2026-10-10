import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC9() {
  return mountChart({
    id: "chart-9",
    url: "charts/c9-food-price-horizon.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);

      const plot = spec.spec;
      const minimumWidth = Math.max(800, fontSize * 42);

      plot.width = Math.max(
        minimumWidth,
        Math.min(960, availableWidth - 32)
      );

      plot.height = Math.max(
        44,
        Math.round(fontSize * 2.4)
      );

      // Bring each heading closer to its strip.
      spec.spacing = 8;

      Object.assign(spec.facet.row.header, {
        labelFontSize: fontSize,
        labelPadding: 4,
      });

      // Increase contrast while retaining the brown–blue scale.
      plot.layer[0].encoding.color.scale.range = [
        "#d9bea7",
        "#b88c67",
        "#8e5d3c",
        "#59371f",
        "#bdd6e2",
        "#83afc4",
        "#4b829d",
        "#28566f",
      ];

      const timeEncoding = plot.encoding.x;

      timeEncoding.axis = {
        ...timeEncoding.axis,
        orient: "bottom",
        labelFontSize: fontSize,
      };

      // Reuse the existing hover layer for a second time axis.
      plot.layer[1].encoding.x = {
        ...timeEncoding,
        axis: {
          ...timeEncoding.axis,
          orient: "top",
        },
      };

      // Separate axis positions while preserving the shared time scale.
      plot.resolve = {
        ...plot.resolve,
        axis: {
          ...plot.resolve?.axis,
          x: "independent",
        },
      };

      return spec;
    },
  });
}