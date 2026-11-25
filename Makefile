# gcm - development and release tasks. Run `make` to list them.

NPM     ?= npm
VERSION := $(shell node -p "require('./package.json').version")
SOURCES := $(shell find bin lib -name '*.ts')

# Where `make install` puts the commands: bun's bin folder if you have one,
# otherwise ~/.local/bin. Override with: make install BINDIR=/some/dir
BINDIR  ?= $(if $(wildcard $(HOME)/.bun/bin),$(HOME)/.bun/bin,$(HOME)/.local/bin)

.DEFAULT_GOAL := help
.PHONY: help deps install build typecheck lint test coverage check run pack publish-dry tag clean distclean

help: ## List targets
	@echo "gcm $(VERSION)"
	@echo
	@awk -F ':.*## ' '/^[a-zA-Z_-]+:.*## / { printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

node_modules: package.json package-lock.json
	$(NPM) ci
	@touch node_modules

deps: node_modules ## Install exact dependencies from the lockfile

dist/bin/gcm.js: $(SOURCES) tsconfig.json package.json | node_modules
	$(NPM) run build
	@touch $@

build: dist/bin/gcm.js ## Compile TypeScript into dist/

typecheck: node_modules ## Type check without writing files
	$(NPM) run type-check

lint: node_modules ## Lint TypeScript sources
	$(NPM) run lint

test: node_modules ## Build and run the tests
	$(NPM) test

coverage: build ## Run tests with a coverage report
	$(NPM) run test:coverage

check: typecheck lint test ## Everything CI runs

run: build ## Run the CLI, e.g. make run ARGS="--simple"
	@node dist/bin/gcm.js $(ARGS)

install: build ## Install gcm from this checkout into BINDIR
	@mkdir -p "$(BINDIR)"
	@chmod +x dist/bin/gcm.js
	@ln -sfn "$(CURDIR)/dist/bin/gcm.js" "$(BINDIR)/gcm"
	@ln -sfn "$(CURDIR)/dist/bin/gcm.js" "$(BINDIR)/gitcommitmessage"
	@echo "Installed gcm $(VERSION) in $(BINDIR)"
	@found=$$(command -v gcm || true); \
		if [ "$$found" != "$(BINDIR)/gcm" ]; then \
			echo "Note: your PATH finds gcm at '$$found', not in $(BINDIR)."; \
		fi

pack: check ## Build the tarball that would be published
	$(NPM) pack

publish-dry: check ## Show what publishing would upload
	$(NPM) publish --dry-run

tag: check ## Tag v$(VERSION) locally (pushing the tag publishes)
	@test -z "$$(git status --porcelain)" || { echo "Commit your changes first."; exit 1; }
	git tag -a "v$(VERSION)" -m "v$(VERSION)"
	@echo "To publish, run: git push origin v$(VERSION)"

clean: ## Remove build output
	rm -rf dist coverage *.tgz

distclean: clean ## Also remove installed dependencies
	rm -rf node_modules
