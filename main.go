package main

import (
	"fmt"
	"net/http"
	"stocks/db"
	"stocks/importer"
	"stocks/logic"
	"stocks/models"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	db.Init()

	r := gin.Default()

	// CORS for frontend development
	r.Use(cors.Default())

	r.POST("/api/upload", handleUpload)
	r.DELETE("/api/transactions", cleanupTransactions)
	r.GET("/api/holdings", getHoldings)
	r.GET("/api/transactions", getTransactions)
	r.GET("/api/summary", getSummary)

	r.Run(":8080")
}

func cleanupTransactions(c *gin.Context) {
	db.DB.Exec("DELETE FROM transactions")
	c.JSON(http.StatusOK, gin.H{"message": "Database cleared"})
}

func handleUpload(c *gin.Context) {
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

	var imp importer.Importer
	switch models.Broker(broker) {
	case models.IBKR:
		imp = &importer.IBKRImporter{}
	case models.FreedomFinance:
		imp = &importer.FreedomFinanceImporter{}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid broker"})
		return
	}

	txs, err := imp.Parse(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse file: " + err.Error()})
		return
	}

	// Save to DB
	for _, tx := range txs {
		rate, err := logic.GetNBURate(tx.Currency, tx.Date)
		if err != nil {
			fmt.Printf("NBU rate error for %s on %s: %v\n", tx.Currency, tx.Date, err)
			tx.NBURate = 0
		} else {
			tx.NBURate = rate
		}
		
		if tx.TotalAmount == 0 {
			tx.TotalAmount = (tx.Quantity * tx.Price) - tx.Commission
		}
		tx.AmountUAH = tx.TotalAmount * tx.NBURate

		if err := db.DB.FirstOrCreate(&tx, models.Transaction{ExternalID: tx.ExternalID}).Error; err != nil {
			fmt.Printf("DB error saving tx: %v\n", err)
			continue
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully uploaded and parsed", "count": len(txs)})
}

func getHoldings(c *gin.Context) {
	from, to := parseDates(c)
	var txs []models.Transaction
	db.DB.Order("date asc").Find(&txs)

	data := logic.GetPortfolioData(txs, from, to)
	c.JSON(http.StatusOK, data)
}

func getTransactions(c *gin.Context) {
	from, to := parseDates(c)
	var txs []models.Transaction
	query := db.DB.Order("date desc")
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
	from, to := parseDates(c)
	var txs []models.Transaction
	db.DB.Order("date asc").Find(&txs)

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
