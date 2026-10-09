(() => {
  "use strict";

  // A new key prevents the previous default from overriding
  // the new Medium default.
  const storageKey = "food-budget-a2-reading-size-v2";
  const defaultSize = "medium";

  // Keep using the size rules already defined in the CSS.
  const cssSizes = {
    small: "standard",
    medium: "large",
    large: "extra-large"
  };

  const choices = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" }
  ];

  function initialiseReadingSize() {
    const controls = document.getElementById("reading-controls");
    const selector = document.getElementById("reading-size");

    if (!controls || !selector) return;

    // Replace the old labels and values.
    selector.replaceChildren();

    choices.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      selector.appendChild(option);
    });

    function applySize(size) {
      const validSize = Object.prototype.hasOwnProperty.call(
        cssSizes,
        size
      )
        ? size
        : defaultSize;

      document.documentElement.setAttribute(
        "data-reading-size",
        cssSizes[validSize]
      );

      selector.value = validSize;
      return validSize;
    }

    let savedSize = defaultSize;

    try {
      savedSize = localStorage.getItem(storageKey) || defaultSize;
    } catch {
      // Use Medium if browser storage is unavailable.
    }

    applySize(savedSize);

    selector.addEventListener("change", () => {
      const selectedSize = applySize(selector.value);

      try {
        localStorage.setItem(storageKey, selectedSize);
      } catch {
        // The selected size still applies for this visit.
      }
    });

    controls.hidden = false;
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseReadingSize,
      { once: true }
    );
  } else {
    initialiseReadingSize();
  }
})();