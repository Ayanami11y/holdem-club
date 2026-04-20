# Holdem Club

Holdem Club is a lightweight realtime multiplayer Texas Hold'em web app built for quick private games with friends. One player hosts a table, shares a short room code, and everyone joins from their own browser.

## What It Includes

- Realtime multiplayer table flow over `socket.io`
- Host and join room flow with a simple room code
- Core Texas Hold'em betting rounds, blinds, community cards, and hand resolution
- Browser-based UI served by an Express backend with static frontend assets
- Unit tests covering core game logic

## Tech Stack

- Node.js
- Express
- socket.io
- Static HTML, CSS, and JavaScript
- Jest for unit tests

## Local Development

1. Install dependencies with `npm install`.
2. Start the app in development mode with `npm run dev`.
3. Open `http://localhost:3000`.

For a production-style run, use `npm start`.

## Tests

Run the game logic test suite with:

```bash
npm test
```

## Product Notes

- This repository is being adapted into a standalone MVP called Holdem Club.
- Screenshots can be added later.
- TODO: replace the inherited favicon and social preview assets with Holdem Club-specific artwork.

## Attribution

This project is an adaptation of the MIT-licensed open-source multiplayer Texas Hold'em base originally published at `ptwu/distributed-texasholdem`. The original `LICENSE` is retained in this repository as required by the upstream license.
