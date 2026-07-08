// config
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port      string
	DBSocket  string
	DBHost    string
	DBPort    string
	DBUser    string
	DBPass    string
	DBName    string
	DBSSLMode string
}

func Load() *Config {
	return &Config{
		Port:      getEnv("PORT", "8080"),
		DBSocket:  getEnv("PGHOST", ""),
		DBHost:    getEnv("DB_HOST", "localhost"),
		DBPort:    getEnv("DB_PORT", "5432"),
		DBUser:    getEnv("DB_USER", "postgres"),
		DBPass:    getEnv("DB_PASS", ""),
		DBName:    getEnv("DB_NAME", "logithm"),
		DBSSLMode: getEnv("DB_SSLMODE", "disable"),
	}
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
