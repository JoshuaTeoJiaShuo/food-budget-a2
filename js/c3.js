import { mountChart, loadCSV, applyTextSize, walkLayers } from "./chart-utils.js";

export async function initialiseC3() {
  const container = document.getElementById("chart-3");
  if (!container) return null;
  const states = await loadCSV("data/state-spending-joined.csv");
  const selector = document.getElementById("c3-state");
  const nationalShare = 33.9;
  const bands = ["Under $70", "$70 to under $90", "$90 and over"];
  const colours = ["#e2c9ae", "#bb8b63", "#75472d"];
  const order = [...states].sort((a, b) => b.meals_weekly - a.meals_weekly).map(r => r.state);
  states.forEach(row => {
    row.spending_band = row.meals_weekly < 70 ? bands[0] : row.meals_weekly < 90 ? bands[1] : bands[2];
    row.share_gap_pp = row.meals_share_pct - nationalShare;
    row.row_label = `${row.state}  $${row.meals_weekly.toFixed(2)}`;
    selector.add(new Option(row.state, String(row.state_code)));
  });
  let controller;
  function select(code) {
    controller?.setSignal("selectedState", Number(code));
    selector.value = String(code);
    const row = states.find(r => r.state_code === Number(code));
    const note = document.getElementById("c3-state-summary");
    note.hidden = !row;
    note.textContent = row ? `${row.state}: $${row.meals_weekly.toFixed(2)} weekly; ${row.meals_share_pct.toFixed(1)}% of food spending. ${Math.abs(row.share_gap_pp).toFixed(1)} percentage points ${row.share_gap_pp >= 0 ? "above" : "below"} the national share. Published spending RSE: ${row.meals_rse_pct}%.` : "";
  }
  controller = await mountChart({
    id: "chart-3", url: "charts/c3-state-meals.vl.json", signals: { selectedState: 0 },
    prepare(template, { availableWidth, fontSize }) {
      applyTextSize(template, fontSize);
      const paired = availableWidth >= 850;
      const mapWidth = paired ? Math.round(availableWidth * .57) : Math.max(300, availableWidth - 44);
      const mapHeight = Math.round(mapWidth * .76);
      const compareWidth = paired ? Math.max(160, availableWidth - mapWidth - 184) : Math.max(220, availableWidth - 168);
      const height = paired ? mapHeight : 350;
      const opacity = { condition: { test: "selectedState === 0 || datum.state_code === selectedState", value: 1 }, value: .35 };
      const colour = { field: "spending_band", type: "ordinal", scale: { domain: bands, range: colours }, legend: null };
      const points = template.layer.find(l => l.transform?.some(t => t.as === "spending_band"));
      points.transform.find(t => t.as === "spending_band").calculate = "datum.meals_weekly < 70 ? 'Under $70' : datum.meals_weekly < 90 ? '$70 to under $90' : '$90 and over'";
      points.transform.find(t => t.as === "map_label").calculate = "datum.state_abbr === 'ACT' || datum.state_abbr === 'TAS' ? datum.state_abbr + '\\n' + format(datum.meals_weekly,'$.0f') : datum.state_abbr";
      const legend = null;
      walkLayers(template, layer => {
        if (layer.encoding?.size?.field === "spending_band") {
          layer.encoding.size = { field: "spending_band", type: "ordinal", scale: { type: "ordinal", domain: bands, range: [90, 650, 1800] }, legend };
          layer.encoding.color = { ...colour, legend };
          layer.encoding.opacity = opacity;
          layer.encoding.strokeWidth = { condition: { test: "datum.state_code === selectedState", value: 3 }, value: 1.2 };
          layer.mark = { type: "circle", filled: true, stroke: "#fffefa", cursor: "pointer" };
        }
        if (layer.mark?.type === "text") {
          layer.mark.fontSize = fontSize; layer.mark.lineBreak = "\n"; layer.mark.lineHeight = fontSize + 2;
          if (layer.mark.dy?.expr) layer.mark.dy.expr = "datum.state_abbr === 'VIC' ? 27 : datum.state_abbr === 'TAS' ? 23 : -29";
          if (layer.mark.dx) layer.mark.dx = 30;
        }
      });
      const map = {
        width: mapWidth, height: mapHeight + (paired ? 32 : 0), projection: template.projection, layer: template.layer,
        title: { text: "Weekly meals-out spending bands", subtitle: "Bands, not proportional dollar amounts", anchor: "start", fontSize: fontSize + 1, subtitleFontSize: fontSize - 1, color: "#223b36", offset: 10 },
      };
      const compare = {
        data: { values: states }, width: compareWidth, height,
        title: { text: "Budget share, ordered by weekly bill", subtitle: "Dashed line: national 33.9% share", anchor: "start", fontSize: fontSize + 1, subtitleFontSize: fontSize - 1, color: "#223b36", offset: 10 },
        encoding: {
          y: { field: "row_label", type: "nominal", sort: order.map(state => states.find(r => r.state === state).row_label), axis: { title: null, domain: false, ticks: false, labelPadding: 9, labelLimit: 160, labelFontSize: fontSize - 1 } },
          x: { field: "meals_share_pct", type: "quantitative", scale: { domain: [28, 40], nice: false, zero: false }, axis: { title: "Food-budget share (%)", values: [28, 32, 36, 40], labelExpr: "datum.value + '%'", domain: false, ticks: false, gridColor: "#e1e7dd", titlePadding: 12 } },
          color: colour, opacity,
          tooltip: [
            { field: "state", title: "State or territory" },
            { field: "meals_weekly", type: "quantitative", format: "$.2f", title: "Weekly meals-out bill" },
            { field: "meals_share_pct", type: "quantitative", format: ".1f", title: "Share of food spending (%)" },
            { field: "share_gap_pp", type: "quantitative", format: "+.1f", title: "Gap from national share (percentage points)" },
          ],
        },
        layer: [
          { data: { values: [{ national_share: nationalShare }] }, mark: { type: "rule", strokeDash: [4, 4], strokeWidth: 1.3 }, encoding: { x: { field: "national_share", type: "quantitative" }, y: { value: 0 }, y2: { value: height }, color: { value: "#82957f" }, opacity: { value: 1 }, tooltip: null } },
          { mark: { type: "rule", strokeWidth: 2 }, encoding: { x2: { datum: nationalShare }, color: { value: "#b4c1ae" } } },
          { mark: { type: "point", filled: true, size: 110, stroke: "#fffefa", strokeWidth: 1.2, cursor: "pointer" } },
          { transform: [{ calculate: "format(datum.meals_share_pct,'.1f')+'%'", as: "share_label" }], mark: { type: "text", align: "left", fontSize: fontSize - 1, fontWeight: "bold" }, encoding: { x: { value: compareWidth + 7 }, text: { field: "share_label" }, color: { value: "#223b36" }, opacity: { value: 1 } } },
        ],
      };
      return {
        $schema: template.$schema, background: "#fffefa", padding: 8,
        params: [{ name: "selectedState", value: 0 }],
        ...(paired ? { hconcat: [map, compare] } : { vconcat: [map, compare] }),
        spacing: 24, resolve: { scale: { color: "shared" } }, config: template.config,
      };
    },
    afterRender(view) {
      view.addEventListener("click", (event, item) => {
        const code = Number(item?.datum?.state_code);
        if (code >= 1 && code <= 8) select(controller.getSignal("selectedState") === code ? 0 : code);
      });
    },
  });
  const options = { signal: controller.events };
  selector.addEventListener("change", () => select(selector.value), options);
  container.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); select(0); return; }
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const current = states.findIndex(r => r.state_code === controller.getSignal("selectedState"));
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = current < 0 ? (direction > 0 ? 0 : states.length - 1) : (current + direction + states.length) % states.length;
    select(states[next].state_code);
  }, options);
  return controller;
}
