.PHONY: help analyse syntax-check build build-cdn build-vue build-all clean test test-unit test-integration test-security frontend-install frontend-build frontend-test

PHP ?= php
PHPSTAN ?= ./vendor/bin/phpstan
PHPUNIT ?= ./vendor/bin/phpunit
PHP_FILES := $(shell git ls-files '*.php')

help:
	@echo "Available targets:"
	@echo "  make analyse      - run PHPStan static analysis on ./src"
	@echo "  make syntax-check - run PHP syntax checks for tracked PHP files"
	@echo "  make test         - build dist and run the full PHPUnit suite"
	@echo "  make test-unit    - run the unit test suite"
	@echo "  make test-integration - run the HTTP integration suite"
	@echo "  make test-security    - run the security/jail-escape suite"
	@echo "  make build        - compile regular dist files"
	@echo "  make build-cdn    - compile CDN dist files"
	@echo "  make build-vue    - compile Vue 3 + Vite dist files (needs frontend build)"
	@echo "  make frontend-install - install frontend dependencies (npm install)"
	@echo "  make frontend-build   - build the Vue bundle (frontend/dist)"
	@echo "  make frontend-test    - run the frontend unit tests"
	@echo "  make build-all    - compile regular and CDN dist files"
	@echo "  make clean        - remove dist directory"

analyse:
	@test -x $(PHPSTAN) || { echo "phpstan not found at $(PHPSTAN). Run: composer install"; exit 1; }
	$(PHPSTAN) analyse --memory-limit=512M

syntax-check:
	@set -e; \
	for file in $(PHP_FILES); do \
		$(PHP) -l "$$file" >/dev/null; \
		echo "OK $$file"; \
	done

test: build
	@test -x $(PHPUNIT) || { echo "phpunit not found at $(PHPUNIT). Run: composer install"; exit 1; }
	$(PHPUNIT)

test-unit: build
	$(PHPUNIT) --testsuite unit

test-integration: build
	$(PHPUNIT) --testsuite integration

test-security: build
	$(PHPUNIT) --testsuite security

build:
	$(PHP) ./compiler.php

build-cdn:
	$(PHP) ./compiler.php --cdn

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm test

build-vue: frontend-build
	$(PHP) ./compiler.php --vue

build-all: build build-cdn

clean:
	rm -rf dist
