package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/handlers"
	"github.com/yangqi93/quit-smoking/server/middleware"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// 全局中间件
	r.Use(middleware.CORSConfig())

	// 公开路由（无需鉴权）
	r.POST("/api/auth/login", handlers.LoginOrRegister)

	// 需要鉴权的路由
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		// 用户
		api.GET("/user/profile", handlers.GetProfile)

		// 戒烟记录
		api.POST("/quit-record", handlers.CreateQuitRecord)
		api.GET("/quit-record/active", handlers.GetActiveQuitRecord)

		// 仪表盘
		api.GET("/dashboard", handlers.GetDashboard)

		// 健康时间线
		api.GET("/health/timeline", handlers.GetHealthTimeline)

		// 打卡
		api.POST("/check-in", handlers.CheckIn)
		api.GET("/check-in/history", handlers.GetCheckInHistory)

		// 烟瘾记录
		api.POST("/craving", handlers.CreateCraving)
	}

	// 健康检查
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong", "service": "quit-smoking-api"})
	})

	return r
}
