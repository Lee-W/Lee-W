const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-light', use: { viewport: { width: 1280, height: 900 }, colorScheme: 'light' } },
    { name: 'desktop-dark', use: { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' } },
    { name: 'mobile-light', use: { viewport: { width: 375, height: 812 }, colorScheme: 'light' } },
    { name: 'mobile-dark', use: { viewport: { width: 375, height: 812 }, colorScheme: 'dark' } },
  ],
  webServer: {
    // Same server as `python3 -m http.server`, but with a deeper listen backlog:
    // the default of 5 overflows when parallel workers open connections in a burst,
    // and the overflowing connection is reset (net::ERR_CONNECTION_RESET).
    command: `python3 -c "import http.server as h; h.ThreadingHTTPServer.request_queue_size = 128; h.test(HandlerClass=h.SimpleHTTPRequestHandler, ServerClass=h.ThreadingHTTPServer, port=4173, bind='127.0.0.1')"`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
