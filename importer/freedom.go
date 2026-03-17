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
}

type F24CorporateAction struct {
	Date      string      `json:"date"`
	TypeID    string      `json:"type_id"`
	Ticker    string      `json:"ticker"`
	Amount    interface{} `json:"amount"`
	Currency  string      `json:"currency"`
	TaxAmount interface{} `json:"tax_amount"`
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

		transactions = append(transactions, models.Transaction{
			Broker:     models.FreedomFinance,
			Symbol:     raw.Symbol,
			Type:       txType,
			Date:       date,
			Quantity:   qty,
			Price:      price,
			Currency:   raw.Currency,
			Commission: commission,
			ExternalID: fmt.Sprintf("F24-TR-%d", raw.TradeID),
		})
	}

	// Parse Dividends
	for _, raw := range report.CorporateActions.Detailed {
		if raw.TypeID != "dividend" {
			continue
		}

		amount := f.toFloat(raw.Amount)
		tax := f.toFloat(raw.TaxAmount)
		date, _ := time.Parse("2006-01-02", raw.Date)

		// Dividend Transaction
		transactions = append(transactions, models.Transaction{
			Broker:      models.FreedomFinance,
			Symbol:      raw.Ticker,
			Type:        models.Dividend,
			Date:        date,
			TotalAmount: amount,
			Currency:    raw.Currency,
			ExternalID:  fmt.Sprintf("F24-DIV-%s-%s-%f", raw.Ticker, raw.Date, amount),
		})

		// Tax Transaction (if any)
		if tax != 0 {
			transactions = append(transactions, models.Transaction{
				Broker:      models.FreedomFinance,
				Symbol:      raw.Ticker,
				Type:        models.Tax,
				Date:        date,
				TotalAmount: tax, 
				Currency:    raw.Currency,
				ExternalID:  fmt.Sprintf("F24-TAX-%s-%s-%f", raw.Ticker, raw.Date, tax),
			})
		}
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
