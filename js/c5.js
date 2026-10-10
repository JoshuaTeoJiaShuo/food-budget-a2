import {
  mountChart,
  loadJSON,
  loadCSV,
  applyTextSize,
} from "./chart-utils.js";

export async function initialiseC5() {
  if (!document.getElementById("chart-5")) return null;

  const specification = await loadJSON(
    "charts/c5-household-mosaic.vl.json"
  );

  const rows = await loadCSV(specification.data.url);

  buildHouseholdKey(
    rows,
    document.getElementById("c5-table-body")
  );

  // Share the parsed rows with the chart and companion table.
  specification.data = { values: rows };

  return mountChart({
    id: "chart-5",
    specification,

    prepare(spec, { availableWidth, fontSize }) {
      const axisAllowance = Math.ceil(
        fontSize * 6.5 + 30
      );

      spec.width = Math.max(
        860,
        Math.min(1100, availableWidth - axisAllowance)
      );

      spec.height = Math.max(
        400,
        Math.round(fontSize * 22)
      );

      applyTextSize(spec, fontSize);

      return spec;
    },
  });
}

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
      throw new Error(
        `Invalid expenditure data for ${row.household_type}`
      );
    }

    return {
      name: row.household_type,
      total: householdCount * foodWeekly,
      mealsShare: mealsWeekly / foodWeekly,
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
    maximumFractionDigits: 1,
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

  // Build the visible key in the same order as the chart columns.
  const householdKey = document.getElementById(
    "c5-household-key"
  );

  if (householdKey) {
    const keyFragment = document.createDocumentFragment();

    households.forEach((household) => {
      const item = document.createElement("li");
      item.textContent = household.name;

      item.classList.toggle(
        "is-highlighted",
        household.name === "Group household"
      );

      keyFragment.appendChild(item);
    });

    householdKey.replaceChildren(keyFragment);
  }
}