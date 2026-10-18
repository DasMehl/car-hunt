# The Claude routine

The site only stores and shows cars. Finding new listings, rating them, reading seller replies and, if you allow it, writing to sellers is done by a Claude Code scheduled task on your computer, using your browser where you are logged in to mobile.de and your email.

## Install

1. Install Claude Code and the desktop app.
2. Save your site password and sync key in two files only you can read:

   ```bash
   mkdir -p ~/.car-hunt && chmod 700 ~/.car-hunt
   printf '%s' 'YOUR-PASSWORD' > ~/.car-hunt/password
   printf '%s' 'YOUR-SYNC-KEY' > ~/.car-hunt/sync-key
   chmod 600 ~/.car-hunt/*
   ```

3. Copy `routine/SKILL.md` to `~/.claude/scheduled-tasks/car-hunt-listing-check/SKILL.md` and replace `https://YOUR-SITE.up.railway.app` with your site's address.
4. In the Claude desktop app, create a scheduled task from it, for example every 5 hours.

Seller messages are only sent when "Contacting sellers" is ticked in the site's Settings.
