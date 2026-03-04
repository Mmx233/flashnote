package callback

import (
	"errors"
	"fmt"

	"github.com/gin-gonic/gin"
)

// Response is the unified API response format.
type Response struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

// BizError is an error that carries a Code for direct API response.
type BizError struct {
	code Code
	msg  string
}

func NewBizError(code Code, msg string) *BizError {
	return &BizError{code: code, msg: msg}
}

func (e *BizError) Error() string {
	return fmt.Sprintf("[%d] %s", e.code.Biz, e.msg)
}

// Success sends a 200 response with code 0.
func Success(ctx *gin.Context, data interface{}) {
	ctx.JSON(CodeSuccess.HTTP, Response{
		Code: CodeSuccess.Biz,
		Msg:  "ok",
		Data: data,
	})
}

// Error sends an HTTP error response and aborts the handler chain.
func Error(ctx *gin.Context, code Code, msg string) {
	ctx.AbortWithStatusJSON(code.HTTP, Response{
		Code: code.Biz,
		Msg:  msg,
	})
}

// HandleError checks if err is a BizError and writes the appropriate response.
// For unknown errors it falls back to 500.
func HandleError(ctx *gin.Context, err error) {
	var bizErr *BizError
	if errors.As(err, &bizErr) {
		Error(ctx, bizErr.code, bizErr.msg)
	} else {
		Error(ctx, CodeInternalError, "internal server error")
	}
}
