const c1Container = document.querySelector("#chart-1");
const c1Panel = document.querySelector(".c1-panel");
const c1Status = document.querySelector("#c1-selection-status");

let c1Template;
let c1View;
let c1ResizeTimer;

let c1LastLayout = "";
let c1Rendering = false;
let c1RenderQueued = false;
let c1FocusedCategory = "";

const c1CategoryOrder = [
  "Meals out & fast foods",
  "Meat, fish & seafood",
  "Fruit & vegetables",
  "Condiments, confectionery etc.",
  "Bakery products, flour & cereals",
  "Other food",
  "Dairy products",
  "Non-alcoholic beverages"
];

/* Read the font size already applied to the reading-size control. */

function c1TextSize() {
  const control = document.getElementById("reading-size");

  return (
    parseFloat(
      getComputedStyle(control || document.body).fontSize
    ) || 18
  );
}

/* Category highlighting */

function setC1Focus(category, announce = false) {
  if (!c1View) return;

  c1FocusedCategory = category;

  c1View
    .signal("focusedCategory", category)
    .runAsync()
    .catch(console.error);

  if (announce && c1Status) {
    c1Status.textContent = category
      ? "Highlighted category: " + category
      : "All categories shown.";
  }
}

c1Container.addEventListener("pointerleave", () => {
  setC1Focus("");
});

c1Container.addEventListener("blur", () => {
  setC1Focus("");
});

c1Container.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    setC1Focus("", true);
    return;
  }

  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }

  event.preventDefault();

  const current = c1CategoryOrder.indexOf(c1FocusedCategory);
  const direction = event.key === "ArrowRight" ? 1 : -1;

  const next =
    current === -1
      ? direction === 1
        ? 0
        : c1CategoryOrder.length - 1
      : (current + direction + c1CategoryOrder.length) %
        c1CategoryOrder.length;

  setC1Focus(c1CategoryOrder[next], true);
});

/* Update fonts before Vega calculates the chart layout. */

function prepareC1Template(fontSize, labelRail) {
  const spec = structuredClone(c1Template);

  spec.config.axis.labelFontSize = fontSize;
  spec.config.axis.titleFontSize = fontSize;
  spec.config.text.fontSize = fontSize;

  function update(node) {
    if (!node || typeof node !== "object") return;

    if (node.mark?.type === "text") {
      node.mark.fontSize = fontSize;
    }

    if (node.encoding?.x?.axis) {
      node.encoding.x.axis.labelFontSize = fontSize;
    }

    if (node.encoding?.y?.axis) {
      node.encoding.y.axis.labelFontSize = fontSize;
    }

    // Move the value column to accommodate larger category names.
    if (node.expr === "width + 305") {
      node.expr = "width + " + labelRail;
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(update);
      } else if (value && typeof value === "object") {
        update(value);
      }
    }
  }

  update(spec);

  // Keep year labels centred beneath their survey points.
  // Disable the automatic inward shift at the two endpoints.
  spec.encoding.x.axis.labelFlush = false;
  spec.encoding.x.axis.labelAlign = "center";
  spec.encoding.x.axis.labelOverlap = false;

  const focus = spec.params.find(
    (parameter) => parameter.name === "focusedCategory"
  );

  if (focus) {
    focus.value = c1FocusedCategory;
  }

  return spec;
}

/* Wrap category headings when using the narrow layout. */

function wrapC1Title(text, width, fontSize) {
  const context = document
    .createElement("canvas")
    .getContext("2d");

  context.font = "bold " + fontSize + "px Arial";

  const lines = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? line + " " + word : word;

    if (
      line &&
      context.measureText(candidate).width > width
    ) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines;
}

/* Narrow screens: one labelled panel per category.
   Every panel retains the same 0–40% vertical scale. */

function makeCompactC1(template, availableWidth, fontSize) {
  const width = Math.max(80, availableWidth - 100);
  const encoding = structuredClone(template.encoding);

  encoding.x.axis.values = [1988, 2003, 2015];
  encoding.y.axis.values = [0, 20, 40];

  encoding.x.axis.labelAlign = {
    expr:
      "datum.value === 1988 ? 'left' : " +
      "datum.value === 2015 ? 'right' : 'center'"
  };

  return {
    $schema: template.$schema,

    description:
      "Food spending trends, with a labelled panel " +
      "for each category.",

    data: template.data,
    transform: template.transform,
    params: template.params,

    padding: 8,
    spacing: 26,

    vconcat: c1CategoryOrder.map((category) => ({
      title: {
        text: wrapC1Title(category, width, fontSize),
        anchor: "start",
        font: "Arial",
        fontSize,
        lineHeight: fontSize + 5,
        color:
          category === "Meals out & fast foods"
            ? "#a74618"
            : "#46534d",
        offset: 14
      },

      width,
      height: Math.max(120, fontSize * 8),

      transform: [
        {
          filter: {
            field: "category",
            equal: category
          }
        }
      ],

      encoding: structuredClone(encoding),

      layer: [
        {
          mark: {
            type: "line",
            strokeWidth: 2,
            point: {
              filled: true,
              size: 32
            }
          }
        },
        {
          transform: [
            {
              filter: "datum.survey_start === 2015"
            },
            {
              calculate:
                "format(datum.food_share_pct, '.1f') + '%'",
              as: "end_label"
            }
          ],

          mark: {
            type: "text",
            align: "right",
            dy: -(fontSize + 2),
            fontSize,
            fontWeight: "bold"
          },

          encoding: {
            text: {
              field: "end_label"
            }
          }
        }
      ]
    })),

    resolve: {
      scale: {
        x: "shared",
        y: "shared"
      }
    },

    config: template.config
  };
}

/* Render again when either the width or reading size changes. */

async function renderC1() {
  c1RenderQueued = true;

  if (!c1Template || c1Rendering) return;

  c1Rendering = true;

  try {
    while (c1RenderQueued) {
      c1RenderQueued = false;

      const width = Math.floor(c1Container.clientWidth);
      const fontSize = c1TextSize();
      const layout = width + ":" + fontSize;

      if (!width || layout === c1LastLayout) {
        continue;
      }

      const labelRail = Math.ceil(fontSize * 18 + 76);

      // Larger year labels require a wider plot.
      const minimumPlotWidth = Math.ceil(fontSize * 25);
      const compact =
        width < labelRail + 80 + minimumPlotWidth;

      c1Panel.classList.toggle("is-compact", compact);

      const template = prepareC1Template(
        fontSize,
        labelRail
      );

      const spec = compact
        ? makeCompactC1(template, width, fontSize)
        : template;

      if (!compact) {
        // Reserve space for axes, category names and values.
        spec.width = width - labelRail - 80;

        // Increase vertical separation as text grows.
        spec.height = Math.round(fontSize * 22 + 80);
      }

      if (c1View) {
        c1View.finalize();
        c1View = null;
      }

      const result = await vegaEmbed(
        c1Container,
        spec,
        {
          actions: false,
          renderer: "svg"
        }
      );

      c1View = result.view;

      c1View.addEventListener(
        "pointermove",
        (event, item) => {
          const category = item?.datum?.category;

          const next = c1CategoryOrder.includes(category)
            ? category
            : "";

          if (next !== c1FocusedCategory) {
            setC1Focus(next);
          }
        }
      );

      c1LastLayout = layout;

      // Handle a size change that happened during rendering.
      const currentLayout =
        Math.floor(c1Container.clientWidth) +
        ":" +
        c1TextSize();

      if (currentLayout !== layout) {
        c1RenderQueued = true;
      }
    }
  } finally {
    c1Rendering = false;
  }
}

function showC1Error(error) {
  console.error(error);
  c1LastLayout = "";

  c1Container.textContent =
    "The chart could not load. Check the file paths " +
    "and internet connection, then refresh.";
}

function scheduleC1Render() {
  clearTimeout(c1ResizeTimer);

  c1ResizeTimer = setTimeout(() => {
    renderC1().catch(showC1Error);
  }, 100);
}

/* Load the existing specification and watch for changes. */

async function initialiseC1() {
  const response = await fetch(
    "charts/c1-food-shares.vl.json"
  );

  if (!response.ok) {
    throw new Error("Could not load the C1 specification.");
  }

  c1Template = await response.json();

  new ResizeObserver(scheduleC1Render).observe(
    c1Container
  );

  new MutationObserver(scheduleC1Render).observe(
    document.documentElement,
    {
      attributes: true,
      attributeFilter: ["data-reading-size"]
    }
  );

  await renderC1();
}

initialiseC1().catch(showC1Error);