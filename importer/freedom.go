package importer

import (
	"encoding/json"
	"fmt"
	"io"
	"stocks/models"
	"strconv"
	"time"
)

type FreedomFinanceImporter struct{}

type F24JSONReport struct {
	Trades struct {
		Detailed []F24Trade `json:"detailed"`
	} `json:"trades"`
	CorporateActions struct {
		Detailed []F24CorporateAction `json:"detailed"`
	} `json:"corporate_actions"`
}

type F24Trade struct {
	TradeID    int64       `json:"trade_id"`
	Date       string      `json:"date"`
	Symbol     string      `json:"instr_nm"`
	Operation  string      `json:"operation"`
	Price      interface{} `json:"p"`
	Quantity   interface{} `json:"q"`
	Commission interface{} `json:"commission"`
	Currency   string      `json:"curr_c"`
	Comment    string      `json:"comment"`
}

type F24CorporateAction struct {
	Date        string      `json:"date"`
	TypeID      string      `json:"type_id"`
	Ticker      string      `json:"ticker"`
	Amount      interface{} `json:"amount"`
	Currency    string      `json:"currency"`
	TaxAmount   interface{} `json:"tax_amount"`
	ExternalTax interface{} `json:"external_tax"`
	Comment     string      `json:"comment"`
}

func (f *FreedomFinanceImporter) Parse(reader io.Reader) ([]models.Transaction, error) {
	var report F24JSONReport
	
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("JSON unmarshal error: %v", err)
	}

	var transactions []models.Transaction

	// Parse Trades
	for _, raw := range report.Trades.Detailed {
		txType := models.Buy
		if raw.Operation == "sell" {
			txType = models.Sell
		}

		qty := f.toFloat(raw.Quantity)
		price := f.toFloat(raw.Price)
		commission := f.toFloat(raw.Commission)

		date, _ := time.Parse("2006-01-02 15:04:05", raw.Date)
		symbol := normalizeTicker(raw.Symbol)

		transactions = append(transactions, models.Transaction{
			Broker:     models.FreedomFinance,
			Symbol:     symbol,
			Type:       txType,
			Date:       date,
			Quantity:   qty,
			Price:      price,
			Currency:   raw.Currency,
			Commission: commission,
			ExternalID: fmt.Sprintf("F24-TR-%d", raw.TradeID),
			Comment:    raw.Comment,
		})
	}

	// Parse Dividends
	for _, raw := range report.CorporateActions.Detailed {
		if raw.TypeID != "dividend" {
			continue
		}

		amount := f.toFloat(raw.Amount)
		// Check both tax fields. Freedom24 uses different ones depending on the region/asset.
		tax := f.toFloat(raw.TaxAmount)
		if tax == 0 {
			tax = f.toFloat(raw.ExternalTax)
		}
		
		// Ensure tax is absolute positive for standardized processing
		if tax < 0 {
			tax = -tax
		}
		
		date, _ := time.Parse("2006-01-02", raw.Date)
		symbol := normalizeTicker(raw.Ticker)

		// Dividend Transaction
		transactions = append(transactions, models.Transaction{
			Broker:      models.FreedomFinance,
			Symbol:      symbol,
			Type:        models.Dividend,
			Date:        date,
			TotalAmount: amount,
			Tax:         tax, // Standardized positive tax
			Currency:    raw.Currency,
			ExternalID:  fmt.Sprintf("F24-DIV-%s-%s-%f", symbol, raw.Date, amount),
			Comment:     raw.Comment,
		})
	}

	fmt.Printf("Freedom Finance Import: Parsed %d transactions\n", len(transactions))
	return transactions, nil
}

func (f *FreedomFinanceImporter) toFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case string:
		if val == "-" || val == "" {
			return 0
		}
		f, _ := strconv.ParseFloat(val, 64)
		return f
	default:
		return 0
	}
}
