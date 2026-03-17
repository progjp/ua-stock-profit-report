package importer

import (
	"stocks/models"
	"io"
)

type Importer interface {
	Parse(reader io.Reader) ([]models.Transaction, error)
}
