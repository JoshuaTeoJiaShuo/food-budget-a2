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
      const mapWidth = Math.max(300, availableWidth - 32);
      const height = Math.round(mapWidth * 0.51);
      const barWidth = mapWidth;
      const projection = vega.projection("equalEarth")()
        .rotate([-150, 0, 0])
        .fitExtent([[16, 16], [mapWidth - 16, height - 16]], { type: "Sphere" });
      const mapRows = countryLabels(rows, locations, projection, mapWidth, height, fontSize);

      applyTextSize(spec, fontSize);
      const flows = spec.layer.find(layer => layer.encoding?.color?.field === "label");
      const connections = flows.layer.find(layer => layer.encoding?.strokeWidth);
      delete connections.params;
      // Both panels use the same short origin labels and colour scale.
      flows.transform.pop();
      flows.data = { values: mapRows };
      flows.encoding.color = {
        condition: { test: "datum.origin === focusedOrigin", value: "#304c59" },
        value: "#839097",
      };
      flows.encoding.opacity = {
        condition: { test: "focusedOrigin === '' || datum.origin === focusedOrigin", value: 1 },
        value: 0.15,
      };
      // Replace the previous selection-only labels with six visible callouts.
      flows.layer = [connections, flows.layer[1]];
      const pixel = field => ({ field, type: "quantitative", scale: null, axis: null });
      flows.layer.push({
        transform: [{ filter: "datum.label_guide" }],
        mark: { type: "rule", strokeDash: [2, 2], strokeWidth: 1 },
        encoding: { x: pixel("anchor_x"), y: pixel("anchor_y"), x2: { field: "label_x" }, y2: { field: "label_y" }, tooltip: null },
      });
      for (const halo of [true, false]) {
        flows.layer.push({
          mark: {
            type: "text", fontSize, fontWeight: "bold", baseline: "middle",
            align: { expr: "datum.label_align" },
            ...(halo ? { stroke: "#fffefa", strokeWidth: 3 } : {}),
          },
          encoding: { x: pixel("label_x"), y: pixel("label_y"), text: { field: "label" }, color: { value: halo ? "#fffefa" : "#223b36" }, tooltip: null },
        });
      }
      flows.layer.push({
        transform: [{ filter: "focusedOrigin !== '' && datum.origin === focusedOrigin" }],
        mark: { type: "point", shape: "triangle-up", filled: true, size: 140, angle: { expr: "datum.arrow_angle" }, color: "#304c59", stroke: "#fffefa", strokeWidth: 0.5 },
        encoding: { longitude: { field: "arrow_longitude", type: "quantitative" }, latitude: { field: "arrow_latitude", type: "quantitative" }, color: { value: "#304c59" }, opacity: { value: 1 } },
      });
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
        height: 230,
        title: { text: "Import value (A$ million)", anchor: "start", fontSize, font: "Arial", color: "#223b36", offset: 14 },
        encoding: {
          y: {
            field: "label", type: "nominal",
            sort: { field: "import_value_aud_million", op: "max", order: "descending" },
            axis: null,
          },
          x: {
            field: "import_value_aud_million", type: "quantitative", stack: null,
            scale: { domain: [0, 120], range: [fontSize * 9, barWidth - 50], nice: false, zero: true },
            axis: { title: null, values: [0, 40, 80, 120], domain: false, ticks: false, gridColor: "#e1e5de" },
          },
          color: structuredClone(flows.encoding.color),
          opacity: structuredClone(flows.encoding.opacity),
          tooltip: structuredClone(flows.encoding.tooltip),
        },
        layer: [{ mark: { type: "bar", size: Math.max(18, fontSize * 1.4), cursor: "pointer" } }],
      };
      bars.layer.push({
        mark: { type: "text", align: "left", fontSize },
        encoding: { x: { value: 0 }, text: { field: "label" }, color: { value: "#223b36" } },
      });
      // Keep numerical emphasis selective; exact values remain in tooltips.
      bars.layer.push({
        mark: { type: "text", align: "left", dx: 6, fontSize, color: "#223b36" },
        encoding: { text: { field: "value_label" }, color: { value: "#223b36" } },
      });

      const map = {
        width: mapWidth, height,
        projection: { type: "equalEarth", rotate: [-150, 0, 0], scale: projection.scale(), translate: projection.translate() },
        layer: spec.layer,
      };
      return {
        $schema: spec.$schema,
        description: spec.description + " Ranked bars show the same six values, on a zero baseline.",
        background: spec.background,
        padding: 12,
        params: [{ name: "foodCategory", value: selector.value }, { name: "focusedOrigin", value: "" }],
        vconcat: [map, bars],
        spacing: 22,
        align: "none",
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


// Place crowded origin labels in short callout rails using projected pixels.
// Country anchors remain geographical; only the label text moves.
function countryLabels(rows, locations, projection, width, height, fontSize) {
  const lookup = new Map(locations.map(row => [row.origin, row]));
  const destination = lookup.get("Australia");
  const context = document.createElement("canvas").getContext("2d");
  context.font = `bold ${fontSize}px Arial`;
  const output = [];
  for (const category of new Set(rows.map(row => row.category))) {
    const points = rows.filter(row => row.category === category).map(row => {
      const location = lookup.get(row.origin);
      const [x, y] = projection([location.longitude, location.latitude]);
      const arrow = greatCirclePoint(location, destination, 0.40);
      const next = greatCirclePoint(location, destination, 0.42);
      const a = projection(arrow), b = projection(next);
      return { ...row, ...location, anchor_x: x, anchor_y: y,
        arrow_longitude: arrow[0], arrow_latitude: arrow[1],
        arrow_angle: Math.atan2(b[0] - a[0], a[1] - b[1]) * 180 / Math.PI };
    });
    const remaining = new Set(points);
    const boxes = [];
    while (remaining.size) {
      const group = [remaining.values().next().value];
      remaining.delete(group[0]);
      for (let i = 0; i < group.length; i++) {
        for (const point of [...remaining]) {
          if (Math.hypot(point.anchor_x - group[i].anchor_x, point.anchor_y - group[i].anchor_y) < 70) {
            group.push(point); remaining.delete(point);
          }
        }
      }
      group.sort((a, b) => a.anchor_y - b.anchor_y);
      const centreX = group.reduce((sum, row) => sum + row.anchor_x, 0) / group.length;
      const centreY = group.reduce((sum, row) => sum + row.anchor_y, 0) / group.length;
      const left = centreX < width / 2;
      const longest = Math.max(...group.map(row => context.measureText(row.label).width));
      const rail = left
        ? Math.max(longest + 16, Math.min(...group.map(row => row.anchor_x)) - 22)
        : Math.min(width - longest - 16, Math.max(...group.map(row => row.anchor_x)) + 22);
      group.forEach((row, i) => {
        const textWidth = context.measureText(row.label).width;
        let x = group.length > 1 ? rail : row.anchor_x + 12;
        let y = group.length > 1 ? centreY + (i - (group.length - 1) / 2) * (fontSize + 8) : row.anchor_y - 12;
        let align = group.length > 1 && left ? "right" : "left";
        if (align === "left" && x + textWidth > width - 12) { align = "right"; x = row.anchor_x - 12; }
        y = Math.max(fontSize + 12, Math.min(height - fontSize - 12, y));
        const box = () => ({ x0: align === "right" ? x - textWidth : x, x1: align === "right" ? x : x + textWidth, y0: y - fontSize / 2, y1: y + fontSize / 2 });
        for (let attempt = 0; attempt < 6 && boxes.some(b => overlaps(b, box())); attempt++) y += fontSize + 8;
        boxes.push(box());
        output.push({ ...row, label_x: x, label_y: y, label_align: align, label_guide: group.length > 1 });
      });
    }
  }
  return output;
}

function overlaps(a, b) {
  return a.x0 < b.x1 + 6 && a.x1 + 6 > b.x0 && a.y0 < b.y1 + 4 && a.y1 + 4 > b.y0;
}

// Interpolate the same great-circle connection that Vega draws on the globe.
function greatCirclePoint(origin, destination, fraction) {
  const radians = Math.PI / 180;
  const vector = point => {
    const lon = point.longitude * radians, lat = point.latitude * radians;
    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  };
  const a = vector(origin), b = vector(destination);
  const angle = Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, i) => sum + value * b[i], 0))));
  const start = Math.sin((1 - fraction) * angle) / Math.sin(angle);
  const end = Math.sin(fraction * angle) / Math.sin(angle);
  const point = a.map((value, i) => value * start + b[i] * end);
  return [Math.atan2(point[1], point[0]) / radians, Math.atan2(point[2], Math.hypot(point[0], point[1])) / radians];
}
