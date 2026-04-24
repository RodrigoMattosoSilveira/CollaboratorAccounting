package app

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Env       string
	HTTPAddr  string
	DBPath    string
	JWTSecret string
}

func LoadConfig() (Config, error) {
	_ = godotenv.Load()
	cfg := Config{
		Env:       getEnv("APP_ENV", "development"),
		HTTPAddr:  getEnv("HTTP_ADDR", ":8080"),
		DBPath:    getEnv("DB_PATH", "./data/app.db"),
		JWTSecret: getEnv("JWT_SECRET", "dev-only-change-me"),
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
