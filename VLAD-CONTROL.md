# Vladinator Local Control

Run commands from the project directory. Both systems are off by default.

```powershell
npm run vlad -- status
npm run vlad -- on backend
npm run vlad -- on x
npm run vlad -- on all
npm run vlad -- off x
npm run vlad -- off all
npm run vlad -- stop
```

`on backend` runs wallet indexing, the website narrator, voice, rooms, and shill responses. `on x` also enables X posting, mention handling, and research. X requires the wallet backend, so enabling X starts both.

Inject a private operator message into the website narrator:

```powershell
npm run vlad -- inject web "what are we watching right now?"
```

Generate an X reply draft or an original post draft:

```powershell
npm run vlad -- inject x "are you actually trading?"
npm run vlad -- inject x "post about the wallet" --mode post
```

Nothing is posted by those commands. Posting requires the explicit `--post` flag while X is on:

```powershell
npm run vlad -- inject x "post about the wallet" --mode post --post
```

Clear persisted narrator, room, shill, X feed, and X-mind data:

```powershell
npm run vlad -- reset local
npm run vlad -- reset cloud
npm run vlad -- reset all
```

The managed process ID and logs live under `.runtime/`. Project assets, videos, and meme folders are never removed by reset commands.
