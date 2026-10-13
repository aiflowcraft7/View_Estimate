/**
 * ViewEstimate embed loader (built to /public/w.js, about 2 KB).
 *
 *   <script src="https://YOUR_APP/w.js" data-business="your-slug" async></script>
 *   <div id="viewestimate"></div>
 *
 * Options on the script tag:
 *   data-target="#css-selector"   where to put the inline widget (default #viewestimate)
 *   data-mode="button"            floating "Get instant price" button that opens a popup
 *   data-button-text="..."        button label
 *   data-color="#0f766e"          button color
 *
 * The widget runs in an iframe, so the host site's CSS and JS can't break it and
 * no keys ever touch the host page. The iframe reports its height with
 * postMessage; only messages from our own origin are accepted.
 */
(function () {
  type W = Window & { __viewestimateLoaded?: Record<string, boolean> };
  const w = window as W;
  w.__viewestimateLoaded = w.__viewestimateLoaded || {};

  const scripts: HTMLScriptElement[] = [];
  const current = document.currentScript as HTMLScriptElement | null;
  if (current && current.dataset.business) scripts.push(current);
  else document.querySelectorAll<HTMLScriptElement>("script[data-business]").forEach((s) => scripts.push(s));

  scripts.forEach((script) => {
    const slug = (script.dataset.business || "").trim();
    if (!slug) return;
    const origin = new URL(script.src, location.href).origin;
    const key = `${origin}|${slug}|${script.dataset.mode || "inline"}|${script.dataset.target || ""}`;
    if (w.__viewestimateLoaded![key]) return;
    w.__viewestimateLoaded![key] = true;

    const src = `${origin}/embed/${encodeURIComponent(slug)}`;

    function makeFrame(): HTMLIFrameElement {
      const f = document.createElement("iframe");
      f.src = src;
      f.title = "Instant price quote";
      f.loading = "lazy";
      f.setAttribute("allow", "clipboard-write");
      f.style.cssText = "width:100%;border:0;display:block;min-height:420px;height:560px;background:transparent;color-scheme:light;";
      return f;
    }

    const frames: HTMLIFrameElement[] = [];
    window.addEventListener("message", (e: MessageEvent) => {
      if (e.origin !== origin || !e.data || e.data.slug !== slug) return;
      if (e.data.type === "viewestimate:height" && typeof e.data.height === "number") {
        const h = Math.max(300, Math.min(3000, e.data.height));
        frames.forEach((f) => {
          if (f.contentWindow === e.source) f.style.height = `${h}px`;
        });
      }
    });

    if (script.dataset.mode === "button") {
      const color = script.dataset.color || "#0f766e";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = script.dataset.buttonText || "Get instant price";
      btn.style.cssText = `position:fixed;right:20px;bottom:20px;z-index:2147483000;background:${color};color:#fff;border:0;border-radius:999px;padding:14px 22px;font:600 15px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;`;
      let overlay: HTMLDivElement | null = null;
      btn.addEventListener("click", () => {
        if (overlay) {
          overlay.style.display = "flex";
          return;
        }
        overlay = document.createElement("div");
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;";
        const box = document.createElement("div");
        box.style.cssText = "position:relative;width:100%;max-width:600px;";
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Close");
        close.textContent = "×";
        close.style.cssText = "position:absolute;right:-6px;top:-14px;width:36px;height:36px;border-radius:50%;border:0;background:#fff;font-size:22px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:1;";
        const frame = makeFrame();
        frames.push(frame);
        const hide = () => {
          if (overlay) overlay.style.display = "none";
        };
        close.addEventListener("click", hide);
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) hide();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") hide();
        });
        box.appendChild(close);
        box.appendChild(frame);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
      });
      const mount = () => document.body.appendChild(btn);
      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount);
      return;
    }

    const place = () => {
      const target = document.querySelector(script.dataset.target || "#viewestimate");
      const frame = makeFrame();
      frames.push(frame);
      if (target) target.appendChild(frame);
      else script.parentNode?.insertBefore(frame, script.nextSibling);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", place);
    else place();
  });
})();
