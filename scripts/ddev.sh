#!/bin/zsh
cd backend
rm -f go.sum
go mod tidy
cd ..

docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
