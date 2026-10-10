import {
  mountChart,
  applyTextSize,
  mapLayout,
  walkLayers,
} from "./chart-utils.js";

export function initialiseC4() {
  return mountChart({
    id: "chart-4",
    url: "charts/c4-state-food-share.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      Object.assign(spec, mapLayout(availableWidth));
      applyTextSize(spec, fontSize);

      Object.assign(spec.config.legend, {
        titleLimit: 0,
        labelLimit: 0,
      });

      // Size the colour legend to suit the map's width.
      walkLayers(spec, (layer) => {
        const legend = layer.encoding?.color?.legend;

        if (legend) {
          legend.gradientLength = Math.min(
            440,
            Math.round(spec.width * 0.55)
          );
        }
      });

      return spec;
    },
  });
}