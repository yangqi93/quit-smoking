package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// GetDashboard 获取首页仪表盘数据
func GetDashboard(c *gin.Context) {
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
		c.JSON(http.StatusOK, gin.H{
			"dashboard": models.DashboardData{IsActive: false},
		})
		return
	}

	now := time.Now()
	duration := now.Sub(record.QuitDate)
	hoursQuit := int(duration.Hours())
	daysQuit := int(duration.Hours() / 24)
	minutesQuit := int(duration.Minutes())

	pricePerCig := record.PricePerPack / float64(record.CigarettesPerPack)
	moneySaved := float64(record.CigarettesPerDay) * pricePerCig * float64(daysQuit)
	cigAvoided := record.CigarettesPerDay * daysQuit
	// 每支烟减少 11 分钟生命（WHO 数据）
	lifeRegained := float64(cigAvoided) * 11.0 / 60.0 // 小时

	// 下一个里程碑
	nextMilestone, milestoneDays := getNextMilestone(daysQuit)

	dashboard := models.DashboardData{
		DaysQuit:        daysQuit,
		HoursQuit:       hoursQuit,
		MinutesQuit:     minutesQuit,
		CigarettesAvoid: cigAvoided,
		MoneySaved:      mathRound(moneySaved, 2),
		LifeRegained:    mathRound(lifeRegained, 1),
		IsActive:        true,
		NextMilestone:   nextMilestone,
		MilestoneDays:   milestoneDays,
	}

	c.JSON(http.StatusOK, gin.H{"dashboard": dashboard})
}
