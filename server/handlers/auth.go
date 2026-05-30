package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/yangqi93/quit-smoking/server/config"
	"github.com/yangqi93/quit-smoking/server/models"
)

// LoginOrRegister 小程序登录/注册
// 前端传 wx.login() 的 code，后端调微信 jscode2session 换真实 openid，返回 JWT
func LoginOrRegister(cfg *config.Config) gin.HandlerFunc {
	type wechatResp struct {
		OpenID     string `json:"openid"`
		SessionKey string `json:"session_key"`
		UnionID    string `json:"unionid"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}

	return func(c *gin.Context) {
		var req struct {
			Code      string `json:"code" binding:"required"`
			Nickname  string `json:"nickname"`
			AvatarURL string `json:"avatar_url"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
			return
		}

		// 调用微信 jscode2session 换取真实 openid
		wxURL := fmt.Sprintf(
			"https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
			cfg.WXAppID, cfg.WXAppSecret, req.Code,
		)
		resp, err := http.Get(wxURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "微信服务不可达"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)

		var wxResp wechatResp
		if err := json.Unmarshal(body, &wxResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "微信响应解析失败"})
			return
		}
		if wxResp.ErrCode != 0 {
			errMsg := fmt.Sprintf("微信登录失败: errcode=%d, errmsg=%s", wxResp.ErrCode, wxResp.ErrMsg)
			fmt.Println("[ERROR]", errMsg)
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
			return
		}

		openID := wxResp.OpenID
		if openID == "" {
			fmt.Println("[ERROR] 微信返回 openid 为空")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "微信返回 openid 为空"})
			return
		}
		// 查找或创建用户
		var user models.User
		err = models.DB.QueryRow(
			"SELECT id, open_id, nickname, avatar_url, created_at, updated_at FROM users WHERE open_id = ?",
			openID,
		).Scan(&user.ID, &user.OpenID, &user.Nickname, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)

		if err == sql.ErrNoRows {
			result, err := models.DB.Exec(
				"INSERT INTO users (open_id, nickname, avatar_url) VALUES (?, ?, ?)",
				openID, req.Nickname, req.AvatarURL,
			)
			if err != nil {
				fmt.Println("[ERROR] 创建用户失败:", err, "openid:", openID)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "创建用户失败: " + err.Error()})
				return
			}
			user.ID, _ = result.LastInsertId()
			user.OpenID = openID
			user.Nickname = req.Nickname
			user.AvatarURL = req.AvatarURL
			now := time.Now()
			user.CreatedAt = &now
			user.UpdatedAt = &now
		} else if err != nil {
			fmt.Println("[ERROR] 查询用户失败:", err, "openid:", openID)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询用户失败: " + err.Error()})
			return
		} else {
			if req.Nickname != "" || req.AvatarURL != "" {
				models.DB.Exec(
					"UPDATE users SET nickname = COALESCE(NULLIF(?, ''), nickname), avatar_url = COALESCE(NULLIF(?, ''), avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
					req.Nickname, req.AvatarURL, user.ID,
				)
			}
		}

		// 生成 JWT
		token, err := generateJWT(openID, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
	}
}

// generateJWT 签发 JWT（7天有效期）
func generateJWT(openID, secret string) (string, error) {
	claims := jwt.MapClaims{
		"open_id": openID,
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
