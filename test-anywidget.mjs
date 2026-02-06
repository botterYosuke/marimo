import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const logs = [];
const errors = [];

// Capture console messages
page.on('console', msg => {
  const text = msg.text();
  const type = msg.type();
  logs.push('[' + type + '] ' + text);

  // Filter for anywidget and error related messages
  if (text.includes('AnyWidget') || text.includes('disposed') ||
      text.includes('Error') || text.includes('error') ||
      text.includes('setData') || text.includes('emit')) {
    console.log('[' + type + '] ' + text);
  }
});

// Capture page errors
page.on('pageerror', err => {
  errors.push(err.message);
  console.log('[PAGE ERROR] ' + err.message);
});

console.log('Opening page...');
await page.goto('http://localhost:3000/?file=fintech1.py', { waitUntil: 'networkidle' });

console.log('Waiting for chart to load and update...');
await page.waitForTimeout(10000); // Wait 10 seconds for updates

console.log('\n=== Summary ===');
console.log('Total logs: ' + logs.length);
console.log('Total errors: ' + errors.length);

// Show any "Object is disposed" errors
const disposedErrors = logs.filter(l => l.includes('disposed') || l.includes('Uncaught'));
if (disposedErrors.length > 0) {
  console.log('\n=== Disposed/Uncaught Errors ===');
  disposedErrors.forEach(e => console.log(e));
} else {
  console.log('\n✅ No "Object is disposed" errors found!');
}

// Show AnyWidget logs
const anywidgetLogs = logs.filter(l => l.includes('AnyWidget'));
if (anywidgetLogs.length > 0) {
  console.log('\n=== AnyWidget Logs ===');
  anywidgetLogs.slice(0, 20).forEach(e => console.log(e));
  if (anywidgetLogs.length > 20) {
    console.log('... and ' + (anywidgetLogs.length - 20) + ' more');
  }
}

await browser.close();
