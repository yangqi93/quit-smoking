package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const HeaderOpenID = "X-Open-ID"

// AuthMiddleware 简易鉴权：从请求头获取 OpenID
// 原型阶段用 OpenID 直连，生产环境换 JWT
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		openID := c.GetHeader(HeaderOpenID)
		if openID == "" {
			// 也尝试从 query 参数获取（方便调试）
			openID = c.Query("open_id")
		}
		if openID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "缺少认证信息，请提供 X-Open-ID 请求头",
			})
			c.Abort()
			return
		}
		c.Set("open_id", openID)
		c.Next()
	}
}

// CORS 跨域中间件配置
func CORSConfig() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowed := []string{
			"http://localhost:3000",
			"http://localhost:8080",
			"https://servicewechat.com",
		}

		isAllowed := false
		for _, o := range allowed {
			if origin == o || strings.HasPrefix(origin, "https://servicewechat.com") {
				isAllowed = true
				break
			}
		}
		// 开发环境放行所有
		if !isAllowed && strings.HasPrefix(origin, "http://localhost") {
			isAllowed = true
		}

		if isAllowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Open-ID, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
