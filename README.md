# gcm - Git Commit Message Generator

A CLI tool that generates intelligent commit messages from git status using Google Gemini AI, with automatic fallback to simple message format. Features real-time progress indicators and comprehensive error handling.

## Features

- AI-powered commit message generation using Google Gemini
- TypeScript codebase with full type safety
- Intelligent caching for similar diffs
- Custom commit message templates
- Progress indicators for long operations
- Comprehensive error handling with retry logic
- Modular architecture for maintainability
- Full test coverage

## Installation

```bash
npm link
```

Ensure your global npm bin directory is in your PATH:

```bash
npm prefix -g
```

Add to your shell config (`~/.zshrc` or `~/.config/fish/config.fish`):

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

## Setup

Configuration is required before using AI-powered commit messages.

1. Get a Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Configure it:
   ```bash
   gcm config set
   ```
3. Enter your API key when prompted
4. Select a model from the list (or press Enter for default: `gemini-3-flash-preview`)

The API key and model are stored in `~/.gcm/config.json`.

Alternatively, use the environment variable:
```bash
export GEMINI_API_KEY="your-api-key-here"
```

## Configuration Commands

```bash
gcm config show      # Show current configuration
gcm config set       # Set or update API key and model (interactive prompt)
gcm config clear     # Clear stored configuration
```

When running `gcm config set`, you'll be prompted for:
1. **API Key** - Your Google Gemini API key
2. **Model** - Choose from available models (default: `gemini-3-flash-preview`)

Available models:
- `gemini-3-flash-preview` (default)
- `gemini-3-pro-preview`
- `gemini-1.5-flash`
- `gemini-1.5-pro`
- `gemini-pro`

## Usage

```bash
gcm                    # Generate commit message for all changes
gcm --staged           # Generate message for staged changes only
gcm --commit           # Stage changes, show message, wait for confirmation, then commit
gcm --simple           # Use simple format without AI
gcm --verbose          # Show verbose output
gcm --help             # Show help message
```

### Options

- `-s, --staged` - Only consider staged changes
- `-c, --commit` - Stage all changes, show message, wait for Enter, then commit
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

Commit with confirmation:
```bash
$ gcm --commit
[Generates message, stages all changes, shows message]
Press Enter to commit, or Ctrl+C to cancel: 
```

Simple mode (no AI):
```bash
$ gcm --simple
2 added, 3 modified — on feature/auth, ahead 1, behind 0

added: src/auth.js, src/login.js
modified: src/app.js, src/utils.js, README.md
```

## How It Works

1. Shows progress indicator while analyzing git status
2. Parses `git status --porcelain=v2 -b` to detect file changes, branch info, and status
3. Collects git diffs for changed files (up to 20 files, ~50KB limit) with progress feedback
4. Checks cache for similar diffs to avoid redundant API calls
5. If API key is configured, sends context to Google Gemini AI to generate a Conventional Commits formatted message (with progress indicator)
6. Falls back to simple format if AI is unavailable or fails
7. Uses retry logic with exponential backoff for API reliability
8. All operations show visual progress indicators for better user experience

## Advanced Features

### Caching

Commit messages are cached based on diff content. Similar changes will use cached messages, reducing API calls and improving speed.

### Custom Templates

You can create custom commit message templates. Templates support variables and conditionals:

- `{{branch}}` - Current branch name
- `{{changes}}` - Summary of changes
- `{{files}}` - List of changed files
- `{{diff}}` - Git diff content
- `{{#if variable}}...{{/if}}` - Conditional blocks

Templates are stored in `~/.gcm/templates/`.

### Progress Indicators

Progress indicators are automatically shown for all operations:
- Spinner animations for async operations (git status, file collection, AI generation)
- Real-time feedback during command execution
- Success checkmarks (✓) when operations complete

Progress indicators appear for:
- Analyzing git status
- Collecting changed files
- Collecting git diffs
- Generating commit messages (AI or simple)
- Staging changes (when using `--commit`)

## Development

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
│   ├── cache.ts        # Caching system
│   ├── templates.ts    # Template management
│   └── progress.ts     # Progress indicators
├── dist/               # Compiled JavaScript (generated by npm run build)
│   ├── bin/
│   └── lib/
├── __tests__/          # Unit tests
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
- Ensure npm global bin is in your PATH
- Run `npm link` again if needed

**API errors:**
- Run `gcm config show` to verify your API key
- Check API quota/rate limits
- Use `--simple` flag to bypass AI
- Set `GEMINI_API_KEY` environment variable as alternative

**No changes detected:**
- Ensure you have staged or unstaged changes
- Use `--staged` to only check staged changes

**TypeScript compilation errors:**
- Run `npm run build` to compile TypeScript
- Ensure all dependencies are installed: `npm install`

## Technical Details

- **Language**: TypeScript with strict type checking
- **Runtime**: Node.js >= 16
- **Testing**: Jest with comprehensive test coverage
- **CI/CD**: GitHub Actions for automated testing and releases
- **Architecture**: Modular design with separation of concerns
- **Error Handling**: Custom error classes with retry logic
- **Security**: Input validation and secure file permissions

## License

MIT
