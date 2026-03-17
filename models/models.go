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

type Transaction struct {
	gorm.Model
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
	Symbol           string    `json:"symbol"`
	Date             time.Time `json:"date"`
	Quantity         float64   `json:"quantity"`
	BuyPrice         float64   `json:"buy_price"`
	SellPrice        float64   `json:"sell_price"`
	Commission       float64   `json:"commission"`
	Profit           float64   `json:"profit"`
	ProfitUAH        float64   `json:"profit_uah"`
	Currency         string    `json:"currency"`
	CurrencyRateBuy  float64   `json:"currency_rate_buy"`
	CurrencyRateSell float64   `json:"currency_rate_sell"`
}

type DividendReport struct {
	Symbol       string    `json:"symbol"`
	Date         time.Time `json:"date"`
	GrossAmount  float64   `json:"gross_amount"`
	Tax          float64   `json:"tax"`
	NetAmount    float64   `json:"net_amount"`
	AmountUAH    float64   `json:"amount_uah"`
	Currency     string    `json:"currency"`
	CurrencyRate float64   `json:"currency_rate"`
}
