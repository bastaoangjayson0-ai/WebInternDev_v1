# WebInternDev v1.5.7 — Fast Share Chooser + Host-Only Pin

- Only the Host can start/stop screen sharing.
- Only the Host sees and can use Pin/Unpin Screen.
- User and Admin participants cannot lock/pin the shared screen.
- Screen sharing now uses a minimal native capture request to reduce work before the browser's monitor/window/tab chooser appears.
- The browser/OS controls the actual native chooser launch time; the web app cannot force that UI to open faster.
- Native source selection remains available for entire screen, window, and browser tab where supported.
- The received shared screen continues to preserve its source aspect ratio and fit without cropping.
- Existing zoom controls remain available to viewers.
