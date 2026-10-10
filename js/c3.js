(() => {
  "use strict";

  async function initialiseC3() {
    const container = document.getElementById("chart-3");

    // The HTML container will be added in the next step.
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

    function prepareSpecification(width, fontSize) {
      const spec = structuredClone(template);

      spec.width = width;
      spec.height = Math.round(width * (560 / 740));

      // Keep labels readable instead of shrinking the whole map.
      spec.config.legend.labelFontSize = fontSize;
      spec.config.legend.titleFontSize = fontSize;
      spec.config.legend.titleLimit = 0;
      spec.config.legend.labelLimit = 0;

      function updateLabels(node) {
        if (!node || typeof node !== "object") return;

        if (node.mark?.type === "text") {
          node.mark.fontSize = fontSize;

          if (node.mark.dy?.expr) {
            const upperOffset = Math.round(fontSize + 16);
            const lowerOffset = Math.round(fontSize + 20);

            node.mark.dy = {
              expr:
                "datum.state_abbr === 'VIC' || " +
                "datum.state_abbr === 'TAS' ? " +
                lowerOffset +
                " : -" +
                upperOffset
            };
          }
        }

        if (Array.isArray(node.layer)) {
          node.layer.forEach(updateLabels);
        }
      }

      updateLabels(spec);

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

          // Wait until the chart's section has a measurable width.
          if (availableWidth <= 0) continue;

          const fontSize = getTextSize();

          // On narrow screens, the HTML wrapper will allow scrolling.
          // This preserves readable labels and geographic positions.
          const width = Math.max(
            740,
            Math.min(920, availableWidth - 80)
          );

          const layoutKey = `${width}:${fontSize}`;

          if (layoutKey === previousLayout) continue;

          const specification = prepareSpecification(
            width,
            fontSize
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

          previousLayout = layoutKey;
        }
      } catch (error) {
        previousLayout = "";

        console.error("C3 could not be displayed:", error);

        container.textContent =
          "The map could not be loaded. Check that the C3 " +
          "chart specification and its three data files " +
          "are saved in the correct folders.";
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
        "charts/c3-state-meals.vl.json"
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
      console.error("C3 setup failed:", error);

      container.textContent =
        "The map specification could not be loaded. " +
        "Check charts/c3-state-meals.vl.json.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseC3,
      { once: true }
    );
  } else {
    void initialiseC3();
  }
})();