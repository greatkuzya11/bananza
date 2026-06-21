const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const { repoRoot } = require('../support/paths');

const callsCss = fs.readFileSync(path.join(repoRoot, 'public', 'css', 'calls.css'), 'utf8');

function renderCallControlsHtml() {
  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            --bg-modal: #1e2c3a;
            --bg-input: #242f3d;
            --bg-sidebar: #17212b;
            --bg-hover: #202b36;
            --border-light: #2a3a4a;
            --text-primary: #f5f5f5;
            --accent: #5eb5f7;
            --danger: #e17076;
          }
          html,
          body {
            width: 100%;
            margin: 0;
            background: #0e1621;
          }
          ${callsCss}
        </style>
      </head>
      <body>
        <div class="call-surface">
          <div class="call-surface-card">
            <div class="call-controls">
              <button type="button" class="call-control-btn call-icon-toggle call-icon-mic"><span class="call-icon"></span></button>
              <button type="button" class="call-control-btn call-icon-toggle call-icon-camera"><span class="call-icon"></span></button>
              <button type="button" class="call-control-btn call-tool-btn call-icon-devices"><span class="call-icon"></span><span class="call-control-label">Devices</span></button>
              <button type="button" class="call-control-btn call-tool-btn call-icon-screen"><span class="call-icon"></span><span class="call-control-label">Share screen</span></button>
              <button type="button" class="call-control-btn call-tool-btn call-icon-ai-badge"><span class="call-icon"></span><span class="call-control-label">AI notes</span></button>
              <button type="button" class="call-control-btn call-tool-btn call-icon-link"><span class="call-icon"></span><span class="call-control-label">Copy link</span></button>
              <button type="button" class="call-control-btn call-tool-btn call-icon-phone-off danger"><span class="call-icon"></span><span class="call-control-label">Leave</span></button>
              <button type="button" class="call-control-btn call-tool-btn call-icon-end danger"><span class="call-icon"></span><span class="call-control-label">End</span></button>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

test('mobile call controls keep eight active buttons in one row', async ({ page }, testInfo) => {
  test.skip(!String(testInfo.project.name || '').includes('mobile'), 'mobile-only layout regression');

  for (const width of [320, 360, 414]) {
    await page.setViewportSize({ width, height: 720 });
    await page.setContent(renderCallControlsHtml());

    const result = await page.locator('.call-controls').evaluate((controls) => {
      const buttons = [...controls.querySelectorAll('.call-control-btn:not(.hidden)')];
      const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top));
      return {
        buttonCount: buttons.length,
        lineCount: new Set(tops).size,
        clientWidth: controls.clientWidth,
        scrollWidth: controls.scrollWidth,
      };
    });

    expect(result.buttonCount, `button count at ${width}px`).toBe(8);
    expect(result.lineCount, `line count at ${width}px`).toBe(1);
    expect(result.scrollWidth, `scroll width at ${width}px`).toBeLessThanOrEqual(result.clientWidth + 1);
  }
});
