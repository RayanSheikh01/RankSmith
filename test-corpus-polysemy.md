# Polysemy test corpus — same words, different intent

A corpus of 4 polysemy pairs. Each pair shares a keyword but has the opposite
intent. Queries are phrased so **BM25** (word counting) ties or trips, while
**dense** (real `Xenova/all-MiniLM-L6-v2` embeddings) should disambiguate by
meaning. Use it to see real embeddings beat the lexical baseline.

## Playground paste (textarea, one doc per line — `Title:: body`)

```
Bank-Finance:: I opened a bank account and deposited my paycheck to save for a mortgage down payment.
Bank-River:: We fished from the muddy bank of the river as the current carried fallen leaves downstream.
Python-Code:: In Python I imported the module and wrote a function to parse the JSON config file.
Python-Snake:: The python coiled around the branch and swallowed the rodent whole in the humid jungle.
Mouse-Computer:: I clicked the mouse, dragged the cursor across two monitors, and the USB receiver blinked.
Mouse-Animal:: The tiny mouse scurried across the barn floor and nibbled a crumb of cheese by the wall.
Apple-Company:: Apple unveiled a new iPhone and MacBook with a faster chip at its autumn keynote.
Apple-Fruit:: She sliced a crisp apple into the salad and baked the rest into a warm cinnamon pie.
```

## Queries + expected winner (mark that chunk relevant = qrels)

| Query | Relevant doc | Why dense wins |
|-------|-------------|----------------|
| `the newest smartphone released by apple` | Apple-Company | "apple" is in **both** fruit + company docs → BM25 ties. "smartphone" ~ "iPhone" is semantic only → dense breaks the tie. |
| `writing a script to read a data file` | Python-Code | Query has **no** shared keyword ("python" absent) → BM25 near-blind. "script / read / file" ~ code intent → dense finds it. |
| `a serpent constricting prey in the rainforest` | Python-Snake | Zero lexical overlap ("python / snake" absent). "serpent / prey / rainforest" ~ "python / rodent / jungle" → pure semantics. |
| `my wireless cursor stopped moving on screen` | Mouse-Computer | "mouse" absent from the query but present in both mouse docs otherwise. "cursor / wireless / screen" → dense picks the computer sense. |

## How to read the demo

Run **bm25 vs dense vs hybrid** on each query.

- BM25 ranks the wrong-intent doc high (or ties) on the first query; on the last
  two it basically fails (little or no word overlap).
- Dense still ranks the right chunk #1 on all four. That gap is the real
  embeddings working.
- **Important:** with the `hashing-bow-v1` baseline, dense *also* fails (it is
  just word-hashing, no semantics). Switch the playground's **Dense model**
  dropdown between `hashing-bow-v1` and `Xenova/all-MiniLM-L6-v2` to see the
  difference the feature was built for.

## API JSON (for `POST /corpora`)

```json
{
  "name": "polysemy-demo",
  "documents": [
    { "path": "/bank-fin.txt",  "title": "Bank-Finance",   "raw": "I opened a bank account and deposited my paycheck to save for a mortgage down payment." },
    { "path": "/bank-riv.txt",  "title": "Bank-River",     "raw": "We fished from the muddy bank of the river as the current carried fallen leaves downstream." },
    { "path": "/py-code.txt",   "title": "Python-Code",    "raw": "In Python I imported the module and wrote a function to parse the JSON config file." },
    { "path": "/py-snake.txt",  "title": "Python-Snake",   "raw": "The python coiled around the branch and swallowed the rodent whole in the humid jungle." },
    { "path": "/mouse-pc.txt",  "title": "Mouse-Computer", "raw": "I clicked the mouse, dragged the cursor across two monitors, and the USB receiver blinked." },
    { "path": "/mouse-an.txt",  "title": "Mouse-Animal",   "raw": "The tiny mouse scurried across the barn floor and nibbled a crumb of cheese by the wall." },
    { "path": "/apple-co.txt",  "title": "Apple-Company",  "raw": "Apple unveiled a new iPhone and MacBook with a faster chip at its autumn keynote." },
    { "path": "/apple-fr.txt",  "title": "Apple-Fruit",    "raw": "She sliced a crisp apple into the salad and baked the rest into a warm cinnamon pie." }
  ]
}
```
