package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/yangqi93/quit-smoking/server/config"
	"github.com/yangqi93/quit-smoking/server/models"
	"github.com/yangqi93/quit-smoking/server/routes"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化数据库
	if err := models.InitDB(cfg.DSN()); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer models.CloseDB()
	fmt.Println("✅ 数据库初始化成功")

	// 设置路由
	r := routes.SetupRouter(cfg)

	// 优雅关闭
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		fmt.Println("\n🛑 正在关闭服务器...")
		models.CloseDB()
		os.Exit(0)
	}()

	// 启动服务
	addr := fmt.Sprintf(":%s", cfg.Port)
	fmt.Printf("🚀 戒烟助手 API 启动成功，监听 %s\n", addr)
	fmt.Printf("🌍 环境: %s\n", cfg.Environment)
	fmt.Printf("📊 健康检查: http://localhost%s/ping\n", addr)

	if err := r.Run(addr); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
