# papaya-cli

Not affiliated with Papaya Global Ltd; use at your own risk and in line with your provider's terms.

Unofficial CLI for Papaya Personal: log in through Auth0 and list or download your payslips from the terminal.

Requires Node >= 24 (zero runtime dependencies) and Google Chrome or Chromium for the assisted login.

## Install

```sh
npm install -g papaya-cli
```

## Commands

```txt
papaya-cli login [--fresh]        open Chrome, capture the app's redirect callback via DevTools
papaya-cli login --paste [url]    print the authorize URL, paste the redirect URL back
papaya-cli payslips               list payslip files with links
papaya-cli download [--out DIR]   save payslips (default dir: ./payslips)
```

`download` takes `--payment ID` and `--period YYYY-MM` filters.

Tokens are stored in `~/.papaya/session.json` next to a dedicated Chrome profile, and refresh automatically on later commands.

## Development

```sh
npm run typecheck
npm run build
```

