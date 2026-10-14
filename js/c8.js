import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC8() {
  return mountChart({
    id: "chart-8",
    url: "charts/c8-food-budget-share.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      const axisAllowance = Math.ceil(fontSize * 4.5 + 40);

      spec.width = Math.max(
        220,
        Math.min(820, availableWidth - axisAllowance)
      );

      // Match C7's plot height and row positions.
      spec.height = Math.max(320, Math.round(fontSize * 18));

      applyTextSize(spec, fontSize);

      spec.encoding.y.scale = {
        ...spec.encoding.y.scale,
        paddingInner: 0.5,
        paddingOuter: 0.25,
      };

      spec.encoding.y.axis.labelLimit = Math.ceil(fontSize * 4.5);
      spec.encoding.y.axis.labelFontWeight = {
        expr:
          "datum.value === 'Lowest' || datum.value === 'Highest' " +
          "? 'bold' : 'normal'",
      };

      spec.encoding.x.scale.domain = [0, 28];
      spec.encoding.x.axis.title = "Food share of spending (%)";
      spec.encoding.x.axis.values =
        spec.width < 400
          ? [0, 10, 20]
          : [0, 5, 10, 15, 20, 25];

      const endpoint =
        "datum.income_quintile === 'Lowest' || " +
        "datum.income_quintile === 'Highest'";

      // A neutral colour distinguishes total food from C7's components.
      const barLayer = spec.layer.find(
        (layer) => layer.mark?.type === "bar"
      );

      delete barLayer.mark.size;
      barLayer.mark.color = "#8a8982";

      const valueLayer = spec.layer.find(
        (layer) => layer.mark?.type === "text"
      );

      valueLayer.mark.fontWeight = {
        expr: `(${endpoint}) ? 'bold' : 'normal'`,
      };

      const rowBands = {
        transform: [{ filter: endpoint }],

        mark: {
          type: "bar",
          size: { expr: "height / 5 - 8" },
          color: "#f0eee7",
          aria: false,
        },

        encoding: {
          x: { value: 0 },
          x2: { value: "width" },
          tooltip: null,
        },
      };

      // Use the same two-line heading position as C7.
      const categoryHeading = {
        transform: [
        { filter: "datum.income_quintile === 'Lowest'" },
        ],

        mark: {
          type: "text",
          align: "center",
          baseline: "bottom",
          lineBreak: "\n",
          lineHeight: fontSize + 2,
          fontSize,
          fontWeight: "bold",
          color: "#223b36",
        },

        encoding: {
        x: { value: spec.width / 2 },
          y: { value: -(fontSize + 18) },
          text: { value: "All food &\nnon-alcoholic drinks" },
          tooltip: null,
        },
      };

      spec.layer = [
        rowBands,
        ...spec.layer,
        categoryHeading,
      ];

      return spec;
    },
  });
}