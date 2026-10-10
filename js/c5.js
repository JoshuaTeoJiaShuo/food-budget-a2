(() => {
  "use strict";

  async function initialiseC5() {
    const container = document.getElementById("chart-5");

    // The HTML section will be added next.
    if (!container) return;

    const wrapper = container.parentElement;
    const tableBody = document.getElementById("c5-table-body");

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

    function buildHouseholdKey(rows) {
      if (!tableBody) return;

      const households = rows.map(row => {
        const householdCount = Number(row.households);
        const foodWeekly = Number(row.food_weekly);
        const mealsWeekly = Number(row.meals_weekly);

        if (
          !Number.isFinite(householdCount) ||
          !Number.isFinite(foodWeekly) ||
          !Number.isFinite(mealsWeekly) ||
          householdCount <= 0 ||
          foodWeekly <= 0 ||
          mealsWeekly < 0 ||
          mealsWeekly > foodWeekly
        ) {
          throw new Error(
            `Invalid expenditure data for ${row.household_type}`
          );
        }

        return {
          name: row.household_type,
          total: householdCount * foodWeekly,
          mealsShare: mealsWeekly / foodWeekly
        };
      });

      // Match the chart's descending expenditure order.
      households.sort((a, b) => b.total - a.total);

      const totalFoodSpending = households.reduce(
        (sum, household) => sum + household.total,
        0
      );

      const percentage = new Intl.NumberFormat("en-AU", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });

      const fragment = document.createDocumentFragment();

      households.forEach((household, index) => {
        const row = document.createElement("tr");

        const numberCell = document.createElement("td");
        numberCell.textContent = String(index + 1);

        const nameCell = document.createElement("th");
        nameCell.scope = "row";
        nameCell.textContent = household.name;

        const widthCell = document.createElement("td");
        widthCell.textContent = percentage.format(
          household.total / totalFoodSpending
        );

        const mealsCell = document.createElement("td");
        mealsCell.textContent = percentage.format(
          household.mealsShare
        );

        row.append(
          numberCell,
          nameCell,
          widthCell,
          mealsCell
        );

        fragment.appendChild(row);
      });

      tableBody.replaceChildren(fragment);
    }

    function prepareSpecification(width, fontSize) {
      const spec = structuredClone(template);

      spec.width = width;
      spec.height = Math.max(
        400,
        Math.round(fontSize * 22)
      );

      spec.config.axis.labelFontSize = fontSize;
      spec.config.axis.titleFontSize = fontSize;
      spec.config.legend.labelFontSize = fontSize;

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

          const availableWidth = Math.floor(
            wrapper.clientWidth
          );

          if (availableWidth <= 0) continue;

          const fontSize = getTextSize();

          // Narrow columns still need room for their numbers.
          // Small screens will scroll within the chart wrapper.
          const width = Math.max(
            860,
            Math.min(1100, availableWidth - 100)
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

        console.error("C5 could not be displayed:", error);

        container.textContent =
          "The household chart could not be loaded. " +
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
      const [specResponse, dataResponse] = await Promise.all([
        fetch("charts/c5-household-mosaic.vl.json"),
        fetch("data/household-composition-joined.csv")
      ]);

      if (!specResponse.ok) {
        throw new Error(
          `Chart specification returned HTTP ${specResponse.status}`
        );
      }

      if (!dataResponse.ok) {
        throw new Error(
          `Household data returned HTTP ${dataResponse.status}`
        );
      }

      const [specification, csvText] = await Promise.all([
        specResponse.json(),
        dataResponse.text()
      ]);

      template = specification;

      const rows = vega.read(csvText, {
        type: "csv",
        parse: "auto"
      });

      buildHouseholdKey(rows);

      const resizeObserver = new ResizeObserver(
        scheduleRender
      );
      resizeObserver.observe(wrapper);

      const readingSizeObserver = new MutationObserver(
        scheduleRender
      );

      readingSizeObserver.observe(
        document.documentElement,
        {
          attributes: true,
          attributeFilter: ["data-reading-size"]
        }
      );

      await renderChart();
    } catch (error) {
      console.error("C5 setup failed:", error);

      container.textContent =
        "C5 could not be prepared. Check that " +
        "c5-household-mosaic.vl.json and " +
        "household-composition-joined.csv are saved " +
        "in their correct folders.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseC5,
      { once: true }
    );
  } else {
    void initialiseC5();
  }
})();