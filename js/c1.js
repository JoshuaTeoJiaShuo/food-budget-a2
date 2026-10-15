// C1 | Historical food shares: survey-wave slider, category focus and $100 comparison.
import { mountChart, loadCSV, applyTextSize } from "./chart-utils.js";
import { CATEGORY_ORDER } from "./c1-compact.js";
export async function initialiseC1() {
  const container = document.getElementById("chart-1");
  if (!container) return null;
  const rows = await loadCSV("data/food-share-history.csv");
  const waves = [1988, 1993, 1998, 2003, 2009, 2015];
  const labels = [
    "Meals out & fast foods",
    "Meat, fish & seafood",
    "Fruit & vegetables",
    "Condiments & sweets",
    "Bakery & cereals",
    "Other food",
    "Dairy",
    "Non-alcoholic drinks",
  ];
  const initial = new Map(
    rows.filter((r) => String(r.year).startsWith("1988")).map((r) => [r.category, Number(r.food_share_pct)]),
  );
  rows.forEach((r) => {
    r.survey_start = Number(String(r.year).slice(0, 4));
    r.short_category = labels[CATEGORY_ORDER.indexOf(r.category)];
    r.baseline = initial.get(r.category);
  });
  const slider = document.getElementById("c1-wave");
  let controller;
  function update() {
    const year = waves[Number(slider.value)];
    const wave = rows.find((r) => r.survey_start === year).year.replace("-", "–");
    document.getElementById("c1-wave-label").textContent = wave;
    slider.setAttribute("aria-valuetext", wave);
    const category = controller?.getSignal("focusedCategory") || CATEGORY_ORDER[0];
    const row = rows.find((r) => r.survey_start === year && r.category === category);
    document.getElementById("c1-wave-summary").textContent =
      `${wave}: ${category}, ${row.food_share_pct.toFixed(1)}%, ${(row.food_share_pct - row.baseline).toFixed(1)} percentage-point change from 1988–89.`;
  }
  function focus(name) {
    controller?.setSignal("focusedCategory", name);
    update();
  }
  controller = await mountChart({
    id: "chart-1",
    url: "charts/c1-food-shares.vl.json",
    signals: { selectedWave: 2015, focusedCategory: "" },
    // CHART | Prepare the data encodings and responsive layout
    prepare(template, { availableWidth, fontSize }) {
      applyTextSize(template, fontSize);
      const paired = availableWidth >= 850;
      const trendWidth = paired ? Math.floor(availableWidth * 0.53) - 40 : Math.max(260, availableWidth - 58);
      const snapshotWidth = paired ? availableWidth - trendWidth - 98 : Math.max(270, availableWidth - 32);
      const height = 320;
      const opacity = {
        condition: { test: "focusedCategory === '' || datum.category === focusedCategory", value: 1 },
        value: 0.28,
      };
      const colour = {
        condition: { test: "datum.category === 'Meals out & fast foods'", value: "#895336" },
        value: "#7d9187",
      };
      const tooltip = [
        { field: "category", title: "Food group" },
        { field: "year", title: "Survey wave" },
        { field: "food_share_pct", type: "quantitative", format: ".1f", title: "Food-budget share (%)" },
        { field: "baseline", type: "quantitative", format: ".1f", title: "1988–89 share (%)" },
      ];
      const trend = {
        data: { values: rows },
        width: trendWidth,
        height,
        title: { text: "The long view", anchor: "start", fontSize, color: "#223b36", offset: 12 },
        encoding: {
          x: {
            field: "survey_start",
            type: "quantitative",
            scale: { domain: [1988, 2015], nice: false, zero: false },
            axis: {
              title: null,
              values: waves,
              labelExpr: "format(datum.value,'d') + '–' + slice(toString(datum.value+1),2,4)",
              labelAngle: 0,
              grid: false,
              labelPadding: 9,
            },
          },
          y: {
            field: "food_share_pct",
            type: "quantitative",
            scale: { domain: [0, 40], nice: false },
            axis: {
              title: null,
              values: [0, 10, 20, 30, 40],
              labelExpr: "datum.value+'%'",
              domain: false,
              ticks: false,
            },
          },
          detail: { field: "category" },
          color: colour,
          opacity,
          tooltip,
        },
        layer: [
          {
            mark: {
              type: "line",
              strokeWidth: 2.2,
              point: { filled: true, size: 34, stroke: "#fffefa", strokeWidth: 1 },
            },
          },
          {
            transform: [
              {
                filter:
                  "datum.category === 'Meals out & fast foods' && (datum.survey_start === 1988 || datum.survey_start === 2015)",
              },
            ],
            mark: { type: "text", dy: -12, fontWeight: "bold", fontSize },
            encoding: { text: { field: "food_share_pct", type: "quantitative", format: ".1f" } },
          },
          {
            transform: [
              {
                filter: "datum.category === 'Meals out & fast foods' && datum.survey_start === selectedWave",
              },
            ],
            mark: { type: "rule", strokeDash: [3, 3], stroke: "#304a40", opacity: 0.5 },
            encoding: {
              y: { datum: 0 },
              y2: { datum: 40 },
              color: { value: "#304a40" },
              opacity: { value: 0.5 },
              tooltip: null,
            },
          },
        ],
      };
      const snapshot = {
        data: { values: rows },
        transform: [
          { filter: "datum.survey_start === selectedWave" },
          { calculate: "'$' + format(datum.food_share_pct,'.2f')", as: "share_label" },
        ],
        width: snapshotWidth,
        height,
        title: {
          text: ["Every $100 spent on food", "Selected wave · grey tick = 1988–89"],
          anchor: "start",
          fontSize,
          color: "#223b36",
          offset: 12,
        },
        encoding: {
          y: { field: "short_category", type: "nominal", sort: labels, axis: null },
          x: {
            field: "food_share_pct",
            type: "quantitative",
            scale: { domain: [0, 40], range: [fontSize * 11, snapshotWidth - 58], nice: false },
            axis: {
              title: null,
              values: [0, 20, 40],
              labelExpr: "'$'+datum.value",
              domain: false,
              ticks: false,
              gridColor: "#e3e8e0",
            },
          },
          color: colour,
          opacity,
          tooltip,
        },
        layer: [
          { mark: { type: "bar", size: 18, cornerRadiusEnd: 3, cursor: "pointer" } },
          {
            mark: { type: "tick", orient: "vertical", thickness: 2, size: 27, color: "#66766d" },
            encoding: { x: { field: "baseline", type: "quantitative" }, color: { value: "#66766d" } },
          },
          {
            mark: { type: "text", align: "left", fontSize: fontSize - 1 },
            encoding: {
              x: { value: 0 },
              text: { field: "short_category" },
              color: { value: "#223b36" },
              opacity: { value: 1 },
            },
          },
          {
            mark: { type: "text", align: "right", fontSize: fontSize - 1, fontWeight: "bold" },
            encoding: {
              x: { value: snapshotWidth - 6 },
              text: { field: "share_label" },
              color: { value: "#223b36" },
              opacity: { value: 1 },
            },
          },
        ],
      };
      return {
        $schema: template.$schema,
        background: "#fffefa",
        padding: 8,
        params: [ { name: "selectedWave", value: 2015 }, { name: "focusedCategory", value: "" }, ],
        ...(paired ? { hconcat: [trend, snapshot] } : { vconcat: [trend, snapshot] }),
        spacing: 24,
        resolve: { scale: { x: "independent", y: "independent", color: "independent" } },
        config: template.config,
      };
    },
    afterRender(view) {
      view.addEventListener("pointermove", (e, item) => {
        const name = item?.datum?.category;
        focus(CATEGORY_ORDER.includes(name) ? name : "");
      });
    },
  });
  const options = { signal: controller.events };
  slider.addEventListener(
    "input",
    () => {
      controller.setSignal("selectedWave", waves[Number(slider.value)]);
      update();
    },
    options,
  );
  // CONTROLS | DOM events and keyboard access
  container.addEventListener("pointerleave", () => focus(""), options);
  // KEYBOARD | Arrow-key selection and Escape to clear
  container.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        focus("");
        return;
      }
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const i = CATEGORY_ORDER.indexOf(controller.getSignal("focusedCategory"));
      const delta = e.key === "ArrowRight" ? 1 : -1;
      focus(
        CATEGORY_ORDER[
          i < 0
            ? delta > 0
              ? 0
              : CATEGORY_ORDER.length - 1
            : (i + delta + CATEGORY_ORDER.length) % CATEGORY_ORDER.length
        ],
      );
      document.getElementById("c1-selection-status").textContent = controller.getSignal("focusedCategory");
    },
    options,
  );
  update();
  return controller;
}
