// C6 | Household heatmap: spending-basis dropdown and linked household focus.
import {
  mountChart,
  loadCSV,
  setTextCues,
  applyTextSize,
  bindHouseholdFocus,
  setHouseholdFocus,
} from "./chart-utils.js";

export async function initialiseC6() {
  if (!document.getElementById("chart-6")) return null;

  const selector = document.getElementById("c6-basis");

  const meat = (await loadCSV("data/household-food-heatmap.csv")).filter(
    (row) => Number(row.hec_code) === 302,
  );
  const finding = document.getElementById("chart-6").closest("figure").querySelector(".chart-finding");
  // CARD | Derive the finding and interpretation from the current data
  function updateFinding() {
    const household = selector.value === "Per household";
    const field = household ? "household_weekly" : "approx_per_person_weekly";
    const ordered = [...meat].sort((a, b) => Number(b[field]) - Number(a[field]));
    const leader = ordered[0];
    const other = meat.find((row) => row.household_type === (household ? "Couple only" : "Multiple-family"));
    setTextCues(
      finding,
      household
        ? [
            "Multiple-family households had the ",
            { text: `highest meat bill: $${Number(leader[field]).toFixed(2)}`, cue: "cue-spending-high" },
            ` per household per week. Couple-only households averaged $${Number(other[field]).toFixed(2)}.`,
          ]
        : [
            "Couple-only households had the ",
            {
              text: `highest meat spending: approximately $${Number(leader[field]).toFixed(2)}`,
              cue: "cue-spending-high",
            },
            ` per person per week. Multiple-family households averaged $${Number(other[field]).toFixed(2)}.`,
          ],
    );
  }
  updateFinding();
  const controller = await mountChart({
    id: "chart-6",
    url: "charts/c6-household-heatmap.vl.json",

    signals: { spendingBasis: selector.value, focusedHousehold: "", },

    // POINTER | Connect plotted marks to selection state
    afterRender(view) {
      view.addEventListener("click", (event, item) => {
        if (item?.datum?.household_type) setHouseholdFocus(item.datum.household_type);
      });
    },

    // CHART | Prepare the data encodings and responsive layout
    prepare(spec, { availableWidth, fontSize }) {
      spec.layer[0].encoding.color.legend.title =
        selector.value === "Per household" ? "A$ per household per week" : "Approx. A$ per person per week";
      const labelAllowance = Math.ceil(fontSize * 10 + 24);

      // Preserve readable cells; narrow screens scroll horizontally.
      const minimumWidth = Math.ceil(fontSize * 4.3) * 7;

      spec.width = Math.max(minimumWidth, Math.min(980, availableWidth - labelAllowance));

      spec.height = 12 * Math.max(34, Math.ceil(fontSize * 2.5));

      applyTextSize(spec, fontSize);

      // Reserve space for household headings of up to four lines.
      const lineHeight = Math.ceil(fontSize * 1.25);

      Object.assign(spec.encoding.x.axis, {
        labelLineHeight: lineHeight,
        labelPadding: lineHeight * 3 + 8,
        labelLimit: Math.floor(spec.width / 7),
      });

      Object.assign(spec.encoding.y.axis, { labelLineHeight: Math.ceil(fontSize * 1.2), labelLimit: Math.ceil(fontSize * 10), });

      return spec;
    },
  });

  // CONTROLS | DOM events and keyboard access
  bindHouseholdFocus(controller, document.getElementById("chart-6"));
  selector.disabled = false;

  selector.addEventListener(
    "change",
    () => {
      void controller.refresh({ spendingBasis: selector.value });
      updateFinding();
    },
    { signal: controller.events },
  );

  return controller;
}
