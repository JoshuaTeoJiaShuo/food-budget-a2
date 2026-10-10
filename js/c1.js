import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

import {
  CATEGORY_ORDER,
  makeCompactC1,
} from "./c1-compact.js";

export async function initialiseC1() {
  const container = document.getElementById("chart-1");
  if (!container) return null;

  const panel = container.closest("figure");
  const status = document.getElementById("c1-selection-status");

  let controller;

  controller = await mountChart({
    id: "chart-1",
    url: "charts/c1-food-shares.vl.json",

    signals: {
      focusedCategory: "",
    },

    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);

      const labelRail = Math.ceil(fontSize * 18 + 76);
      const minimumPlotWidth = Math.ceil(fontSize * 25);

      const compact =
        availableWidth < labelRail + 80 + minimumPlotWidth;

      panel.classList.toggle("is-compact", compact);

      spec.params.find(
        (parameter) => parameter.name === "labelRail"
      ).value = labelRail;

      if (compact) {
        return makeCompactC1(spec, availableWidth, fontSize);
      }

      spec.width = availableWidth - labelRail - 80;
      spec.height = Math.round(fontSize * 22 + 80);

      return spec;
    },

    afterRender(view) {
      view.addEventListener("pointermove", (event, item) => {
        const category = item?.datum?.category;

        controller?.setSignal(
          "focusedCategory",
          CATEGORY_ORDER.includes(category) ? category : ""
        );
      });
    },
  });

  const listenerOptions = {
    signal: controller.events,
  };

  function focusCategory(category, announce = false) {
    controller.setSignal("focusedCategory", category);

    if (announce && status) {
      status.textContent = category
        ? `Highlighted category: ${category}`
        : "All categories shown.";
    }
  }

  container.addEventListener(
    "pointerleave",
    () => focusCategory(""),
    listenerOptions
  );

  container.addEventListener(
    "blur",
    () => focusCategory(""),
    listenerOptions
  );

  container.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        focusCategory("", true);
        return;
      }

      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }

      event.preventDefault();

      const current = CATEGORY_ORDER.indexOf(
        controller.getSignal("focusedCategory")
      );

      const direction = event.key === "ArrowRight" ? 1 : -1;

      const next =
        current < 0
          ? direction > 0
            ? 0
            : CATEGORY_ORDER.length - 1
          : (current + direction + CATEGORY_ORDER.length) %
            CATEGORY_ORDER.length;

      focusCategory(CATEGORY_ORDER[next], true);
    },
    listenerOptions
  );

  return controller;
}