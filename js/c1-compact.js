export const CATEGORY_ORDER = [
  "Meals out & fast foods",
  "Meat, fish & seafood",
  "Fruit & vegetables",
  "Condiments, confectionery etc.",
  "Bakery products, flour & cereals",
  "Other food",
  "Dairy products",
  "Non-alcoholic beverages",
];

function wrapC1Title(text, width, fontSize) {
  const context = document
    .createElement("canvas")
    .getContext("2d");

  context.font = `bold ${fontSize}px Arial`;

  const lines = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && context.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

// Show one panel per category, keeping identical scales across panels.
export function makeCompactC1(
  template,
  availableWidth,
  fontSize
) {
  const width = Math.max(80, availableWidth - 100);
  const encoding = structuredClone(template.encoding);

  encoding.x.axis.values = [1988, 2003, 2015];
  encoding.y.axis.values = [0, 20, 40];

  encoding.x.axis.labelAlign = {
    expr:
      "datum.value === 1988 ? 'left' : " +
      "datum.value === 2015 ? 'right' : 'center'",
  };

  return {
    $schema: template.$schema,

    description:
      "Food spending trends, with a labelled panel for each category.",

    data: template.data,
    transform: template.transform,
    params: template.params,

    padding: 8,
    spacing: 26,

    vconcat: CATEGORY_ORDER.map((category) => ({
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
        offset: 14,
      },

      width,
      height: Math.max(120, fontSize * 8),

      transform: [
        {
          filter: {
            field: "category",
            equal: category,
          },
        },
      ],

      encoding: structuredClone(encoding),

      layer: [
        {
          mark: {
            type: "line",
            strokeWidth: 2,
            point: {
              filled: true,
              size: 32,
            },
          },
        },
        {
          transform: [
            {
              filter: "datum.survey_start === 2015",
            },
            {
              calculate:
                "format(datum.food_share_pct, '.1f') + '%'",
              as: "end_label",
            },
          ],

          mark: {
            type: "text",
            align: "right",
            dy: -(fontSize + 2),
            fontSize,
            fontWeight: "bold",
          },

          encoding: {
            text: {
              field: "end_label",
            },
          },
        },
      ],
    })),

    resolve: {
      scale: {
        x: "shared",
        y: "shared",
      },
    },

    config: template.config,
  };
}