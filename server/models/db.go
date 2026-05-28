package models

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDB 初始化数据库，接收 MySQL DSN 连接字符串
func InitDB(dsn string) error {
	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	// 验证数据库连接
	if err = DB.Ping(); err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}

	// MySQL 连接池配置
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(10)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = createTables(); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	return nil
}

func createTables() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INT PRIMARY KEY AUTO_INCREMENT,
			open_id VARCHAR(128) NOT NULL UNIQUE,
			nickname VARCHAR(128) DEFAULT '',
			avatar_url VARCHAR(512) DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS quit_records (
			id INT PRIMARY KEY AUTO_INCREMENT,
			user_id INT NOT NULL,
			quit_date DATETIME NOT NULL,
			cigarettes_per_day INT DEFAULT 20,
			price_per_pack DOUBLE DEFAULT 20.0,
			cigarettes_per_pack INT DEFAULT 20,
			years_smoked DOUBLE DEFAULT 5.0,
			reason TEXT,
			is_active TINYINT(1) DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			INDEX idx_quit_records_user (user_id),
			INDEX idx_quit_records_active (user_id, is_active)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS check_ins (
			id INT PRIMARY KEY AUTO_INCREMENT,
			user_id INT NOT NULL,
			record_id INT NOT NULL,
			date VARCHAR(32) NOT NULL,
			is_success TINYINT(1) DEFAULT 1,
			mood VARCHAR(64) DEFAULT 'normal',
			note TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (record_id) REFERENCES quit_records(id),
			UNIQUE(user_id, record_id, date),
			INDEX idx_check_ins_user_date (user_id, date)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS cravings (
			id INT PRIMARY KEY AUTO_INCREMENT,
			user_id INT NOT NULL,
			record_id INT NOT NULL,
			trigger_val VARCHAR(255) DEFAULT '',
			intensity INT DEFAULT 5,
			resolved TINYINT(1) DEFAULT 0,
			method VARCHAR(255) DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (record_id) REFERENCES quit_records(id),
			INDEX idx_cravings_user (user_id, record_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}

	for _, stmt := range stmts {
		if _, err := DB.Exec(stmt); err != nil {
			preview := stmt
			if len(preview) > 80 {
				preview = preview[:80] + "..."
			}
			return fmt.Errorf("执行SQL失败 [%s]: %w", preview, err)
		}
	}
	return nil
}

// CloseDB 关闭数据库
func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
