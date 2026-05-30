package models

import "time"

// User 用户模型
type User struct {
	ID        int64     `json:"id"`
	OpenID    string    `json:"open_id"`              // 微信 OpenID
	Nickname  string    `json:"nickname"`              // 昵称
	AvatarURL string    `json:"avatar_url"`            // 头像
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

// QuitRecord 戒烟记录
type QuitRecord struct {
	ID               int64      `json:"id"`
	UserID           int64      `json:"user_id"`
	QuitDate         time.Time  `json:"quit_date"`           // 开始戒烟时间
	CigarettesPerDay  int       `json:"cigarettes_per_day"`  // 每天抽烟数
	PricePerPack     float64    `json:"price_per_pack"`      // 每包价格
	CigarettesPerPack int       `json:"cigarettes_per_pack"` // 每包支数
	YearsSmoked      float64    `json:"years_smoked"`        // 烟龄（年）
	Reason           string     `json:"reason"`              // 戒烟理由
	IsActive         bool       `json:"is_active"`           // 是否正在戒烟
	CreatedAt        *time.Time `json:"created_at"`
	UpdatedAt        *time.Time `json:"updated_at"`
}

// CheckIn 打卡记录
type CheckIn struct {
	ID        int64      `json:"id"`
	UserID    int64      `json:"user_id"`
	RecordID  int64      `json:"record_id"`
	Date      string     `json:"date"`       // YYYY-MM-DD
	IsSuccess bool       `json:"is_success"` // 是否成功
	Mood      string     `json:"mood"`       // 心情: good/normal/bad
	Note      string     `json:"note"`       // 备注
	CreatedAt *time.Time `json:"created_at"`
}

// Craving 烟瘾发作记录
type Craving struct {
	ID        int64      `json:"id"`
	UserID    int64      `json:"user_id"`
	RecordID  int64      `json:"record_id"`
	Trigger   string     `json:"trigger"`   // 触发场景: stress/social/boredom/habit/other
	Intensity int        `json:"intensity"` // 强度 1-10
	Resolved  bool       `json:"resolved"`  // 是否已克服
	Method    string     `json:"method"`    // 克服方式: breathe/water/walk/other
	CreatedAt *time.Time `json:"created_at"`
}

// DashboardData 首页仪表盘数据
type DashboardData struct {
	DaysQuit        int     `json:"days_quit"`
	HoursQuit       int     `json:"hours_quit"`
	MinutesQuit     int     `json:"minutes_quit"`
	CigarettesAvoid int     `json:"cigarettes_avoided"`
	MoneySaved      float64 `json:"money_saved"`
	LifeRegained    float64 `json:"life_regained"` // 重获生命时长（小时）
	IsActive        bool    `json:"is_active"`
	NextMilestone   string  `json:"next_milestone"`
	MilestoneDays   int     `json:"milestone_days"`
}

// HealthMilestone 健康里程碑
type HealthMilestone struct {
	Hours    int    `json:"hours"`
	Title    string `json:"title"`
	Desc     string `json:"desc"`
	Category string `json:"category"` // immediate/short/medium/long
}

// HealthTimeline 健康恢复时间线响应
type HealthTimeline struct {
	QuitDate      string             `json:"quit_date"`
	HoursElapsed  float64            `json:"hours_elapsed"`
	Milestones    []HealthMilestoneStatus `json:"milestones"`
}

// HealthMilestoneStatus 带状态的健康里程碑
type HealthMilestoneStatus struct {
	Hours     int    `json:"hours"`
	Title     string `json:"title"`
	Desc      string `json:"desc"`
	Category  string `json:"category"`
	Achieved  bool   `json:"achieved"`
	TimeLeft  string `json:"time_left,omitempty"` // 距离达成还有多久
}
