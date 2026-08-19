(() => {
  "use strict";

  const screens = {
    menu: document.getElementById("menuScreen"),
    level: document.getElementById("levelScreen"),
    how: document.getElementById("howScreen")
  };

  function showOnly(screen) {
    Object.values(screens).forEach(node => node?.classList.add("hidden"));
    screen?.classList.remove("hidden");
  }

  function refreshLevelStars() {
    for (let index = 0; index < 4; index++) {
      const value = Number(localStorage.getItem(`pizzaDashStars${index}`) || 0);
      const node = document.getElementById(`stars-${index}`);
      if (node) node.textContent = `${"★ ".repeat(value)}${"☆ ".repeat(3 - value)}`.trim();
    }
  }

  document.getElementById("playBtn")?.addEventListener("click", () => showOnly(screens.level));
  document.getElementById("howBtn")?.addEventListener("click", () => showOnly(screens.how));
  document.getElementById("howPlayBtn")?.addEventListener("click", () => showOnly(screens.level));
  document.getElementById("closeHowBtn")?.addEventListener("click", () => showOnly(screens.menu));
  document.getElementById("backToMenuBtn")?.addEventListener("click", () => showOnly(screens.menu));

  refreshLevelStars();
})();
