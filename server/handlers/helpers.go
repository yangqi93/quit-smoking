package handlers

import (
	"fmt"

	"github.com/yangqi93/quit-smoking/server/models"
)

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
