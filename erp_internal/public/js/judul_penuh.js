// A text cut to "..." (a narrow column header, a list cell) shows its whole text on hover (Abel 2026-11-27).
// Only for an element that really overflows and has no title of its own; set on the first hover, so nothing runs
// while the page draws.
document.addEventListener(
	"mouseover",
	(e) => {
		for (let el = e.target; el && el !== document.body; el = el.parentElement) {
			if (el.hasAttribute?.("title")) return;
			if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === "ellipsis") {
				const teks = el.textContent.trim();
				if (teks) el.title = teks;
				return;
			}
		}
	},
	{ passive: true },
);
