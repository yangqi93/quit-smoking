package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// CreateQuitRecord 创建戒烟记录
func CreateQuitRecord(c *gin.Context) {
	openID := c.GetString("open_id")

	var req struct {
		QuitDate          string  `json:"quit_date" binding:"required"`
		CigarettesPerDay  int     `json:"cigarettes_per_day"`
		PricePerPack      float64 `json:"price_per_pack"`
		CigarettesPerPack int     `json:"cigarettes_per_pack"`
		YearsSmoked       float64 `json:"years_smoked"`
		Reason            string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 默认值
	if req.CigarettesPerDay == 0 {
		req.CigarettesPerDay = 20
	}
	if req.PricePerPack == 0 {
		req.PricePerPack = 20.0
	}
	if req.CigarettesPerPack == 0 {
		req.CigarettesPerPack = 20
	}
	if req.YearsSmoked == 0 {
		req.YearsSmoked = 5.0
	}

	// 获取 user_id
	var userID int64
	err := models.DB.QueryRow("SELECT id FROM users WHERE open_id = ?", openID).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在，请先登录"})
		return
	}

	// 将当前活跃记录设为不活跃
	models.DB.Exec("UPDATE quit_records SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_active = 1", userID)

	// 解析戒烟时间
	quitDate, err := time.Parse(time.RFC3339, req.QuitDate)
	if err != nil {
		quitDate, _ = time.Parse("2006-01-02", req.QuitDate)
	}

	result, err := models.DB.Exec(
		`INSERT INTO quit_records (user_id, quit_date, cigarettes_per_day, price_per_pack, cigarettes_per_pack, years_smoked, reason)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		userID, quitDate, req.CigarettesPerDay, req.PricePerPack, req.CigarettesPerPack, req.YearsSmoked, req.Reason,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建戒烟记录失败"})
		return
	}

	recordID, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"id":      recordID,
		"message": "戒烟之旅开始了，加油！",
	})
}

// GetActiveQuitRecord 获取当前活跃的戒烟记录
func GetActiveQuitRecord(c *gin.Context) {
	openID := c.GetString("open_id")

	var record models.QuitRecord
	err := models.DB.QueryRow(
		`SELECT qr.id, qr.user_id, qr.quit_date, qr.cigarettes_per_day, qr.price_per_pack,
		        qr.cigarettes_per_pack, qr.years_smoked, qr.reason, qr.is_active, qr.created_at, qr.updated_at
		 FROM quit_records qr
		 JOIN users u ON qr.user_id = u.id
		 WHERE u.open_id = ? AND qr.is_active = 1
		 ORDER BY qr.created_at DESC LIMIT 1`,
		openID,
	).Scan(&record.ID, &record.UserID, &record.QuitDate, &record.CigarettesPerDay, &record.PricePerPack,
		&record.CigarettesPerPack, &record.YearsSmoked, &record.Reason, &record.IsActive, &record.CreatedAt, &record.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"record": nil, "is_active": false})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"record": record, "is_active": true})
}

// GetQuitRecordHistory 获取历史戒烟记录
func GetQuitRecordHistory(c *gin.Context) {
	openID := c.GetString("open_id")

	rows, err := models.DB.Query(
		`SELECT qr.id, qr.user_id, qr.quit_date, qr.cigarettes_per_day, qr.price_per_pack,
		        qr.cigarettes_per_pack, qr.years_smoked, qr.reason, qr.is_active, qr.created_at, qr.updated_at
		 FROM quit_records qr
		 JOIN users u ON qr.user_id = u.id
		 WHERE u.open_id = ?
		 ORDER BY qr.created_at DESC`,
		openID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var records []models.QuitRecord
	for rows.Next() {
		var r models.QuitRecord
		rows.Scan(&r.ID, &r.UserID, &r.QuitDate, &r.CigarettesPerDay, &r.PricePerPack,
			&r.CigarettesPerPack, &r.YearsSmoked, &r.Reason, &r.IsActive, &r.CreatedAt, &r.UpdatedAt)
		records = append(records, r)
	}

	c.JSON(http.StatusOK, gin.H{"records": records})
}
