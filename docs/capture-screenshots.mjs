import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = resolve(__dirname, 'screenshots');

const BASE_URL = 'https://balfour-signage.vercel.app';
const SHOP_PASSWORD = 'Balfour-signage-2026';
const ADMIN_PASSWORD = 'Onesign-Balfour-admin';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Mobile viewport — 375px width for phone mockup frames
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

// ─── Helper: screenshot with optional full-page ───
async function snap(name, fullPage = false) {
  const path = resolve(screenshotsDir, `${name}.png`);
  await page.screenshot({ path, fullPage });
  console.log(`  ✓ ${name}.png`);
}

// ─── Helper: wait for network idle ───
async function waitForIdle() {
  await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
}

// ═══════════════════════════════════════
// 1. LOGIN PAGE
// ═══════════════════════════════════════
console.log('\n1. Login page...');
await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle0', timeout: 30000 });
await waitForIdle();
await snap('01-login');

// ═══════════════════════════════════════
// 2. LOG IN → HOMEPAGE
// ═══════════════════════════════════════
console.log('2. Logging in...');
await page.type('input[type="password"]', SHOP_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await waitForIdle();

// Wait for splash screen to finish (if there is one)
await new Promise(r => setTimeout(r, 2500));
await waitForIdle();

console.log('   Homepage...');
await snap('02-homepage');
await snap('02-homepage-full', true);

// ═══════════════════════════════════════
// 3. CATEGORY PAGE — click first category
// ═══════════════════════════════════════
console.log('3. Category page...');
// Find and click the first category link
const categoryLink = await page.$('a[href*="/category/"]');
if (categoryLink) {
  await categoryLink.click();
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await waitForIdle();
  await snap('03-category');
  await snap('03-category-full', true);

  // ═══════════════════════════════════════
  // 4. PRODUCT DETAIL — click first product
  // ═══════════════════════════════════════
  console.log('4. Product detail...');
  const productLink = await page.$('a[href*="/product/"]');
  if (productLink) {
    await productLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await waitForIdle();
    await snap('04-product');
    await snap('04-product-full', true);

    // Add to basket
    console.log('   Adding to basket...');
    const addButton = await page.$('button');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text && text.includes('Add to')) {
        await btn.click();
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
    }
  }
} else {
  console.log('   No category links found, skipping...');
}

// ═══════════════════════════════════════
// 5. ADD ANOTHER PRODUCT (for a fuller basket)
// ═══════════════════════════════════════
console.log('5. Adding second product...');
await page.goto(BASE_URL + '/', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();

// Click second category if available
const categories = await page.$$('a[href*="/category/"]');
if (categories.length > 1) {
  await categories[1].click();
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await waitForIdle();

  const product2 = await page.$('a[href*="/product/"]');
  if (product2) {
    await product2.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await waitForIdle();

    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text && text.includes('Add to')) {
        await btn.click();
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
    }
  }
}

// ═══════════════════════════════════════
// 6. BASKET PAGE
// ═══════════════════════════════════════
console.log('6. Basket...');
await page.goto(BASE_URL + '/basket', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();
await snap('07-basket');
await snap('07-basket-full', true);

// ═══════════════════════════════════════
// 7. CHECKOUT PAGE
// ═══════════════════════════════════════
console.log('7. Checkout...');
await page.goto(BASE_URL + '/checkout', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();
await snap('08-checkout');
await snap('08-checkout-full', true);

// ═══════════════════════════════════════
// 8. CUSTOM SIGN BUILDER
// ═══════════════════════════════════════
console.log('8. Custom sign builder...');
await page.goto(BASE_URL + '/custom-sign', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();
await snap('09-custom-sign');
await snap('09-custom-sign-full', true);

// Fill in some fields for a preview screenshot
console.log('   Filling custom sign form...');
// Try to select sign type
const selects = await page.$$('select');
for (const sel of selects) {
  const options = await sel.$$('option');
  if (options.length > 1) {
    await options[1].evaluate(o => o.selected = true);
    await sel.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await new Promise(r => setTimeout(r, 300));
  }
}

// Try to type in text fields
const textInputs = await page.$$('input[type="text"], textarea');
for (const input of textInputs) {
  const placeholder = await input.evaluate(el => el.placeholder || el.name || '');
  if (placeholder.toLowerCase().includes('text') || placeholder.toLowerCase().includes('message') || placeholder.toLowerCase().includes('line')) {
    await input.click();
    await input.type('DANGER: Keep Out');
    break;
  }
}

await new Promise(r => setTimeout(r, 1000));
await snap('09-custom-sign-preview');
await snap('09-custom-sign-filled', true);

// ═══════════════════════════════════════
// 9. ORDERS PAGE
// ═══════════════════════════════════════
console.log('9. Orders page...');
await page.goto(BASE_URL + '/orders', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();
await snap('10-orders');
await snap('10-orders-full', true);

// ═══════════════════════════════════════
// 10. ADMIN — log in as admin
// ═══════════════════════════════════════
console.log('10. Admin login...');
await page.goto(BASE_URL + '/login?mode=admin', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();
await snap('11-admin-login');

console.log('    Logging in as admin...');
await page.type('input[type="password"]', ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await waitForIdle();
await new Promise(r => setTimeout(r, 2000));
await waitForIdle();

console.log('    Admin orders...');
await snap('12-admin-orders');
await snap('12-admin-orders-full', true);

// ═══════════════════════════════════════
// DONE
// ═══════════════════════════════════════
await browser.close();
console.log('\n✅ All screenshots captured!\n');
