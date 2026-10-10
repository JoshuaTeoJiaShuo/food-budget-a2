(() => {
  "use strict";

  async function initialiseC6() {
    const container = document.getElementById("chart-6");
    if (!container) return;

    const wrapper = container.parentElement;

    let template;
    let embeddedChart;
    let resizeTimer;
    let rendering = false;
    let renderQueued = false;
    let previousLayout = "";

    function getTextSize() {
      const control = document.getElementById("reading-size");

      return (
        parseFloat(
          getComputedStyle(control || document.body).fontSize
        ) || 18
      );
    }

    function getSpendingBasis() {
      const selector = container.querySelector(
        ".vega-bindings select"
      );

      return selector?.value || "Approx. per person";
    }

    function prepareSpecification(width, fontSize, basis) {
      const spec = structuredClone(template);

      spec.width = width;
      spec.height = 12 * Math.max(44, Math.ceil(fontSize * 2.6));

      spec.params.find(
        parameter => parameter.name === "spendingBasis"
      ).value = basis;

      spec.config.axis.labelFontSize = fontSize;
      spec.config.legend.labelFontSize = fontSize;
      spec.config.legend.titleFontSize = fontSize;
      spec.config.legend.titleLimit = 400;

      // Wrap household names instead of shrinking the text.
        const headingLineHeight = Math.ceil(fontSize * 1.25);

        spec.encoding.x.axis.labelLineHeight = headingLineHeight;

        // The longest household heading occupies four lines.
        spec.encoding.x.axis.labelPadding =
        headingLineHeight * 3 + 16;

      spec.encoding.x.axis.labelLimit = Math.floor(width / 7);

      spec.encoding.x.axis.labelExpr =
        "datum.label === 'Couple with dependent children' " +
        "? ['Couple with', 'dependent', 'children'] " +
        ": datum.label === 'Couple only' " +
        "? ['Couple', 'only'] " +
        ": datum.label === 'Other one-family' " +
        "? ['Other', 'one-family'] " +
        ": datum.label === 'Lone person' " +
        "? ['Lone', 'person'] " +
        ": datum.label === 'One parent with dependent children' " +
        "? ['One parent', 'with', 'dependent', 'children'] " +
        ": datum.label === 'Group household' " +
        "? ['Group', 'household'] " +
        ": ['Multiple-', 'family']";

      // Keep long food-category labels within the left margin.
      spec.encoding.y.axis.labelLineHeight = Math.ceil(
        fontSize * 1.2
      );

      spec.encoding.y.axis.labelLimit = Math.ceil(
        fontSize * 10
      );

      spec.encoding.y.axis.labelExpr =
        "datum.label === 'Condiments, sweets & meals' " +
        "? ['Condiments,', 'sweets & meals'] " +
        ": datum.label === 'Unspecified food & drinks' " +
        "? ['Unspecified', 'food & drinks'] " +
        ": datum.label === 'Bakery, flour & cereals' " +
        "? ['Bakery, flour', '& cereals'] " +
        ": datum.label";

      for (const layer of spec.layer) {
        if (layer.mark?.type === "text") {
          layer.mark.fontSize = fontSize;
        }
      }

      return spec;
    }

    async function renderChart() {
      renderQueued = true;

      if (rendering || !template) return;
      rendering = true;

      try {
        while (renderQueued) {
          renderQueued = false;

          const availableWidth = Math.floor(wrapper.clientWidth);
          if (availableWidth <= 0) continue;

          const fontSize = getTextSize();

          // Reserve space for category labels and chart padding.
          const labelAllowance = Math.ceil(fontSize * 10 + 40);

          // Preserve readable cells on narrow screens.
          // The surrounding wrapper will provide horizontal scrolling.
          const minimumWidth = Math.ceil(fontSize * 5.7) * 7;

          const width = Math.max(
            minimumWidth,
            Math.min(980, availableWidth - labelAllowance)
          );

          const layoutKey = `${width}:${fontSize}`;
          if (layoutKey === previousLayout) continue;

          const basis = getSpendingBasis();
          const previousScroll = wrapper.scrollLeft;

          const specification = prepareSpecification(
            width,
            fontSize,
            basis
          );

          container.setAttribute("aria-busy", "true");

          if (embeddedChart) {
            embeddedChart.finalize();
            embeddedChart = null;
          }

          embeddedChart = await vegaEmbed(
            container,
            specification,
            {
              actions: false,
              renderer: "svg"
            }
          );

          wrapper.scrollLeft = previousScroll;
          previousLayout = layoutKey;
        }
      } catch (error) {
        previousLayout = "";

        console.error("C6 could not be displayed:", error);

        container.textContent =
          "The household food heatmap could not be loaded. " +
          "Check its chart specification and data file.";
      } finally {
        rendering = false;
        container.setAttribute("aria-busy", "false");
      }
    }

    function scheduleRender() {
      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        void renderChart();
      }, 100);
    }

    try {
      const response = await fetch(
        "charts/c6-household-heatmap.vl.json"
      );

      if (!response.ok) {
        throw new Error(
          `Chart specification returned HTTP ${response.status}`
        );
      }

      template = await response.json();

      const resizeObserver = new ResizeObserver(scheduleRender);
      resizeObserver.observe(wrapper);

      const readingSizeObserver = new MutationObserver(
        scheduleRender
      );

      readingSizeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-reading-size"]
      });

      await renderChart();
    } catch (error) {
      console.error("C6 setup failed:", error);

      container.textContent =
        "C6 could not be prepared. Check that " +
        "c6-household-heatmap.vl.json is saved in the charts folder.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseC6,
      { once: true }
    );
  } else {
    void initialiseC6();
  }
})();