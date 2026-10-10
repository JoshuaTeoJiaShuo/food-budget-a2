import { initialiseReadingSize } from "./reading-size.js";
import { showChartError } from "./chart-utils.js";
import { initialiseC1 } from "./c1.js";
import { initialiseC2 } from "./c2.js";
import { initialiseC3 } from "./c3.js";
import { initialiseC4 } from "./c4.js";
import { initialiseC5 } from "./c5.js";
import { initialiseC6 } from "./c6.js";

async function start() {
  initialiseReadingSize();

  const charts = [
    initialiseC1,
    initialiseC2,
    initialiseC3,
    initialiseC4,
    initialiseC5,
    initialiseC6,
  ];

  const controllers = [];
  let leaving = false;

  window.addEventListener("pagehide", (event) => {
    // Preserve charts when the browser caches the page for back navigation.
    if (event.persisted) return;

    leaving = true;
    controllers.forEach((chart) => chart.dispose());
  });

  // A failed chart should not prevent the remaining charts from loading.
  await Promise.all(
    charts.map(async (initialise, index) => {
      try {
        if (typeof window.vegaEmbed !== "function") {
          throw new Error("The chart libraries did not load.");
        }

        const chart = await initialise();

        if (chart) {
          if (leaving) {
            chart.dispose();
          } else {
            controllers.push(chart);
          }
        }
      } catch (error) {
        showChartError(`chart-${index + 1}`, error);
      }
    })
  );
}

// Wait for the HTML and deferred chart libraries before starting.
if (
  document.readyState === "loading" ||
  document.readyState === "interactive"
) {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  void start();
}