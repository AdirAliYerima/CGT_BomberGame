# CGT Bomber Game

A simple browser-based strategy game for two players.

## Play locally

Open `index.html` in a browser, or run a local server:

```bash
python -m http.server 8081
```

Then open:

```text
http://localhost:8081
```

## How to play

- Choose how many bombers each player has before the game starts.
- Click one of your bombers to select it.
- Click a reachable destination within the move limit set by the slider.
- Bombers may move orthogonally or diagonally, but cannot pass through blocked or occupied cells.
- After moving, choose a valid adjacent cell to place a bomb.
- Each bomb has a fuse countdown based on the bomb delay setting.
- When the timer reaches zero, the bomb explodes in its center and in the four orthogonal neighboring cells.
- Empty blast cells become blocked; cells occupied by bombers are skipped and remain open.
- If a player has no legal moves left, they lose.

## Custom settings

The game includes a few adjustable options:

- Number of bombers per player
- Bomb delay (how many turns before a bomb explodes)
- Maximum move distance per bomber
- Board size

## Goal

Outmaneuver your opponent, block their movement, and force them into a position where they cannot make a valid move.

