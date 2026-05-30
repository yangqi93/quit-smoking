package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/yangqi93/quit-smoking/server/config"
	"github.com/yangqi93/quit-smoking/server/middleware"
	"github.com/yangqi93/quit-smoking/server/models"
)

var testCfg = &config.Config{
	JWTSecret: "test-jwt-secret-integration",
}

// setupTestRouter 创建测试路由和数据库
func setupTestRouter(t *testing.T) (*gin.Engine, func()) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		dsn = "root:@tcp(127.0.0.1:3306)/quit_smoking_test?charset=utf8mb4&parseTime=true&loc=Local"
	}
	if err := models.InitDB(dsn); err != nil {
		t.Fatalf("初始化测试数据库失败: %v", err)
	}

	r := gin.New()
	r.Use(middleware.CORSConfig())

	// 公开路由
	r.POST("/api/auth/login", LoginOrRegister(testCfg))

	// 鉴权路由
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware(testCfg.JWTSecret))
	{
		api.GET("/user/profile", GetProfile)
		api.POST("/quit-record", CreateQuitRecord)
		api.GET("/quit-record/active", GetActiveQuitRecord)
		api.GET("/dashboard", GetDashboard)
		api.GET("/health/timeline", GetHealthTimeline)
		api.POST("/check-in", CheckIn)
		api.GET("/check-in/history", GetCheckInHistory)
		api.POST("/craving", CreateCraving)
	}

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong", "service": "quit-smoking-api"})
	})

	cleanup := func() {
		models.DB.Exec("DELETE FROM cravings")
		models.DB.Exec("DELETE FROM check_ins")
		models.DB.Exec("DELETE FROM quit_records")
		models.DB.Exec("DELETE FROM users")
		models.CloseDB()
	}

	return r, cleanup
}

const testOpenID = "test_user_001"

// makeAuthenticatedRequest 创建带 JWT 认证头的请求
func makeAuthenticatedRequest(method, url string, body interface{}) *http.Request {
	var reqBody *bytes.Reader
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewReader(jsonBody)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}

	// 生成 JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"open_id": testOpenID,
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(1 * time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString([]byte(testCfg.JWTSecret))

	req := httptest.NewRequest(method, url, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	return req
}

// createTestUser 创建测试用户
func createTestUser(t *testing.T) {
	t.Helper()
	_, err := models.DB.Exec("INSERT IGNORE INTO users (open_id, nickname) VALUES (?, ?)", testOpenID, "测试用户")
	if err != nil {
		t.Fatalf("创建测试用户失败: %v", err)
	}
}

// createTestQuitRecord 创建测试戒烟记录
func createTestQuitRecord(t *testing.T) {
	t.Helper()
	createTestUser(t)
	var userID int64
	err := models.DB.QueryRow("SELECT id FROM users WHERE open_id = ?", testOpenID).Scan(&userID)
	if err != nil {
		t.Fatalf("查询用户失败: %v", err)
	}
	_, err = models.DB.Exec(
		`INSERT INTO quit_records (user_id, quit_date, cigarettes_per_day, price_per_pack, cigarettes_per_pack, years_smoked, is_active)
		 VALUES (?, DATE_SUB(NOW(), INTERVAL 7 DAY), 20, 25.0, 20, 5.0, 1)`,
		userID,
	)
	if err != nil {
		t.Fatalf("创建测试戒烟记录失败: %v", err)
	}
}

// ================== API Handler 集成测试 ==================

func TestPing(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/ping", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["message"] != "pong" {
		t.Errorf("期望 message=pong，实际 %v", response["message"])
	}
}

func TestLoginOrRegister_NewUser(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()

	body := map[string]string{
		"open_id":    "new_user_123",
		"nickname":   "新用户",
		"avatar_url": "http://avatar.jpg",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("期望状态码 %d（缺少 code 字段），实际 %d，响应: %s", http.StatusBadRequest, w.Code, w.Body.String())
	}
}

func TestLoginOrRegister_MissingOpenID(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()

	body := map[string]string{
		"nickname": "无ID用户",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusBadRequest, w.Code)
	}
}

func TestAuthMiddleware_MissingHeader(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/user/profile", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusUnauthorized, w.Code)
	}
}

func TestGetProfile(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	req := makeAuthenticatedRequest("GET", "/api/user/profile", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	user, ok := response["user"].(map[string]interface{})
	if !ok {
		t.Fatal("响应中缺少 user 字段")
	}
	if user["open_id"] != testOpenID {
		t.Errorf("期望 open_id=%s，实际 %v", testOpenID, user["open_id"])
	}
}

func TestCreateQuitRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	body := map[string]interface{}{
		"quit_date":           "2025-07-01T00:00:00Z",
		"cigarettes_per_day":  20,
		"price_per_pack":      25.0,
		"cigarettes_per_pack": 20,
		"years_smoked":        5.0,
		"reason":              "为了健康",
	}

	req := makeAuthenticatedRequest("POST", "/api/quit-record", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusCreated, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["id"] == nil {
		t.Error("期望返回记录 id")
	}
	if response["message"] == nil {
		t.Error("期望返回 message")
	}
}

func TestCreateQuitRecord_DefaultValues(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	body := map[string]interface{}{
		"quit_date": "2025-07-01T00:00:00Z",
	}

	req := makeAuthenticatedRequest("POST", "/api/quit-record", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusCreated, w.Code, w.Body.String())
	}
}

func TestCreateQuitRecord_MissingQuitDate(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	body := map[string]interface{}{
		"cigarettes_per_day": 20,
	}

	req := makeAuthenticatedRequest("POST", "/api/quit-record", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusBadRequest, w.Code)
	}
}

func TestGetActiveQuitRecord_NoRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	req := makeAuthenticatedRequest("GET", "/api/quit-record/active", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["is_active"] != false {
		t.Errorf("期望 is_active=false，实际 %v", response["is_active"])
	}
}

func TestGetActiveQuitRecord_WithRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	req := makeAuthenticatedRequest("GET", "/api/quit-record/active", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["is_active"] != true {
		t.Errorf("期望 is_active=true，实际 %v", response["is_active"])
	}
	record, ok := response["record"].(map[string]interface{})
	if !ok {
		t.Fatal("响应中缺少 record 字段")
	}
	if record["cigarettes_per_day"] != float64(20) {
		t.Errorf("期望 cigarettes_per_day=20，实际 %v", record["cigarettes_per_day"])
	}
}

func TestGetDashboard_NoRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	req := makeAuthenticatedRequest("GET", "/api/dashboard", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	dashboard, ok := response["dashboard"].(map[string]interface{})
	if !ok {
		t.Fatal("响应中缺少 dashboard 字段")
	}
	if dashboard["is_active"] != false {
		t.Errorf("期望 is_active=false，实际 %v", dashboard["is_active"])
	}
}

func TestGetDashboard_WithRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	req := makeAuthenticatedRequest("GET", "/api/dashboard", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	dashboard, ok := response["dashboard"].(map[string]interface{})
	if !ok {
		t.Fatal("响应中缺少 dashboard 字段")
	}
	if dashboard["is_active"] != true {
		t.Errorf("期望 is_active=true，实际 %v", dashboard["is_active"])
	}
	if dashboard["days_quit"] == nil {
		t.Error("期望有 days_quit 字段")
	}
	if dashboard["money_saved"] == nil {
		t.Error("期望有 money_saved 字段")
	}
	if dashboard["cigarettes_avoided"] == nil {
		t.Error("期望有 cigarettes_avoided 字段")
	}
}

func TestGetHealthTimeline_NoRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	req := makeAuthenticatedRequest("GET", "/api/health/timeline", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["is_active"] != false {
		t.Errorf("期望 is_active=false，实际 %v", response["is_active"])
	}
}

func TestGetHealthTimeline_WithRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	req := makeAuthenticatedRequest("GET", "/api/health/timeline", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["is_active"] != true {
		t.Errorf("期望 is_active=true，实际 %v", response["is_active"])
	}
	timeline, ok := response["timeline"].(map[string]interface{})
	if !ok {
		t.Fatal("响应中缺少 timeline 字段")
	}
	milestones, ok := timeline["milestones"].([]interface{})
	if !ok {
		t.Fatal("响应中缺少 milestones 字段")
	}
	if len(milestones) == 0 {
		t.Error("期望至少有1个里程碑")
	}
}

func TestCheckIn(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	body := map[string]interface{}{
		"date":       "2025-07-15",
		"is_success": true,
		"mood":       "good",
		"note":       "坚持！",
	}

	req := makeAuthenticatedRequest("POST", "/api/check-in", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusOK, w.Code, w.Body.String())
	}
}

func TestCheckIn_NoActiveRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	body := map[string]interface{}{
		"date": "2025-07-15",
	}

	req := makeAuthenticatedRequest("POST", "/api/check-in", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusBadRequest, w.Code)
	}
}

func TestGetCheckInHistory(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	req := makeAuthenticatedRequest("GET", "/api/check-in/history?month=2025-07", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["month"] != "2025-07" {
		t.Errorf("期望 month=2025-07，实际 %v", response["month"])
	}
}

func TestCreateCraving(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	body := map[string]interface{}{
		"trigger":   "stress",
		"intensity": 8,
		"method":    "breathe",
	}

	req := makeAuthenticatedRequest("POST", "/api/craving", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusCreated, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	if response["id"] == nil {
		t.Error("期望返回记录 id")
	}
}

func TestCreateCraving_NoActiveRecord(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestUser(t)

	body := map[string]interface{}{
		"trigger":   "stress",
		"intensity": 5,
	}

	req := makeAuthenticatedRequest("POST", "/api/craving", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusBadRequest, w.Code)
	}
}

func TestCreateCraving_IntensityClamp(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	body := map[string]interface{}{
		"trigger":   "boredom",
		"intensity": 15,
		"method":    "walk",
	}

	req := makeAuthenticatedRequest("POST", "/api/craving", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("期望状态码 %d，实际 %d，响应: %s", http.StatusCreated, w.Code, w.Body.String())
	}

	var intensity int
	models.DB.QueryRow("SELECT intensity FROM cravings ORDER BY id DESC LIMIT 1").Scan(&intensity)
	if intensity != 10 {
		t.Errorf("期望 intensity=10，实际 %d", intensity)
	}
}

func TestCreateQuitRecord_UserNotFound(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()

	body := map[string]interface{}{
		"quit_date": "2025-07-01T00:00:00Z",
	}

	req := makeAuthenticatedRequest("POST", "/api/quit-record", body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("期望状态码 %d，实际 %d", http.StatusNotFound, w.Code)
	}
}

func TestDashboardCalculation(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	req := makeAuthenticatedRequest("GET", "/api/dashboard", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	dashboard := response["dashboard"].(map[string]interface{})

	daysQuit := dashboard["days_quit"].(float64)
	if daysQuit < 6 || daysQuit > 8 {
		t.Errorf("期望戒烟天数约7天，实际 %.0f", daysQuit)
	}

	moneySaved := dashboard["money_saved"].(float64)
	expectedMoney := 25.0 / 20.0 * 20 * daysQuit
	if moneySaved < expectedMoney-5 || moneySaved > expectedMoney+5 {
		t.Errorf("期望节省金额约 %.2f，实际 %.2f", expectedMoney, moneySaved)
	}

	cigAvoided := dashboard["cigarettes_avoided"].(float64)
	expectedCig := 20 * daysQuit
	if cigAvoided != expectedCig {
		t.Errorf("期望少抽 %.0f 支，实际 %.0f", expectedCig, cigAvoided)
	}
}

func TestAPIDataStructures(t *testing.T) {
	r, cleanup := setupTestRouter(t)
	defer cleanup()
	createTestQuitRecord(t)

	req := makeAuthenticatedRequest("GET", "/api/dashboard", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	dashboard := response["dashboard"].(map[string]interface{})

	expectedFields := []string{
		"days_quit", "hours_quit", "minutes_quit",
		"cigarettes_avoided", "money_saved", "life_regained",
		"is_active", "next_milestone", "milestone_days",
	}
	for _, field := range expectedFields {
		if _, ok := dashboard[field]; !ok {
			t.Errorf("dashboard 缺少字段: %s", field)
		}
	}
}
