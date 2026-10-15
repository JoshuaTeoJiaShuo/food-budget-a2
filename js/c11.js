// C11 | Food-insecurity map: linked state bars and keyboard selection.
import { mountChart, applyTextSize, loadCSV, walkLayers } from "./chart-utils.js";

export async function initialiseC11() {
  const container = document.getElementById("chart-11");
  if (!container) return null;
  const states = await loadCSV("data/foodbank-state-2025.csv");
  const order = [...states].sort(
    (a, b) => b.moderate_or_severe_pct - a.moderate_or_severe_pct || a.state.localeCompare(b.state),
  );
  let controller;
  function selectState(code) {
    controller?.setSignal("selectedState", code);
    const status = document.getElementById("c11-selection-status");
    const state = states.find((row) => row.state_code === code);
    if (status)
      status.textContent = state
        ? `${state.state}: ${state.moderate_or_severe_pct}%. Sample: ${state.sample_n} respondents.`
        : "All states and territories shown.";
  }

  controller = await mountChart({
    id: "chart-11",
    url: "charts/c11-state-food-security.vl.json",
    signals: { selectedState: 0 },
    // CHART | Prepare the data encodings and responsive layout
    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);
      const paired = availableWidth >= 800;
      const gap = 24;
      const mapWidth = paired
        ? Math.floor((availableWidth - gap) * 0.6) - 24
        : Math.max(300, availableWidth - 100);
      const height = Math.round(mapWidth * 0.76);
      const barWidth = paired
        ? Math.max(180, availableWidth - mapWidth - gap - fontSize * 5 - 60)
        : Math.max(200, mapWidth);
      const opacity = {
        condition: { test: "selectedState === 0 || datum.state_code === selectedState", value: 1 },
        value: 0.2,
      };
      const stateLayer = spec.layer.find((layer) => layer.transform?.some((t) => t.as === "state_code"));
      stateLayer.encoding.opacity = opacity;
      let colours;
      const colourLegend = null;
      walkLayers(spec, (layer) => {
        if (layer.encoding?.color?.field !== "moderate_or_severe_pct") return;
        colours = structuredClone(layer.encoding.color.scale);
        layer.encoding.color.legend = null;
      });
      const bars = {
        data: { values: states },
        transform: [
          { calculate: "datum.state + (datum.state_code >= 7 ? ' †' : '')", as: "state_label" },
          {
            calculate:
              "datum.state_code === 7 || datum.moderate_or_severe_pct === 30 || datum.state_code === selectedState ? format(datum.moderate_or_severe_pct, '.0f') + '%' : ''",
            as: "value_label",
          },
        ],
        width: barWidth,
        height,
        title: {
          text: "Compare the state estimates",
          anchor: "start",
          font: "Arial",
          fontSize,
          color: "#223b36",
          offset: 12,
        },
        encoding: {
          y: {
            field: "state_label",
            type: "nominal",
            sort: { field: "moderate_or_severe_pct", op: "max", order: "descending" },
            axis: { title: null, ticks: false, domain: false, labelPadding: 10 },
          },
          x: {
            field: "moderate_or_severe_pct",
            type: "quantitative",
            stack: null,
            scale: { domain: [0, 55], nice: false },
            axis: {
              title: null,
              values: [0, 10, 20, 30, 40, 50],
              labelExpr: "datum.value + '%'",
              domain: false,
              ticks: false,
              gridColor: "#e1e5de",
            },
          },
          color: { field: "moderate_or_severe_pct", type: "quantitative", scale: colours, legend: colourLegend, },
          opacity,
          tooltip: [
            { field: "state", type: "nominal", title: "State or territory" },
            {
              field: "moderate_or_severe_pct",
              type: "quantitative",
              title: "Moderate or severe food insecurity (%)",
              format: ".0f",
            },
            { field: "sample_n", type: "quantitative", title: "Survey sample (respondents)", format: ",.0f" },
          ],
        },
        layer: [
          { mark: { type: "bar", size: 24, cursor: "pointer" } },
          {
            mark: { type: "text", align: "left", dx: 6, fontWeight: "bold", fontSize },
            encoding: { text: { field: "value_label" }, color: { value: "#223b36" }, opacity: { value: 1 } },
          },
        ],
      };
      const map = { width: mapWidth, height: height + (paired ? 28 : 0), projection: spec.projection, layer: spec.layer, };
      return {
        $schema: spec.$schema,
        background: spec.background,
        description: spec.description + " Linked bars show the same eight estimates.",
        padding: 12,
        params: [{ name: "selectedState", value: 0 }],
        ...(paired ? { hconcat: [map, bars] } : { vconcat: [map, bars] }),
        spacing: gap,
        resolve: { scale: { color: "shared" } },
        config: spec.config,
      };
    },
    // POINTER | Connect plotted marks to selection state
    afterRender(view) {
      view.addEventListener("click", (event, item) => {
        const code = Number(item?.datum?.state_code);
        if (code >= 1 && code <= 8) selectState(controller.getSignal("selectedState") === code ? 0 : code);
      });
      view.addEventListener("dblclick", () => selectState(0));
    },
  });
  container.closest(".chart-scroll").addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        selectState(0);
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const current = order.findIndex((row) => row.state_code === controller.getSignal("selectedState"));
      const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
      const next =
        current < 0
          ? direction > 0
            ? 0
            : order.length - 1
          : (current + direction + order.length) % order.length;
      selectState(order[next].state_code);
    },
    { signal: controller.events },
  );
  return controller;
}
