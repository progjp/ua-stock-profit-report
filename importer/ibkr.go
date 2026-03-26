package importer

import (
	"encoding/csv"
	"fmt"
	"io"
	"stocks/models"
	"strconv"
	"strings"
	"time"
)

type IBKRImporter struct{}

func (i *IBKRImporter) Parse(reader io.Reader) ([]models.Transaction, error) {
	r := csv.NewReader(reader)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return nil, err
	}

	var transactions []models.Transaction
	var currentHeader []string
	var mode string // "trades", "dividends", "taxes"

	for _, record := range records {
		if len(record) < 5 {
			continue
		}

		// Detect Header
		if record[0] == "ClientAccountID" {
			currentHeader = record
			mode = ""
			for _, col := range record {
				if col == "TradePrice" {
					mode = "trades"
					break
				}
				if col == "GrossAmount" {
					mode = "dividends"
					break
				}
				if col == "TaxType" {
					mode = "taxes"
					break
				}
			}
			continue
		}

		if currentHeader == nil || mode == "" {
			continue
		}

		switch mode {
		case "trades":
			tx, err := i.parseTradeRow(currentHeader, record)
			if err == nil {
				transactions = append(transactions, tx)
			}
		case "dividends":
			tx, err := i.parseDividendRow(currentHeader, record)
			if err == nil {
				transactions = append(transactions, tx)
			}
		case "taxes":
			tx, err := i.parseTaxRow(currentHeader, record)
			if err == nil {
				transactions = append(transactions, tx)
			}
		}
	}

	fmt.Printf("IBKR Import: Parsed %d transactions\n", len(transactions))
	return transactions, nil
}

func (i *IBKRImporter) findCol(header []string, name string) int {
	for idx, val := range header {
		if val == name {
			return idx
		}
	}
	return -1
}

func (i *IBKRImporter) parseTradeRow(header []string, row []string) (models.Transaction, error) {
	symbolIdx := i.findCol(header, "Symbol")
	dateIdx := i.findCol(header, "DateTime")
	qtyIdx := i.findCol(header, "Quantity")
	priceIdx := i.findCol(header, "TradePrice")
	commIdx := i.findCol(header, "IBCommission")
	currIdx := i.findCol(header, "CurrencyPrimary")
	sideIdx := i.findCol(header, "Buy/Sell")
	assetClassIdx := i.findCol(header, "AssetClass")

	if symbolIdx == -1 || dateIdx == -1 || qtyIdx == -1 || row[symbolIdx] == "" || row[symbolIdx] == "Symbol" {
		return models.Transaction{}, fmt.Errorf("invalid row")
	}

	// Skip non-stock trades (like FX conversions which show up as CASH)
	if assetClassIdx != -1 && row[assetClassIdx] != "STK" {
		return models.Transaction{}, fmt.Errorf("not a stock")
	}

	qty, _ := strconv.ParseFloat(strings.ReplaceAll(row[qtyIdx], "\"", ""), 64)
	price, _ := strconv.ParseFloat(strings.ReplaceAll(row[priceIdx], "\"", ""), 64)
	comm, _ := strconv.ParseFloat(strings.ReplaceAll(row[commIdx], "\"", ""), 64)
	if comm < 0 {
		comm = -comm
	}

	txType := models.Buy
	side := strings.ToUpper(row[sideIdx])
	if strings.Contains(side, "SELL") {
		txType = models.Sell
	}
	if qty < 0 {
		qty = -qty
	}

	dateStr := strings.ReplaceAll(row[dateIdx], "\"", "")
	// Format in your file: "20251007;031231"
	date, err := time.Parse("20060102;150405", dateStr)
	if err != nil {
		// Try date only
		date, _ = time.Parse("20060102", strings.Split(dateStr, ";")[0])
	}

	totalAmount := (qty * price)
	if txType == models.Sell {
		totalAmount = -totalAmount // Cash inflow
	}

	symbol := normalizeTicker(row[symbolIdx])
	return models.Transaction{
		Broker:      models.IBKR,
		Symbol:      symbol,
		Type:        txType,
		Date:        date,
		Quantity:    qty,
		Price:       price,
		Currency:    row[currIdx],
		Commission:  comm,
		TotalAmount: totalAmount,
		ExternalID:  fmt.Sprintf("IBKR-TR-%s-%s-%f", symbol, dateStr, qty),
	}, nil
}

func (i *IBKRImporter) parseDividendRow(header []string, row []string) (models.Transaction, error) {
	symbolIdx := i.findCol(header, "Symbol")
	dateIdx := i.findCol(header, "PayDate")
	netAmountIdx := i.findCol(header, "NetAmount")
	grossAmountIdx := i.findCol(header, "GrossAmount")
	taxIdx := i.findCol(header, "Tax")
	currIdx := i.findCol(header, "CurrencyPrimary")
	codeIdx := i.findCol(header, "Code")

	if symbolIdx == -1 || dateIdx == -1 || netAmountIdx == -1 || row[symbolIdx] == "" || row[symbolIdx] == "Symbol" {
		return models.Transaction{}, fmt.Errorf("invalid row")
	}

	if codeIdx != -1 && row[codeIdx] == "Re" {
		return models.Transaction{}, fmt.Errorf("reversal")
	}

	net, _ := strconv.ParseFloat(strings.ReplaceAll(row[netAmountIdx], "\"", ""), 64)
	gross, _ := strconv.ParseFloat(strings.ReplaceAll(row[grossAmountIdx], "\"", ""), 64)
	tax, _ := strconv.ParseFloat(strings.ReplaceAll(row[taxIdx], "\"", ""), 64)
	
	// Standardize tax to absolute positive value
	if tax < 0 {
		tax = -tax
	}
	
	dateStr := strings.ReplaceAll(row[dateIdx], "\"", "")
	date, _ := time.Parse("20060102", dateStr)

	if net == 0 && gross == 0 {
		return models.Transaction{}, fmt.Errorf("zero amount")
	}

	// We'll store the Net as TotalAmount, but we can also create a separate Tax transaction 
	// to ensure the calculator picks it up for the "Gross/Tax/Net" view.
	// However, to keep it simple, if Tax is present in the same row, 
	// let's ensure the calculator knows how to handle a single Dividend row with Tax.
	
	symbol := normalizeTicker(row[symbolIdx])
	return models.Transaction{
		Broker:      models.IBKR,
		Symbol:      symbol,
		Type:        models.Dividend,
		Date:        date,
		TotalAmount: net,
		Tax:         tax, // New field usage
		Currency:    row[currIdx],
		ExternalID:  fmt.Sprintf("IBKR-DIV-%s-%s-%f", symbol, dateStr, net),
	}, nil
}

func (i *IBKRImporter) parseTaxRow(header []string, row []string) (models.Transaction, error) {
	symbolIdx := i.findCol(header, "Symbol")
	dateIdx := i.findCol(header, "Date")
	amountIdx := i.findCol(header, "Amount")
	currIdx := i.findCol(header, "CurrencyPrimary")

	if symbolIdx == -1 || dateIdx == -1 || amountIdx == -1 || row[symbolIdx] == "" || row[symbolIdx] == "Symbol" {
		return models.Transaction{}, fmt.Errorf("invalid row")
	}

	amount, _ := strconv.ParseFloat(strings.ReplaceAll(row[amountIdx], "\"", ""), 64)
	dateStr := strings.ReplaceAll(row[dateIdx], "\"", "")
	date, _ := time.Parse("20060102", dateStr)

	if amount == 0 {
		return models.Transaction{}, fmt.Errorf("zero amount")
	}

	return models.Transaction{
		Broker:      models.IBKR,
		Symbol:      row[symbolIdx],
		Type:        models.Tax,
		Date:        date,
		TotalAmount: amount,
		Currency:    row[currIdx],
		ExternalID:  fmt.Sprintf("IBKR-TAX-%s-%s-%f", row[symbolIdx], dateStr, amount),
	}, nil
}
