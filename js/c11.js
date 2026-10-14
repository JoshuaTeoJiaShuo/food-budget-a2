import {
  mountChart,
  applyTextSize,
  mapLayout,
  walkLayers,
} from "./chart-utils.js";

export function initialiseC11() {
  return mountChart({
    id: "chart-11",
    url: "charts/c11-state-food-security.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      Object.assign(spec, mapLayout(availableWidth));
      applyTextSize(spec, fontSize);

      // Keep the legend readable at every text-size setting.
      walkLayers(spec, (layer) => {
        const legend = layer.encoding?.color?.legend;

        if (!legend) return;

        Object.assign(legend, {
          title: [
            "Households experiencing moderate",
            "or severe food insecurity",
          ],
          titleLimit: 0,
          labelLimit: 0,
          gradientLength: Math.min(
            440,
            Math.round(spec.width * 0.55)
          ),
        });
      });

      return spec;
    },
  });
}