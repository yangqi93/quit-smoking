package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware JWT 鉴权中间件
// 从 Authorization: Bearer <token> 中解析 open_id，注入到 gin.Context
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "缺少认证信息"})
			c.Abort()
			return
		}

		// Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "认证格式错误，需要 Bearer token"})
			c.Abort()
			return
		}

		tokenStr := parts[1]

		// 解析 JWT
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌无效或已过期"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌格式错误"})
			c.Abort()
			return
		}

		openID, _ := claims["open_id"].(string)
		if openID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌中缺少用户标识"})
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
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
