# Game Art Review — GitHub Pages export

Complete published version 14, source commit 648b9799ba65922dd852c360eef47c836053c7ad, exported 21 September 2026.

## Publish
1. Create a GitHub repository named `game-art-review`.
2. Extract this ZIP and upload the **contents** of the `game-art-review` folder to the repository root. `index.html` must be at the root, not inside another folder.
3. In Settings → Pages choose **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
4. Open `https://YOUR-USERNAME.github.io/game-art-review/` after deployment finishes.

No build or npm installation is needed. The HTML, CSS and JavaScript are the complete editable website source. All local artwork, fonts and seven PDFs are included. The latest downloadable presentation includes the updated desktop and mobile Crash 2 scenes.

The current site contains no video files or video embeds. Its motion previews are implemented in JavaScript/CSS with image assets; those are all included. Existing Figma and Notion links still open external services.

Paths and route detection are configured for `/game-art-review/`. Keep this repository name. Existing interactive demos, query-string states, local preferences and download links are preserved. Sites access controls are hosting-specific and are not part of this static export.

## Local preview
From the parent of this folder run `python3 -m http.server 8000`, then visit `http://localhost:8000/game-art-review/`.

`source-notes/` preserves the original project documentation and supporting scripts. It is not required to run the website.
