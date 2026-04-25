.PHONY: ddev dev backend frontend test build tidy migrate-up

dev:
	./scripts/dev.sh

ddev:
	./scripts/ddev.sh

backend:
	cd backend && go run ./cmd/server

frontend:
	cd frontend && npm install && npm run dev

tidy:
	cd backend && go mod tidy

test:
	cd backend && go test ./...
	cd frontend && npm test -- --run

build:
	cd backend && go build -o bin/mining-app ./cmd/server
	cd frontend && npm install && npm run build

migrate-up:
	cd backend && go run ./cmd/server --migrate-only
