const c1Container = document.querySelector("#chart-1");
const c1Panel = document.querySelector(".c1-panel");
const c1Status = document.querySelector("#c1-selection-status");

let c1Template;
let c1View;
let c1LastWidth = 0;
let c1Rendering = false;
let c1ResizeTimer;
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

// Update the highlight without rebuilding the chart.
function setC1Focus(category, announce = false) {
  if (!c1View || category === c1FocusedCategory) return;

  c1FocusedCategory = category;

  c1View
    .signal("focusedCategory", category)
    .runAsync()
    .catch(console.error);

  if (announce) {
    c1Status.textContent = category
      ? `Highlighted category: ${category}`
      : "All categories shown.";
  }
}

function addC1Hover(view) {
  view.addEventListener("pointermove", (event, item) => {
    const category = item?.datum?.category;

    setC1Focus(
      c1CategoryOrder.includes(category) ? category : ""
    );
  });
}

// Restore the overview when the pointer leaves the chart.
c1Container.addEventListener("pointerleave", () => {
  setC1Focus("");
});

// Provide a keyboard alternative to hovering.
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

  const currentIndex =
    c1CategoryOrder.indexOf(c1FocusedCategory);

  let nextIndex;

  if (currentIndex === -1) {
    nextIndex = event.key === "ArrowRight"
      ? 0
      : c1CategoryOrder.length - 1;
  } else {
    const direction = event.key === "ArrowRight" ? 1 : -1;

    nextIndex =
      (currentIndex + direction + c1CategoryOrder.length) %
      c1CategoryOrder.length;
  }

  setC1Focus(c1CategoryOrder[nextIndex], true);
});

c1Container.addEventListener("blur", () => {
  setC1Focus("");
});

function makeCompactC1(template, availableWidth) {
  const encoding = structuredClone(template.encoding);

  encoding.x.axis.values = [1988, 2003, 2015];
  encoding.x.axis.labelFontSize = 12;
  encoding.y.axis.values = [0, 20, 40];

  return {
    $schema: template.$schema,
    description: "C1 on narrow screens, using shared scales.",
    params: structuredClone(template.params),
    data: structuredClone(template.data),
    transform: structuredClone(template.transform),
    padding: 8,

    facet: {
      field: "category",
      type: "nominal",
      sort: c1CategoryOrder,

      header: {
        title: null,
        labelOrient: "top",
        labelAnchor: "start",
        labelAlign: "left",
        labelFont: "Arial",
        labelFontSize: 12,
        labelFontWeight: "bold",
        labelPadding: 10,
        labelLimit: 0
      }
    },

    columns: 1,
    spacing: 24,

    spec: {
      width: Math.max(140, availableWidth - 85),
      height: 110,
      encoding,

      layer: [
        {
          mark: {
            type: "line",
            strokeWidth: 2,
            point: {
              filled: true,
              size: 28
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
            dy: -12,
            fontSize: 13,
            fontWeight: "bold"
          },

          encoding: {
            text: {
              field: "end_label"
            }
          }
        }
      ]
    },

    resolve: {
      scale: {
        x: "shared",
        y: "shared"
      }
    },

    config: structuredClone(template.config)
  };
}

async function renderC1() {
  if (!c1Template || c1Rendering) return;

  const availableWidth =
    Math.floor(c1Container.clientWidth);

  if (!availableWidth || availableWidth === c1LastWidth) {
    return;
  }

  c1Rendering = true;
  c1LastWidth = availableWidth;

  try {
    const compact = availableWidth < 820;

    c1Panel.classList.toggle("is-compact", compact);

    const specification = compact
      ? makeCompactC1(c1Template, availableWidth)
      : structuredClone(c1Template);

    if (!compact) {
      // Space for the y-axis, connector lines, names and values.
      specification.width = availableWidth - 370;
    }

    if (c1View) {
      c1View.finalize();
      c1View = null;
    }

    c1FocusedCategory = "";

    const result = await vegaEmbed(
      c1Container,
      specification,
      {
        actions: false,
        renderer: "svg"
      }
    );

    c1View = result.view;
    addC1Hover(c1View);
  } finally {
    c1Rendering = false;
  }

  // Catch a resize that happened while rendering.
  if (
    Math.floor(c1Container.clientWidth) !== c1LastWidth
  ) {
    await renderC1();
  }
}

function showC1Error(error) {
  console.error(error);

  c1Container.textContent =
    "The chart could not load. Check the file paths " +
    "and internet connection, then refresh Live Server.";
}

async function initialiseC1() {
  const response = await fetch(
    "charts/c1-food-shares.vl.json"
  );

  if (!response.ok) {
    throw new Error("Could not load the C1 specification.");
  }

  c1Template = await response.json();
  await renderC1();

  const observer = new ResizeObserver(() => {
    clearTimeout(c1ResizeTimer);

    c1ResizeTimer = setTimeout(() => {
      renderC1().catch(showC1Error);
    }, 150);
  });

  observer.observe(c1Container);
}

initialiseC1().catch(showC1Error);