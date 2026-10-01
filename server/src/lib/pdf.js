const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger.util');

// Lazily launched shared browser instance to avoid per-request startup cost.
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const puppeteer = require('puppeteer');
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

/**
 * Render an HTML string to a PDF Buffer.
 * @param {string} html full document markup
 * @param {object} opts { format, landscape, margin }
 */
async function htmlToPdf(html, { format = 'A4', landscape = false, margin = {} } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.emulateMediaType('screen');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format,
      landscape,
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm', ...margin },
    });
    return buffer;
  } finally {
    await page.close();
  }
}

/** Render + persist to uploads/<category>/ and return the public URL. */
async function htmlToPdfFile(html, { category = 'pdfs', filename, ...opts } = {}) {
  const buffer = await htmlToPdf(html, opts);
  const dir = path.join(config.uploadAbsDir, category);
  await fs.mkdir(dir, { recursive: true });
  const name = filename || `${Date.now()}.pdf`;
  await fs.writeFile(path.join(dir, name), buffer);
  return { url: `/${config.uploadDir}/${category}/${name}`, buffer };
}

async function shutdown() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch (e) {
      logger.warn('puppeteer shutdown', e.message);
    }
    browserPromise = null;
  }
}

module.exports = { htmlToPdf, htmlToPdfFile, shutdown };
