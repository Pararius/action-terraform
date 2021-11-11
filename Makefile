help: ## Show this help message.
	@echo 'usage: make [target] ...'
	@echo
	@echo 'targets:'
	@egrep '^(.+)\:(.+)?\ ##\ (.+)' ${MAKEFILE_LIST} | column -t -c 2 -s ':#'

build:
	docker compose run --rm node npm run-script build

install:
	docker compose run --rm node npm install

cs:
	docker compose run --rm node npm run-script lint

cs-fix:
	docker compose run --rm node npm run-script lint-fix

test:
	docker compose run --rm node npm run-script test

.PHONY: build install lint test