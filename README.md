# gcm - Git Commit Message Generator

A command-line tool that writes [Conventional Commits](https://www.conventionalcommits.org/) messages from your git changes using the AI provider you choose. If the AI call fails, it falls back to a plain summary.

## Quick Start

Requires Node.js 20 or later and git.

```bash
npm install -g @solomonmarvel97/gitcommitmessage
```

```bash
gcm config set
```

```bash
gcm --commit
```

To try it without an API key, run `gcm --simple`.

## Features

- Six providers: Gemini, Anthropic, OpenAI, xAI (Grok), Groq and OpenRouter
- Commit, edit, regenerate or quit from one menu
- One saved API key and model per provider
- Cached messages for unchanged diffs
- Retries for rate limits, server errors and network failures
- Only the commit message goes to stdout, so it pipes cleanly

## Installation

From npm (installs `gcm` and `gitcommitmessage`):

```bash
npm install -g @solomonmarvel97/gitcommitmessage
```

Or run it without installing:

```bash
npx @solomonmarvel97/gitcommitmessage
```

From a checkout of this repository:

```bash
make install
```

This builds the project and links `gcm` and `gitcommitmessage` into `~/.bun/bin` if it exists, otherwise `~/.local/bin`. Use `make install BINDIR=/some/dir` to choose another folder, and make sure that folder is on your `PATH`. The links point at this checkout, so keep it in place.

### Upgrading from 0.3.x

- Node.js 20 or later is now required
- Your saved key is kept; the config file moves to the new format the next time you run `gcm config set`
- A saved model that the provider has retired is replaced by a current default, with a warning
- `--commit` now stages changes only when you confirm

## Setup

Configuration is required before using AI-powered commit messages.

| Provider | id | API key variable | Get a key |
|---|---|---|---|
| Google Gemini | `gemini` (default) | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | [Claude Console](https://platform.claude.com/settings/keys) |
| OpenAI | `openai` | `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| xAI (Grok) | `xai` | `XAI_API_KEY` | [xAI Console](https://console.x.ai) |
| Groq | `groq` | `GROQ_API_KEY` | [Groq Console](https://console.groq.com/keys) |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | [OpenRouter Keys](https://openrouter.ai/settings/keys) |

Run `gcm config set`, pick a provider, paste its key (input is hidden) and choose a model. Each provider keeps its own key and model in `~/.gcm/config.json`; the last one you set is active. A config file from 0.3.x still works.

You can also use environment variables:

```bash
export GCM_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="your-api-key-here"
```

Models can be set with `--model`, the provider's `<NAME>_MODEL` variable (for example `ANTHROPIC_MODEL`), `GCM_MODEL`, or `gcm config set`. If you pick none, gcm uses the provider's default and tries the next one if it is unavailable. A model passed with `--model` is never swapped.

| Provider | Default | Fallbacks |
|---|---|---|
| `gemini` | `gemini-3.8-flash` | `gemini-3.5-flash-lite` |
| `anthropic` | `claude-opus-5-5` | `claude-haiku-5-5`, `claude-sonnet-5-5` |
| `openai` | `gpt-5.6-luna` | `gpt-6.2-sol` |
| `xai` | `grok-4.3` | `grok-4.20-0309-non-reasoning`, `grok-4.7` |
| `groq` | `openai/gpt-oss-20b` | `openai/gpt-oss-120b` |
| `openrouter` | `openai/gpt-4o-mini` | `openai/gpt-oss-20b`, `anthropic/claude-haiku-5.5` |

For Anthropic, `claude-haiku-5-5` is much cheaper than the default. Requests to Claude Opus and Sonnet allow a server-side fallback model if the request is refused.

Your diff is sent to the provider you choose. Use `--simple` for code that must not leave your machine.

## Using Any Model

You are not limited to the models listed above. gcm sends whatever model name you give to the provider, so use the id exactly as the provider writes it.

**Save it as your default:** run `gcm config set`, pick the provider, and type the model id at the `Model` prompt instead of a number.

**For one run:**

```bash
gcm --provider openrouter --model vendor/model-name
```

```bash
gcm --provider groq --model openai/gpt-oss-120b
```

**With environment variables:**

```bash
export GCM_PROVIDER="openrouter"
export OPENROUTER_API_KEY="your-api-key-here"
export OPENROUTER_MODEL="vendor/model-name"
```

For Groq, use `groq`, `GROQ_API_KEY` and `GROQ_MODEL`.

When several are set, the order is: `--model`, then `<NAME>_MODEL`, then `GCM_MODEL`, then the saved model, then the provider's default.

A model given with `--model` is never swapped. If a model from a variable or your saved config is unavailable, gcm warns you and uses one of the provider's defaults.

Find model ids at [OpenRouter models](https://openrouter.ai/models) and [Groq models](https://console.groq.com/docs/models).

## Configuration Commands

```bash
gcm config show      # List configured providers (keys are masked)
gcm config set       # Add or update a provider
gcm config clear     # Remove all stored configuration
```

## Usage

```bash
gcm                    # Generate commit message for all changes
gcm --staged           # Generate message for staged changes only
gcm --commit           # Show the message, then commit, edit, regenerate or quit
gcm -p openai          # Use another provider for this run
gcm -m claude-haiku-5-5 -p anthropic
gcm | pbcopy           # Only the message goes to stdout
gcm --simple           # Use simple format without AI
gcm --verbose          # Show verbose output
gcm --help             # Show help message
```

### Options

- `-s, --staged` - Only consider staged changes
- `-c, --commit` - Show the message, then press Enter to commit, `e` to edit, `r` to regenerate or `q` to quit. Changes are staged when you commit (with `--staged`, only what is already staged is committed)
- `-p, --provider <id>` - Provider for this run
- `-m, --model <name>` - Model for this run
- `--simple, --no-ai` - Use simple message format (no AI)
- `-v, --verbose` - Show verbose output
- `-h, --help` - Show help message

### Examples

Generate message for all changes:
```bash
$ gcm
feat: add user authentication and login UI

- Added login form component
- Implemented JWT token handling
- Updated user model schema
```

Generate message for staged changes only:
```bash
$ gcm --staged
fix: resolve memory leak in data processing

- Fixed unclosed file handles
- Added proper cleanup in error paths
```

Commit with the action menu:
```
$ gcm --commit
 ◆ gcm  anthropic · claude-opus-5-5

 ✓ 3 files  +42 −7  on dev

 │ feat: add Anthropic and OpenAI support

 [enter] commit   [e] edit   [r] regenerate   [q] quit
```

Colors turn off for pipes and when `NO_COLOR` is set.

Simple mode (no AI):
```bash
$ gcm --simple
2 added, 3 modified — on feature/auth, ahead 1, behind 0

added: src/auth.js, src/login.js
modified: src/app.js, src/utils.js, README.md
```

## How It Works

1. Parses `git status --porcelain=v2 -b` to detect file changes, branch info, and status
2. Collects git diffs for changed files (up to 20 files, ~50KB limit)
3. Checks the cache for the same provider, model and diff
4. Sends the context to the selected provider for a Conventional Commits message
5. Retries rate limits, server errors and network failures with exponential backoff
6. Falls back to the simple format if AI fails

## Advanced Features

### Caching

Commit messages are cached based on diff content. Similar changes will use cached messages, reducing API calls and improving speed.

### Prompt Template

The prompt sent to the provider is built from a template in [`lib/templates.ts`](lib/templates.ts). There is currently no command-line option to select a custom template.

### Progress

A spinner is shown while the message is generated. Status output goes to stderr and is not animated when piped.

## Development

Run `make` to list tasks. The main ones are `make install`, `make check` (type check, lint, tests), `make deps`, `make pack` and `make tag`.

### Releasing

1. Update the version: `npm version <version> --no-git-tag-version`
2. Commit and merge to `main`
3. Publish with `npm publish` (npm asks for two-factor approval)

Pushing a `v*` tag runs the release workflow instead, which needs an `NPM_TOKEN` repository secret.

### Building

The project is written in TypeScript and compiles to JavaScript:

```bash
npm run build        # Compile TypeScript to JavaScript
npm run type-check   # Type check without compiling
```

### Testing

```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Project Structure

```
gcm/
├── bin/
│   └── gcm.ts          # TypeScript source
├── lib/                # Modular library (TypeScript source)
│   ├── constants.ts    # Application constants
│   ├── errors.ts       # Custom error classes
│   ├── logger.ts       # Structured logging
│   ├── utils.ts        # Utility functions
│   ├── config.ts       # Configuration management
│   ├── git.ts          # Git operations
│   ├── message.ts      # Message generation
│   ├── providers/      # One adapter per provider API
│   ├── ui.ts           # Colors and layout
│   ├── prompt.ts       # Interactive input and editor
│   ├── cache.ts        # Caching system
│   ├── templates.ts    # Template management
│   └── progress.ts     # Progress indicators
├── dist/               # Compiled JavaScript (generated by npm run build)
│   ├── bin/
│   └── lib/
├── __tests__/          # Unit and command-line tests
├── Makefile            # Development and release tasks
├── .github/
│   └── workflows/      # CI/CD pipelines
└── package.json
```

## Message Format

AI-generated messages follow [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `style:` - Code style changes
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

Simple format provides a summary:
```
<count> <type> — on <branch>, ahead <n>, behind <n>

<category>: <file list>
```

## Troubleshooting

**Command not found:**
- Installed from npm: add `$(npm prefix -g)/bin` to your PATH
- Installed with `make install`: add the folder it printed to your PATH

**API errors:**
- Try another model with `--model`, or another provider with `--provider`
- Set `DEBUG=1` to see stack traces
- Run `gcm config show` to verify your API key
- Check API quota/rate limits
- Use `--simple` flag to bypass AI
- Or set the provider's API key variable (see Setup)

**No changes detected:**
- Ensure you have staged or unstaged changes
- Use `--staged` to only check staged changes

**TypeScript compilation errors:**
- Run `npm run build` to compile TypeScript
- Ensure all dependencies are installed: `npm install`

## Technical Details

- **Language**: TypeScript with strict type checking
- **Runtime**: Node.js >= 20
- **Testing**: Jest, with a faked network (no real provider calls)
- **CI/CD**: GitHub Actions for automated testing and releases
- **Architecture**: Modular design with separation of concerns
- **Error Handling**: Custom error classes with retry logic
- **Security**: Input validation and secure file permissions

## License

MIT
