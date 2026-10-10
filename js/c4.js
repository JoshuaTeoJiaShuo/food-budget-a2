(() => {
  "use strict";

  async function initialiseC4() {
    const container = document.getElementById("chart-4");

    // We will add this container to index.html next.
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

      spec.config.legend.labelFontSize = fontSize;
      spec.config.legend.titleFontSize = fontSize;
      spec.config.legend.titleLimit = 0;
      spec.config.legend.labelLimit = 0;

      for (const layer of spec.layer) {
        if (layer.mark?.type === "text") {
          layer.mark.fontSize = fontSize;
        }

        const legend = layer.encoding?.color?.legend;

        if (legend) {
          legend.gradientLength = Math.min(
            440,
            Math.round(width * 0.55)
          );
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

          // Preserve readable labels on narrow screens.
          // The map wrapper will allow horizontal scrolling.
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

        console.error("C4 could not be displayed:", error);

        container.textContent =
          "The map could not be loaded. Check the C4 " +
          "chart specification and its data files.";
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
        "charts/c4-state-food-share.vl.json"
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
      console.error("C4 setup failed:", error);

      container.textContent =
        "The map specification could not be loaded. " +
        "Check charts/c4-state-food-share.vl.json.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseC4,
      { once: true }
    );
  } else {
    void initialiseC4();
  }
})();