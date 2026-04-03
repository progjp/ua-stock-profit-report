package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"stocks/auth"
	"stocks/db"
	"stocks/importer"
	"stocks/logic"
	"stocks/models"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/facebook"
	"github.com/markbates/goth/providers/google"
	"gorm.io/gorm"
	"github.com/gorilla/sessions"
	"io"
)

func init() {
	// Load .env file
	_ = godotenv.Load()

	// Setup gothic session store
	key := os.Getenv("SESSION_SECRET")
	if key == "" {
		key = "default-session-secret-change-me"
	}
	gothic.Store = sessions.NewCookieStore([]byte(key))

	goth.UseProviders(
		google.New(os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("GOOGLE_CLIENT_SECRET"), "http://localhost:8080/api/auth/google/callback"),
		facebook.New(os.Getenv("FACEBOOK_CLIENT_ID"), os.Getenv("FACEBOOK_CLIENT_SECRET"), "http://localhost:8080/api/auth/facebook/callback"),
	)
}

func main() {
	db.Init()

	// Command line flags
	syncFlag := flag.Bool("sync-rates", false, "Sync NBU rates for a period")
	fromFlag := flag.String("from", "", "Start date (YYYY-MM-DD)")
	toFlag := flag.String("to", "", "End date (YYYY-MM-DD)")
	flag.Parse()

	if *syncFlag {
		if *fromFlag == "" {
			fmt.Println("Usage: ./stocks -sync-rates -from 2023-01-01 [-to 2026-03-31]")
			return
		}
		from, err := time.Parse("2006-01-02", *fromFlag)
		if err != nil {
			fmt.Printf("Invalid from date: %v\n", err)
			return
		}

		var to time.Time
		if *toFlag == "" {
			to = time.Now()
			fmt.Printf("No end date provided, defaulting to today: %s\n", to.Format("2006-01-02"))
		} else {
			to, err = time.Parse("2006-01-02", *toFlag)
			if err != nil {
				fmt.Printf("Invalid to date: %v\n", err)
				return
			}
		}

		fmt.Printf("Starting manual sync from %s to %s...\n", from.Format("2006-01-02"), to.Format("2006-01-02"))
		err = logic.SyncRatesForPeriod(from, to)
		if err != nil {
			fmt.Printf("Sync failed: %v\n", err)
		} else {
			fmt.Println("Sync finished successfully")
		}
		return
	}

	r := gin.Default()

	// CORS for frontend development
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = append(config.AllowHeaders, "Authorization")
	r.Use(cors.New(config))

	// Auth routes
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", handleRegister)
		authGroup.POST("/login", handleLogin)
		authGroup.GET("/:provider", handleOAuthLogin)
		authGroup.GET("/:provider/callback", handleOAuthCallback)
	}

	// Public routes
	r.GET("/api/rates", getRates)

	// Protected routes
	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.POST("/upload", handleUpload)
		api.GET("/jobs", getJobs)
		api.DELETE("/transactions", cleanupTransactions)
		api.GET("/holdings", getHoldings)
		api.GET("/transactions", getTransactions)
		api.GET("/summary", getSummary)
	}
	r.Run(":8080")
}

func getRates(c *gin.Context) {
	from, to := parseDates(c)
	currencies := c.QueryArray("currency")
	if len(currencies) == 0 {
		currencies = []string{"USD", "EUR"}
	}

	var rates []models.ExchangeRate
	query := db.DB.Where("currency IN ?", currencies).Order("date asc")
	if from != nil {
		query = query.Where("date >= ?", *from)
	}
	if to != nil {
		query = query.Where("date <= ?", *to)
	}
	query.Find(&rates)

	c.JSON(http.StatusOK, rates)
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer <token>"})
			c.Abort()
			return
		}

		claims, err := auth.ValidateToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token: " + err.Error()})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Next()
	}
}

func handleRegister(c *gin.Context) {
	var body struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := auth.HashPassword(body.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Email:        body.Email,
		Password:     hashedPassword,
		AuthProvider: "local",
	}

	if err := db.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "email": user.Email})
}

func handleLogin(c *gin.Context) {
	var body struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", body.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !auth.CheckPasswordHash(body.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "email": user.Email})
}

func handleOAuthLogin(c *gin.Context) {
	provider := c.Param("provider")
	q := c.Request.URL.Query()
	q.Add("provider", provider)
	c.Request.URL.RawQuery = q.Encode()
	
	// Start OAuth process
	gothic.BeginAuthHandler(c.Writer, c.Request)
}

func handleOAuthCallback(c *gin.Context) {
	provider := c.Param("provider")
	q := c.Request.URL.Query()
	q.Add("provider", provider)
	c.Request.URL.RawQuery = q.Encode()

	gothUser, err := gothic.CompleteUserAuth(c.Writer, c.Request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth failed: " + err.Error()})
		return
	}

	// Find or create user
	var user models.User
	if err := db.DB.Where("email = ?", gothUser.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			user = models.User{
				Email:        gothUser.Email,
				AuthProvider: provider,
				AuthID:       gothUser.UserID,
			}
			db.DB.Create(&user)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error: " + err.Error()})
			return
		}
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Redirect back to frontend with token
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}
	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/login?token=%s&email=%s", frontendURL, token, user.Email))
}

func cleanupTransactions(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	db.DB.Where("user_id = ?", userID).Delete(&models.Transaction{})
	c.JSON(http.StatusOK, gin.H{"message": "Database cleared"})
}

func getJobs(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	var jobs []models.UploadJob
	db.DB.Where("user_id = ?", userID).Order("created_at desc").Limit(5).Find(&jobs)
	c.JSON(http.StatusOK, jobs)
}

func handleUpload(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	broker := c.PostForm("broker")
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not open file"})
		return
	}
	defer f.Close()

	// Read file into memory so we can process it in background
	fileBytes, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not read file"})
		return
	}

	// Create Job
	job := models.UploadJob{
		UserID:   userID,
		Status:   models.JobPending,
		FileName: file.Filename,
		Broker:   models.Broker(broker),
	}
	db.DB.Create(&job)

	// Start background processing
	go processUpload(job.ID, fileBytes)

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Upload started in background",
		"job_id":  job.ID,
	})
}

func processUpload(jobID uint, fileBytes []byte) {
	var job models.UploadJob
	db.DB.First(&job, jobID)

	updateStatus := func(status models.JobStatus, errMsg string) {
		job.Status = status
		job.Error = errMsg
		db.DB.Save(&job)
	}

	updateProgress := func(processed, total int) {
		job.ProcessedCount = processed
		job.TotalCount = total
		db.DB.Save(&job)
	}

	updateStatus(models.JobProcessing, "")

	var imp importer.Importer
	switch job.Broker {
	case models.IBKR:
		imp = &importer.IBKRImporter{}
	case models.FreedomFinance:
		imp = &importer.FreedomFinanceImporter{}
	default:
		updateStatus(models.JobFailed, "Invalid broker")
		return
	}

	// Parse expects io.Reader
	txs, err := imp.Parse(strings.NewReader(string(fileBytes)))
	if err != nil {
		updateStatus(models.JobFailed, "Failed to parse file: "+err.Error())
		return
	}

	total := len(txs)
	updateProgress(0, total)

	// Save to DB
	for i := range txs {
		tx := &txs[i]
		tx.UserID = job.UserID
		
		rate, err := logic.GetNBURate(tx.Currency, tx.Date)
		if err != nil {
			fmt.Printf("NBU rate error for %s on %s: %v\n", tx.Currency, tx.Date, err)
			tx.NBURate = 0
		} else {
			tx.NBURate = rate
		}
		
		if tx.TotalAmount == 0 {
			if tx.Type == models.Sell {
				tx.TotalAmount = (tx.Quantity * tx.Price) - tx.Commission - tx.Tax
			} else {
				tx.TotalAmount = (tx.Quantity * tx.Price) + tx.Commission + tx.Tax
			}
		}
		tx.AmountUAH = tx.TotalAmount * tx.NBURate

		if err := db.DB.Where(models.Transaction{UserID: job.UserID, ExternalID: tx.ExternalID}).FirstOrCreate(tx).Error; err != nil {
			fmt.Printf("DB error saving tx: %v\n", err)
		}

		updateProgress(i+1, total)
	}

	updateStatus(models.JobCompleted, "")
}

func getHoldings(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	from, to := parseDates(c)
	var txs []models.Transaction
	db.DB.Where("user_id = ?", userID).Order("date asc").Find(&txs)

	data := logic.GetPortfolioData(txs, from, to)
	c.JSON(http.StatusOK, data)
}

func getTransactions(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	from, to := parseDates(c)
	var txs []models.Transaction
	query := db.DB.Where("user_id = ?", userID).Order("date desc")
	if from != nil {
		query = query.Where("date >= ?", *from)
	}
	if to != nil {
		query = query.Where("date <= ?", *to)
	}
	query.Find(&txs)
	c.JSON(http.StatusOK, txs)
}

func getSummary(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	from, to := parseDates(c)
	var txs []models.Transaction
	db.DB.Where("user_id = ?", userID).Order("date asc").Find(&txs)

	data := logic.GetPortfolioData(txs, from, to)
	
	totalRealizedProfit := 0.0
	totalRealizedProfitUAH := 0.0
	totalDividends := 0.0
	totalDividendsUAH := 0.0
	totalCostBasis := 0.0
	totalCostBasisUAH := 0.0

	for _, h := range data.Holdings {
		totalRealizedProfit += h.RealizedProfit
		totalRealizedProfitUAH += h.RealizedProfitUAH
		totalDividends += h.TotalDividends
		totalDividendsUAH += h.TotalDividendsUAH
		totalCostBasis += h.TotalCost
		totalCostBasisUAH += h.TotalCostUAH
	}

	c.JSON(http.StatusOK, gin.H{
		"total_realized_profit":     totalRealizedProfit,
		"total_realized_profit_uah": totalRealizedProfitUAH,
		"total_dividends":           totalDividends,
		"total_dividends_uah":       totalDividendsUAH,
		"total_cost_basis":          totalCostBasis,
		"total_cost_basis_uah":      totalCostBasisUAH,
	})
}

func parseDates(c *gin.Context) (*time.Time, *time.Time) {
	fromStr := c.Query("from")
	toStr := c.Query("to")

	var from, to *time.Time

	if fromStr != "" {
		t, err := time.Parse("2006-01-02", fromStr)
		if err == nil {
			from = &t
		}
	}
	if toStr != "" {
		t, err := time.Parse("2006-01-02", toStr)
		if err == nil {
			// Set to end of day
			t = t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			to = &t
		}
	}

	return from, to
}
