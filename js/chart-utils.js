// Shared chart utilities.
// Chart-specific data transformations and encodings stay in charts/*.json.

export async function loadJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }

  return response.json();
}

export async function loadCSV(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }

  return vega.read(await response.text(), {
    type: "csv",
    parse: "auto",
  });
}

export function showChartError(id, error) {
  console.error(`${id}:`, error);

  const container = document.getElementById(id);
  if (!container) return;

  const message = document.createElement("p");
  message.className = "chart-error";
  message.setAttribute("role", "alert");
  message.textContent =
    "This chart could not load. Check its files and internet connection, then refresh.";

  container.replaceChildren(message);
  container.setAttribute("aria-busy", "false");
}

export function walkLayers(spec, visit) {
  visit(spec);

  for (const layer of spec.layer || []) {
    walkLayers(layer, visit);
  }
}

// Set text sizes before Vega calculates the chart's layout.
export function applyTextSize(spec, fontSize) {
  spec.config ||= {};

  spec.config.axis = {
    ...spec.config.axis,
    labelFontSize: fontSize,
    titleFontSize: fontSize,
  };

  spec.config.legend = {
    ...spec.config.legend,
    labelFontSize: fontSize,
    titleFontSize: fontSize,
  };

  spec.config.text = {
    ...spec.config.text,
    fontSize,
  };

  walkLayers(spec, (layer) => {
    if (layer.mark?.type === "text") {
      layer.mark.fontSize = fontSize;
    }

    for (const channel of ["x", "y"]) {
      const axis = layer.encoding?.[channel]?.axis;

      if (axis && typeof axis === "object") {
        axis.labelFontSize = fontSize;
        axis.titleFontSize = fontSize;
      }
    }
  });
}

export function mapLayout(availableWidth) {
  const width = Math.max(
    740,
    Math.min(920, availableWidth - 80)
  );

  return {
    width,
    height: Math.round((width * 560) / 740),
  };
}

// Manage loading, rendering, selection state and cleanup in one place.
// Most charts rebuild when their layout changes.
// Charts supporting direct resizing can provide resizeView instead.
export async function mountChart({
  id,
  url,
  specification,
  mode = "vega-lite",
  prepare,
  signals = {},
  resizeView,
  afterRender,
}) {
  const container = document.getElementById(id);
  if (!container) return null;

  const wrapper =
    container.closest(".chart-scroll") || container;

  const template = specification || (await loadJSON(url));
  const state = { ...signals };
  const events = new AbortController();

  let embedded;
  let timer;
  let lastLayout = "";
  let lastSignals = "";
  let pending = false;
  let running = false;
  let disposed = false;

  function layout() {
    const styles = getComputedStyle(document.documentElement);

    return {
      availableWidth: Math.floor(wrapper.clientWidth),
      fontSize:
        parseFloat(styles.getPropertyValue("--chart-font")) || 18,
    };
  }

  function updateScrollHint() {
    if (!wrapper.classList.contains("chart-scroll")) return;

    const hint = wrapper.nextElementSibling;

    if (hint?.classList.contains("scroll-help")) {
      hint.hidden =
        wrapper.scrollWidth <= wrapper.clientWidth + 1;
    }
  }

  async function render() {
    pending = true;

    if (running || disposed) return;

    running = true;
    container.setAttribute("aria-busy", "true");

    try {
      while (pending && !disposed) {
        pending = false;

        const dimensions = layout();
        if (!dimensions.availableWidth) continue;

        const layoutKey = JSON.stringify(dimensions);
        const signalValues = { ...state };
        const signalKey = JSON.stringify(signalValues);

        if (
          embedded &&
          layoutKey === lastLayout &&
          signalKey === lastSignals
        ) {
          continue;
        }

        if (!embedded || layoutKey !== lastLayout) {
          if (embedded && resizeView) {
            await resizeView(embedded.view, dimensions);
          } else {
            const scroll = wrapper.scrollLeft;

            const spec = prepare(
              structuredClone(template),
              dimensions
            );

            const parameters =
              mode === "vega" ? spec.signals : spec.params;

            for (const [name, value] of Object.entries(signalValues)) {
              const parameter = parameters?.find(
                (item) => item.name === name
              );

              if (!parameter) {
                throw new Error(
                  `Missing chart parameter: ${name}`
                );
              }

              parameter.value = value;
            }

            embedded?.finalize();
            embedded = null;

            const result = await vegaEmbed(container, spec, {
              mode,
              actions: false,
              renderer: "svg",
            });

            if (disposed) {
              result.finalize();
              return;
            }

            embedded = result;
            wrapper.scrollLeft = scroll;
            afterRender?.(embedded.view);
          }

          lastLayout = layoutKey;
        }

        for (const [name, value] of Object.entries(signalValues)) {
          embedded.view.signal(name, value);
        }

        if (Object.keys(signalValues).length) {
          await embedded.view.runAsync();
        }

        lastSignals = signalKey;
        updateScrollHint();

        // Handle changes made while rendering was in progress.
        if (
          JSON.stringify(layout()) !== layoutKey ||
          JSON.stringify(state) !== signalKey
        ) {
          pending = true;
        }
      }
    } finally {
      running = false;
      container.setAttribute("aria-busy", "false");
    }
  }

  function fail(error) {
    dispose();

    container
      .closest("figure")
      ?.querySelectorAll("select, button")
      .forEach((control) => {
        control.disabled = true;
      });

    showChartError(id, error);
  }

  function schedule() {
    clearTimeout(timer);

    timer = setTimeout(() => {
      void render().catch(fail);
    }, 100);
  }

  const observer = new ResizeObserver(schedule);
  observer.observe(wrapper);

  document.addEventListener(
    "reading-size-change",
    schedule,
    { signal: events.signal }
  );

  function dispose() {
    disposed = true;
    clearTimeout(timer);
    observer.disconnect();
    events.abort();

    embedded?.finalize();
    embedded = null;
  }

  try {
    await render();
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    get view() {
      return embedded?.view;
    },

    getSignal(name) {
      return state[name];
    },

    setSignal(name, value) {
      if (disposed || state[name] === value) return;

      state[name] = value;
      void render().catch(fail);
    },

    events: events.signal,
    dispose,
  };
}