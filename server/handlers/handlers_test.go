package handlers

import (
	"testing"
)

// ================== 纯逻辑单元测试（不需要 CGO/SQLite） ==================

func TestGetNextMilestone(t *testing.T) {
	tests := []struct {
		daysQuit         int
		expectedTitle    string
		expectedDaysLeft int
	}{
		{0, "第1天", 1},
		{1, "第3天", 2},
		{6, "一周", 1},
		{7, "两周", 7},
		{30, "三个月", 60},
		{4000, "传奇", 0},
	}

	for _, tt := range tests {
		title, daysLeft := getNextMilestone(tt.daysQuit)
		if title != tt.expectedTitle {
			t.Errorf("daysQuit=%d: 期望 title=%s, 实际 %s", tt.daysQuit, tt.expectedTitle, title)
		}
		if daysLeft != tt.expectedDaysLeft {
			t.Errorf("daysQuit=%d: 期望 daysLeft=%d, 实际 %d", tt.daysQuit, tt.expectedDaysLeft, daysLeft)
		}
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		hours    float64
		expected string
	}{
		{0, "0小时"},
		{8, "8小时"},
		{23, "23小时"},
		{24, "1天"},
		{72, "3天"},
		{744, "1个月"},     // 31天 => 31/30 ≈ 1.03 => round 1
		{8760, "1.0年"},   // 365天 => 12.17月 => 1.0年
	}

	for _, tt := range tests {
		result := formatDuration(tt.hours)
		if result != tt.expected {
			t.Errorf("hours=%.0f: 期望 %s, 实际 %s", tt.hours, tt.expected, result)
		}
	}
}

func TestMathRound(t *testing.T) {
	if mathRound(3.456, 2) != 3.46 {
		t.Errorf("mathRound(3.456, 2) = %f, 期望 3.46", mathRound(3.456, 2))
	}
	if mathRound(3.454, 2) != 3.45 {
		t.Errorf("mathRound(3.454, 2) = %f, 期望 3.45", mathRound(3.454, 2))
	}
	if mathRound(3.45, 1) != 3.5 {
		t.Errorf("mathRound(3.45, 1) = %f, 期望 3.5", mathRound(3.45, 1))
	}
	if mathRound(0.0, 2) != 0.0 {
		t.Errorf("mathRound(0.0, 2) = %f, 期望 0.0", mathRound(0.0, 2))
	}
}

func TestGetWHOMilestones(t *testing.T) {
	milestones := getWHOMilestones()

	if len(milestones) < 10 {
		t.Errorf("WHO 里程碑数量太少: %d，期望至少 10", len(milestones))
	}

	// 验证第一个里程碑
	if milestones[0].Hours != 0 || milestones[0].Title != "开始戒烟" {
		t.Errorf("第一个里程碑应该是'开始戒烟'(0小时)，实际: %s(%d小时)", milestones[0].Title, milestones[0].Hours)
	}

	// 验证按小时升序排列
	for i := 1; i < len(milestones); i++ {
		if milestones[i].Hours <= milestones[i-1].Hours {
			t.Errorf("里程碑未按升序: milestones[%d].Hours=%d <= milestones[%d].Hours=%d",
				i, milestones[i].Hours, i-1, milestones[i-1].Hours)
		}
	}

	// 验证分类合法
	validCategories := map[string]bool{"immediate": true, "short": true, "medium": true, "long": true}
	for _, m := range milestones {
		if !validCategories[m.Category] {
			t.Errorf("非法 category: %s", m.Category)
		}
	}
}

func TestMilestoneList(t *testing.T) {
	// 验证里程碑列表完整性
	expectedDays := []int{1, 3, 7, 14, 30, 90, 180, 365, 730, 1825, 3650}
	if len(milestoneList) != len(expectedDays) {
		t.Errorf("里程碑数量: %d，期望 %d", len(milestoneList), len(expectedDays))
		return
	}
	for i, expected := range expectedDays {
		if milestoneList[i].Days != expected {
			t.Errorf("milestoneList[%d].Days = %d, 期望 %d", i, milestoneList[i].Days, expected)
		}
	}
}
