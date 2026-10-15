// C5 | Household mosaic: numbered key, shared household focus and exact-values table.
import {
  mountChart,
  loadJSON,
  loadCSV,
  applyTextSize,
  bindHouseholdFocus,
  setHouseholdFocus,
} from "./chart-utils.js";

export async function initialiseC5() {
  if (!document.getElementById("chart-5")) return null;

  const specification = await loadJSON("charts/c5-household-mosaic.vl.json");

  const rows = await loadCSV(specification.data.url);

  buildHouseholdKey(rows, document.getElementById("c5-table-body"));

  // Share the parsed rows with the chart and companion table.
  specification.data = { values: rows };

  const controller = await mountChart({
    id: "chart-5",
    specification,
    signals: { focusedHousehold: "" },
    // POINTER | Connect plotted marks to selection state
    afterRender(view) {
      view.addEventListener("click", (event, item) => {
        if (item?.datum?.household_type) setHouseholdFocus(item.datum.household_type);
      });
    },

    // CHART | Prepare the data encodings and responsive layout
    prepare(spec, { availableWidth, fontSize }) {
      const axisAllowance = Math.ceil(fontSize * 6.5 + 28);

      spec.width = Math.max(300, Math.min(1100, availableWidth - axisAllowance));

      spec.padding.bottom = 0;
      spec.height = Math.max(310, Math.round(fontSize * 22));

      applyTextSize(spec, fontSize);

      return spec;
    },
  });
  // CONTROLS | DOM events and keyboard access
  bindHouseholdFocus(controller, document.getElementById("chart-5"));
  const update = () => {
    const name = document.body.dataset.householdFocus || "";
    const row = rows.find((r) => r.household_type === name);
    document.getElementById("household-focus-summary").hidden = !name;
    document
      .querySelectorAll("#c5-household-key button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.household === name)));
    document.getElementById("household-focus-summary").textContent = row
      ? `${name}: $${Number(row.food_weekly).toFixed(2)} per household; approximately $${Number(row.food_per_person).toFixed(2)} per person (mean size ${row.mean_size}). `
      : "Couples with children contributed the most overall; group households allocated the highest share to meals out.";
  };
  window.addEventListener("household-focus", update, { signal: controller.events });
  document
    .getElementById("household-clear")
    .addEventListener("click", () => setHouseholdFocus(""), { signal: controller.events });
  update();
  return controller;
}

// KEY/TABLE | Build household labels, selection buttons and exact values
function buildHouseholdKey(rows, tableBody) {
  if (!tableBody) return;

  const households = rows.map((row) => {
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
      throw new Error(`Invalid expenditure data for ${row.household_type}`);
    }

    return { name: row.household_type, total: householdCount * foodWeekly, mealsShare: mealsWeekly / foodWeekly, };
  });

  // Match the chart's descending expenditure order.
  households.sort((a, b) => b.total - a.total);

  const totalFoodSpending = households.reduce((sum, household) => sum + household.total, 0);

  const percentage = new Intl.NumberFormat("en-AU", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, });

  const fragment = document.createDocumentFragment();

  households.forEach((household, index) => {
    const row = document.createElement("tr");

    const numberCell = document.createElement("td");
    numberCell.textContent = String(index + 1);

    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.textContent = household.name;

    const widthCell = document.createElement("td");
    widthCell.textContent = percentage.format(household.total / totalFoodSpending);

    const mealsCell = document.createElement("td");
    mealsCell.textContent = percentage.format(household.mealsShare);

    row.append(numberCell, nameCell, widthCell, mealsCell);

    fragment.appendChild(row);
  });

  tableBody.replaceChildren(fragment);

  // Build the visible key in the same order as the chart columns.
  const householdKey = document.getElementById("c5-household-key");

  if (householdKey) {
    const keyFragment = document.createDocumentFragment();

    households.forEach((household) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const number = document.createElement("span");
      number.className = "household-number";
      number.textContent = String(households.indexOf(household) + 1);
      const name = document.createElement("span");
      name.className = "household-name";
      name.textContent = household.name;
      const values = document.createElement("span");
      values.className = "household-values";
      values.textContent = percentage.format(household.mealsShare);
      const contribution = document.createElement("span");
      contribution.className = "household-contribution";
      contribution.textContent = `${percentage.format(household.total / totalFoodSpending)} of combined spending`;
      button.append(number, name, values, contribution);
      button.dataset.household = household.name;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => setHouseholdFocus(household.name));
      item.append(button);

      item.classList.toggle("is-highlighted", household.name === "Group household");

      keyFragment.appendChild(item);
    });

    householdKey.replaceChildren(keyFragment);
  }
}
