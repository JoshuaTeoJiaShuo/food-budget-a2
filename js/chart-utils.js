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
  const width = Math.max(300, Math.min(680, availableWidth - 48));

  return {
    width,
    height: Math.round(width * 0.74),
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
  let revision = 0;
  let lastSignals = "";
  let pending = false;
  let running = false;
  let disposed = false;

  function layout() {
    const styles = getComputedStyle(document.documentElement);

    return {
      availableWidth: Math.floor(wrapper.clientWidth),
      fontSize:
        parseFloat(styles.getPropertyValue("--chart-font")) || 14,
    };
  }

  function updateScrollHint() {
    if (!wrapper.classList.contains("chart-scroll")) return;

    const chartNumber = container.id.replace("chart-", "");
    const hint = document.getElementById(`c${chartNumber}-scroll-help`);

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

        const layoutKey = JSON.stringify(dimensions) + ":" + revision;
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
        alignFigureToPlots(container);

        // Handle changes made while rendering was in progress.
        if (
          JSON.stringify(layout()) + ":" + revision !== layoutKey ||
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

    refresh(values = {}) {
      Object.assign(state, values);
      revision += 1;
      return render().catch(fail);
    },

    events: events.signal,
    dispose,
  };
}

// Household focus is shared by the mosaic and heatmap, without filtering denominators.
export function bindHouseholdFocus(controller, container) {
  const update = () => controller.setSignal("focusedHousehold", document.body.dataset.householdFocus || "");
  window.addEventListener("household-focus", update, { signal: controller.events });
  update();
  container.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); setHouseholdFocus(""); }
  }, { signal: controller.events });
}
export function setHouseholdFocus(name) {
  const current = document.body.dataset.householdFocus || "";
  document.body.dataset.householdFocus = current === name ? "" : name;
  window.dispatchEvent(new Event("household-focus"));
}


// Chart columns, headings and reading text share the same measured rails.
function alignFigureToPlots(container) {
  const figure = container.closest("figure");
  const svg = container.querySelector("svg");
  if (!figure || !svg) return;
  const heading = figure.querySelector(":scope > .plot-heading");
  heading?.classList.toggle("has-inline-control", Boolean(heading.querySelector(".compact-timeline, .header-actions")));
  figure.classList.remove("has-comparison-columns");
  figure.style.setProperty("--plot-inset", "0px");
  const body = figure.querySelector(".takeaway-body");
  if (!body) return;
  const frame = figure.getBoundingClientRect();
  const contentLeft = frame.left + parseFloat(getComputedStyle(figure).paddingLeft) + parseFloat(getComputedStyle(figure).borderLeftWidth);
  const contentRight = frame.right - parseFloat(getComputedStyle(figure).paddingRight) - parseFloat(getComputedStyle(figure).borderRightWidth);
  const scope = name => svg.querySelector(`g.role-scope.${name}`)?.getBoundingClientRect();
  const outer = svg.querySelector(":scope > g")?.getBoundingClientRect();
  let primary = outer, secondary;
  if (["chart-1", "chart-3", "chart-11", "chart-13"].includes(container.id)) {
    primary = scope("concat_0_group") || outer;
    const next = scope("concat_1_group");
    if (next && next.left > primary.right - 20 && Math.abs(next.top-primary.top) < 80) secondary = next;
  }
  if (container.id === "chart-9") {
    primary = scope("concat_0_concat_0_group") || outer;
    const next = scope("concat_0_concat_1_group");
    if (next && next.left > primary.right - 20) secondary = next;
  }
  if (container.id === "chart-5" && innerWidth > 800) {
    secondary = figure.querySelector(".mosaic-key-heading")?.getBoundingClientRect();
  }
  if (container.id === "chart-11") {
    const comparison = scope("concat_1_group");
    figure.style.setProperty("--stacked-key-inset", `${Math.max(0,(comparison?.left || contentLeft)-contentLeft)}px`);
    heading?.classList.toggle("aligned-map-key", Boolean(secondary && innerWidth > 800));
    if (secondary) figure.style.setProperty("--map-key-first-width", `${secondary.left-contentLeft-20}px`);
  }
  const sidebar = Boolean(figure.querySelector(".chart-and-takeaway"));
  const rail = Math.max(contentLeft, Math.min(primary?.left || contentLeft, contentLeft+20));
  figure.style.setProperty("--visual-inset", `${rail-contentLeft}px`);
  const split = secondary && secondary.left < contentRight-240 && innerWidth > 800;
  figure.classList.toggle("has-visual-columns", Boolean(split && !sidebar));
  if (split && !sidebar) {
    const bodyLeft = body.getBoundingClientRect().left;
    figure.style.setProperty("--reading-first-width", `${secondary.left-bodyLeft-24}px`);
    figure.style.setProperty("--visual-first-span", `${secondary.left-rail-24}px`);
  }
  // A finding box keeps its edge at the frame, while its text follows the chart.
  const panel = body.querySelector(".takeaway-finding");
  if (!sidebar && panel) panel.style.setProperty("--finding-text-inset", `${Math.max(0,rail-body.getBoundingClientRect().left-1)}px`);
  heading?.classList.toggle("has-timeline-comparison", Boolean(split && heading.querySelector(".compact-timeline")));
  if (split) figure.style.setProperty("--timeline-first-width", `${secondary.left-contentLeft-24}px`);
  if (container.id === "chart-9") {
    const headings = document.getElementById("c9-column-headings");
    headings.style.paddingLeft = `${Math.max(0,primary.left-headings.getBoundingClientRect().left)}px`;
    headings.style.gridTemplateColumns = split ? `${secondary.left-primary.left-24}px minmax(0,1fr)` : "minmax(0,1fr)";
  }
  const interpretation = body.querySelector(".takeaway-interpretation");
  const meaning = interpretation?.querySelector(".takeaway-meaning");
  if (!sidebar && panel && meaning && innerWidth > 650 && getComputedStyle(body).gridTemplateColumns.split(" ").length > 1) {
    const start = meaning.getBoundingClientRect().left;
    const end = panel.getBoundingClientRect().right;
    interpretation.style.setProperty("--arrow-left", `${(start+end)/2-interpretation.getBoundingClientRect().left-16}px`);
  }
  if (["chart-7", "chart-8"].includes(container.id)) balanceIncomeFindings();
  alignSectionIntroduction(container);
}

// Small semantic cues survive copy updates without parsing data as HTML.
export function setTextCues(element, parts) {
  element.replaceChildren(...parts.map(part => {
    if (typeof part === "string") return document.createTextNode(part);
    const cue = document.createElement("span");
    cue.className = `chart-cue ${part.cue}`;
    cue.textContent = part.text;
    return cue;
  }));
}

function balanceIncomeFindings() {
  const comparison = document.querySelector(".income-comparison");
  const panels = [...document.querySelectorAll(".income-chart .takeaway-finding")];
  panels.forEach(panel => panel.style.minHeight = "0px");
  if (!comparison || innerWidth <= 800 || panels.length !== 2) return;
  const height = Math.max(...panels.map(panel => panel.getBoundingClientRect().height));
  panels.forEach(panel => panel.style.minHeight = `${height}px`);
}



// Section introductions use the first visual in their own section, never the preceding one.
function alignSectionIntroduction(container) {
  if (container.id === "chart-8") { alignSectionIntroduction(document.getElementById("chart-7")); return; }
  const section = container.closest("section.chapter");
  const header = section?.querySelector(":scope > .chapter-header");
  const figure = container.closest("figure");
  if (!section || !figure) return;
  const svg = container.querySelector("svg");
  const scope = name => svg?.querySelector(`g.role-scope.${name}`)?.getBoundingClientRect();
  if (header && section.querySelector(".chart") === container) {
    const bounds = header.getBoundingClientRect();
    const title = figure.querySelector(".figure-title h3, .income-chart-heading h3");
    if (title) header.style.setProperty("--section-title-inset", `${Math.max(24,title.getBoundingClientRect().left-bounds.left-1)}px`);
    let target;
    if (container.id === "chart-1") target = scope("concat_1_group")?.left;
    if (container.id === "chart-5") target = figure.querySelector(".mosaic-key-heading")?.getBoundingClientRect().left;
    if (container.id === "chart-7") target = section.querySelector(".income-chart:nth-child(2) h3")?.getBoundingClientRect().left;
    if (container.id === "chart-4") target = figure.querySelector(".takeaway-meaning")?.getBoundingClientRect().left;
    if (container.id === "chart-10") target = figure.querySelector(".chart-finding")?.getBoundingClientRect().left;
    if (target && innerWidth > 850) header.style.setProperty("--section-first-width", `${target-bounds.left-17}px`);
    else header.style.removeProperty("--section-first-width");
  }
  const bridge = figure.previousElementSibling;
  if (bridge?.classList.contains("story-bridge")) {
    const first = scope("concat_0_group");
    const title = figure.querySelector(".figure-title h3");
    if (innerWidth > 850 && first && title) {
      bridge.style.width = `${first.width}px`;
      bridge.style.marginLeft = `${Math.max(0,title.getBoundingClientRect().left-bridge.parentElement.getBoundingClientRect().left-17)}px`;
    } else if (title) {
      const inset = Math.max(0,title.getBoundingClientRect().left-bridge.parentElement.getBoundingClientRect().left-17);
      bridge.style.width = `calc(100% - ${inset}px)`;
      bridge.style.marginLeft = `${inset}px`;
    }
  }
}
