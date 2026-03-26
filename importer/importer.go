package importer

import (
	"stocks/models"
	"io"
	"strings"
)

type Importer interface {
	Parse(reader io.Reader) ([]models.Transaction, error)
}

func normalizeTicker(ticker string) string {
	ticker = strings.ToUpper(ticker)
	// Remove common exchange suffixes
	suffixes := []string{".DE", ".US", ".EU", ".UK", ".L", ".MC", ".PA", ".AS", ".MI"}
	for _, s := range suffixes {
		if strings.HasSuffix(ticker, s) {
			return strings.TrimSuffix(ticker, s)
		}
	}
	
	// Special case for "RHMd" (likely Xetra/German dividend-related notation or broker specific)
	if strings.HasPrefix(ticker, "RHM") && len(ticker) > 3 {
		return "RHM"
	}

	return ticker
}
