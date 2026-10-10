const STORAGE_KEY = "food-budget-a2-reading-size-v2";
const DEFAULT_SIZE = "medium";
const SIZES = ["small", "medium", "large"];

export function initialiseReadingSize() {
  const selector = document.getElementById("reading-size");
  const controls = document.getElementById("reading-controls");

  if (!selector || !controls) return;

  function apply(size) {
    const selected = SIZES.includes(size)
      ? size
      : DEFAULT_SIZE;

    document.documentElement.dataset.readingSize = selected;
    selector.value = selected;

    return selected;
  }

  let saved = DEFAULT_SIZE;

  try {
    saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_SIZE;
  } catch {
    // Reading controls still work when browser storage is unavailable.
  }

  apply(saved);

  selector.addEventListener("change", () => {
    const selected = apply(selector.value);

    try {
      localStorage.setItem(STORAGE_KEY, selected);
    } catch {
      // Keep the selected size for this visit.
    }

    document.dispatchEvent(
      new Event("reading-size-change")
    );
  });

  controls.hidden = false;
}