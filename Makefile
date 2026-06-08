.PHONY: help lint syntax-check build build-cdn build-all clean

PHP ?= php
PHPMD ?= ./vendor/bin/phpmd
PHP_FILES := $(shell git ls-files '*.php')

help:
	@echo "Available targets:"
	@echo "  make lint         - run PHPMD on ./src"
	@echo "  make syntax-check - run PHP syntax checks for tracked PHP files"
	@echo "  make build        - compile regular dist files"
	@echo "  make build-cdn    - compile CDN dist files"
	@echo "  make build-all    - compile regular and CDN dist files"
	@echo "  make clean        - remove dist directory"

lint:
	@test -x $(PHPMD) || { echo "phpmd not found at $(PHPMD). Run: composer install"; exit 1; }
	$(PHPMD) ./src text cleancode,design,unusedcode --exclude './src/includes/*' --ignore-violations-on-exit

syntax-check:
	@set -e; \
	for file in $(PHP_FILES); do \
		$(PHP) -l "$$file" >/dev/null; \
		echo "OK $$file"; \
	done

build:
	$(PHP) ./compiler.php

build-cdn:
	$(PHP) ./compiler.php --cdn

build-all: build build-cdn

clean:
	rm -rf dist
