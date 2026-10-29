# Video Speed Controller extension

A small Chromium extension (Manifest V3) that adds playback speed and skip controls to any HTML5 video. It also works on videos inside embedded iframe players. It's a lightweight clone of the Video Speed Controller extension, made for browsers like Helium that can't install from the Chrome Web Store.

## Install

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder.
5. Reload any tab that already has a video open.

## Usage

A speed label appears in the top-left corner of every video. Hover over it to show the buttons.

| Button | Key | Action |
|---|---|---|
| `−` / `+` | S / D | Slower / faster (0.1x steps, 0.07x to 16x) |
| | R | Reset to 1x (press again to jump to 1.8x) |
| `«` / `»` | Z / X | Back / forward 10 seconds |
| `×` | V | Hide / show the controller |

Click the video once so it has focus before using the keys. Keys are ignored while you're typing in a text field.

## Behavior

- The speed is saved in `chrome.storage.local` and applied to every video, across sites.
- Some players reset the speed when the source, quality or episode changes. The extension sets it back on `loadeddata`, `play` and `seeked`.
- The controller is rendered in a closed shadow root, so page CSS can't change how it looks. Clicks on it don't reach the player underneath.
- The content script runs in all frames (`all_frames`, `match_about_blank`), so it reaches players embedded in iframes.

## Files

- `manifest.json`: extension manifest (MV3, `storage` permission only)
- `content.js`: the controller, shortcuts and video detection

## Known limits

- If a player captures keyboard events before the page sees them, the shortcuts won't fire. Use the hover buttons instead.
- Players that draw video to a `<canvas>` instead of a `<video>` element aren't supported.

## License

MIT. See [LICENSE](LICENSE).
