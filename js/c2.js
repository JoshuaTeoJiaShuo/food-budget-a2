import { mountChart } from "./chart-utils.js";

function treemapLayout({ availableWidth, fontSize }) {
  return {
    width: availableWidth,
    height: Math.round(
      availableWidth < 500
        ? Math.max(720, fontSize * 40)
        : Math.max(620, fontSize * 36)
    ),
  };
}

export async function initialiseC2() {
  if (!document.getElementById("chart-2")) return null;

  const selector = document.getElementById("c2-group");
  const resetButton = document.getElementById("c2-reset");
  const context = document.getElementById("c2-context");
  const tableBody = document.getElementById("c2-table-body");
  const tableCaption = document.getElementById("c2-table-caption");

  const groupColumnHeading = tableBody
    .closest("table")
    .querySelector("thead th:first-child");

  selector.disabled = true;

  const controller = await mountChart({
    id: "chart-2",
    url: "charts/c2-food-treemap.vg.json",
    mode: "vega",

    signals: {
      selectedGroup: "",
    },

    prepare(spec, layout) {
      Object.assign(spec, treemapLayout(layout));

      spec.signals.find(
        (signal) => signal.name === "labelSize"
      ).value = layout.fontSize;

      return spec;
    },

    async resizeView(view, layout) {
      const { width, height } = treemapLayout(layout);

      await view
        .width(width)
        .height(height)
        .signal("labelSize", layout.fontSize)
        .runAsync();
    },
  });

  try {
    // Use independent copies for the controls and table.
    const rows = controller.view.data("raw").map((row) => ({
      parent: row.parent,
      parent_label: row.parent_label,
      category: row.category,
      weekly: row.weekly,
    }));

    const groups = controller.view
      .data("groupNodes")
      .map((group) => ({
        id: group.id,
        name: group.name,
        label: group.label,
        total: group.total,
        childCount: rows.filter(
          (row) => row.parent === group.id
        ).length,
      }))
      .sort((a, b) => b.total - a.total);

    if (rows.length !== 42 || groups.length !== 13) {
      throw new Error(
        "C2 expects 42 categories in 13 groups. " +
        "Check food-hierarchy.csv."
      );
    }

    const money = (value) => `$${value.toFixed(2)}`;

    const readable = (text) =>
      text
        .replace(/\bnfd\b/g, "(not further defined)")
        .replace(/\bnec\b/g, "(not elsewhere classified)");

    const groupOrder = new Map(
      groups.map((group, index) => [group.id, index])
    );

    const groupCounts = new Map(
      groups.map((group) => [group.id, group.childCount])
    );

    selector.replaceChildren(
      new Option("All food groups", "")
    );

    for (const group of groups) {
      if (group.childCount <= 1) continue;

      selector.add(new Option(group.label, group.id));
    }

    selector.disabled = false;

    function updateTableAndContext(selected) {
      const group = groups.find(
        (item) => item.id === selected
      );

      const visibleRows = rows
        .filter(
          (row) => !selected || row.parent === selected
        )
        .sort(
          (a, b) =>
            groupOrder.get(a.parent) -
              groupOrder.get(b.parent) ||
            b.weekly - a.weekly
        );

      if (group) {
        context.textContent =
          `${readable(group.name)}: ` +
          `${money(group.total)} per household per week. ` +
          "Rectangle sizes now compare categories within this group.";
      } else {
        context.textContent =
          "All 13 food groups — average household spending " +
          "in Australian dollars per week, 2015–16.";
      }

      tableCaption.textContent =
        `${group ? readable(group.name) : "All food groups"} ` +
        "— average household dollars per week, 2015–16";

      resetButton.disabled = !selected;
      groupColumnHeading.hidden = Boolean(selected);

      const fragment = document.createDocumentFragment();
      let previousGroup = null;

      for (const row of visibleRows) {
        const tr = document.createElement("tr");

        if (!selected && row.parent !== previousGroup) {
          const groupCell = document.createElement("td");

          groupCell.textContent = readable(row.parent_label);
          groupCell.rowSpan = groupCounts.get(row.parent);
          groupCell.className = "c2-table-group";

          tr.append(groupCell);
        }

        const categoryCell = document.createElement("th");
        categoryCell.scope = "row";
        categoryCell.textContent = readable(row.category);

        const valueCell = document.createElement("td");
        valueCell.textContent = money(row.weekly);

        tr.append(categoryCell, valueCell);
        fragment.append(tr);

        previousGroup = row.parent;
      }

      tableBody.replaceChildren(fragment);
    }

    function chooseGroup(value) {
      selector.value = value;
      controller.setSignal("selectedGroup", value);
      updateTableAndContext(value);
    }

    selector.addEventListener(
      "change",
      () => chooseGroup(selector.value),
      { signal: controller.events }
    );

    resetButton.addEventListener(
      "click",
      () => chooseGroup(""),
      { signal: controller.events }
    );

    updateTableAndContext("");

    return controller;
  } catch (error) {
    controller.dispose();
    selector.disabled = true;
    resetButton.disabled = true;
    throw error;
  }
}