"""Render the built datasheets site with Playwright and run the in-browser DuckDB query.
Usage: python3 scripts/verify.py (after npm run build). Output in verify-out/.
"""
import asyncio, subprocess, sys, time, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "verify-out"
OUT.mkdir(exist_ok=True)
PORT = 8772

async def main():
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    errors = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
            page = await ctx.new_page()
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
            await page.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")
            await page.screenshot(path=str(OUT / "shelf.png"), full_page=True)
            await page.goto(f"http://127.0.0.1:{PORT}/datasheets/ds-001/", wait_until="networkidle")
            await page.screenshot(path=str(OUT / "ds-001.png"), full_page=True)
            # run the explorer (needs jsDelivr for DuckDB-WASM)
            await page.click("#run")
            for _ in range(60):
                await page.wait_for_timeout(1000)
                st = await page.evaluate("document.getElementById('status').textContent")
                if st.startswith(("Error", "Ready")) or " row" in st:
                    break
            print("explorer status:", st)
            print("tables:", await page.evaluate("document.getElementById('tables').textContent"))
            print("result html (first 400):", (await page.evaluate("document.getElementById('result').innerText"))[:400].replace("\n", " | "))
            await page.screenshot(path=str(OUT / "ds-001-explorer.png"))
            await page.goto(f"http://127.0.0.1:{PORT}/datasheets/ds-003/", wait_until="networkidle")
            await page.screenshot(path=str(OUT / "ds-003.png"), full_page=True)
            await ctx.close()
            ctx = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
            page = await ctx.new_page()
            await page.goto(f"http://127.0.0.1:{PORT}/datasheets/ds-001/", wait_until="networkidle")
            ov = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            print("phone overflow px:", ov)
            await page.screenshot(path=str(OUT / "ds-001-phone.png"), full_page=True)
            await ctx.close()
            await browser.close()
    finally:
        server.terminate()
    print("errors:", errors if errors else "none")

asyncio.run(main())
