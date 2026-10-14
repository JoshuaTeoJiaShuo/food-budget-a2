import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export async function initialiseC4Flow() {
  const container = document.getElementById("chart-4");

  if (!container) return null;

  const selector = document.getElementById("c4-food-category");

  if (!selector) {
    throw new Error("The C4 food-category selector is missing.");
  }

  const controller = await mountChart({
    id: "chart-4",
    url: "charts/c4-food-import-flows.vl.json",

    signals: {
      foodCategory: selector.value,
    },

    prepare(spec, { availableWidth, fontSize }) {
      spec.width = Math.max(
        480,
        Math.min(1000, availableWidth - 28)
      );

      spec.height = Math.round(spec.width * 0.53);

      applyTextSize(spec, fontSize);

      // Allow complete legend titles at every reading size.
      spec.config.legend.titleLimit = spec.width;

      const flows = spec.layer.find(
        (layer) => layer.encoding?.color?.field === "label"
      );

      if (flows) {
        const originLegend = flows.encoding.color.legend;

        originLegend.columns = spec.width >= 700 ? 2 : 1;

        originLegend.labelLimit = Math.floor(
          spec.width / originLegend.columns - 55
        );

        originLegend.columnPadding = 20;
        originLegend.rowPadding = Math.ceil(fontSize * 0.6);

        const connections = flows.layer.find(
          (layer) => layer.encoding?.strokeWidth
        );

        if (connections) {
          const widthLegend =
            connections.encoding.strokeWidth.legend;

          // Longer samples make differences in thickness easier to read.
          widthLegend.symbolSize = 1600;
          widthLegend.columnPadding = 20;
          widthLegend.labelOffset = 10;
        }
      }

      return spec;
    },
  });

  selector.disabled = false;

  selector.addEventListener(
    "change",
    () => {
      controller.setSignal("foodCategory", selector.value);
    },
    { signal: controller.events }
  );

  return controller;
}