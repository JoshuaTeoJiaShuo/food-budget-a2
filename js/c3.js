import {
  mountChart,
  applyTextSize,
  mapLayout,
  walkLayers,
} from "./chart-utils.js";

export function initialiseC3() {
  return mountChart({
    id: "chart-3",
    url: "charts/c3-state-meals.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      Object.assign(spec, mapLayout(availableWidth));
      applyTextSize(spec, fontSize);

      Object.assign(spec.config.legend, {
        titleLimit: 0,
        labelLimit: 0,
      });

      // Keep labels clear of their circles as text size changes.
      walkLayers(spec, (layer) => {
        if (
          layer.mark?.type === "text" &&
          layer.mark.dy?.expr
        ) {
          layer.mark.dy.expr =
            "datum.state_abbr === 'VIC' || " +
            "datum.state_abbr === 'TAS' ? " +
            `${fontSize + 20} : -${fontSize + 16}`;
        }
      });

      return spec;
    },
  });
}