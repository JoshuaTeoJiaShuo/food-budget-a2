import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC7() {
  return mountChart({
    id: "chart-7",
    url: "charts/c7-income-spending.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      const axisAllowance = Math.ceil(fontSize * 4.5 + 40);

      spec.width = Math.max(
        270,
        Math.min(820, availableWidth - axisAllowance)
      );

      spec.height = Math.max(220, Math.round(fontSize * 15));

      applyTextSize(spec, fontSize);

      // Keep both halves on the same dollar scale.
      spec.encoding.x.scale.domain = [-300, 300];
      spec.encoding.x.axis.title = "Weekly spending (A$)";
      spec.encoding.x.axis.values =
        spec.width < 500
          ? [-200, 0, 200]
          : [-200, -100, 0, 100, 200];

      // Emphasise the two groups discussed in the narrative.
      spec.encoding.y.axis.labelLimit = Math.ceil(fontSize * 4.5);
      spec.encoding.y.axis.labelFontWeight = {
        expr:
          "datum.value === 'Lowest' || datum.value === 'Highest' " +
          "? 'bold' : 'normal'",
      };

      const endpoint =
        "datum.income_quintile === 'Lowest' || " +
        "datum.income_quintile === 'Highest'";

      // Round visible labels; tooltips retain cents.
      const labelTransform = spec.transform.find(
        (transform) => transform.as === "value_label"
      );

      labelTransform.calculate = "format(datum.weekly, '$,.0f')";

      const valueLayer = spec.layer.find(
        (layer) => layer.mark?.type === "text"
      );

      // Label only the lowest- and highest-income groups.
      valueLayer.transform = [
        ...(valueLayer.transform ?? []),
        { filter: endpoint },
      ];

      valueLayer.mark.fontWeight = "bold";

      // Direct headings replace the detached legend.
      const barLayer = spec.layer.find(
        (layer) => layer.encoding?.color
      );

      barLayer.encoding.color.legend = null;

      // Draw two subtle row bands behind the existing marks.
      const rowBands = {
        transform: [
          {
            aggregate: [{ op: "count", as: "rows" }],
            groupby: ["income_quintile"],
          },
          { filter: endpoint },
        ],

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

      const categoryHeadings = {
        transform: [
          {
            aggregate: [{ op: "count", as: "rows" }],
            groupby: ["purchase_type"],
          },
          {
            calculate:
              "datum.purchase_type === 'Other food purchases' " +
              "? -150 : 150",
            as: "heading_position",
          },
          {
            calculate:
              "datum.purchase_type === 'Other food purchases' " +
              "? 'Other food\\npurchases' : 'Meals out &\\nfast foods'",
            as: "heading_label",
          },
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
          x: {
            field: "heading_position",
            type: "quantitative",
          },
          y: { value: -(fontSize + 18) },
          text: {
            field: "heading_label",
            type: "nominal",
          },
          tooltip: null,
        },
      };

      spec.layer = [
        rowBands,
        ...spec.layer,
        categoryHeadings,
      ];

      return spec;
    },
  });
}