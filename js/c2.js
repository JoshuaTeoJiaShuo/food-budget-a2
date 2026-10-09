// C2: treemap, group selector, reading size and data table.

(async function initialiseC2() {
  const container = document.querySelector("#chart-2");
  if (!container) return;

  const selector = document.querySelector("#c2-group");
  const resetButton = document.querySelector("#c2-reset");
  const context = document.querySelector("#c2-context");
  const tableBody = document.querySelector("#c2-table-body");
  const tableCaption = document.querySelector("#c2-table-caption");

  const table = tableBody.closest("table");
  const groupColumnHeading = table.querySelector(
    "thead th:first-child"
  );

  function getLayout() {
    const readingControl = document.querySelector("#reading-size");

    const fontSize =
      parseFloat(
        getComputedStyle(readingControl || document.body).fontSize
      ) || 18;

    const width = Math.max(
      1,
      Math.floor(container.clientWidth)
    );

    const height = Math.round(
      width < 500
        ? Math.max(720, fontSize * 40)
        : Math.max(620, fontSize * 36)
    );

    return { width, height, fontSize };
  }

  function showError(error) {
    console.error(error);

    container.textContent =
      "The treemap could not load. Check the C2 file paths " +
      "and refresh Live Server.";

    container.setAttribute("role", "alert");
    selector.disabled = true;
    resetButton.disabled = true;
  }

  /*
   * Add responsive font settings to the existing specification.
   * The JSON file and data file do not need to change.
   */

  function prepareSpecification(spec, layout) {
    spec.width = layout.width;
    spec.height = layout.height;

    spec.signals = spec.signals.filter(
      signal =>
        !["labelSize", "lineSpacing", "headerSpace"].includes(
          signal.name
        )
    );

    spec.signals.push(
      {
        name: "labelSize",
        value: layout.fontSize
      },
      {
        name: "lineSpacing",
        update: "labelSize + 4"
      },
      {
        name: "headerSpace",
        update: "2 * lineSpacing + 16"
      }
    );

    const groupFits =
      "datum.x1 - datum.x0 > labelSize * 4 + 16 && " +
      "datum.y1 - datum.y0 > headerSpace + 4";

    const mealValueSize =
      "min(labelSize * 2.8, " +
      "max(labelSize + 6, " +
      "(datum.right - datum.left) / 7.5))";

    // Only draw labels when the rectangle has enough room.
    for (const dataset of spec.data) {
      if (dataset.name === "groupLabels") {
        dataset.transform = [
          { type: "filter", expr: groupFits }
        ];
      }

      if (dataset.name === "groupTotals") {
        dataset.transform = [
          {
            type: "filter",
            expr: "datum.childCount > 1 && " + groupFits
          }
        ];
      }

      if (dataset.name === "leafLabels") {
        dataset.transform = [
          {
            type: "filter",
            expr:
              "datum.right - datum.left > labelSize * 5 + 16 && " +
              "datum.bottom - datum.top > " +
              "(datum.name === datum.groupName " +
                "? 24 + (datum.group === '0311' " +
                  "? " + mealValueSize + " " +
                  ": labelSize + 2) " +
                ": 24 + length(split(datum.label, '|')) * " +
                  "lineSpacing + labelSize + 2)"
          }
        ];
      }
    }

    for (const mark of spec.marks) {
      if (mark.type !== "text") continue;

      const source = mark.from?.data;
      const update = mark.encode.update;

      if (source === "groupLabels") {
        update.fontSize = { signal: "labelSize" };
      }

      if (source === "groupTotals") {
        update.fontSize = { signal: "labelSize" };

        update.y = {
          signal:
            "datum.y0 - headerSpace + 8 + lineSpacing"
        };
      }

      if (source === "leafLabels") {
        const isValue =
          update.fontWeight?.value === "bold";

        update.limit = {
          signal:
            "max(0, datum.right - datum.left - " +
            "(datum.group === '0311' ? 32 : 16))"
        };

        if (isValue) {
          update.x = {
            signal:
              "datum.left + " +
              "(datum.group === '0311' ? 16 : 8)"
          };

          update.y = {
            signal:
              "datum.top - headerSpace + " +
              "(datum.name === datum.groupName " +
                "? 14 " +
                ": 14 + length(split(datum.label, '|')) * " +
                  "lineSpacing)"
          };

          update.fontSize = {
            signal:
              "datum.group === '0311' ? " +
              mealValueSize +
              " : labelSize + 2"
          };
        } else {
          update.x = {
            signal: "datum.left + 8"
          };

          update.y = {
            signal: "datum.top - headerSpace + 8"
          };

          update.fontSize = {
            signal: "labelSize"
          };

          update.lineHeight = {
            signal: "lineSpacing"
          };
        }
      }
    }

    return spec;
  }

  try {
    selector.disabled = true;

    const response = await fetch(
      "charts/c2-food-treemap.vg.json"
    );

    if (!response.ok) {
      throw new Error("Could not load the C2 specification.");
    }

    const initialLayout = getLayout();

    const specification = prepareSpecification(
      await response.json(),
      initialLayout
    );

    const { view } = await vegaEmbed(
      container,
      specification,
      {
        mode: "vega",
        actions: false,
        renderer: "svg"
      }
    );

    // Independent copies support the controls and table.
    const rows = view.data("raw").map(row => ({
      parent: row.parent,
      parent_label: row.parent_label,
      category: row.category,
      weekly: row.weekly
    }));

    const groups = view
      .data("groupNodes")
      .map(group => ({
        id: group.id,
        name: group.name,
        label: group.label,
        total: group.total,
        childCount: rows.filter(
          row => row.parent === group.id
        ).length
      }))
      .sort((a, b) => b.total - a.total);

    if (rows.length !== 42 || groups.length !== 13) {
      throw new Error(
        "C2 expects 42 categories in 13 groups. " +
        "Check food-hierarchy.csv."
      );
    }

    const money = value => "$" + value.toFixed(2);

    const readable = text =>
      text
        .replace(/\bnfd\b/g, "(not further defined)")
        .replace(/\bnec\b/g, "(not elsewhere classified)");

    const groupOrder = new Map(
      groups.map((group, index) => [group.id, index])
    );

    const groupCounts = new Map(
      groups.map(group => [group.id, group.childCount])
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
        item => item.id === selected
      );

      const visibleRows = rows
        .filter(row => !selected || row.parent === selected)
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
          "Rectangle sizes now compare categories " +
          "within this group.";
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

    /*
     * Apply width, text size and selected group together.
     * Queue changes made while Vega is updating.
     */

    let updating = false;
    let updatePending = false;
    let lastState = "";
    let resizeTimer;

    async function updateView() {
      updatePending = true;
      if (updating) return;

      updating = true;

      try {
        while (updatePending) {
          updatePending = false;

          const layout = getLayout();
          const selected = selector.value;

          const state = [
            layout.width,
            layout.height,
            layout.fontSize,
            selected
          ].join(":");

          if (state === lastState) continue;

          await view
            .width(layout.width)
            .height(layout.height)
            .signal("labelSize", layout.fontSize)
            .signal("selectedGroup", selected)
            .runAsync();

          lastState = state;
          updateTableAndContext(selected);
        }
      } finally {
        updating = false;
      }
    }

    function scheduleUpdate() {
      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        updateView().catch(showError);
      }, 100);
    }

    selector.addEventListener("change", () => {
      updateView().catch(showError);
    });

    resetButton.addEventListener("click", () => {
      selector.value = "";
      updateView().catch(showError);
    });

    new ResizeObserver(scheduleUpdate).observe(container);

    new MutationObserver(scheduleUpdate).observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["data-reading-size"]
      }
    );

    await updateView();
  } catch (error) {
    showError(error);
  }
})();