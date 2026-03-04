package callback

import (
	"github.com/gin-gonic/gin"
)

// Response is the unified API response format.
type Response struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

// Success sends a 200 response with code 0.
func Success(ctx *gin.Context, data interface{}) {
	ctx.JSON(CodeSuccess.HTTP, Response{
		Code: CodeSuccess.Biz,
		Msg:  "ok",
		Data: data,
	})
}

// Error sends an HTTP response using the Code's HTTP status and business code.
func Error(ctx *gin.Context, code Code, msg string) {
	ctx.JSON(code.HTTP, Response{
		Code: code.Biz,
		Msg:  msg,
	})
}
