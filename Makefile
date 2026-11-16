.PHONY: help analyse syntax-check build build-cdn build-all clean test test-unit test-integration test-security test-docker

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
	@echo "  make test-docker      - build both docker image variants and smoke-test them"
	@echo "  make build        - compile regular dist files"
	@echo "  make build-cdn    - compile CDN dist files"
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

# same as the "Docker" CI workflow; needs docker, curl and jq
IFM_VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null)

test-docker:
	docker build --build-arg CDN=false --build-arg IFM_VERSION="$(IFM_VERSION)" -t ifm:test .
	tests/docker/smoke-test.sh ifm:test regular "$(IFM_VERSION)"
	docker build --build-arg CDN=true --build-arg IFM_VERSION="$(IFM_VERSION)" -t ifm:test-cdn .
	tests/docker/smoke-test.sh ifm:test-cdn cdn "$(IFM_VERSION)"

build:
	$(PHP) ./compiler.php

build-cdn:
	$(PHP) ./compiler.php --cdn

build-all: build build-cdn

clean:
	rm -rf dist
