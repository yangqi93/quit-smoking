package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// CheckIn 打卡
func CheckIn(c *gin.Context) {
	openID := c.GetString("open_id")

	var req struct {
		Date      string `json:"date"`       // YYYY-MM-DD
		IsSuccess *bool  `json:"is_success"` // 默认 true
		Mood      string `json:"mood"`
		Note      string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}
	if req.IsSuccess == nil {
		success := true
		req.IsSuccess = &success
	}
	if req.Mood == "" {
		req.Mood = "normal"
	}

	// 获取 user_id 和 active record_id
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

	_, err = models.DB.Exec(
		`INSERT INTO check_ins (user_id, record_id, date, is_success, mood, note)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE is_success = VALUES(is_success), mood = VALUES(mood), note = VALUES(note)`,
		userID, recordID, req.Date, *req.IsSuccess, req.Mood, req.Note,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "打卡失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "打卡成功！", "date": req.Date})
}

// GetCheckInHistory 获取打卡历史
func GetCheckInHistory(c *gin.Context) {
	openID := c.GetString("open_id")
	month := c.Query("month") // YYYY-MM
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	rows, err := models.DB.Query(
		`SELECT ci.id, ci.user_id, ci.record_id, ci.date, ci.is_success, ci.mood, ci.note, ci.created_at
		 FROM check_ins ci
		 JOIN users u ON ci.user_id = u.id
		 WHERE u.open_id = ? AND DATE_FORMAT(ci.date, '%Y-%m') = ?
		 ORDER BY ci.date DESC`,
		openID, month,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var checkIns []models.CheckIn
	for rows.Next() {
		var ci models.CheckIn
		rows.Scan(&ci.ID, &ci.UserID, &ci.RecordID, &ci.Date, &ci.IsSuccess, &ci.Mood, &ci.Note, &ci.CreatedAt)
		checkIns = append(checkIns, ci)
	}

	c.JSON(http.StatusOK, gin.H{"check_ins": checkIns, "month": month})
}
