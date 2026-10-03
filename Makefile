# Developer entry points. Every target wraps `docker compose` and the
# Composer/npm scripts that CI runs, so local and CI gates are identical.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Containers run as the host user so files written to the bind mount
# (vendor/, node_modules/, storage/) stay owned by you.
export HOST_UID ?= $(shell id -u)
export HOST_GID ?= $(shell id -g)

COMPOSE ?= docker compose
APP_RUN := $(COMPOSE) run --rm --no-deps app
NODE_RUN := $(COMPOSE) run --rm --no-deps vite
APP_EXEC := $(COMPOSE) exec -T app

# Must match the exact @playwright/test version in package.json.
PLAYWRIGHT_IMAGE ?= mcr.microsoft.com/playwright:v1.63.0-noble

.PHONY: help setup up down restart logs shell smoke test test-backend test-frontend lint analyse types ci e2e reset

help: ## List available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

.env:
	cp .env.example .env

setup: .env ## Build images, install dependencies, generate the app key, create the bucket and migrate
	$(COMPOSE) build
	$(APP_RUN) composer install --no-interaction
	$(NODE_RUN) npm ci --no-audit --no-fund
	@if grep -qE '^APP_KEY=$$' .env; then $(APP_RUN) php artisan key:generate --ansi; fi
	$(COMPOSE) up -d --wait pgsql redis s3
	$(COMPOSE) run --rm s3-init
	$(COMPOSE) run --rm app php artisan migrate --force

up: ## Start the full development stack
	$(COMPOSE) up -d --wait

down: ## Stop the stack (data volumes are kept)
	$(COMPOSE) down

restart: ## Restart application processes (pick up config, queue and Reverb changes)
	$(COMPOSE) restart app horizon scheduler reverb

logs: ## Follow logs from all services
	$(COMPOSE) logs -f

shell: ## Open a shell in the app container
	$(COMPOSE) exec app sh

smoke: ## Run the foundation smoke checks (MAIL_TO=you@example.com to include Mailtrap)
	$(APP_EXEC) php artisan foundation:smoke $(if $(MAIL_TO),--mail-to=$(MAIL_TO),)

test: test-backend test-frontend ## Run backend and frontend test suites

test-backend: ## Run the Pest suite against PostgreSQL and Redis
	$(APP_EXEC) composer test

test-frontend: ## Run the Vitest suite
	$(NODE_RUN) npm run test

lint: ## Check PHP and TypeScript lint and formatting
	$(APP_EXEC) composer lint
	$(NODE_RUN) npm run lint
	$(NODE_RUN) npm run format:check

analyse: ## Run PHP static analysis
	$(APP_EXEC) composer analyse

types: ## Run the TypeScript type check
	$(NODE_RUN) npm run types

ci: lint analyse types test ## Every non-E2E quality gate plus the production asset build
	$(NODE_RUN) npm run build

e2e: ## Run Playwright (in its official container) against the running stack
	docker run --rm --network host --ipc host --user $(HOST_UID):$(HOST_GID) \
		-e HOME=/tmp -e CI -e PLAYWRIGHT_BASE_URL \
		-v "$(CURDIR)":/app -w /app $(PLAYWRIGHT_IMAGE) npm run test:e2e

reset: ## Destroy containers and data volumes, then set up again (local recovery)
	$(COMPOSE) down --volumes --remove-orphans
	$(MAKE) setup
