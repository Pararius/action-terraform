help: ## Show this help message.
	@echo 'usage: make [target] ...'
	@echo
	@echo 'targets:'
	@egrep '^(.+)\:(.+)?\ ##\ (.+)' ${MAKEFILE_LIST} | column -t -c 2 -s ':#'

compile:
	docker compose run --rm node npx ncc build index.js

tests:
	docker compose run --rm node npm test

.PHONY: compile test