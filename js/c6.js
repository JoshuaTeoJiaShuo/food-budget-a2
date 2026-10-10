import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export async function initialiseC6() {
  if (!document.getElementById("chart-6")) return null;

  const selector = document.getElementById("c6-basis");

  const controller = await mountChart({
    id: "chart-6",
    url: "charts/c6-household-heatmap.vl.json",

    signals: {
      spendingBasis: selector.value,
    },

    prepare(spec, { availableWidth, fontSize }) {
      const labelAllowance = Math.ceil(
        fontSize * 10 + 40
      );

      // Preserve readable cells; narrow screens scroll horizontally.
      const minimumWidth =
        Math.ceil(fontSize * 5.7) * 7;

      spec.width = Math.max(
        minimumWidth,
        Math.min(980, availableWidth - labelAllowance)
      );

      spec.height =
        12 * Math.max(44, Math.ceil(fontSize * 2.6));

      applyTextSize(spec, fontSize);

      // Reserve space for household headings of up to four lines.
      const lineHeight = Math.ceil(fontSize * 1.25);

      Object.assign(spec.encoding.x.axis, {
        labelLineHeight: lineHeight,
        labelPadding: lineHeight * 3 + 16,
        labelLimit: Math.floor(spec.width / 7),
      });

      Object.assign(spec.encoding.y.axis, {
        labelLineHeight: Math.ceil(fontSize * 1.2),
        labelLimit: Math.ceil(fontSize * 10),
      });

      return spec;
    },
  });

  selector.disabled = false;

  selector.addEventListener(
    "change",
    () => {
      controller.setSignal(
        "spendingBasis",
        selector.value
      );
    },
    { signal: controller.events }
  );

  return controller;
}