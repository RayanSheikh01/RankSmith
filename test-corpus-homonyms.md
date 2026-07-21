# Homonym test corpus — same words, different intent (set 2)

A corpus of 4 homonym pairs. Each pair shares a keyword but has the opposite
intent. Queries are phrased so **BM25** (word counting) ties or trips, while
**dense** (real `Xenova/all-MiniLM-L6-v2` embeddings) should disambiguate by
meaning. Companion set to `test-corpus-polysemy.md`.

## Playground paste (textarea, one doc per line — `Title:: body`)

```
Bat-Animal:: The bat left the cave at dusk and hunted moths using echolocation in total darkness.
Bat-Baseball:: He gripped the bat, swung hard, and drove the ball over the fence for a home run.
Spring-Coil:: The steel spring compressed under the load and stored energy inside the mattress frame.
Spring-Season:: In spring the orchard burst into blossom and warmer afternoons melted the last snow.
Crane-Bird:: The tall crane waded through the marsh on thin legs and speared a fish with its beak.
Crane-Machine:: The crane hoisted a steel beam forty stories up and swung it over the building site.
Seal-Animal:: The seal barked on the rocky shore, then slid off the ledge and dove after a fish.
Seal-Stamp:: The clerk pressed a wax seal onto the treaty to certify the document was official.
```

## Queries + expected winner (mark that chunk relevant = qrels)

| Query | Relevant doc | Why dense wins |
|-------|-------------|----------------|
| `a flying nocturnal creature that navigates by sound` | Bat-Animal | "bat" absent from query → BM25 near-blind. "nocturnal / flying / by sound" ~ dusk + echolocation → dense finds it. |
| `compressed metal part that stores mechanical energy` | Spring-Coil | "spring" is in **both** docs → BM25 ties. "compressed metal / energy" is the coil sense only → dense breaks the tie. |
| `heavy equipment lifting girders at a building site` | Crane-Machine | "crane" in **both** docs → BM25 ties. "equipment / lifting / girders" ~ machine intent → dense disambiguates. |
| `a marine mammal sunbathing near the ocean waves` | Seal-Animal | Zero lexical overlap ("seal" absent). "marine mammal / ocean" ~ shore + dove after a fish → pure semantics. |

## How to read the demo

Run **bm25 vs dense vs hybrid** on each query.

- BM25 ties on the middle two queries (shared keyword in both senses) and is
  near-blind on the first + last (little or no word overlap).
- Dense ranks the right chunk #1 on all four — the real embeddings working.
- **Important:** with the `hashing-bow-v1` baseline, dense *also* fails (word
  hashing, no semantics). Switch the playground's **Dense model** dropdown
  between `hashing-bow-v1` and `Xenova/all-MiniLM-L6-v2` to see the difference.

## API JSON (for `POST /corpora`)

```json
{
  "name": "homonym-demo",
  "documents": [
    { "path": "/bat-animal.txt",   "title": "Bat-Animal",     "raw": "The bat left the cave at dusk and hunted moths using echolocation in total darkness." },
    { "path": "/bat-baseball.txt",  "title": "Bat-Baseball",   "raw": "He gripped the bat, swung hard, and drove the ball over the fence for a home run." },
    { "path": "/spring-coil.txt",   "title": "Spring-Coil",    "raw": "The steel spring compressed under the load and stored energy inside the mattress frame." },
    { "path": "/spring-season.txt", "title": "Spring-Season",  "raw": "In spring the orchard burst into blossom and warmer afternoons melted the last snow." },
    { "path": "/crane-bird.txt",    "title": "Crane-Bird",     "raw": "The tall crane waded through the marsh on thin legs and speared a fish with its beak." },
    { "path": "/crane-machine.txt", "title": "Crane-Machine",  "raw": "The crane hoisted a steel beam forty stories up and swung it over the building site." },
    { "path": "/seal-animal.txt",   "title": "Seal-Animal",    "raw": "The seal barked on the rocky shore, then slid off the ledge and dove after a fish." },
    { "path": "/seal-stamp.txt",    "title": "Seal-Stamp",     "raw": "The clerk pressed a wax seal onto the treaty to certify the document was official." }
  ]
}
```
