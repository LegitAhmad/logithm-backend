// Package config loads and validates application configuration.
package config

import (
	"fmt"
	"os"
	"time"
)

type Config struct {
	Port             string
	DBSocket         string
	DBHost           string
	DBPort           string
	DBUser           string
	DBPass           string
	DBName           string
	DBSSLMode        string
	JWTAccessSecret  string
	JWTRefreshSecret string
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	CookieSecure     bool
	CookieDomain     string
	Environment      string
}

func Load() *Config {
	return &Config{
		Port:             getEnv("PORT", "8080"),
		DBSocket:         getEnv("PGHOST", ""),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBUser:           getEnv("DB_USER", "postgres"),
		DBPass:           getEnv("DB_PASS", ""),
		DBName:           getEnv("DB_NAME", "logithm"),
		DBSSLMode:        getEnv("DB_SSLMODE", "disable"),
		JWTAccessSecret:  getEnv("JWT_ACCESS_SECRET", "development-access-secret-change-me"),
		JWTRefreshSecret: getEnv("JWT_REFRESH_SECRET", "development-refresh-secret-change-me"),
		AccessTokenTTL:   durationEnv("JWT_ACCESS_TTL", 15*time.Minute),
		RefreshTokenTTL:  durationEnv("JWT_REFRESH_TTL", 30*24*time.Hour),
		CookieSecure:     getEnv("COOKIE_SECURE", "false") == "true",
		CookieDomain:     getEnv("COOKIE_DOMAIN", ""),
		Environment:      getEnv("APP_ENV", "development"),
	}
}

func (c *Config) Validate() error {
	if c.Environment != "production" {
		return nil
	}
	if len(c.JWTAccessSecret) < 32 || len(c.JWTRefreshSecret) < 32 || c.JWTAccessSecret == c.JWTRefreshSecret {
		return fmt.Errorf("production JWT access and refresh secrets must be distinct and at least 32 characters")
	}
	if !c.CookieSecure {
		return fmt.Errorf("COOKIE_SECURE must be true in production")
	}
	return nil
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	if raw := os.Getenv(key); raw != "" {
		if value, err := time.ParseDuration(raw); err == nil {
			return value
		}
	}
	return fallback
}

func (c *Config) DSN() string {
	if c.DBSocket != "" {
		return fmt.Sprintf(
			"postgres://%s@/%s?host=%s&sslmode=disable",
			c.DBUser, c.DBName, c.DBSocket,
		)
	}
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPass, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode,
	)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
