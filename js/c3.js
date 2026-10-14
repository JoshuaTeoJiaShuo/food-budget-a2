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

      // Preserve the agreed graduated bands; exact amounts stay in tooltips.
      walkLayers(spec, (layer) => {
        if (layer.encoding?.size?.field === "spending_band") {
          layer.encoding.size.scale.range = [250, 900, 3200];
          Object.assign(layer.encoding.size.legend, {
            columns: 3,
            direction: "horizontal",
            title: "Weekly household spending",
            offset: 8,
            columnPadding: 12,
            labelOffset: 6,
          });
        }
      });
      return spec;
    },
  });
}
