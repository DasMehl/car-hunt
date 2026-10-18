# Car Hunt

A private tracker for buying a used car. You describe what you are looking for, and the site keeps every candidate in one place: photos, specs, a score based on your own priorities, seller replies, status, notes and the cars worth visiting.

Each person runs their own copy. On first launch a setup wizard asks for your criteria:

- fuel types, gearbox, body types, seats, makes and models, year range, mileage and power
- maximum price, a negotiable margin and optional financing limits
- your home address and the longest drive you accept
- must-have and nice-to-have equipment
- engines and gearboxes with known problems that you want to avoid
- how much mileage, documents, gearbox, seller, price, distance and equipment count in the score

Cars come in two ways: an "Add a car" form on the site, and an optional Claude Code routine that searches mobile.de with your criteria, rates new listings, reads seller replies and, if you allow it, sends a short first message to sellers in your name.

## Run your own copy

1. Fork this repository on GitHub.
2. Create a Railway project from your fork and add a volume mounted at `/data`.
3. Set these variables on the service: `DATA_DIR=/data`, `SITE_PASSWORD` (anyone with it can see and edit your hunt), `SYNC_KEY` (a long random string; only the routine needs it).
4. Deploy, open the site, enter the password with any user name and complete the setup wizard.
5. Add cars with "Add a car", or install the Claude routine: see [routine/README.md](routine/README.md).

Run locally with `npm install && DATA_DIR=./data SYNC_KEY=dev npm start` and open http://localhost:3000.

## Tests

`npm test`
