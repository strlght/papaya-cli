# papaya-cli

Not affiliated with Papaya Global Ltd; use at your own risk and in line with your provider's terms.

Unofficial CLI for Papaya Personal: log in through Auth0 and list or download your payslips from the terminal.

Requires Node >= 24 and Google Chrome or Chromium for the assisted login. The only runtime dependency is the OS keychain binding for token storage.

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

Tokens are stored in the OS keychain under the `papaya-cli` service, and refresh automatically on later commands.

If no keychain is reachable (e.g. headless Linux without Secret Service), they fall back to `~/.papaya/session.json` (mode 0600) with a warning.

## Development

```sh
npm run typecheck
npm run build
```
