package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// GetProfile 获取用户资料
func GetProfile(c *gin.Context) {
	openID := c.GetString("open_id")
	var user models.User
	err := models.DB.QueryRow(
		"SELECT id, open_id, nickname, avatar_url, created_at, updated_at FROM users WHERE open_id = ?",
		openID,
	).Scan(&user.ID, &user.OpenID, &user.Nickname, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// UpdateProfile 更新用户资料（昵称/头像）
func UpdateProfile(c *gin.Context) {
	openID := c.GetString("open_id")

	var req struct {
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	result, err := models.DB.Exec(
		"UPDATE users SET nickname = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE open_id = ?",
		req.Nickname, req.AvatarURL, openID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}
