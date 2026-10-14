import {
  mountChart,
  applyTextSize,
  loadCSV,
} from "./chart-utils.js";

export async function initialiseC4Flow() {
  const container = document.getElementById("chart-4");
  if (!container) return null;

  const selector = document.getElementById("c4-food-category");
  if (!selector) throw new Error("The C4 food-category selector is missing.");

  const [rows, locations] = await Promise.all([
    loadCSV("data/food-import-flows.csv"),
    loadCSV("data/food-trade-locations.csv"),
  ]);
  const originLabels = new Map(locations.map(row => [row.origin, row.label]));
  const finding = container.closest("figure").querySelector(".chart-finding");
  function updateFinding() {
    const leading = rows.filter(row => row.category === selector.value)
      .sort((a, b) => b.import_value_aud_million - a.import_value_aud_million)[0];
    if (leading && finding) {
      const amount = document.createElement("strong");
      amount.textContent = `A$${leading.import_value_aud_million.toFixed(1)} million`;
      finding.replaceChildren(
        document.createTextNode(`${originLabels.get(leading.origin) || leading.origin} led the six published origins, at `),
        amount,
        document.createTextNode("."),
      );
    }
  }
  updateFinding();
  let controller;

  function selectOrigin(origin) {
    controller?.setSignal("focusedOrigin", origin);
    const status = document.getElementById("c4-selection-status");
    if (status) status.textContent = origin ? `Highlighted origin: ${origin}` : "All six origins shown.";
  }

  controller = await mountChart({
    id: "chart-4",
    url: "charts/c4-food-import-flows.vl.json",
    signals: { foodCategory: selector.value, focusedOrigin: "" },

    prepare(spec, { availableWidth, fontSize }) {
      const paired = availableWidth >= 800;
      const gap = 20;
      const mapWidth = paired
        ? Math.floor((availableWidth - gap) * 0.54) - 24
        : Math.max(300, Math.min(600, availableWidth - fontSize * 9 - 64));
      const barWidth = paired
        ? availableWidth - mapWidth - gap - fontSize * 9 - 64
        : Math.max(220, Math.min(600, availableWidth - fontSize * 9 - 64));
      const height = Math.max(230, Math.round(mapWidth * 0.53));

      applyTextSize(spec, fontSize);
      const flows = spec.layer.find(layer => layer.encoding?.color?.field === "label");
      const connections = flows.layer.find(layer => layer.encoding?.strokeWidth);
      delete connections.params;
      // Both panels use the same short origin labels and colour scale.
      flows.transform.pop();
      flows.encoding.color = {
        condition: { test: "datum.origin === focusedOrigin", value: "#304c59" },
        value: "#839097",
      };
      flows.encoding.opacity = {
        condition: { test: "focusedOrigin === '' || datum.origin === focusedOrigin", value: 1 },
        value: 0.15,
      };
      for (const layer of flows.layer) {
        if (layer.transform) {
          layer.transform = [{ filter: "focusedOrigin !== '' && datum.origin === focusedOrigin" }];
        }
      }
      // The fixed line-width key sits in the shared HTML control strip.
      connections.encoding.strokeWidth.legend = null;

      const bars = {
        data: structuredClone(flows.data),
        transform: [
          ...structuredClone(flows.transform),
          { window: [{ op: "rank", as: "value_rank" }], sort: [{ field: "import_value_aud_million", order: "descending" }] },
          { calculate: "datum.value_rank === 1 ? format(datum.import_value_aud_million, '.1f') : ''", as: "value_label" },
        ],
        width: Math.round(barWidth),
        height,
        title: { text: "Import value (A$ million)", anchor: "start", fontSize, font: "Arial", color: "#223b36", offset: 14 },
        encoding: {
          y: {
            field: "label", type: "nominal",
            sort: { field: "import_value_aud_million", op: "max", order: "descending" },
            axis: { title: null, domain: false, ticks: false, labelPadding: 10, labelLimit: fontSize * 9 },
          },
          x: {
            field: "import_value_aud_million", type: "quantitative", stack: null,
            scale: { domain: [0, 120], nice: false, zero: true },
            axis: { title: null, values: [0, 40, 80, 120], domain: false, ticks: false, gridColor: "#e1e5de" },
          },
          color: structuredClone(flows.encoding.color),
          opacity: structuredClone(flows.encoding.opacity),
          tooltip: structuredClone(flows.encoding.tooltip),
        },
        layer: [{ mark: { type: "bar", size: Math.max(18, fontSize * 1.4), cursor: "pointer" } }],
      };
      // Keep numerical emphasis selective; exact values remain in tooltips.
      bars.layer.push({
        mark: { type: "text", align: "left", dx: 6, fontSize, color: "#223b36" },
        encoding: { text: { field: "value_label" }, color: { value: "#223b36" } },
      });

      const map = { width: mapWidth, height, projection: spec.projection, layer: spec.layer };
      return {
        $schema: spec.$schema,
        description: spec.description + " Ranked bars show the same six values, on a zero baseline.",
        background: spec.background,
        padding: 12,
        params: [{ name: "foodCategory", value: selector.value }, { name: "focusedOrigin", value: "" }],
        ...(paired ? { hconcat: [map, bars] } : { vconcat: [map, bars] }),
        spacing: gap,
        resolve: { scale: { color: "shared" } },
        config: spec.config,
      };
    },

    afterRender(view) {
      view.addEventListener("click", (event, item) => {
        const origin = item?.datum?.origin;
        if (!origin || origin === "Australia") return;
        selectOrigin(controller.getSignal("focusedOrigin") === origin ? "" : origin);
      });
      view.addEventListener("dblclick", () => selectOrigin(""));
    },
  });

  selector.disabled = false;
  selector.addEventListener("change", () => {
    selectOrigin("");
    updateFinding();
    controller.setSignal("foodCategory", selector.value);
  }, { signal: controller.events });

  const wrapper = container.closest(".chart-scroll");
  wrapper.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      selectOrigin("");
    } else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const origins = rows.filter(row => row.category === selector.value)
        .sort((a, b) => b.import_value_aud_million - a.import_value_aud_million)
        .map(row => row.origin);
      const current = origins.indexOf(controller.getSignal("focusedOrigin"));
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = current < 0 ? (direction === 1 ? 0 : origins.length - 1)
        : (current + direction + origins.length) % origins.length;
      selectOrigin(origins[next]);
    }
  }, { signal: controller.events });

  return controller;
}
