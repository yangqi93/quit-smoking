package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yangqi93/quit-smoking/server/models"
)

// --- 用户 ---

// LoginOrRegister 小程序登录/注册（原型用 OpenID 直传）
func LoginOrRegister(c *gin.Context) {
	var req struct {
		OpenID    string `json:"open_id" binding:"required"`
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 查找或创建用户
	var user models.User
	err := models.DB.QueryRow(
		"SELECT id, open_id, nickname, avatar_url, created_at, updated_at FROM users WHERE open_id = ?",
		req.OpenID,
	).Scan(&user.ID, &user.OpenID, &user.Nickname, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// 新用户
		result, err := models.DB.Exec(
			"INSERT INTO users (open_id, nickname, avatar_url) VALUES (?, ?, ?)",
			req.OpenID, req.Nickname, req.AvatarURL,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "创建用户失败"})
			return
		}
		user.ID, _ = result.LastInsertId()
		user.OpenID = req.OpenID
		user.Nickname = req.Nickname
		user.AvatarURL = req.AvatarURL
		user.CreatedAt = time.Now()
		user.UpdatedAt = time.Now()
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询用户失败"})
		return
	} else {
		// 更新昵称和头像
		if req.Nickname != "" || req.AvatarURL != "" {
			models.DB.Exec(
				"UPDATE users SET nickname = COALESCE(NULLIF(?, ''), nickname), avatar_url = COALESCE(NULLIF(?, ''), avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
				req.Nickname, req.AvatarURL, user.ID,
			)
		}
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

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

// --- 戒烟记录 ---

// CreateQuitRecord 创建戒烟记录
func CreateQuitRecord(c *gin.Context) {
	openID := c.GetString("open_id")

	var req struct {
		QuitDate         string  `json:"quit_date" binding:"required"`
		CigarettesPerDay int     `json:"cigarettes_per_day"`
		PricePerPack     float64 `json:"price_per_pack"`
		CigarettesPerPack int    `json:"cigarettes_per_pack"`
		YearsSmoked      float64 `json:"years_smoked"`
		Reason           string  `json:"reason"`
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

// --- 仪表盘 ---

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

// --- 健康时间线 ---

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

// --- 打卡 ---

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

// --- 烟瘾记录 ---

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

// --- 辅助函数 ---

var milestoneList = []struct {
	Days  int
	Title string
}{
	{1, "第1天"},
	{3, "第3天"},
	{7, "一周"},
	{14, "两周"},
	{30, "一个月"},
	{90, "三个月"},
	{180, "半年"},
	{365, "一年"},
	{730, "两年"},
	{1825, "五年"},
	{3650, "十年"},
}

func getNextMilestone(daysQuit int) (string, int) {
	for _, m := range milestoneList {
		if daysQuit < m.Days {
			return m.Title, m.Days - daysQuit
		}
	}
	return "传奇", 0
}

func getWHOMilestones() []models.HealthMilestone {
	return []models.HealthMilestone{
		{Hours: 0, Title: "开始戒烟", Desc: "心率开始恢复正常", Category: "immediate"},
		{Hours: 8, Title: "8小时", Desc: "血液中一氧化碳水平降低，氧气水平恢复正常", Category: "immediate"},
		{Hours: 24, Title: "24小时", Desc: "心脏病发作风险开始降低", Category: "immediate"},
		{Hours: 48, Title: "48小时", Desc: "味觉和嗅觉开始改善", Category: "short"},
		{Hours: 72, Title: "72小时", Desc: "呼吸变得更轻松，支气管开始放松", Category: "short"},
		{Hours: 168, Title: "1周", Desc: "肺活量开始增加，体力逐渐恢复", Category: "short"},
		{Hours: 336, Title: "2周", Desc: "血液循环明显改善，皮肤状态变好", Category: "medium"},
		{Hours: 720, Title: "1个月", Desc: "肺功能提升约30%，咳嗽减少", Category: "medium"},
		{Hours: 2160, Title: "3个月", Desc: "肺功能持续改善，运动耐力明显提升", Category: "medium"},
		{Hours: 4320, Title: "6个月", Desc: "呼吸问题显著减少，体能大幅提升", Category: "medium"},
		{Hours: 8760, Title: "1年", Desc: "冠心病风险降低50%", Category: "long"},
		{Hours: 17520, Title: "2年", Desc: "心脏病和中风风险接近非吸烟者", Category: "long"},
		{Hours: 43800, Title: "5年", Desc: "中风风险降至非吸烟者水平", Category: "long"},
		{Hours: 87600, Title: "10年", Desc: "肺癌风险降至吸烟者的一半", Category: "long"},
		{Hours: 175200, Title: "20年", Desc: "所有吸烟相关疾病风险接近非吸烟者", Category: "long"},
	}
}

func formatDuration(hours float64) string {
	if hours < 24 {
		return fmt.Sprintf("%.0f小时", hours)
	}
	days := hours / 24
	if days < 30 {
		return fmt.Sprintf("%.0f天", days)
	}
	months := days / 30
	if months < 12 {
		return fmt.Sprintf("%.0f个月", months)
	}
	years := months / 12
	return fmt.Sprintf("%.1f年", years)
}

func mathRound(val float64, places int) float64 {
	format := fmt.Sprintf("%%.%df", places)
	s := fmt.Sprintf(format, val)
	var result float64
	fmt.Sscanf(s, "%f", &result)
	return result
}
