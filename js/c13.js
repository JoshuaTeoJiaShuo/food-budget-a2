// C13 | Remote-store baskets: cost/premium buttons, district dropdown and store selection.
import { mountChart, applyTextSize, loadCSV } from "./chart-utils.js";

export async function initialiseC13() {
  const rows = await loadCSV("data/nt-market-basket-2023.csv");
  const container = document.getElementById("chart-13");
  let controller;
  function summary() {
    const row = rows.find((r) => r.store_id === controller?.getSignal("selectedStore"));
    document.getElementById("c13-selection-summary").hidden = !row;
    if (!row) {
      document.getElementById("c13-selection-summary").textContent =
        "Healthy-basket premiums: 3.8%–106.0%. Current-basket premiums: 9.9%–48.2%. Both compare with the same district supermarket.";
      return;
    }
    const ref = rows.find((r) => r.district === row.district && r.store_type === "District supermarket");
    const healthy = 100 * (row.healthy_basket_aud / ref.healthy_basket_aud - 1);
    const current = 100 * (row.current_basket_aud / ref.current_basket_aud - 1);
    document.getElementById("c13-selection-summary").textContent =
      `${row.store_id} · ${row.district}: healthy basket $${row.healthy_basket_aud.toFixed(2)} (${healthy.toFixed(1)}% premium); current basket $${row.current_basket_aud.toFixed(2)} (${current.toFixed(1)}% premium).`;
  }
  function select(id) {
    controller.setSignal("selectedStore", id);
    summary();
  }
  controller = await mountChart({
    id: "chart-13",
    url: "charts/c13-nt-basket-costs.vl.json",
    signals: { basketBasis: "cost", selectedStore: "", districtFocus: "" },
    // POINTER | Connect plotted marks to selection state
    afterRender(view) {
      view.addEventListener("click", (event, item) => {
        const id = item?.datum?.store_id;
        if (id) select(controller.getSignal("selectedStore") === id ? "" : id);
      });
      view.addEventListener("dblclick", () => select(""));
    },

    // CHART | Prepare the data encodings and responsive layout
    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);

      const premium =
        document.querySelector('[data-c13-basis="premium"]').getAttribute("aria-pressed") === "true";
      const paired = availableWidth >= 800;
      const columns = paired ? 2 : 1;
      const gap = 20;

      // Reserve the same district-label space in each panel.
      const labelWidth = Math.ceil(fontSize * 7);
      const panelWidth = Math.floor((availableWidth - 32 - gap * (columns - 1)) / columns);

      const plotWidth = Math.max(240, panelWidth - labelWidth - 24);

      const plotHeight = Math.max(240, fontSize * 16);
      const districts = ["Barkly", "Big Rivers", "Central Australia", "East Arnhem", "Top End"];

      const template = spec.spec;

      function makePanel(basket) {
        const panel = structuredClone(template);
        panel.encoding.x.scale.domain = premium ? [0, 110] : [550, 1450];
        panel.encoding.x.axis.title = premium ? "Above district supermarket (%)" : "Basket cost (A$)";
        panel.encoding.x.axis.format = premium ? ".0f" : "$,.0f";

        panel.width = plotWidth;
        panel.height = plotHeight;

        panel.title = {
          text: basket,
          anchor: "start",
          font: "Arial",
          fontSize,
          fontWeight: "bold",
          color: "#223b36",
          offset: 18,
        };

        panel.transform = [ { filter: { field: "basket_name", equal: basket, }, }, ];

        // Identical domains keep both panels directly comparable.
        panel.encoding.y.scale.domain = districts;

        Object.assign(panel.encoding.y.axis, {
          labelFontSize: fontSize,
          labelLineHeight: Math.ceil(fontSize * 1.2),
          labelLimit: labelWidth,
          labelPadding: 12,
          minExtent: labelWidth,
          maxExtent: labelWidth,
        });

        Object.assign(panel.encoding.x.axis, {
          labelFontSize: fontSize,
          titleFontSize: fontSize,
          values: premium ? [0, 50, 100] : [600, 1000, 1400],
        });

        const legend = panel.layer[0].encoding.color.legend;

        Object.assign(legend, {
          columns: availableWidth >= 650 ? 2 : 1,
          direction: availableWidth >= 650 ? "horizontal" : "vertical",
          labelFontSize: fontSize,
          rowPadding: 10,
        });

        return panel;
      }

      // Replace the facet layout with two equally sized panels.
      delete spec.facet;
      delete spec.spec;

      spec.concat = [makePanel("Healthy food basket"), makePanel("Current diet basket")];

      spec.columns = columns;
      spec.spacing = gap;
      spec.align = "all";
      spec.bounds = "full";

      spec.resolve = {
        scale: { x: "shared", y: "shared", color: "shared", shape: "shared", },
        axis: { x: "independent", y: "independent", },
        legend: { color: "shared", shape: "shared", },
      };

      return spec;
    },
  });
  const options = { signal: controller.events };
  document.querySelectorAll("[data-c13-basis]").forEach((button) =>
    button.addEventListener(
      "click",
      () => {
        document
          .querySelectorAll("[data-c13-basis]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        void controller.refresh({ basketBasis: button.dataset.c13Basis });
      },
      options,
    ),
  );
  document.getElementById("c13-district").addEventListener(
    "change",
    (e) => {
      controller.setSignal("districtFocus", e.target.value);
      select("");
    },
    options,
  );
  document.getElementById("c13-clear").addEventListener("click", () => select(""), options);
  // CONTROLS | DOM events and keyboard access
  // KEYBOARD | Arrow-key selection and Escape to clear
  container.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        select("");
        return;
      }
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const district = controller.getSignal("districtFocus");
      const candidates = rows.filter((r) => !district || r.district === district);
      const i = candidates.findIndex((r) => r.store_id === controller.getSignal("selectedStore"));
      const d = e.key === "ArrowRight" ? 1 : -1;
      select(
        candidates[
          i < 0 ? (d > 0 ? 0 : candidates.length - 1) : (i + d + candidates.length) % candidates.length
        ].store_id,
      );
    },
    options,
  );
  return controller;
}
