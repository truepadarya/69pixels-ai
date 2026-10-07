# Scroll animation regression checks

Run the Astro development server in background mode:

```powershell
npm.cmd run dev -- --background
```

Start a separate headless Edge session for the test (the regular browser session is not used):

```powershell
$motionProfile = Join-Path $env:TEMP 'land69-motion-test-browser'
Start-Process -FilePath 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' -WindowStyle Hidden -ArgumentList '--headless=new','--disable-gpu','--remote-debugging-port=9223',"--user-data-dir=$motionProfile",'http://localhost:4321'
npm.cmd run test:motion
```

The test uses Node's built-in DevTools client, with no extra dependencies. Set `MOTION_TEST_URL` if the dev server uses a different address. Port 9223 must belong to the dedicated test browser.

Checks cover 1440, 768 and 390 px viewports, case order and opacity, scrolling backwards, reload at the first case, the creators scene's start, square expansion, repeated ScrollTrigger refreshes, visible pricing, live viewport resizing without duplicate triggers, and reduced motion. Screenshots are saved in `audit/`.

The square's target scale must be calculated from its layout dimensions (`offsetWidth` and `offsetHeight`). Its transformed bounding rectangle changes during playback and makes repeated refreshes shrink the expansion.

Case selection derives from current group positions rather than entry callback history. Scene initialization waits for fonts and cleans up before Astro page swaps; layout refreshes are batched into one animation frame after initialization or media size changes.
