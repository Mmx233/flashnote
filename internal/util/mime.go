package util

import (
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
)

// DetectFileMIME reads the first 512 bytes of a multipart file to detect its real MIME type.
func DetectFileMIME(file *multipart.FileHeader) (string, error) {
	f, err := file.Open()
	if err != nil {
		return "", err
	}
	defer f.Close()

	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return "", err
	}
	return http.DetectContentType(buf[:n]), nil
}

// MIMEToExt returns a file extension for the given MIME type.
func MIMEToExt(mimeType string) (string, error) {
	exts, _ := mime.ExtensionsByType(mimeType)
	if len(exts) > 0 {
		return exts[0], nil
	}
	return "", fmt.Errorf("no extension found for MIME type %q", mimeType)
}
