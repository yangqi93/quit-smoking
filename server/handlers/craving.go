package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// CreateCraving 记录烟瘾发作
func CreateCraving(c *gin.Context) {
	openID := c.GetString("open_id")

	var req struct {
		Trigger   string `json:"trigger"`
		Intensity int    `json:"intensity"`
		Method    string `json:"method"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	if req.Intensity < 1 {
		req.Intensity = 5
	}
	if req.Intensity > 10 {
		req.Intensity = 10
	}

	var userID, recordID int64
	err := models.DB.QueryRow(
		`SELECT u.id, qr.id
		 FROM users u
		 JOIN quit_records qr ON qr.user_id = u.id
		 WHERE u.open_id = ? AND qr.is_active = 1
		 ORDER BY qr.created_at DESC LIMIT 1`,
		openID,
	).Scan(&userID, &recordID)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "没有活跃的戒烟记录"})
		return
	}

	resolved := req.Method != ""
	result, err := models.DB.Exec(
		`INSERT INTO cravings (user_id, record_id, trigger_val, intensity, resolved, method)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		userID, recordID, req.Trigger, req.Intensity, resolved, req.Method,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "记录失败"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"id": id, "message": "已记录，你很棒！"})
}

// GetCravingHistory 获取烟瘾历史记录
func GetCravingHistory(c *gin.Context) {
	openID := c.GetString("open_id")

	rows, err := models.DB.Query(
		`SELECT cr.id, cr.user_id, cr.record_id, cr.trigger_val, cr.intensity, cr.resolved, cr.method, cr.created_at
		 FROM cravings cr
		 JOIN users u ON cr.user_id = u.id
		 WHERE u.open_id = ?
		 ORDER BY cr.created_at DESC
		 LIMIT 200`,
		openID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var cravings []models.Craving
	for rows.Next() {
		var cr models.Craving
		rows.Scan(&cr.ID, &cr.UserID, &cr.RecordID, &cr.Trigger, &cr.Intensity, &cr.Resolved, &cr.Method, &cr.CreatedAt)
		cravings = append(cravings, cr)
	}

	c.JSON(http.StatusOK, gin.H{"cravings": cravings})
}

// DeleteCraving 删除烟瘾记录
func DeleteCraving(c *gin.Context) {
	openID := c.GetString("open_id")
	id := c.Param("id")

	result, err := models.DB.Exec(
		`DELETE cr FROM cravings cr
		 JOIN users u ON cr.user_id = u.id
		 WHERE cr.id = ? AND u.open_id = ?`,
		id, openID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "记录不存在或无权操作"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
