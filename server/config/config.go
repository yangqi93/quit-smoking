package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	JWTSecret   string
	Environment string
}

func Load() *Config {
	// 加载 .env 文件（优先从 server/ 目录查找，再从项目根目录查找）
	if err := godotenv.Load(); err != nil {
		// .env 文件不存在时不报错，可能是生产环境通过系统环境变量配置
		log.Println("未找到 .env 文件，使用系统环境变量")
	}

	return &Config{
		Port:        getEnv("PORT", "8080"),
		DBHost:      getEnv("DB_HOST", "127.0.0.1"),
		DBPort:      getEnv("DB_PORT", "3306"),
		DBUser:      getEnv("DB_USER", "root"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBName:      getEnv("DB_NAME", "quit_smoking"),
		JWTSecret:   getEnv("JWT_SECRET", "quit-smoking-secret-change-in-prod"),
		Environment: getEnv("ENV", "development"),
	}
}

// DSN 返回 MySQL 连接字符串
// parseTime=true 和 loc=Local 是必须的，否则 DATETIME 字段无法自动扫描到 Go 的 time.Time
func (c *Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName,
	)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
