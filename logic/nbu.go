package logic

import (
	"encoding/json"
	"fmt"
	"net/http"
	"stocks/db"
	"stocks/models"
	"time"

	"gorm.io/gorm"
)

type NBUExchangeRate struct {
	Txt      string  `json:"txt"`
	Rate     float64 `json:"rate"`
	Cc       string  `json:"cc"`
	Exchangedate string `json:"exchangedate"`
}

func GetNBURate(currency string, date time.Time) (float64, error) {
	if currency == "UAH" || currency == "" {
		return 1.0, nil
	}

	// Normalize date to 00:00:00 UTC
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)

	// Check DB first
	var ex models.ExchangeRate
	err := db.DB.Where("currency = ? AND date = ?", currency, date).First(&ex).Error
	if err == nil {
		return ex.Rate, nil
	}

	if err != gorm.ErrRecordNotFound {
		return 0, err
	}

	// If not found, try to fetch from NBU for this specific date
	err = SyncRatesForDate(date)
	if err != nil {
		fmt.Printf("Warning: Failed to sync NBU rates for %s: %v. Trying previous date...\n", date.Format("2006-01-02"), err)
	}

	// Try finding again after sync
	err = db.DB.Where("currency = ? AND date = ?", currency, date).First(&ex).Error
	if err == nil {
		return ex.Rate, nil
	}

	// If still not found (might be a weekend/holiday where NBU doesn't publish), 
	// find the latest available rate BEFORE this date
	err = db.DB.Where("currency = ? AND date < ?", currency, date).Order("date desc").First(&ex).Error
	if err == nil {
		fmt.Printf("Using fallback rate for %s from %s: %f\n", currency, ex.Date.Format("2006-01-02"), ex.Rate)
		return ex.Rate, nil
	}

	return 0, fmt.Errorf("no rate found for %s on or before %s", currency, date.Format("2006-01-02"))
}

func SyncRatesForDate(date time.Time) error {
	dateStr := date.Format("20060102")
	url := fmt.Sprintf("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=%s&json", dateStr)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("NBU API returned status %d", resp.StatusCode)
	}

	var nbuRates []NBUExchangeRate
	if err := json.NewDecoder(resp.Body).Decode(&nbuRates); err != nil {
		return err
	}

	for _, nr := range nbuRates {
		ex := models.ExchangeRate{
			Currency: nr.Cc,
			Date:     date,
			Rate:     nr.Rate,
		}
		// If exists (match by unique index currency+date), update the rate. Otherwise create.
		db.DB.Where(models.ExchangeRate{Currency: nr.Cc, Date: date}).
			Assign(models.ExchangeRate{Rate: nr.Rate}).
			FirstOrCreate(&ex)
	}

	return nil
}

func SyncRatesForPeriod(from, to time.Time) error {
	// Loop through every day in the period
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		err := SyncRatesForDate(d)
		if err != nil {
			fmt.Printf("Error syncing rates for %s: %v\n", d.Format("2006-01-02"), err)
			continue
		}
		// Small delay to be nice to NBU API
		time.Sleep(100 * time.Millisecond)
	}
	return nil
}
