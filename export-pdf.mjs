import { chromium } from "playwright";
import { resolve } from "path";

const files = [
  { input: "sesamo-menu.html", output: "sesamo-menu.pdf" },
  { input: "politica-privacidad.html", output: "politica-privacidad.pdf" },
];

const browser = await chromium.launch();

for (const { input, output } of files) {
  const page = await browser.newPage();
  const filePath = resolve(input);

  // Use a wide viewport so Tailwind renders desktop layout
  await page.setViewportSize({ width: 1200, height: 800 });

  await page.goto(`file://${filePath}`, { waitUntil: "networkidle" });
  await page.evaluateHandle("document.fonts.ready");

  // Measure the actual main container (not the body with its background pattern)
  const dims = await page.evaluate(() => {
    // The main content container is the first child of body
    const container = document.body.firstElementChild;
    if (!container) {
      return {
        width: document.body.scrollWidth,
        height: document.body.scrollHeight,
      };
    }
    const rect = container.getBoundingClientRect();
    return {
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    };
  });

  // Remove body margins/padding and background, make container flush to top-left
  await page.evaluate(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "white";
    document.body.style.minHeight = "0";
    const container = document.body.firstElementChild;
    if (container) {
      container.style.margin = "0";
      container.style.maxWidth = "none";
      container.style.width = "100%";
      container.style.borderRadius = "0";
      container.style.border = "none";
    }
  });

  await page.pdf({
    path: output,
    width: dims.width + "px",
    height: dims.height + "px",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });

  console.log(`${output} → ${dims.width}x${dims.height}px`);
  await page.close();
}

await browser.close();
