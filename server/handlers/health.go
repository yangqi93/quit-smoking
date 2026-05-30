package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// GetHealthTimeline 获取健康恢复时间线
func GetHealthTimeline(c *gin.Context) {
	openID := c.GetString("open_id")

	var quitDate time.Time
	err := models.DB.QueryRow(
		`SELECT qr.quit_date
		 FROM quit_records qr
		 JOIN users u ON qr.user_id = u.id
		 WHERE u.open_id = ? AND qr.is_active = 1
		 ORDER BY qr.created_at DESC LIMIT 1`,
		openID,
	).Scan(&quitDate)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"timeline": nil, "is_active": false})
		return
	}

	hoursElapsed := time.Since(quitDate).Hours()

	milestones := getWHOMilestones()
	var timeline []models.HealthMilestoneStatus
	for _, m := range milestones {
		status := models.HealthMilestoneStatus{
			Hours:    m.Hours,
			Title:    m.Title,
			Desc:     m.Desc,
			Category: m.Category,
			Achieved: hoursElapsed >= float64(m.Hours),
		}
		if !status.Achieved {
			remaining := float64(m.Hours) - hoursElapsed
			status.TimeLeft = formatDuration(remaining)
		}
		timeline = append(timeline, status)
	}

	c.JSON(http.StatusOK, gin.H{
		"timeline": models.HealthTimeline{
			QuitDate:     quitDate.Format("2006-01-02"),
			HoursElapsed: mathRound(hoursElapsed, 1),
			Milestones:   timeline,
		},
		"is_active": true,
	})
}
