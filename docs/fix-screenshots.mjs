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
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

async function snap(name, fullPage = false) {
  const path = resolve(screenshotsDir, `${name}.png`);
  await page.screenshot({ path, fullPage });
  console.log(`  ✓ ${name}.png`);
}

async function waitForIdle() {
  await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
}

// Dismiss splash screen by waiting and then hiding it via JS
async function dismissSplash() {
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => {
    // Hide any splash/overlay elements
    const splashes = document.querySelectorAll('[class*="splash"], [class*="Splash"], [class*="overlay"]');
    splashes.forEach(el => el.style.display = 'none');
    // Also try opacity-based splashes
    const fixedEls = document.querySelectorAll('div[style*="fixed"], div[style*="z-index"]');
    fixedEls.forEach(el => {
      if (el.style.position === 'fixed' && el.style.zIndex > 40) {
        el.style.display = 'none';
      }
    });
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
}

// ═══════════════════════════════════════
// LOGIN + WAIT FOR SPLASH TO CLEAR
// ═══════════════════════════════════════
console.log('Logging in...');
await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle0', timeout: 30000 });
await waitForIdle();
await page.type('input[type="password"]', SHOP_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await dismissSplash();
await waitForIdle();

// ═══════════════════════════════════════
// BETTER CATEGORY — pick one with more products
// ═══════════════════════════════════════
console.log('\n1. Finding a category with multiple products...');
// Go to Environmental Signs (36 products)
await page.goto(BASE_URL + '/category/environmental-signs', { waitUntil: 'networkidle0', timeout: 15000 });
await dismissSplash();
await waitForIdle();
await snap('03-category');

// ═══════════════════════════════════════
// PRODUCT DETAIL — pick a product with an image
// ═══════════════════════════════════════
console.log('2. Product detail...');
const productLink = await page.$('a[href*="/product/"]');
if (productLink) {
  await productLink.click();
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await dismissSplash();
  await waitForIdle();
  await snap('04-product');
  await snap('04-product-full', true);

  // Add to basket
  console.log('   Adding to basket...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text && text.includes('Add to')) {
      await btn.click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('   Added first item');
      break;
    }
  }
}

// Add a second product
console.log('3. Adding second product...');
await page.goto(BASE_URL + '/category/site-entrance-signs', { waitUntil: 'networkidle0', timeout: 15000 });
await dismissSplash();
await waitForIdle();

const product2 = await page.$('a[href*="/product/"]');
if (product2) {
  await product2.click();
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await dismissSplash();
  await waitForIdle();

  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text && text.includes('Add to')) {
      await btn.click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('   Added second item');
      break;
    }
  }
}

// ═══════════════════════════════════════
// CHECKOUT — navigate WITHOUT full page reload to keep basket
// ═══════════════════════════════════════
console.log('4. Checkout page...');
// Use client-side navigation by clicking checkout link or navigating
await page.evaluate(() => {
  window.location.href = '/checkout';
});
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await dismissSplash();
await waitForIdle();
await snap('08-checkout');
await snap('08-checkout-full', true);

// Also try basket
console.log('5. Basket page...');
await page.evaluate(() => { window.location.href = '/basket'; });
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await dismissSplash();
await waitForIdle();
await snap('07-basket');
await snap('07-basket-full', true);

// ═══════════════════════════════════════
// ORDERS — retake without splash
// ═══════════════════════════════════════
console.log('6. Orders page (clean)...');
await page.evaluate(() => { window.location.href = '/orders'; });
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await dismissSplash();
await waitForIdle();
// Extra wait and force-hide splash
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => {
  document.querySelectorAll('div').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && parseInt(style.zIndex) > 40) {
      el.remove();
    }
  });
}).catch(() => {});
await new Promise(r => setTimeout(r, 300));
await snap('10-orders');
await snap('10-orders-full', true);

// ═══════════════════════════════════════
// CUSTOM SIGN — retake the initial view without splash
// ═══════════════════════════════════════
console.log('7. Custom sign (clean)...');
await page.evaluate(() => { window.location.href = '/custom-sign'; });
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await dismissSplash();
await waitForIdle();
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => {
  document.querySelectorAll('div').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && parseInt(style.zIndex) > 40) {
      el.remove();
    }
  });
}).catch(() => {});
await new Promise(r => setTimeout(r, 300));
await snap('09-custom-sign');

// ═══════════════════════════════════════
// ADMIN — retake without splash
// ═══════════════════════════════════════
console.log('8. Admin (clean)...');
await page.goto(BASE_URL + '/login?mode=admin', { waitUntil: 'networkidle0', timeout: 15000 });
await waitForIdle();
await page.type('input[type="password"]', ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
await dismissSplash();
await waitForIdle();
await new Promise(r => setTimeout(r, 3000));
await page.evaluate(() => {
  document.querySelectorAll('div').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && parseInt(style.zIndex) > 40) {
      el.remove();
    }
  });
}).catch(() => {});
await new Promise(r => setTimeout(r, 300));
await snap('12-admin-orders');
await snap('12-admin-orders-full', true);

await browser.close();
console.log('\n✅ Fixed screenshots captured!\n');
