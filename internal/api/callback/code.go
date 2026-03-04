package callback

import "net/http"

// Code bundles a business error code with its corresponding HTTP status.
type Code struct {
	HTTP int
	Biz  int
}

var (
	CodeSuccess       = Code{HTTP: http.StatusOK, Biz: 0}
	CodeBadRequest    = Code{HTTP: http.StatusBadRequest, Biz: 400}
	CodeNotFound      = Code{HTTP: http.StatusNotFound, Biz: 404}
	CodeFileTooLarge  = Code{HTTP: http.StatusRequestEntityTooLarge, Biz: 413}
	CodeInternalError = Code{HTTP: http.StatusInternalServerError, Biz: 500}
)
