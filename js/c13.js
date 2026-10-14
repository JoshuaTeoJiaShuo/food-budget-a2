import {
  mountChart,
  applyTextSize,
} from "./chart-utils.js";

export function initialiseC13() {
  return mountChart({
    id: "chart-13",
    url: "charts/c13-nt-basket-costs.vl.json",

    prepare(spec, { availableWidth, fontSize }) {
      applyTextSize(spec, fontSize);

      const paired = availableWidth >= 800;
      const columns = paired ? 2 : 1;
      const gap = 20;

      // Reserve the same district-label space in each panel.
      const labelWidth = Math.ceil(fontSize * 7);
      const panelWidth = Math.floor(
        (availableWidth - 32 - gap * (columns - 1)) / columns
      );

      const plotWidth = Math.max(
        240,
        panelWidth - labelWidth - 24
      );

      const plotHeight = Math.max(240, fontSize * 16);
      const districts = [
        "Barkly",
        "Big Rivers",
        "Central Australia",
        "East Arnhem",
        "Top End",
      ];

      const template = spec.spec;

      function makePanel(basket) {
        const panel = structuredClone(template);

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

        panel.transform = [
          {
            filter: {
              field: "basket_name",
              equal: basket,
            },
          },
        ];

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
          values: [600, 1000, 1400],
        });

        const legend = panel.layer[0].encoding.color.legend;

        Object.assign(legend, {
          columns: availableWidth >= 650 ? 2 : 1,
          direction: availableWidth >= 650
            ? "horizontal"
            : "vertical",
          labelFontSize: fontSize,
          rowPadding: 10,
        });

        return panel;
      }

      // Replace the facet layout with two equally sized panels.
      delete spec.facet;
      delete spec.spec;

      spec.concat = [
        makePanel("Healthy food basket"),
        makePanel("Current diet basket"),
      ];

      spec.columns = columns;
      spec.spacing = gap;
      spec.align = "all";
      spec.bounds = "full";

      spec.resolve = {
        scale: {
          x: "shared",
          y: "shared",
          color: "shared",
          shape: "shared",
        },
        axis: {
          x: "independent",
          y: "independent",
        },
        legend: {
          color: "shared",
          shape: "shared",
        },
      };

      return spec;
    },
  });
}