function NXI_Panel({ type: i }) {
  const svg = ne.useMemo(() => {
    try {
      return NXI_DRAW[i] ? NXI_DRAW[i]() : null;
    } catch (e) {
      return null;
    }
  }, [i]);
  if (!svg) return null;
  const open = () => {
    const d = document.createElement("div");
    ((d.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);padding:24px;cursor:zoom-out"),
      (d.innerHTML =
        '<div style="width:min(1150px,96vw);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)">' +
        svg +
        "</div>"),
      (d.onclick = () => d.remove()),
      document.body.appendChild(d));
  };
  return x.jsxs("div", {
    className: "border-b border-line px-2.5 py-2.5",
    children: [
      x.jsx("div", {
        className: "cursor-zoom-in overflow-hidden rounded-lg border border-line2 shadow-lg",
        title: "לחצו להגדלה",
        onClick: open,
        dangerouslySetInnerHTML: { __html: svg },
      }),
      x.jsx("div", {
        className: "mt-1 text-center text-[10.5px] text-fg3",
        children: "איור חתך מוסבר · לחצו להגדלה",
      }),
    ],
  });
}
try {
  window.__TS = { wt, ye, tn, O6, bS, ct, F6, Ul, B6, c0, xi };
} catch (e) {}
