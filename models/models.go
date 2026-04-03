package models

import (
	"time"

	"gorm.io/gorm"
)

type Broker string

const (
	IBKR           Broker = "IBKR"
	FreedomFinance Broker = "FreedomFinance"
)

type TransactionType string

const (
	Buy      TransactionType = "BUY"
	Sell     TransactionType = "SELL"
	Dividend TransactionType = "DIVIDEND"
	Tax      TransactionType = "TAX"
	Fee      TransactionType = "FEE"
)

type User struct {
	gorm.Model
	Email        string        `json:"email" gorm:"uniqueIndex"`
	Password     string        `json:"-"` // Hashed password, never return in JSON
	AuthProvider string        `json:"auth_provider"` // "local", "google", etc.
	AuthID       string        `json:"auth_id"`       // ID from OAuth provider
	Transactions []Transaction `json:"transactions" gorm:"foreignKey:UserID"`
}

type ExchangeRate struct {
	gorm.Model
	Currency string    `json:"currency" gorm:"index:idx_currency_date,unique"`
	Date     time.Time `json:"date" gorm:"index:idx_currency_date,unique"`
	Rate     float64   `json:"rate"`
}

type JobStatus string

const (
	JobPending    JobStatus = "PENDING"
	JobProcessing JobStatus = "PROCESSING"
	JobCompleted  JobStatus = "COMPLETED"
	JobFailed     JobStatus = "FAILED"
)

type UploadJob struct {
	gorm.Model
	UserID         uint      `json:"user_id" gorm:"index"`
	Status         JobStatus `json:"status"`
	FileName       string    `json:"file_name"`
	Broker         Broker    `json:"broker"`
	TotalCount     int       `json:"total_count"`
	ProcessedCount int       `json:"processed_count"`
	Error          string    `json:"error"`
}

type Transaction struct {
	gorm.Model
	UserID      uint            `json:"user_id" gorm:"index"`
	Broker      Broker          `json:"broker"`
	Symbol      string          `json:"symbol"`
	Type        TransactionType `json:"type"`
	Date        time.Time       `json:"date"`
	Quantity    float64         `json:"quantity"`
	Price       float64         `json:"price"`
	Currency    string          `json:"currency"`
	Commission  float64         `json:"commission"`
	Tax         float64         `json:"tax"`
	TotalAmount float64         `json:"total_amount"` // Final cash impact
	ExternalID  string          `json:"external_id" gorm:"uniqueIndex"` 
	NBURate     float64         `json:"nbu_rate"`     // Rate on transaction date
	AmountUAH   float64         `json:"amount_uah"`   // TotalAmount * NBURate
	Comment     string          `json:"comment"`
}

type Holding struct {
	Symbol          string    `json:"symbol"`
	Currency        string    `json:"currency"`
	AveragePrice    float64   `json:"average_price"`
	Quantity        float64   `json:"quantity"`
	TotalCost       float64   `json:"total_cost"`
	TotalCostUAH    float64   `json:"total_cost_uah"`
	RealizedProfit  float64   `json:"realized_profit"`
	RealizedProfitUAH float64 `json:"realized_profit_uah"`
	TotalDividends  float64   `json:"total_dividends"`
	TotalDividendsUAH float64 `json:"total_dividends_uah"`
	LastTradeDate   time.Time `json:"last_trade_date"`
}

type SellReport struct {
	Broker           Broker    `json:"broker"`
	Symbol           string    `json:"symbol"`
	Date             time.Time `json:"date"` // Sell Date
	BuyDate          time.Time `json:"buy_date"`
	Quantity         float64   `json:"quantity"`
	BuyPrice         float64   `json:"buy_price"`
	SellPrice        float64   `json:"sell_price"`
	CommissionBuy    float64   `json:"commission_buy"`
	CommissionSell   float64   `json:"commission_sell"`
	CommissionBuyUAH float64   `json:"commission_buy_uah"`
	CommissionSellUAH float64  `json:"commission_sell_uah"`
	Tax              float64   `json:"tax"`
	TaxUAH           float64   `json:"tax_uah"`
	Profit           float64   `json:"profit"`
	ProfitUAH        float64   `json:"profit_uah"`
	Currency         string    `json:"currency"`
	CurrencyRateBuy  float64   `json:"currency_rate_buy"`
	CurrencyRateSell float64   `json:"currency_rate_sell"`
	Comment          string    `json:"comment"`
}

type DividendReport struct {
	Broker       Broker    `json:"broker"`
	Symbol       string    `json:"symbol"`
	Date         time.Time `json:"date"`
	GrossAmount  float64   `json:"gross_amount"`
	GrossAmountUAH float64 `json:"gross_amount_uah"`
	Tax          float64   `json:"tax"`
	TaxUAH       float64   `json:"tax_uah"`
	NetAmount    float64   `json:"net_amount"`
	AmountUAH    float64   `json:"amount_uah"`
	Currency     string    `json:"currency"`
	CurrencyRate float64   `json:"currency_rate"`
}
