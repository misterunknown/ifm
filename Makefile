.PHONY: help analyse syntax-check frontend build build-cdn build-all clean test test-unit test-integration test-security

PHP ?= php
PHPSTAN ?= ./vendor/bin/phpstan
PHPUNIT ?= ./vendor/bin/phpunit
NPM ?= npm
PHP_FILES := $(shell git ls-files '*.php')

help:
	@echo "Available targets:"
	@echo "  make analyse      - run PHPStan static analysis on ./src"
	@echo "  make syntax-check - run PHP syntax checks for tracked PHP files"
	@echo "  make frontend     - build the Vue 3 frontend bundle (frontend/dist)"
	@echo "  make test         - build dist and run the full PHPUnit suite"
	@echo "  make test-unit    - run the unit test suite"
	@echo "  make test-integration - run the HTTP integration suite"
	@echo "  make test-security    - run the security/jail-escape suite"
	@echo "  make build        - build the frontend and compile regular dist files"
	@echo "  make build-cdn    - build the frontend and compile CDN dist files"
	@echo "  make build-all    - build the frontend and compile regular and CDN dist files"
	@echo "  make clean        - remove dist and frontend/dist directories"

analyse:
	@test -x $(PHPSTAN) || { echo "phpstan not found at $(PHPSTAN). Run: composer install"; exit 1; }
	$(PHPSTAN) analyse --memory-limit=512M

syntax-check:
	@set -e; \
	for file in $(PHP_FILES); do \
		$(PHP) -l "$$file" >/dev/null; \
		echo "OK $$file"; \
	done

frontend:
	@command -v $(NPM) >/dev/null 2>&1 || { echo "npm not found. Install Node.js (see frontend/README.md) and retry."; exit 1; }
	@if [ ! -d frontend/node_modules ]; then (cd frontend && $(NPM) ci --no-audit --no-fund); fi
	cd frontend && $(NPM) run build

test: build
	@test -x $(PHPUNIT) || { echo "phpunit not found at $(PHPUNIT). Run: composer install"; exit 1; }
	$(PHPUNIT)

test-unit: build
	$(PHPUNIT) --testsuite unit

test-integration: build
	$(PHPUNIT) --testsuite integration

test-security: build
	$(PHPUNIT) --testsuite security

build: frontend
	$(PHP) ./compiler.php

build-cdn: frontend
	$(PHP) ./compiler.php --cdn

build-all: build build-cdn

clean:
	rm -rf dist frontend/dist
