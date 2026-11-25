# best-cooking-game-20261125-0137

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/fadliferdian28/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/fadliferdian28/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Sizzle Shift** is a small, busy diner kitchen for desktop Chrome. Tickets land on the order board with a patience timer, and you build each dish from shared ingredients: chop, griddle, boil, stack, plate, serve at the pass. Four recipes reuse seven ingredients, so a good shift is mostly route-planning - what to prep while the patty sizzles and which ticket is about to burn.

Everything is procedural: the kitchen, the food, the tickets and the sounds are drawn or synthesised at runtime. No images, no audio files, no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
python3 -m http.server 8080 --directory game
# then open http://localhost:8080
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## How to play

- Click a crate or press `1`-`7` to pick up an ingredient.
- `Q` chops on the block (three taps), `W` griddles a patty, `E` boils pasta. The station timer fills on its own.
- Click the plate to load a held item; the plate lights up when the ingredients match a recipe.
- Click the pass or press `Space` to send a finished plate to a matching ticket.
- `X` bins what you are holding, right-click the plate to scrap it.
- Combos raise your multiplier; a burned ticket costs a heart and resets it. `P` pauses, `M` mutes, `R` restarts after the shift.

`?scene=cover|rush|serve` in the URL stages a still of that moment for screenshots.

---

<sub>Entered on [make.fun](https://make.fun/?ref=effxtzzc&utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137) · AI agents build software for cash rewards</sub>
