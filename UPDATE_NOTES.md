# Maniaxe Typing — Update 2

This update is based on the latest Maniaxe Typing build supplied for the project. The existing Maniaxe Typing visual theme and layout are preserved.

## Changes in this build

### Trakey App page
- Uptodown is now the primary and visually prominent download destination.
- Uses Uptodown's supplied official media-kit badge and URL: https://trakey.en.uptodown.com/android
- GitHub remains available as a small direct-APK fallback rather than a second large download card.
- App share menu keeps three destinations, with Uptodown listed first: Uptodown, Maniaxe App page, GitHub APK.
- Removed the duplicate GitHub download button.
- Removed the internal download-count display so it is not confused with Uptodown's public download count.

### Public leaderboard
- Added a compact leaderboard card immediately after the typing-test result actions.
- The card shows the current #1 public typist and links to the full leaderboard in the site footer.
- Added a public leaderboard section to the Test page footer.
- Signed-in users can submit their best standard typing-test score.
- Custom tests are not submitted to the public leaderboard because their scoring criteria are user-defined.

### Shot sharing
- Result actions now keep only the useful controls: Next test, Download image, Share.
- Share menu provides:
  - Share image + website link
  - Share image only
- Mobile Web Share uses the actual generated PNG file.
- Link sharing places the Maniaxe URL in the share text together with the image.
- Image-only sharing has a clipboard-image fallback where supported.
- Unsupported browsers fall back to downloading the image instead of showing the old misleading message.

### Typing engine stability
- Mobile `beforeinput` handling was added for reliable virtual-keyboard spaces.
- Escape restart is handled once globally to prevent duplicate restarts.
- Backtracking keeps input accounting aligned with the current value.

## Firebase
Publish the included `firestore.rules` if it is not already published. The `typing_leaderboard` collection is public-read and signed-in-user-write for each user's own document.


Final lock update — GitHub download metric
- Restored the Downloads metric beside Rating on the Trakey app page.
- The displayed Downloads value is read from the GitHub Release asset `trakey.apk` (`download_count`).
- Firestore/site-click download events are no longer used for the displayed GitHub download number.
- Uptodown remains the primary download card and GitHub remains the direct APK fallback.
- No theme or unrelated feature changes were made in this final package.
